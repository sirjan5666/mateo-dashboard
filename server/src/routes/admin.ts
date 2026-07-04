import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { Types } from 'mongoose';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Baby } from '../models/Baby.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { Consultation } from '../models/Consultation.js';
import { VaccineDose } from '../models/VaccineDose.js';
import { GrowthLog } from '../models/GrowthLog.js';
import { SkinLog } from '../models/SkinLog.js';
import { FoodLog } from '../models/FoodLog.js';
import { SleepLog } from '../models/SleepLog.js';
import { MilestoneAchievement } from '../models/MilestoneAchievement.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Appointment } from '../models/Appointment.js';
import { ChatSession } from '../models/ChatSession.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { requireAuth, requireRole, setAuthCookie } from '../middleware/auth.js';
import { generatePassword } from '../lib/password.js';
import { eraseUserData } from '../lib/eraseUser.js';
import { REWARD_PER_REFERRAL } from '../lib/referral.js';
import { doseStatus, istToday } from '../vaccines/schedule.js';

interface VaccineCounts {
  done: number;
  due: number;
  overdue: number;
  upcoming: number;
  total: number;
}
function emptyCounts(): VaccineCounts {
  return { done: 0, due: 0, overdue: 0, upcoming: 0, total: 0 };
}

// Admin control panel API. Admin is the central control: it creates BOTH parent
// and doctor accounts (public signup is disabled) and manages everything.
const router = Router();
router.use(requireAuth, requireRole('admin'));

// ── Overview counts ────────────────────────────────────────────────────
router.get('/overview', async (_req, res) => {
  const [parents, doctors, babies, consultations] = await Promise.all([
    User.countDocuments({ role: 'parent' }),
    User.countDocuments({ role: 'doctor' }),
    Baby.countDocuments({}),
    Consultation.countDocuments({}),
  ]);
  res.json({ counts: { parents, doctors, babies, consultations } });
});

// ── Parents ────────────────────────────────────────────────────────────
router.get('/parents', async (_req, res) => {
  const parents = await User.find({ role: 'parent' }).select('-passwordHash').sort({ createdAt: -1 }).limit(1000);
  const counts = await Baby.aggregate<{ _id: string; n: number }>([
    { $group: { _id: '$userId', n: { $sum: 1 } } },
  ]);
  const babyCount = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({
    parents: parents.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone ?? null,
      createdAt: u.createdAt,
      babies: babyCount.get(u.id) ?? 0,
    })),
  });
});

const createParentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional(),
  // Admin may set the password; if omitted, one is generated.
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
  // Refer & Earn: if this parent was referred, the referrer's code credits them.
  referralCode: z.string().trim().toUpperCase().max(20).optional(),
});

// Create a parent account. Returns the password (admin-set or generated) to share.
router.post('/parents', async (req, res) => {
  const { name, email, phone, password, referralCode } = createParentSchema.parse(req.body);
  if (await User.findOne({ email })) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }
  // If a valid referral code was supplied, credit the referrer and record it.
  let referredByCode: string | undefined;
  if (referralCode) {
    const referrer = await User.findOne({ referralCode });
    if (referrer) {
      referrer.referralCredits = (referrer.referralCredits ?? 0) + REWARD_PER_REFERRAL;
      await referrer.save();
      referredByCode = referralCode;
    }
  }
  const tempPassword = password ?? generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  // Admin-created on the parent's behalf after they opted in on the website.
  // Mateo-origin parents get the plan included from day one (see the grandfather
  // rule on IUser.subscription) — only doctor-invited parents start unsubscribed.
  const user = await User.create({
    name,
    email,
    phone,
    role: 'parent',
    passwordHash,
    consentAcceptedAt: new Date(),
    referredByCode,
    subscription: { active: true, source: 'mateo', activatedAt: new Date() },
  });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, tempPassword });
});

