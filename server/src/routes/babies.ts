import { Router } from 'express';
import { z } from 'zod';
import { Baby } from '../models/Baby.js';
import type { IBaby } from '../models/Baby.js';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { VaccineDose } from '../models/VaccineDose.js';
import { GrowthLog } from '../models/GrowthLog.js';
import { SkinLog } from '../models/SkinLog.js';
import { FoodLog } from '../models/FoodLog.js';
import { SleepLog } from '../models/SleepLog.js';
import { Prescription } from '../models/Prescription.js';
import { MedicineDoseLog } from '../models/MedicineDoseLog.js';
import { MedicineCourse } from '../models/MedicineCourse.js';
import { MilestoneAchievement } from '../models/MilestoneAchievement.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Appointment } from '../models/Appointment.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { ChatSession } from '../models/ChatSession.js';
import { Consultation } from '../models/Consultation.js';
import { requireAuth } from '../middleware/auth.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { syncDosesForBaby } from '../vaccines/sync.js';
import { uploadsDir } from '../middleware/upload.js';

const MIN_DOB = new Date('2000-01-01T00:00:00.000Z');

const createBabySchema = z.object({
  name: z.string().trim().min(1, 'Please enter a name').max(100),
  dob: z.coerce
    .date()
    .refine((d) => d.getTime() >= MIN_DOB.getTime(), 'Date of birth must be on or after 2000-01-01')
    .refine((d) => d.getTime() <= Date.now(), 'Date of birth cannot be in the future'),
  sex: z.enum(['male', 'female']),
  // Avatar key like "boy-01" / "girl-12"; the client picks from a fixed catalog
  avatar: z
    .string()
    .regex(/^(boy|girl)-\d{2}$/, 'Invalid avatar')
    .optional(),
  birthWeightG: z
    .number()
    .int()
    .min(300, 'Birth weight should be between 0.3 kg and 8 kg')
    .max(8000, 'Birth weight should be between 0.3 kg and 8 kg')
    .optional(),
  birthLengthCm: z.number().min(20, 'Birth length should be between 20 cm and 70 cm').max(70, 'Birth length should be between 20 cm and 70 cm').optional(),
  birthHeadCircCm: z.number().min(20, 'Head circumference should be between 20 cm and 60 cm').max(60, 'Head circumference should be between 20 cm and 60 cm').optional(),
  // Onboarding feeding baseline (see IBaby.solidsStartedOn). Optional; must not be in the future.
  solidsStartedOn: z.coerce.date().refine((d) => d.getTime() <= Date.now(), 'That date is in the future').optional(),
});

// userId is deliberately not part of the schema, so a baby can never be reassigned to another user
const updateBabySchema = createBabySchema.partial();

function publicBaby(baby: IBaby & { id: string }) {
  return {
    id: baby.id,
    name: baby.name,
    dob: baby.dob,
    sex: baby.sex,
    avatar: baby.avatar,
    birthWeightG: baby.birthWeightG,
    birthLengthCm: baby.birthLengthCm,
    birthHeadCircCm: baby.birthHeadCircCm,
    solidsStartedOn: baby.solidsStartedOn,
    createdAt: baby.createdAt,
  };
}

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const babies = await Baby.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json({ babies: babies.map((baby) => publicBaby(baby)) });
});

router.post('/', async (req, res) => {
  const body = createBabySchema.parse(req.body);
  const baby = await Baby.create({ ...body, userId: req.userId });
  // Expand the IAP schedule into this baby's vaccine doses, dated from its DOB.
  await syncDosesForBaby({ id: baby.id, dob: baby.dob, sex: baby.sex });
  res.status(201).json({ baby: publicBaby(baby) });
});

router.get('/:id', loadOwnedBaby, (req, res) => {
  res.json({ baby: publicBaby(req.baby!) });
});

router.patch('/:id', loadOwnedBaby, async (req, res) => {
  const body = updateBabySchema.parse(req.body);
  const baby = req.baby!;
  const prevDob = baby.dob.getTime();
  const prevSex = baby.sex;
  baby.set(body);
  await baby.save();
  // DOB shifts every due date; sex can add/remove sex-specific doses. Re-sync,
  // preserving any administrations already recorded.
  if (baby.dob.getTime() !== prevDob || baby.sex !== prevSex) {
    await syncDosesForBaby({ id: baby.id, dob: baby.dob, sex: baby.sex });
  }
  res.json({ baby: publicBaby(baby) });
});

router.delete('/:id', loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  // Cascade-delete all of this baby's tracker data.
  await VaccineDose.deleteMany({ babyId: baby._id });
  await GrowthLog.deleteMany({ babyId: baby._id });
  const skinLogs = await SkinLog.find({ babyId: baby._id });
  await Promise.all(
    skinLogs
      .filter((l) => l.photoFile)
      .map((l) => unlink(path.join(uploadsDir, l.photoFile!)).catch(() => {})),
  );
  await SkinLog.deleteMany({ babyId: baby._id });
  await FoodLog.deleteMany({ babyId: baby._id });
  await SleepLog.deleteMany({ babyId: baby._id });
  // Parent-added (self) medicines are tied to the baby; doctor prescriptions outlive it.
  await Prescription.deleteMany({ babyId: baby._id, source: 'self' });
  await MedicineDoseLog.deleteMany({ babyId: baby._id });
  await MedicineCourse.deleteMany({ babyId: baby._id });
  await MilestoneAchievement.deleteMany({ babyId: baby._id });
  await HealthRecord.deleteMany({ babyId: baby._id });
  await Appointment.deleteMany({ babyId: baby._id });
  await ChatMessage.deleteMany({ babyId: baby._id });
  await ChatSession.deleteMany({ babyId: baby._id });
  // A consultation outlives the baby record (it's a parent↔doctor booking); just
  // detach the baby reference so nothing dangles.
  await Consultation.updateMany({ babyId: baby._id }, { $unset: { babyId: 1 } });
  await baby.deleteOne();
  res.json({ ok: true });
});

export default router;
