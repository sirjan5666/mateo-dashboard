import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { FeedLog, FEED_KINDS, FEED_SIDES } from '../models/FeedLog.js';
import type { IFeedLog, FeedKind, FeedSide } from '../models/FeedLog.js';
import { requireAuth } from '../middleware/auth.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { isFutureISTDate, istDateString } from '../lib/ist.js';

const MIN_DATE = new Date('2000-01-01T00:00:00.000Z');

const createFeedSchema = z.object({
  loggedAt: z.coerce
    .date()
    .refine((d) => d.getTime() >= MIN_DATE.getTime(), 'Date is too far in the past')
    .refine((d) => !isFutureISTDate(d), 'Date cannot be in the future'),
  kind: z.enum(FEED_KINDS as [FeedKind, ...FeedKind[]]),
  side: z.enum(FEED_SIDES as [FeedSide, ...FeedSide[]]).optional(),
  durationMin: z.number().int().min(1).max(240).optional(),
  amountMl: z.number().int().min(1).max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
});

function publicLog(log: IFeedLog & { id: string }) {
  return {
    id: log.id,
    loggedAt: log.loggedAt,
    kind: log.kind,
    side: log.side ?? null,
    durationMin: log.durationMin ?? null,
    amountMl: log.amountMl ?? null,
    notes: log.notes ?? null,
    createdAt: log.createdAt,
  };
}

const router = Router();

router.get('/babies/:id/feeds', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const logs = await FeedLog.find({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 });
  const today = istDateString(new Date());
  // The set of the last 7 IST calendar days (today + 6 prior), so the "7d" average
  // truly spans 7 days regardless of the current time of day.
  const last7Days = new Set<string>();
  for (let i = 0; i < 7; i += 1) last7Days.add(istDateString(new Date(Date.now() - i * 86_400_000)));
  let feedsToday = 0;
  let breastMinutesToday = 0;
  let last7Count = 0;
  const seenDays = new Set<string>();
  for (const l of logs) {
    const day = istDateString(l.loggedAt);
    if (day === today) {
      feedsToday += 1;
      if (l.kind === 'breast' && l.durationMin) breastMinutesToday += l.durationMin;
    }
    if (last7Days.has(day)) {
      last7Count += 1;
      seenDays.add(day);
    }
  }
  res.json({
    logs: logs.map((l) => publicLog(l)),
    summary: {
      feedsToday,
      breastMinutesToday,
      avgPerDay: seenDays.size > 0 ? Math.round(last7Count / seenDays.size) : 0,
    },
  });
});

router.post('/babies/:id/feeds', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const body = createFeedSchema.parse(req.body);
  if (body.loggedAt.getTime() < baby.dob.getTime()) {
    res.status(400).json({ error: 'Date cannot be before the baby was born' });
    return;
  }
  const log = await FeedLog.create({ babyId: baby._id, ...body });
  res.status(201).json({ log: publicLog(log) });
});

router.delete('/babies/:id/feeds/:logId', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const { logId } = req.params;
  const log = isValidObjectId(logId) ? await FeedLog.findById(logId) : null;
  if (!log || log.babyId.toString() !== baby._id.toString()) {
    res.status(404).json({ error: 'Feed log not found' });
    return;
  }
  await log.deleteOne();
  res.json({ ok: true });
});

export default router;