// ── Doctors ────────────────────────────────────────────────────────────
router.get('/doctors', async (_req, res) => {
  const profiles = await DoctorProfile.find({}).sort({ createdAt: -1 }).limit(1000);
  const users = await User.find({ _id: { $in: profiles.map((p) => p.userId) } }).select('name email phone');
  const byId = new Map(users.map((u) => [u.id, { name: u.name, email: u.email, phone: u.phone ?? null }]));
  res.json({
    doctors: profiles.map((p) => ({
      id: p.id,
      userId: p.userId.toString(),
      name: byId.get(p.userId.toString())?.name ?? 'Doctor',
      email: byId.get(p.userId.toString())?.email ?? null,
      phone: byId.get(p.userId.toString())?.phone ?? null,
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
      status: p.status,
      createdAt: p.createdAt,
    })),
  });
});

const availabilitySchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  slotMinutes: z.number().int().min(5).max(120),
});

const createDoctorSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional(),
  // Admin may set the password; if omitted, one is generated.
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
  specialization: z.string().trim().min(2).max(80),
  qualifications: z.string().trim().max(160).optional().default(''),
  experienceYears: z.number().int().min(0).max(80).optional().default(0),
  registrationNo: z.string().trim().max(60).optional().default(''),
  bio: z.string().trim().max(1000).optional().default(''),
  consultationFee: z.number().int().min(0).max(100000),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).optional().default([]),
  clinicName: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  availability: availabilitySchema.optional(),
});

// Create a doctor: a User (role doctor) + an approved DoctorProfile. Returns a
// one-time password for the admin to share. Admin-added doctors are immediately
// visible to parents in the directory.
router.post('/doctors', async (req, res) => {
  const body = createDoctorSchema.parse(req.body);
  if (await User.findOne({ email: body.email })) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }
  const tempPassword = body.password ?? generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const user = await User.create({ name: body.name, email: body.email, phone: body.phone, role: 'doctor', passwordHash, consentAcceptedAt: new Date() });
  await DoctorProfile.create({
    userId: user._id,
    specialization: body.specialization,
    qualifications: body.qualifications,
    experienceYears: body.experienceYears,
    registrationNo: body.registrationNo,
    bio: body.bio,
    consultationFee: body.consultationFee,
    languages: body.languages,
    clinicName: body.clinicName,
    city: body.city,
    availability: body.availability,
    status: 'approved',
  });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, tempPassword });
});

// ── Edit a parent ──────────────────────────────────────────────────────
const updateParentSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
});

router.patch('/parents/:userId', async (req, res) => {
  const id = String(req.params.userId);
  const user = isValidObjectId(id) ? await User.findById(id) : null;
  if (!user || user.role !== 'parent') {
    res.status(404).json({ error: 'Parent not found' });
    return;
  }
  const body = updateParentSchema.parse(req.body);
  if (body.email && body.email !== user.email) {
    if (await User.findOne({ email: body.email, _id: { $ne: user._id } })) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    user.email = body.email;
  }
  if (body.name !== undefined) user.name = body.name;
  if (body.phone !== undefined) user.phone = body.phone || undefined;
  if (body.password) user.passwordHash = await bcrypt.hash(body.password, 12);
  await user.save();
  res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone ?? null, role: user.role } });
});

// ── Edit a doctor (user + profile) ─────────────────────────────────────
const updateDoctorSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
  specialization: z.string().trim().min(2).max(80).optional(),
  qualifications: z.string().trim().max(160).optional(),
  experienceYears: z.number().int().min(0).max(80).optional(),
  registrationNo: z.string().trim().max(60).optional(),
  bio: z.string().trim().max(1000).optional(),
  consultationFee: z.number().int().min(0).max(100000).optional(),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  clinicName: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  availability: availabilitySchema.optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

