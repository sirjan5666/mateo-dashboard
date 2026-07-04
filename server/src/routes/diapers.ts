import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { DiaperLog, DIAPER_KINDS, STOOL_CONSISTENCIES, STOOL_COLORS, CONCERNING_COLORS } from '../models/DiaperLog.js';
import type { IDiaperLog, DiaperKind, StoolColor, StoolConsistency } from '../models/DiaperLog.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { isFutureISTDate, istDateString } from '../lib/ist.js';

const MIN_DATE = new Date('2000-01-01T00:00:00.000Z');

const createDiaperSchema = z.object({
  loggedAt: z.coerce
    .date()
    .refine((d) => d.getTime() >= MIN_DATE.getTime(), 'Date is too far in the past')
    .refine((d) => !isFutureISTDate(d), 'Date cannot be in the future'),
  kind: z.enum(DIAPER_KINDS as [DiaperKind, ...DiaperKind[]]),
  consistency: z.enum(STOOL_CONSISTENCIES as [StoolConsistency, ...StoolConsistency[]]).optional(),
  color: z.enum(STOOL_COLORS as [StoolColor, ...StoolColor[]]).optional(),
  notes: z.string().trim().max(1000).optional(),
});

function publicLog(log: IDiaperLog & { id: string }) {
  return {
    id: log.id,
    loggedAt: log.loggedAt,
    kind: log.kind,
    consistency: log.consistency ?? null,
    color: log.color ?? null,
    // A gentle, non-diagnostic flag for stool colours worth a doctor's eye.
    concerning: log.color ? CONCERNING_COLORS.includes(log.color as StoolColor) : false,
    notes: log.notes ?? null,
    createdAt: log.createdAt,
  };
}

const router = Router();

router.get('/babies/:id/diapers', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const logs = await DiaperLog.find({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 });
  const today = istDateString(new Date());
  const last7Days = new Set<string>();
  for (let i = 0; i < 7; i += 1) last7Days.add(istDateString(new Date(Date.now() - i * 86_400_000)));
  let wetToday = 0;
  let dirtyToday = 0;
  let last7Count = 0;
  const seenDays = new Set<string>();
  for (const l of logs) {
    const day = istDateString(l.loggedAt);
    if (day === today) {
      if (l.kind === 'wet' || l.kind === 'mixed') wetToday += 1;
      if (l.kind === 'dirty' || l.kind === 'mixed') dirtyToday += 1;
    }
    if (last7Days.has(day)) {
      last7Count += 1;
      seenDays.add(day);
    }
  }
  res.json({
    logs: logs.map((l) => publicLog(l)),
    summary: {
      wetToday,
      dirtyToday,
      avgPerDay: seenDays.size > 0 ? Math.round(last7Count / seenDays.size) : 0,
    },
  });
});

router.post('/babies/:id/diapers', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const body = createDiaperSchema.parse(req.body);
  if (body.loggedAt.getTime() < baby.dob.getTime()) {
    res.status(400).json({ error: 'Date cannot be before the baby was born' });
    return;
  }
  const log = await DiaperLog.create({ babyId: baby._id, ...body });
  res.status(201).json({ log: publicLog(log) });
});

router.delete('/babies/:id/diapers/:logId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const { logId } = req.params;
  const log = isValidObjectId(logId) ? await DiaperLog.findById(logId) : null;
  if (!log || log.babyId.toString() !== baby._id.toString()) {
    res.status(404).json({ error: 'Diaper log not found' });
    return;
  }
  await log.deleteOne();
  res.json({ ok: true });
});

export default router;
