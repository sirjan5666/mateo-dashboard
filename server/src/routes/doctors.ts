import { Router } from 'express';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { DoctorProfile } from '../models/DoctorProfile.js';
import type { IDoctorProfile } from '../models/DoctorProfile.js';
import { Consultation } from '../models/Consultation.js';
import { DoctorReview } from '../models/DoctorReview.js';
import { User } from '../models/User.js';
import type { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadPhoto, uploadsDir } from '../middleware/upload.js';
import { generateSlots } from '../doctors/slots.js';
import { decryptOptional } from '../lib/crypto/fieldCipher.js';

const router = Router();

// Average rating + review count per doctor (by their user id).
async function ratingStats(doctorUserIds: Types.ObjectId[]): Promise<Map<string, { avg: number; count: number }>> {
  const rows = await DoctorReview.aggregate<{ _id: Types.ObjectId; avg: number; count: number }>([
    { $match: { doctorUserId: { $in: doctorUserIds } } },
    { $group: { _id: '$doctorUserId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { avg: Math.round(r.avg * 10) / 10, count: r.count }]));
}

const availabilitySchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  slotMinutes: z.number().int().min(5).max(120),
});

const dayHoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  closed: z.boolean(),
});
const workingHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
});
const bankDetailsSchema = z.object({
  accountHolder: z.string().trim().max(120),
  accountNumber: z.string().trim().max(40),
  ifsc: z.string().trim().max(20),
  bankName: z.string().trim().max(120),
});
const notificationsSchema = z.object({ email: z.boolean(), sms: z.boolean(), reminders: z.boolean() });

const profileSchema = z.object({
  specialization: z.string().trim().min(2).max(80),
  qualifications: z.string().trim().max(160).optional().default(''),
  experienceYears: z.number().int().min(0).max(80).optional().default(0),
  registrationNo: z.string().trim().max(60).optional().default(''),
  bio: z.string().trim().max(1000).optional().default(''),
  consultationFee: z.number().int().min(0).max(100000),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).optional().default([]),
  clinicName: z.string().trim().max(120).optional(),
  clinicAddress: z.string().trim().max(300).optional(),
  city: z.string().trim().max(80).optional(),
  availability: availabilitySchema.optional(),
  workingHours: workingHoursSchema.optional(),
  notifications: notificationsSchema.optional(),
  bankDetails: bankDetailsSchema.optional(),
});

// Decrypt the payout-banking blob for the owner's own view only.
function decryptBank(enc?: string) {
  const json = decryptOptional(enc || undefined);
  if (!json) return null;
  try {
    return JSON.parse(json) as z.infer<typeof bankDetailsSchema>;
  } catch {
    return null;
  }
}

// The doctor's own view — includes approval status.
function publicSelf(p: IDoctorProfile & { id: string }, name: string) {
  return {
    id: p.id,
    name,
    specialization: p.specialization,
    qualifications: p.qualifications,
    experienceYears: p.experienceYears,
    registrationNo: p.registrationNo,
    bio: p.bio,
    consultationFee: p.consultationFee,
    languages: p.languages,
    clinicName: p.clinicName ?? null,
    clinicAddress: p.clinicAddress ?? null,
    city: p.city ?? null,
    availability: p.availability,
    workingHours: p.workingHours ?? null,
    notifications: p.notifications ?? { email: true, sms: false, reminders: true },
    bankDetails: decryptBank(p.bankDetailsEnc),
    hasPaymentQr: !!p.paymentQrFile,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// What a parent sees in the directory — no status, no contact details.
function publicListing(p: IDoctorProfile & { id: string }, name: string) {
  return {
    id: p.id,
    name,
    specialization: p.specialization,
    qualifications: p.qualifications,
    experienceYears: p.experienceYears,
    registrationNo: p.registrationNo,
    bio: p.bio,
    consultationFee: p.consultationFee,
    languages: p.languages,
    clinicName: p.clinicName ?? null,
    city: p.city ?? null,
    availability: p.availability,
  };
}

// ── Doctor's own profile ───────────────────────────────────────────────
router.get('/doctors/me', requireAuth, requireRole('doctor'), async (req, res) => {
  const profile = await DoctorProfile.findOne({ userId: req.userId });
  res.json({ profile: profile ? publicSelf(profile, req.authUser!.name) : null });
});

router.put('/doctors/me', requireAuth, requireRole('doctor'), async (req, res) => {
  const body = profileSchema.parse(req.body);
  // Bank details are encrypted separately (bankDetailsEnc) — never set as a plain field.
  const { bankDetails, ...rest } = body;
  const existing = await DoctorProfile.findOne({ userId: req.userId });
  // No admin approval step right now — profiles go live on save. When the admin
  // panel returns, gate visibility behind 'pending' → admin approval again.
  if (existing) {
    // Specialization + medical registration number are FIXED after creation
    // (the doctor form disables them; enforce here too so a raw API call can't
    // change them). registrationNo locks only once it has actually been set.
    rest.specialization = existing.specialization;
    if (existing.registrationNo) rest.registrationNo = existing.registrationNo;
    existing.set(rest);
    if (bankDetails) existing.bankDetailsEnc = JSON.stringify(bankDetails); // encrypted on save
    existing.status = 'approved';
    await existing.save();
    res.json({ profile: publicSelf(existing, req.authUser!.name) });
    return;
  }
  const created = await DoctorProfile.create({
    userId: req.userId,
    ...rest,
    bankDetailsEnc: bankDetails ? JSON.stringify(bankDetails) : undefined,
    status: 'approved',
  });
  res.status(201).json({ profile: publicSelf(created, req.authUser!.name) });
});

// Quick speciality switch (from the dashboard header) — updates ONLY the
// specialization so a doctor can re-point their whole dashboard without
// re-submitting the full profile form. New patient records follow this speciality.
const specSchema = z.object({ specialization: z.string().trim().min(1).max(100) });
router.patch('/doctors/me/specialization', requireAuth, requireRole('doctor'), async (req, res) => {
  specSchema.parse(req.body); // validate shape, but changes are no longer allowed
  const existing = await DoctorProfile.findOne({ userId: req.userId });
  if (!existing) {
    res.status(400).json({ error: 'Complete your doctor profile before setting a speciality.' });
    return;
  }
  // Specialization is fixed after the profile is created — this switch is disabled.
  res.status(403).json({ error: 'Specialization cannot be changed after your profile is created. Contact Mateo support if this needs correcting.' });
});

// ── Payment QR (spec #8) ───────────────────────────────────────────────
// The doctor uploads their own UPI/payment QR (a GPay/PhonePe/Paytm image) in
// Settings; it is shown in the collect-payment flow for the patient to scan.
// Stored like other uploads (server-generated filename under uploadsDir) and
// streamed back only to the authenticated owner.
router.post('/doctors/me/payment-qr', requireAuth, requireRole('doctor'), uploadPhoto, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image uploaded' });
    return;
  }
  const profile = await DoctorProfile.findOne({ userId: req.userId });
  if (!profile) {
    // Don't leave an orphaned file if there's no profile to attach it to.
    await unlink(path.resolve(uploadsDir, req.file.filename)).catch(() => {});
    res.status(400).json({ error: 'Complete your doctor profile before adding a payment QR.' });
    return;
  }
  const previous = profile.paymentQrFile;
  profile.paymentQrFile = req.file.filename;
  await profile.save();
  // Best-effort cleanup of the replaced image.
  if (previous && previous !== req.file.filename) {
    await unlink(path.resolve(uploadsDir, previous)).catch(() => {});
  }
  res.status(201).json({ hasPaymentQr: true });
});

