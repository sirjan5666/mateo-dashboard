import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { SleepLog } from '../models/SleepLog.js';
import type { ISleepLog } from '../models/SleepLog.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { isFutureISTDate, istDateString } from '../lib/ist.js';
import { sleepReferenceForAge } from '../sleep/reference.js';

const MIN_DATE = new Date('2000-01-01T00:00:00.000Z');
const MS_PER_MONTH = 86_400_000 * 30.4375;

const createSleepSchema = z.object({
  loggedAt: z.coerce
    .date()
    .refine((d) => d.getTime() >= MIN_DATE.getTime(), 'Date is too far in the past')
    // IST calendar day, not raw instant (a date-only value is UTC midnight).
    .refine((d) => !isFutureISTDate(d), 'Date cannot be in the future'),
  kind: z.enum(['nap', 'night']),
  durationMin: z.number().int().min(1).max(1440),
  quality: z.enum(['settled', 'restless', 'unsettled']).optional(),
  notes: z.string().trim().max(1000).optional(),
});

function publicLog(log: ISleepLog & { id: string }) {
  return {
    id: log.id,
    loggedAt: log.loggedAt,
    kind: log.kind,
    durationMin: log.durationMin,
    quality: log.quality ?? null,
    notes: log.notes ?? null,
    createdAt: log.createdAt,
  };
}

const router = Router();

router.get('/babies/:id/sleep', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const logs = await SleepLog.find({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 });
  // Light summary over today (IST) + the last 7 IST days, computed server-side.
  const today = istDateString(new Date());
  const last7DaySet = new Set<string>();
  for (let i = 0; i < 7; i += 1) last7DaySet.add(istDateString(new Date(Date.now() - i * 86_400_000)));
  let todayMin = 0;
  let todayNaps = 0;
  let last7Total = 0;
  const seenDays = new Set<string>();
  for (const l of logs) {
    const day = istDateString(l.loggedAt);
    if (day === today) {
      todayMin += l.durationMin;
      if (l.kind === 'nap') todayNaps += 1;
    }
    if (last7DaySet.has(day)) {
      last7Total += l.durationMin;
      seenDays.add(day);
    }
  }
  const last7Days = seenDays.size;
  const ageMonths = Math.max(0, Math.floor((Date.now() - baby.dob.getTime()) / MS_PER_MONTH));
  res.json({
    logs: logs.map((l) => publicLog(l)),
    summary: {
      todayMinutes: todayMin,
      todayNaps,
      avgPerDayMinutes: last7Days > 0 ? Math.round(last7Total / last7Days) : 0,
    },
    // Age-driven "what's typical" band, so the tracker shows expectations even
    // before anything is logged. Typical ranges, never a target.
    ageMonths,
    reference: sleepReferenceForAge(ageMonths),
  });
});

router.post('/babies/:id/sleep', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const body = createSleepSchema.parse(req.body);
  if (body.loggedAt.getTime() < baby.dob.getTime()) {
    res.status(400).json({ error: 'Date cannot be before the baby was born' });
    return;
  }
  const log = await SleepLog.create({ babyId: baby._id, ...body });
  res.status(201).json({ log: publicLog(log) });
});

router.delete('/babies/:id/sleep/:logId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const { logId } = req.params;
  const log = isValidObjectId(logId) ? await SleepLog.findById(logId) : null;
  if (!log || log.babyId.toString() !== baby._id.toString()) {
    res.status(404).json({ error: 'Sleep log not found' });
    return;
  }
  await log.deleteOne();
  res.json({ ok: true });
});

export default router;
