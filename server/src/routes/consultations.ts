import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { Consultation } from '../models/Consultation.js';
import type { IConsultation } from '../models/Consultation.js';
import { ConsultationMessage } from '../models/ConsultationMessage.js';
import type { IConsultationMessage } from '../models/ConsultationMessage.js';
import { Prescription } from '../models/Prescription.js';
import type { IPrescription } from '../models/Prescription.js';
import { DoctorReview } from '../models/DoctorReview.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { Baby } from '../models/Baby.js';
import type { IBaby } from '../models/Baby.js';
import { User } from '../models/User.js';
import { VaccineDose } from '../models/VaccineDose.js';
import { GrowthLog } from '../models/GrowthLog.js';
import { SymptomLog } from '../models/SymptomLog.js';
import { FeedLog } from '../models/FeedLog.js';
import { DiaperLog } from '../models/DiaperLog.js';
import { Allergy } from '../models/Allergy.js';
import { MilestoneAchievement } from '../models/MilestoneAchievement.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadImage, uploadsDir } from '../middleware/upload.js';
import { slotIsValid, slotEndFor } from '../doctors/slots.js';
import { doseStatus, istToday } from '../vaccines/schedule.js';
import { computePercentile } from '../growth/percentile.js';
import type { Sex } from '../growth/percentile.js';
import { assessSymptoms } from '../health/symptoms.js';
import { istDateString } from '../lib/ist.js';
import { milestoneById } from '../milestones/milestones.js';
import { checkRedFlags } from '../ai/red-flags.js';
import type { RedFlagContext } from '../ai/red-flags.js';
import { babyAge } from '../ai/context.js';

const router = Router();

const bookSchema = z.object({
  doctorId: z.string(),
  babyId: z.string().optional(),
  slotStart: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid slot'),
  reason: z.string().trim().max(1000).optional().default(''),
});

const patchSchema = z.object({ status: z.enum(['completed', 'cancelled']) });

// Deterministic red-flag pre-screen for the booking concern box. The matching
// engine lives in ai/red-flags.ts (CLAUDE.md hard rule 2) — here we only run it
// with the (owned) baby's age so a parent describing an emergency is steered to
// urgent care before waiting for a consultation slot.
const concernSchema = z.object({
  text: z.string().trim().max(2000),
  babyId: z.string().optional(),
});

router.post('/consultations/concern-check', requireAuth, async (req, res) => {
  const { text, babyId } = concernSchema.parse(req.body);
  let ctx: RedFlagContext = {};
  if (babyId && isValidObjectId(babyId)) {
    const baby = await Baby.findOne({ _id: babyId, userId: req.userId });
    if (baby) {
      const age = babyAge(baby.dob);
      ctx = { ageDays: age.ageDays, ageMonths: age.ageMonths };
    }
  }
  const r = checkRedFlags(text, ctx);
  res.json({
    triggered: r.triggered,
    severity: r.severity ?? null,
    category: r.category ?? null,
    response: r.response ?? null,
  });
});

