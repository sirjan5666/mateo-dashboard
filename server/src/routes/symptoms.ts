import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { SymptomLog } from '../models/SymptomLog.js';
import type { ISymptomLog } from '../models/SymptomLog.js';
import type { IBaby } from '../models/Baby.js';
import { requireAuth } from '../middleware/auth.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { isFutureISTDate } from '../lib/ist.js';
import { assessSymptoms, SYMPTOM_KEYS } from '../health/symptoms.js';

const MIN_DATE = new Date('2000-01-01T00:00:00.000Z');

const createSymptomSchema = z
  .object({
    loggedAt: z.coerce
      .date()
      .refine((d) => d.getTime() >= MIN_DATE.getTime(), 'Date is too far in the past')
      .refine((d) => !isFutureISTDate(d), 'Date cannot be in the future'),
    temperatureC: z.number().min(30, 'Temperature seems too low').max(45, 'Temperature seems too high').optional(),
    symptoms: z
      .array(z.string())
      .max(40)
      .optional()
      .default([])
      .refine((arr) => arr.every((k) => SYMPTOM_KEYS.includes(k)), 'Unknown symptom'),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((b) => b.temperatureC != null || (b.symptoms?.length ?? 0) > 0, {
    message: 'Add a temperature or at least one symptom',
  });

function ageDaysAt(dob: Date, at: Date): number {
  return Math.floor((at.getTime() - dob.getTime()) / 86_400_000);
}

function publicLog(log: HydratedDocument<ISymptomLog>, baby: IBaby) {
  const assessment = assessSymptoms({
    temperatureC: log.temperatureC ?? null,
    symptoms: log.symptoms,
    ageDays: ageDaysAt(baby.dob, log.loggedAt),
  });
  return {
    id: log.id,
    loggedAt: log.loggedAt,
    temperatureC: log.temperatureC ?? null,
    symptoms: log.symptoms,
    notes: log.notes ?? null,
    level: assessment.level,
    reasons: assessment.reasons,
    createdAt: log.createdAt,
  };
}

const router = Router();

router.get('/babies/:id/symptoms', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const logs = await SymptomLog.find({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 });
  const views = logs.map((l) => publicLog(l, baby));
  const sevenAgo = Date.now() - 7 * 86_400_000;
  const recent = views.filter((v) => new Date(v.loggedAt).getTime() >= sevenAgo);
  const temps = recent.map((v) => v.temperatureC).filter((t): t is number => typeof t === 'number');
  res.json({
    logs: views,
    summary: {
      latestTempC: views.find((v) => typeof v.temperatureC === 'number')?.temperatureC ?? null,
      maxTemp7dC: temps.length ? Math.max(...temps) : null,
      hasUrgentRecently: recent.some((v) => v.level === 'urgent'),
    },
  });
});

router.post('/babies/:id/symptoms', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const body = createSymptomSchema.parse(req.body);
  if (body.loggedAt.getTime() < baby.dob.getTime()) {
    res.status(400).json({ error: 'Date cannot be before the baby was born' });
    return;
  }
  const log = await SymptomLog.create({
    babyId: baby._id,
    loggedAt: body.loggedAt,
    temperatureC: body.temperatureC,
    symptoms: body.symptoms ?? [],
    notes: body.notes,
  });
  res.status(201).json({ log: publicLog(log, baby) });
});

router.delete('/babies/:id/symptoms/:logId', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const { logId } = req.params;
  const log = isValidObjectId(logId) ? await SymptomLog.findById(logId) : null;
  if (!log || log.babyId.toString() !== baby._id.toString()) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }
  await log.deleteOne();
  res.json({ ok: true });
});

export default router;