router.get('/doctors/me/payment-qr', requireAuth, requireRole('doctor'), async (req, res) => {
  const profile = await DoctorProfile.findOne({ userId: req.userId });
  if (!profile?.paymentQrFile) {
    res.status(404).json({ error: 'No payment QR uploaded' });
    return;
  }
  // Filenames are server-generated UUIDs; resolve + prefix-check to be certain
  // the path stays inside uploadsDir.
  const full = path.resolve(uploadsDir, profile.paymentQrFile);
  if (!full.startsWith(path.resolve(uploadsDir))) {
    res.status(400).json({ error: 'Bad path' });
    return;
  }
  res.setHeader('Cache-Control', 'private, no-cache');
  res.sendFile(full);
});

router.delete('/doctors/me/payment-qr', requireAuth, requireRole('doctor'), async (req, res) => {
  const profile = await DoctorProfile.findOne({ userId: req.userId });
  if (profile?.paymentQrFile) {
    const file = profile.paymentQrFile;
    profile.paymentQrFile = undefined;
    await profile.save();
    await unlink(path.resolve(uploadsDir, file)).catch(() => {});
  }
  res.json({ hasPaymentQr: false });
});

// ── Parent-facing directory ────────────────────────────────────────────
router.get('/doctors', requireAuth, async (_req, res) => {
  const profiles = await DoctorProfile.find({ status: 'approved' }).sort({ experienceYears: -1, createdAt: -1 }).limit(200);
  const users = await User.find({ _id: { $in: profiles.map((p) => p.userId) } }).select('name');
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const stats = await ratingStats(profiles.map((p) => p.userId));
  res.json({
    doctors: profiles.map((p) => {
      const s = stats.get(p.userId.toString());
      return { ...publicListing(p, nameById.get(p.userId.toString()) ?? 'Doctor'), avgRating: s?.avg ?? null, reviewCount: s?.count ?? 0 };
    }),
  });
});

router.get('/doctors/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const profile = isValidObjectId(id) ? await DoctorProfile.findById(id) : null;
  if (!profile || profile.status !== 'approved') {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }
  const user = await User.findById(profile.userId).select('name');
  const stats = await ratingStats([profile.userId]);
  const s = stats.get(profile.userId.toString());
  res.json({ doctor: { ...publicListing(profile, user?.name ?? 'Doctor'), avgRating: s?.avg ?? null, reviewCount: s?.count ?? 0 } });
});

// Recent reviews for a doctor (first name only, for privacy).
router.get('/doctors/:id/reviews', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const profile = isValidObjectId(id) ? await DoctorProfile.findById(id) : null;
  if (!profile) {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }
  const reviews = await DoctorReview.find({ doctorProfileId: profile._id }).sort({ createdAt: -1 }).limit(50);
  const parents = await User.find({ _id: { $in: reviews.map((r) => r.parentUserId) } }).select('name');
  const nameById = new Map(parents.map((u) => [u.id, u.name]));
  res.json({
    reviews: reviews
      .filter((r) => r.comment)
      .map((r) => ({
        rating: r.rating,
        comment: r.comment ?? null,
        createdAt: r.createdAt,
        reviewer: (nameById.get(r.parentUserId.toString()) ?? 'A parent').split(' ')[0],
      })),
  });
});

router.get('/doctors/:id/slots', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const profile = isValidObjectId(id) ? await DoctorProfile.findById(id) : null;
  if (!profile || profile.status !== 'approved') {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }
  const taken = await Consultation.find({
    doctorUserId: profile.userId,
    status: { $in: ['booked', 'completed'] },
    slotStart: { $gte: new Date() },
  }).select('slotStart');
  const booked = new Set(taken.map((c) => c.slotStart.toISOString()));
  res.json({ days: generateSlots(profile.availability, booked) });
});

export default router;