// Enrich a set of consultations with the names of both parties + baby.
async function enrich(consults: HydratedDocument<IConsultation>[]) {
  const userIds = new Set<string>();
  const babyIds = new Set<string>();
  for (const c of consults) {
    userIds.add(c.parentUserId.toString());
    userIds.add(c.doctorUserId.toString());
    if (c.babyId) babyIds.add(c.babyId.toString());
  }
  const [users, babies] = await Promise.all([
    User.find({ _id: { $in: [...userIds] } }).select('name'),
    Baby.find({ _id: { $in: [...babyIds] } }).select('name'),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const babyName = new Map(babies.map((b) => [b.id, b.name]));
  return consults.map((c) => ({
    id: c.id,
    slotStart: c.slotStart,
    slotEnd: c.slotEnd,
    reason: c.reason,
    status: c.status,
    payment: c.payment,
    meetLink: c.meetLink ?? null,
    doctor: { profileId: c.doctorProfileId.toString(), name: userName.get(c.doctorUserId.toString()) ?? 'Doctor' },
    parent: { name: userName.get(c.parentUserId.toString()) ?? 'Parent' },
    baby: c.babyId ? { id: c.babyId.toString(), name: babyName.get(c.babyId.toString()) ?? null } : null,
    createdAt: c.createdAt,
  }));
}

// ── Parent books a consultation (mock payment) ─────────────────────────
router.post('/consultations', requireAuth, requireRole('parent'), async (req, res) => {
  const { doctorId, babyId, slotStart, reason } = bookSchema.parse(req.body);

  const profile = isValidObjectId(doctorId) ? await DoctorProfile.findById(doctorId) : null;
  if (!profile || profile.status !== 'approved') {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }

  let babyDoc: HydratedDocument<IBaby> | null = null;
  if (babyId) {
    babyDoc = isValidObjectId(babyId) ? await Baby.findById(babyId) : null;
    if (!babyDoc || babyDoc.userId.toString() !== req.userId) {
      res.status(403).json({ error: 'You do not have access to this baby' });
      return;
    }
  }

  // Server-side red-flag backstop (CLAUDE.md hard rule 2). The client pre-screen is
  // advisory and can be raced (booked before the debounced check resolves) or fail
  // open (network error). Re-run the deterministic check here so an emergency concern
  // is steered to urgent care instead of booked — authoritatively, for every client.
  if (reason.trim()) {
    let ctx: RedFlagContext = {};
    if (babyDoc) {
      const age = babyAge(babyDoc.dob);
      ctx = { ageDays: age.ageDays, ageMonths: age.ageMonths };
    }
    const rf = checkRedFlags(reason, ctx);
    if (rf.triggered && rf.severity === 'emergency') {
      // 422 (not 409) so the client distinguishes this from a slot conflict.
      res.status(422).json({ error: rf.response, code: 'urgent_care' });
      return;
    }
  }

  if (!slotIsValid(profile.availability, slotStart)) {
    res.status(400).json({ error: 'That time slot is not available. Please pick another.' });
    return;
  }

  try {
    const consult = await Consultation.create({
      parentUserId: req.userId,
      doctorUserId: profile.userId,
      doctorProfileId: profile._id,
      babyId: babyId || undefined,
      slotStart: new Date(slotStart),
      slotEnd: new Date(slotEndFor(profile.availability, slotStart)),
      reason,
      status: 'booked',
      // Payment is mocked for now — booking marks it paid.
      payment: { amount: profile.consultationFee, status: 'paid', method: 'mock', paidAt: new Date() },
    });
    const [pub] = await enrich([consult]);
    res.status(201).json({ consultation: pub });
  } catch (err) {
    if (err && typeof err === 'object' && (err as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'That slot was just booked. Please pick another.' });
      return;
    }
    throw err;
  }
});

// ── List my consultations (works for both parent and doctor) ───────────
router.get('/consultations', requireAuth, async (req, res) => {
  const me = req.userId;
  const consults = await Consultation.find({ $or: [{ parentUserId: me }, { doctorUserId: me }] }).sort({ slotStart: 1 });
  res.json({ consultations: await enrich(consults) });
});

// ── Parent's follow-ups (prescriptions with a follow-up date) for rebooking ──
router.get('/follow-ups', requireAuth, requireRole('parent'), async (req, res) => {
  const prescriptions = await Prescription.find({ parentUserId: req.userId, followUpDate: { $exists: true, $ne: null } })
    .sort({ followUpDate: 1 })
    .limit(50);
  if (prescriptions.length === 0) {
    res.json({ followUps: [] });
    return;
  }
  const consultIds = prescriptions.map((p) => p.consultationId).filter((c): c is NonNullable<typeof c> => c != null);
  const doctorIds = prescriptions.map((p) => p.doctorUserId).filter((d): d is NonNullable<typeof d> => d != null);
  const babyIds = prescriptions.map((p) => p.babyId).filter((b): b is NonNullable<typeof b> => b != null);
  const consults = await Consultation.find({ _id: { $in: consultIds } }).select('doctorProfileId');
  const profileByConsult = new Map(consults.map((c) => [c.id, c.doctorProfileId.toString()]));
  const [doctors, babies] = await Promise.all([
    User.find({ _id: { $in: doctorIds } }).select('name'),
    Baby.find({ _id: { $in: babyIds } }).select('name'),
  ]);
  const docName = new Map(doctors.map((u) => [u.id, u.name]));
  const babyName = new Map(babies.map((b) => [b.id, b.name]));
  res.json({
    followUps: prescriptions.map((p) => ({
      prescriptionId: p.id,
      followUpDate: p.followUpDate,
      doctorName: p.doctorUserId ? docName.get(p.doctorUserId.toString()) ?? 'Doctor' : 'Doctor',
      doctorProfileId: p.consultationId ? profileByConsult.get(p.consultationId.toString()) ?? null : null,
      babyId: p.babyId?.toString() ?? null,
      babyName: p.babyId ? babyName.get(p.babyId.toString()) ?? null : null,
    })),
  });
});

// ── A single consultation (must be a participant) ──────────────────────
router.get('/consultations/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const consult = isValidObjectId(id) ? await Consultation.findById(id) : null;
  if (!consult || (consult.parentUserId.toString() !== req.userId && consult.doctorUserId.toString() !== req.userId)) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  const [pub] = await enrich([consult]);
  res.json({ consultation: pub });
});

