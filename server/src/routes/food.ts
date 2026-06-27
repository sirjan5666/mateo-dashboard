import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { FoodLog } from '../models/FoodLog.js';
import type { IFoodLog } from '../models/FoodLog.js';
import { requireAuth } from '../middleware/auth.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { ageInWholeMonthsIST, isFutureISTDate } from '../lib/ist.js';
import {
  feedingNote,
  feedingPrinciples,
  feedingSafety,
  neverFeed,
  stageForAge,
  underSixMonths,
  SOLIDS_START_MONTH,
} from '../food/feeding.js';

const MIN_DATE = new Date('2000-01-01T00:00:00.000Z');

const createFoodSchema = z.object({
  loggedAt: z.coerce
    .date()
    .refine((d) => d.getTime() >= MIN_DATE.getTime(), 'Date is too far in the past')
    // Compare on the IST calendar day, not the raw instant: a date-only value is
    // stored as UTC midnight, which is up to 5.5h "ahead" of now in the early-IST
    // hours and would otherwise be wrongly rejected as a future date.
    .refine((d) => !isFutureISTDate(d), 'Date cannot be in the future'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  foodName: z.string().trim().min(1).max(120),
  foodGroups: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  texture: z.enum(['puree', 'mashed', 'finger', 'family']),
  amount: z.enum(['tasted', 'some', 'full']),
  reaction: z.enum(['none', 'mild', 'concerning']),
  isNewFood: z.boolean(),
  notes: z.string().trim().max(1000).optional(),
});

function publicLog(log: IFoodLog & { id: string }) {
  return {
    id: log.id,
    loggedAt: log.loggedAt,
    mealType: log.mealType,
    foodName: log.foodName,
    foodGroups: log.foodGroups,
    texture: log.texture,
    amount: log.amount,
    reaction: log.reaction,
    isNewFood: log.isNewFood,
    notes: log.notes ?? null,
    createdAt: log.createdAt,
  };
}

const router = Router();

router.get('/babies/:id/food', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  // Newest meal first; createdAt breaks ties when several share a date.
  const logs = await FoodLog.find({ babyId: baby._id }).sort({ loggedAt: -1, createdAt: -1 });
  const ageMonths = ageInWholeMonthsIST(baby.dob);
  res.json({
    logs: logs.map((l) => publicLog(l)),
    // Age-gated, brand-neutral guidance (single source of truth lives on the server).
    guidance: {
      ageMonths,
      underSix: ageMonths < SOLIDS_START_MONTH,
      underSixMonths,
      stage: stageForAge(ageMonths),
      neverFeed,
      safety: feedingSafety,
      principles: feedingPrinciples,
      feedingNote,
    },
  });
});

router.post('/babies/:id/food', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const body = createFoodSchema.parse(req.body);
  if (body.loggedAt.getTime() < baby.dob.getTime()) {
    res.status(400).json({ error: 'Date cannot be before the baby was born' });
    return;
  }
  const log = await FoodLog.create({ babyId: baby._id, ...body });
  res.status(201).json({ log: publicLog(log) });
});

router.delete('/babies/:id/food/:logId', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const { logId } = req.params;
  const log = isValidObjectId(logId) ? await FoodLog.findById(logId) : null;
  if (!log || log.babyId.toString() !== baby._id.toString()) {
    res.status(404).json({ error: 'Food log not found' });
    return;
  }
  await log.deleteOne();
  res.json({ ok: true });
});

export default router;
