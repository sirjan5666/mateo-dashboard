import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { DoctorProfile } from '../models/DoctorProfile.js';
import type { IDoctorProfile } from '../models/DoctorProfile.js';
import { Consultation } from '../models/Consultation.js';
import { DoctorReview } from '../models/DoctorReview.js';
import { User } from '../models/User.js';
import type { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateSlots } from '../doctors/slots.js';

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

const profileSchema = z.object({
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
    city: p.city ?? null,
    availability: p.availability,
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
  const existing = await DoctorProfile.findOne({ userId: req.userId });
  // No admin approval step right now — profiles go live on save. When the admin
  // panel returns, gate visibility behind 'pending' → admin approval again.
  if (existing) {
    existing.set(body);
    existing.status = 'approved';
    await existing.save();
    res.json({ profile: publicSelf(existing, req.authUser!.name) });
    return;
  }
  const created = await DoctorProfile.create({ userId: req.userId, ...body, status: 'approved' });
  res.status(201).json({ profile: publicSelf(created, req.authUser!.name) });
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