router.patch('/doctors/:id', async (req, res) => {
  const id = String(req.params.id);
  const profile = isValidObjectId(id) ? await DoctorProfile.findById(id) : null;
  if (!profile) {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }
  const user = await User.findById(profile.userId);
  if (!user) {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }
  const body = updateDoctorSchema.parse(req.body);

  // Account fields.
  if (body.email && body.email !== user.email) {
    if (await User.findOne({ email: body.email, _id: { $ne: user._id } })) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    user.email = body.email;
  }
  if (body.name !== undefined) user.name = body.name;
  if (body.phone !== undefined) user.phone = body.phone || undefined;
  if (body.password) user.passwordHash = await bcrypt.hash(body.password, 12);
  await user.save();

  // Profile fields.
  if (body.specialization !== undefined) profile.specialization = body.specialization;
  if (body.qualifications !== undefined) profile.qualifications = body.qualifications;
  if (body.experienceYears !== undefined) profile.experienceYears = body.experienceYears;
  if (body.registrationNo !== undefined) profile.registrationNo = body.registrationNo;
  if (body.bio !== undefined) profile.bio = body.bio;
  if (body.consultationFee !== undefined) profile.consultationFee = body.consultationFee;
  if (body.languages !== undefined) profile.languages = body.languages;
  if (body.clinicName !== undefined) profile.clinicName = body.clinicName;
  if (body.city !== undefined) profile.city = body.city;
  if (body.availability !== undefined) profile.availability = body.availability;
  if (body.status !== undefined) profile.status = body.status;
  await profile.save();

  res.json({ ok: true });
});

// ── Impersonation: switch into any parent/doctor's session ─────────────
// Sets the auth cookie to the target user but records the admin in the JWT's
// `act` claim, so /auth/me flags it and /auth/stop-impersonating returns here.
router.post('/impersonate/:userId', async (req, res) => {
  const targetId = String(req.params.userId);
  const target = isValidObjectId(targetId) ? await User.findById(targetId) : null;
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (target.role === 'admin') {
    res.status(400).json({ error: 'Cannot impersonate an admin' });
    return;
  }
  setAuthCookie(res, target.id, req.userId);
  res.json({ user: { id: target.id, name: target.name, email: target.email, role: target.role, impersonating: true } });
});

// Delete a parent/doctor user and ALL their data. Admins can't be deleted here.
router.delete('/users/:userId', async (req, res) => {
  const targetId = String(req.params.userId);
  const target = isValidObjectId(targetId) ? await User.findById(targetId) : null;
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (target.role === 'admin') {
    res.status(400).json({ error: 'Cannot delete an admin account' });
    return;
  }
  await eraseUserData(target.id);
  res.json({ ok: true });
});

// ── Parent oversight (read-only) ───────────────────────────────────────
// A parent's profile + their babies, each with a vaccine summary.
router.get('/parents/:id', async (req, res) => {
  const id = String(req.params.id);
  const parent = isValidObjectId(id) ? await User.findById(id).select('-passwordHash') : null;
  if (!parent || parent.role !== 'parent') {
    res.status(404).json({ error: 'Parent not found' });
    return;
  }
  const babies = await Baby.find({ userId: parent._id }).sort({ createdAt: -1 });
  const babyIds = babies.map((b) => b._id);
  const doses = babyIds.length > 0 ? await VaccineDose.find({ babyId: { $in: babyIds } }) : [];
  const today = istToday();
  const counts = new Map<string, VaccineCounts>();
  for (const dose of doses) {
    const key = dose.babyId.toString();
    const c = counts.get(key) ?? emptyCounts();
    c[doseStatus(dose, today)]++;
    c.total++;
    counts.set(key, c);
  }
  res.json({
    parent: { id: parent.id, name: parent.name, email: parent.email, createdAt: parent.createdAt },
    babies: babies.map((b) => ({
      id: b.id,
      name: b.name,
      dob: b.dob,
      sex: b.sex,
      vaccines: counts.get(b._id.toString()) ?? emptyCounts(),
    })),
  });
});