// ── Update status: doctor completes/cancels, parent cancels ────────────
router.patch('/consultations/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const { status } = patchSchema.parse(req.body);
  const consult = isValidObjectId(id) ? await Consultation.findById(id) : null;
  if (!consult) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  const isParent = consult.parentUserId.toString() === req.userId;
  const isDoctor = consult.doctorUserId.toString() === req.userId;
  if (!isParent && !isDoctor) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  if (consult.status !== 'booked') {
    res.status(400).json({ error: `This consultation is already ${consult.status}.` });
    return;
  }
  // Only the doctor can mark a consultation completed.
  if (status === 'completed' && !isDoctor) {
    res.status(403).json({ error: 'Only the doctor can complete a consultation.' });
    return;
  }
  consult.status = status;
  await consult.save();
  const [pub] = await enrich([consult]);
  res.json({ consultation: pub });
});

// ── Doctor sets/clears the video-call link (Google Meet, etc.) ─────────
const meetLinkSchema = z.object({
  meetLink: z.union([z.string().trim().url('Enter a valid meeting link (https://…)'), z.literal('')]),
});

router.put('/consultations/:id/meet-link', requireAuth, async (req, res) => {
  const ctx = await loadParticipant(req.userId, String(req.params.id));
  if (!ctx) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  if (ctx.role !== 'doctor') {
    res.status(403).json({ error: 'Only the doctor can set the meeting link.' });
    return;
  }
  const { meetLink } = meetLinkSchema.parse(req.body);
  ctx.consult.meetLink = meetLink || undefined;
  await ctx.consult.save();
  const [pub] = await enrich([ctx.consult]);
  res.json({ consultation: pub });
});

// ── Doctor ↔ parent chat (per consultation) ────────────────────────────
type Participant = { consult: HydratedDocument<IConsultation>; role: 'parent' | 'doctor' } | null;

// Load a consultation and the requester's role in it (null if not a participant).
async function loadParticipant(userId: string | undefined, id: string): Promise<Participant> {
  if (!isValidObjectId(id)) return null;
  const consult = await Consultation.findById(id);
  if (!consult) return null;
  if (consult.parentUserId.toString() === userId) return { consult, role: 'parent' };
  if (consult.doctorUserId.toString() === userId) return { consult, role: 'doctor' };
  return null;
}

function handleImageUpload(req: Request, res: Response, next: NextFunction): void {
  uploadImage(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      return;
    }
    next();
  });
}

function publicMessage(m: IConsultationMessage & { id: string }, consultId: string) {
  return {
    id: m.id,
    senderRole: m.senderRole,
    text: m.text,
    imageUrl: m.imageFile ? `/api/consultations/${consultId}/messages/${m.id}/image` : null,
    createdAt: m.createdAt,
  };
}

router.get('/consultations/:id/messages', requireAuth, async (req, res) => {
  const ctx = await loadParticipant(req.userId, String(req.params.id));
  if (!ctx) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  const msgs = await ConsultationMessage.find({ consultationId: ctx.consult._id }).sort({ createdAt: 1 }).limit(500);
  res.json({ messages: msgs.map((m) => publicMessage(m, ctx.consult.id)), role: ctx.role });
});

router.post('/consultations/:id/messages', requireAuth, handleImageUpload, async (req, res) => {
  const ctx = await loadParticipant(req.userId, String(req.params.id));
  const cleanup = async () => {
    if (req.file) await unlink(req.file.path).catch(() => {});
  };
  if (!ctx) {
    await cleanup();
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  const text = typeof req.body.text === 'string' ? req.body.text.trim().slice(0, 2000) : '';
  if (!text && !req.file) {
    res.status(400).json({ error: 'Message is empty' });
    return;
  }
  const msg = await ConsultationMessage.create({
    consultationId: ctx.consult._id,
    senderUserId: req.userId,
    senderRole: ctx.role,
    text,
    imageFile: req.file?.filename,
  });
  res.status(201).json({ message: publicMessage(msg, ctx.consult.id) });
});

router.get('/consultations/:id/messages/:messageId/image', requireAuth, async (req, res) => {
  const ctx = await loadParticipant(req.userId, String(req.params.id));
  if (!ctx) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const mid = String(req.params.messageId);
  const msg = isValidObjectId(mid) ? await ConsultationMessage.findById(mid) : null;
  if (!msg || msg.consultationId.toString() !== ctx.consult._id.toString() || !msg.imageFile) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }
  res.sendFile(path.join(uploadsDir, msg.imageFile));
});

