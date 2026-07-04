import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { VaccineDose } from '../models/VaccineDose.js';
import { GrowthLog } from '../models/GrowthLog.js';
import { SkinLog } from '../models/SkinLog.js';
import { FoodLog } from '../models/FoodLog.js';
import { SleepLog } from '../models/SleepLog.js';
import { FeedLog } from '../models/FeedLog.js';
import { DiaperLog } from '../models/DiaperLog.js';
import { Allergy } from '../models/Allergy.js';
import { SymptomLog } from '../models/SymptomLog.js';
import { MilestoneAchievement } from '../models/MilestoneAchievement.js';
import { SYMPTOMS } from '../health/symptoms.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Appointment } from '../models/Appointment.js';
import { User } from '../models/User.js';
import { doseStatus, istToday } from '../vaccines/schedule.js';
import { milestoneById } from '../milestones/milestones.js';

const router = Router();

type Counts = { done: number; due: number; overdue: number; upcoming: number; total: number };
const emptyCounts = (): Counts => ({ done: 0, due: 0, overdue: 0, upcoming: 0, total: 0 });

// Full per-baby health snapshot for the printable parent report. Owner-scoped
// (loadOwnedBaby) — a parent can only generate their own baby's report.
router.get('/babies/:id/report', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const today = istToday();
  const [parent, doses, growth, skin, food, sleep, milestones, records, appointments, symptoms, feeds, diapers, allergies] = await Promise.all([
    User.findById(req.userId).select('name'),
    VaccineDose.find({ babyId: baby._id }).sort({ dueDate: 1 }),
    GrowthLog.find({ babyId: baby._id }).sort({ loggedAt: 1 }),
    SkinLog.find({ babyId: baby._id }).sort({ loggedAt: -1 }).limit(100),
    FoodLog.find({ babyId: baby._id }).sort({ loggedAt: -1 }).limit(100),
    SleepLog.find({ babyId: baby._id }).sort({ loggedAt: -1 }).limit(100),
    MilestoneAchievement.find({ babyId: baby._id }).sort({ achievedOn: 1 }),
    HealthRecord.find({ babyId: baby._id }).sort({ recordDate: -1 }),
    Appointment.find({ babyId: baby._id }).sort({ scheduledAt: -1 }),
    SymptomLog.find({ babyId: baby._id }).sort({ loggedAt: -1 }).limit(100),
    FeedLog.find({ babyId: baby._id }).sort({ loggedAt: -1 }).limit(100),
    DiaperLog.find({ babyId: baby._id }).sort({ loggedAt: -1 }).limit(100),
    Allergy.find({ babyId: baby._id }).sort({ createdAt: -1 }),
  ]);

  const summary = emptyCounts();
  const doseViews = doses.map((d) => {
    const status = doseStatus(d, today);
    summary[status]++;
    summary.total++;
    return { id: d.id, vaccineName: d.vaccineName, doseLabel: d.doseLabel, dueDate: d.dueDate, administeredOn: d.administeredOn, status };
  });

  const symptomLabel = new Map(SYMPTOMS.map((s) => [s.key, s.label]));
  res.json({
    generatedAt: new Date(),
    parent: { name: parent?.name ?? 'Parent' },
    baby: {
      id: baby.id,
      name: baby.name,
      dob: baby.dob,
      sex: baby.sex,
      birthWeightG: baby.birthWeightG,
      birthLengthCm: baby.birthLengthCm,
      birthHeadCircCm: baby.birthHeadCircCm,
    },
    vaccines: { summary, doses: doseViews },
    growth: growth.map((g) => ({ id: g.id, loggedAt: g.loggedAt, weightG: g.weightG, lengthCm: g.lengthCm, headCircCm: g.headCircCm })),
    skin: skin.map((s) => ({ id: s.id, loggedAt: s.loggedAt, area: s.area, description: s.description, severity: s.severity })),
    food: food.map((f) => ({ id: f.id, loggedAt: f.loggedAt, mealType: f.mealType, foodName: f.foodName, reaction: f.reaction, isNewFood: f.isNewFood })),
    sleep: sleep.map((s) => ({ id: s.id, loggedAt: s.loggedAt, kind: s.kind, durationMin: s.durationMin, quality: s.quality })),
    feeds: feeds.map((f) => ({ id: f.id, loggedAt: f.loggedAt, kind: f.kind, side: f.side ?? null, durationMin: f.durationMin ?? null, amountMl: f.amountMl ?? null })),
    diapers: diapers.map((d) => ({ id: d.id, loggedAt: d.loggedAt, kind: d.kind, consistency: d.consistency ?? null, color: d.color ?? null })),
    allergies: allergies.map((a) => ({ id: a.id, name: a.name, severity: a.severity, reaction: a.reaction ?? null })),
    symptoms: symptoms.map((s) => ({
      id: s.id,
      loggedAt: s.loggedAt,
      temperatureC: s.temperatureC ?? null,
      symptoms: s.symptoms.map((k) => symptomLabel.get(k) ?? k),
      notes: s.notes ?? null,
    })),
    milestones: milestones.map((m) => ({ id: m.id, milestoneId: m.milestoneId, label: milestoneById.get(m.milestoneId)?.label ?? m.milestoneId, achievedOn: m.achievedOn })),
    records: records.map((r) => ({ id: r.id, recordType: r.recordType, title: r.title, recordDate: r.recordDate, provider: r.provider ?? null, notes: r.notes ?? null })),
    appointments: appointments.map((a) => ({ id: a.id, scheduledAt: a.scheduledAt, reason: a.reason, completed: a.completed })),
  });
});

export default router;