// A baby's full data snapshot for admin oversight (read-only — admin never owns
// or mutates the baby; these are GETs only).
router.get('/babies/:id', async (req, res) => {
  const id = String(req.params.id);
  const baby = isValidObjectId(id) ? await Baby.findById(id) : null;
  if (!baby) {
    res.status(404).json({ error: 'Baby not found' });
    return;
  }
  const today = istToday();
  const [owner, doses, growth, skin, food, sleep, milestones, records, appointments, sessions] = await Promise.all([
    User.findById(baby.userId).select('name email'),
    VaccineDose.find({ babyId: baby._id }).sort({ dueDate: 1 }),
    GrowthLog.find({ babyId: baby._id }).sort({ loggedAt: 1 }),
    SkinLog.find({ babyId: baby._id }).sort({ loggedAt: -1 }).limit(50),
    FoodLog.find({ babyId: baby._id }).sort({ loggedAt: -1 }).limit(50),
    SleepLog.find({ babyId: baby._id }).sort({ loggedAt: -1 }).limit(50),
    MilestoneAchievement.find({ babyId: baby._id }),
    HealthRecord.find({ babyId: baby._id }).sort({ recordDate: -1 }),
    Appointment.find({ babyId: baby._id }).sort({ scheduledAt: -1 }),
    ChatSession.find({ babyId: baby._id }).sort({ lastMessageAt: -1 }).limit(50),
  ]);

  const vaccines = emptyCounts();
  const doseViews = doses.map((d) => {
    const status = doseStatus(d, today);
    vaccines[status]++;
    vaccines.total++;
    return { id: d.id, vaccineName: d.vaccineName, doseLabel: d.doseLabel, dueDate: d.dueDate, administeredOn: d.administeredOn, status };
  });

  const chatSessions = await Promise.all(
    sessions.map(async (s) => {
      const msgs = await ChatMessage.find({ sessionId: s._id }).sort({ createdAt: 1 }).limit(200);
      return {
        id: s.id,
        title: s.title,
        lastMessageAt: s.lastMessageAt,
        messages: msgs.map((m) => ({ id: m.id, role: m.role, content: m.content, redFlagTriggered: m.redFlagTriggered, createdAt: m.createdAt })),
      };
    }),
  );

  res.json({
    baby: {
      id: baby.id,
      name: baby.name,
      dob: baby.dob,
      sex: baby.sex,
      birthWeightG: baby.birthWeightG,
      birthLengthCm: baby.birthLengthCm,
      birthHeadCircCm: baby.birthHeadCircCm,
    },
    owner: owner ? { name: owner.name, email: owner.email } : null,
    vaccines: { summary: vaccines, doses: doseViews },
    growth: growth.map((g) => ({ id: g.id, loggedAt: g.loggedAt, weightG: g.weightG, lengthCm: g.lengthCm, headCircCm: g.headCircCm })),
    skin: skin.map((s) => ({ id: s.id, loggedAt: s.loggedAt, area: s.area, description: s.description, severity: s.severity })),
    food: food.map((f) => ({ id: f.id, loggedAt: f.loggedAt, mealType: f.mealType, foodName: f.foodName, reaction: f.reaction, isNewFood: f.isNewFood })),
    sleep: sleep.map((s) => ({ id: s.id, loggedAt: s.loggedAt, kind: s.kind, durationMin: s.durationMin, quality: s.quality })),
    milestones: milestones.map((m) => ({ id: m.id, milestoneId: m.milestoneId, achievedOn: m.achievedOn })),
    records: records.map((r) => ({ id: r.id, recordType: r.recordType, title: r.title, recordDate: r.recordDate, provider: r.provider ?? null, notes: r.notes ?? null })),
    appointments: appointments.map((a) => ({ id: a.id, scheduledAt: a.scheduledAt, reason: a.reason, completed: a.completed })),
    chatSessions,
  });
});

// ── AI chat oversight (read-only) ──────────────────────────────────────
// What parents are actually asking mateo.ai, across everyone: how many
// conversations exist, how many are live right now vs idle, how many questions
// were asked, and the red-flag escalations the deterministic gate caught — so
// the team can see the real issues parents face. Read-only; admin already has
// full impersonation access to this data. These are private children's-health
// conversations, so this view is admin-only (requireRole('admin') above).
const LIVE_WINDOW_MS = 30 * 60 * 1000; // a chat is "live" if a message landed in the last 30 min