// ── Prescriptions (doctor issues, both view) ───────────────────────────
const prescriptionSchema = z.object({
  diagnosis: z.string().trim().max(500).optional().default(''),
  items: z
    .array(
      z.object({
        medicine: z.string().trim().min(1).max(120),
        dosage: z.string().trim().max(80).optional().default(''),
        frequency: z.string().trim().max(80).optional().default(''),
        duration: z.string().trim().max(80).optional().default(''),
        notes: z.string().trim().max(200).optional(),
      }),
    )
    .min(1, 'Add at least one medicine')
    .max(30),
  advice: z.string().trim().max(2000).optional().default(''),
  followUpDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date').optional(),
});

// Compose the doctor + patient header (same for every prescription in a consult).
async function composePrescriptions(list: HydratedDocument<IPrescription>[], consult: HydratedDocument<IConsultation>) {
  if (list.length === 0) return [];
  const [doctorUser, profile, baby] = await Promise.all([
    User.findById(consult.doctorUserId).select('name'),
    DoctorProfile.findOne({ userId: consult.doctorUserId }),
    consult.babyId ? Baby.findById(consult.babyId) : Promise.resolve(null),
  ]);
  const doctor = {
    name: doctorUser?.name ?? 'Doctor',
    specialization: profile?.specialization ?? '',
    qualifications: profile?.qualifications ?? '',
    registrationNo: profile?.registrationNo ?? '',
    clinicName: profile?.clinicName ?? null,
  };
  const patient = baby ? { name: baby.name, dob: baby.dob, sex: baby.sex } : null;
  return list.map((rx) => ({
    id: rx.id,
    diagnosis: rx.diagnosis,
    items: rx.items,
    advice: rx.advice,
    followUpDate: rx.followUpDate ?? null,
    createdAt: rx.createdAt,
    doctor,
    patient,
  }));
}

router.post('/consultations/:id/prescription', requireAuth, async (req, res) => {
  const ctx = await loadParticipant(req.userId, String(req.params.id));
  if (!ctx) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  if (ctx.role !== 'doctor') {
    res.status(403).json({ error: 'Only the doctor can issue a prescription.' });
    return;
  }
  const body = prescriptionSchema.parse(req.body);
  const rx = await Prescription.create({
    consultationId: ctx.consult._id,
    doctorUserId: ctx.consult.doctorUserId,
    parentUserId: ctx.consult.parentUserId,
    babyId: ctx.consult.babyId,
    source: 'doctor',
    diagnosis: body.diagnosis,
    items: body.items,
    advice: body.advice,
    followUpDate: body.followUpDate ? new Date(body.followUpDate) : undefined,
  });
  const [pub] = await composePrescriptions([rx], ctx.consult);
  res.status(201).json({ prescription: pub });
});

router.get('/consultations/:id/prescriptions', requireAuth, async (req, res) => {
  const ctx = await loadParticipant(req.userId, String(req.params.id));
  if (!ctx) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  const list = await Prescription.find({ consultationId: ctx.consult._id }).sort({ createdAt: -1 });
  res.json({ prescriptions: await composePrescriptions(list, ctx.consult) });
});

// ── Rating & review (parent reviews the doctor, one per consultation) ──
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

router.get('/consultations/:id/review', requireAuth, async (req, res) => {
  const ctx = await loadParticipant(req.userId, String(req.params.id));
  if (!ctx) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  const review = await DoctorReview.findOne({ consultationId: ctx.consult._id });
  res.json({ review: review ? { rating: review.rating, comment: review.comment ?? null, createdAt: review.createdAt } : null });
});

router.post('/consultations/:id/review', requireAuth, async (req, res) => {
  const ctx = await loadParticipant(req.userId, String(req.params.id));
  if (!ctx) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  if (ctx.role !== 'parent') {
    res.status(403).json({ error: 'Only the parent can leave a review.' });
    return;
  }
  // A review is only meaningful after the consultation actually happened — gate
  // it on completion server-side (the client hides the form for the same reason).
  if (ctx.consult.status !== 'completed') {
    res.status(400).json({ error: 'You can review a doctor only after the consultation is completed.' });
    return;
  }
  const { rating, comment } = reviewSchema.parse(req.body);
  const review = await DoctorReview.findOneAndUpdate(
    { consultationId: ctx.consult._id },
    {
      $set: { rating, comment: comment ?? undefined },
      $setOnInsert: { doctorUserId: ctx.consult.doctorUserId, doctorProfileId: ctx.consult.doctorProfileId, parentUserId: req.userId },
    },
    { upsert: true, new: true },
  );
  res.status(201).json({ review: { rating: review.rating, comment: review.comment ?? null, createdAt: review.createdAt } });
});