router.get('/chats', async (_req, res) => {
  const liveSince = new Date(Date.now() - LIVE_WINDOW_MS);
  const [totalSessions, liveSessions, totalMessages, userMessages, redFlags] = await Promise.all([
    ChatSession.countDocuments({}),
    ChatSession.countDocuments({ lastMessageAt: { $gte: liveSince } }),
    ChatMessage.countDocuments({}),
    ChatMessage.countDocuments({ role: 'user' }),
    ChatMessage.countDocuments({ redFlagTriggered: true }),
  ]);

  // Distinct parents who have ever chatted (every session → its baby → the owner).
  const chattedBabyIds = await ChatSession.distinct('babyId');
  const chattedBabies = chattedBabyIds.length ? await Baby.find({ _id: { $in: chattedBabyIds } }).select('userId') : [];
  const activeParents = new Set(chattedBabies.map((b) => b.userId.toString())).size;

  // Recent sessions (newest activity first) with per-session message stats and
  // the parent/baby they belong to.
  const sessions = await ChatSession.find({}).sort({ lastMessageAt: -1 }).limit(200);
  const stats = await ChatMessage.aggregate<{ _id: Types.ObjectId; total: number; user: number; redFlags: number }>([
    { $match: { sessionId: { $in: sessions.map((s) => s._id) } } },
    {
      $group: {
        _id: '$sessionId',
        total: { $sum: 1 },
        user: { $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] } },
        redFlags: { $sum: { $cond: ['$redFlagTriggered', 1, 0] } },
      },
    },
  ]);
  const statBySession = new Map(stats.map((s) => [String(s._id), s]));

  const sBabyIds = [...new Set(sessions.map((s) => s.babyId.toString()))];
  const sBabies = sBabyIds.length ? await Baby.find({ _id: { $in: sBabyIds } }).select('name userId') : [];
  const babyById = new Map(sBabies.map((b) => [b.id, { name: b.name, userId: b.userId.toString() }]));
  const sUsers = sBabies.length ? await User.find({ _id: { $in: [...new Set(sBabies.map((b) => b.userId.toString()))] } }).select('name') : [];
  const nameByUser = new Map(sUsers.map((u) => [u.id, u.name]));

  res.json({
    counts: { sessions: totalSessions, live: liveSessions, messages: totalMessages, questions: userMessages, redFlags, activeParents },
    liveWindowMinutes: LIVE_WINDOW_MS / 60000,
    sessions: sessions.map((s) => {
      const st = statBySession.get(s.id);
      const baby = babyById.get(s.babyId.toString());
      return {
        id: s.id,
        title: s.title,
        babyId: s.babyId.toString(),
        babyName: baby?.name ?? 'Unknown',
        parentId: baby?.userId ?? null,
        parentName: baby ? nameByUser.get(baby.userId) ?? 'Unknown' : 'Unknown',
        messages: st?.total ?? 0,
        questions: st?.user ?? 0,
        redFlags: st?.redFlags ?? 0,
        lastMessageAt: s.lastMessageAt,
        createdAt: s.createdAt,
        live: s.lastMessageAt.getTime() >= liveSince.getTime(),
      };
    }),
  });
});

// Full transcript of one session, so the team can read what was actually asked.
router.get('/chats/:sessionId', async (req, res) => {
  const id = String(req.params.sessionId);
  const session = isValidObjectId(id) ? await ChatSession.findById(id) : null;
  if (!session) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  const baby = await Baby.findById(session.babyId).select('name userId');
  const owner = baby ? await User.findById(baby.userId).select('name email') : null;
  const messages = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 }).limit(500);
  res.json({
    session: {
      id: session.id,
      title: session.title,
      babyId: session.babyId.toString(),
      babyName: baby?.name ?? 'Unknown',
      parentId: baby ? baby.userId.toString() : null,
      parentName: owner?.name ?? 'Unknown',
      parentEmail: owner?.email ?? null,
      lastMessageAt: session.lastMessageAt,
      createdAt: session.createdAt,
      live: session.lastMessageAt.getTime() >= Date.now() - LIVE_WINDOW_MS,
    },
    messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, redFlagTriggered: m.redFlagTriggered, createdAt: m.createdAt })),
  });
});

export default router;