// ── Doctor's clinical snapshot of the consulted baby (doctor participant only) ──
const MS_PER_MONTH = 30.4375 * 86_400_000;
router.get('/consultations/:id/baby-snapshot', requireAuth, async (req, res) => {
  const ctx = await loadParticipant(req.userId, String(req.params.id));
  if (!ctx) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  if (ctx.role !== 'doctor') {
    res.status(403).json({ error: 'Only the consulting doctor can view this.' });
    return;
  }
  const babyId = ctx.consult.babyId;
  const baby = babyId ? await Baby.findById(babyId) : null;
  if (!baby) {
    res.status(404).json({ error: 'No baby is attached to this consultation' });
    return;
  }
  const today = istToday();
  const todayStr = istDateString(new Date());
  const [doses, growth, symptoms, feeds, diapers, milestones, allergies] = await Promise.all([
    VaccineDose.find({ babyId: baby._id }).sort({ dueDate: 1 }),
    GrowthLog.find({ babyId: baby._id }).sort({ loggedAt: 1 }),
    SymptomLog.find({ babyId: baby._id }).sort({ loggedAt: -1 }).limit(5),
    FeedLog.find({ babyId: baby._id }),
    DiaperLog.find({ babyId: baby._id }),
    MilestoneAchievement.find({ babyId: baby._id }).sort({ achievedOn: -1 }).limit(5),
    Allergy.find({ babyId: baby._id }).sort({ createdAt: -1 }),
  ]);

  let done = 0;
  let due = 0;
  let overdue = 0;
  let next: (typeof doses)[number] | null = null;
  for (const d of doses) {
    const s = doseStatus(d, today);
    if (s === 'done') done++;
    else if (s === 'due') due++;
    else if (s === 'overdue') overdue++;
    if (s !== 'done' && (next === null || d.dueDate.getTime() < next.dueDate.getTime())) next = d;
  }

  const weights = growth.filter((g) => g.weightG != null);
  const latest = growth.length ? growth[growth.length - 1] : null;
  let weightPercentile: number | null = null;
  if (weights.length) {
    const lw = weights[weights.length - 1];
    const am = (lw.loggedAt.getTime() - baby.dob.getTime()) / MS_PER_MONTH;
    weightPercentile = Math.round(computePercentile('weight', baby.sex as Sex, am, lw.weightG! / 1000).percentile);
  }

  const onDay = (d: Date) => istDateString(d) === todayStr;
  res.json({
    baby: { name: baby.name, dob: baby.dob, sex: baby.sex },
    vaccines: {
      done,
      due,
      overdue,
      total: doses.length,
      next: next ? { vaccineName: next.vaccineName, doseLabel: next.doseLabel, dueDate: next.dueDate } : null,
    },
    growth: {
      latest: latest ? { loggedAt: latest.loggedAt, weightG: latest.weightG ?? null, lengthCm: latest.lengthCm ?? null, headCircCm: latest.headCircCm ?? null } : null,
      weightPercentile,
      points: weights.slice(-8).map((g) => ({ loggedAt: g.loggedAt, weightG: g.weightG! })),
    },
    symptoms: symptoms.map((s) => ({
      loggedAt: s.loggedAt,
      temperatureC: s.temperatureC ?? null,
      level: assessSymptoms({ temperatureC: s.temperatureC ?? null, symptoms: s.symptoms, ageDays: Math.floor((s.loggedAt.getTime() - baby.dob.getTime()) / 86_400_000) }).level,
    })),
    feeds: {
      feedsToday: feeds.filter((f) => onDay(f.loggedAt)).length,
      breastMinToday: feeds.filter((f) => onDay(f.loggedAt) && f.kind === 'breast').reduce((s, f) => s + (f.durationMin ?? 0), 0),
    },
    diapers: {
      wetToday: diapers.filter((d) => onDay(d.loggedAt) && (d.kind === 'wet' || d.kind === 'mixed')).length,
      dirtyToday: diapers.filter((d) => onDay(d.loggedAt) && (d.kind === 'dirty' || d.kind === 'mixed')).length,
    },
    milestones: milestones.map((m) => milestoneById.get(m.milestoneId)?.label ?? m.milestoneId),
    allergies: allergies.map((a) => ({ name: a.name, severity: a.severity, reaction: a.reaction ?? null })),
  });
});

export default router;
