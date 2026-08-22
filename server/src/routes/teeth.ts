import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { ToothLog } from '../models/ToothLog.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { isFutureISTDate } from '../lib/ist.js';

const MIN_DATE = new Date('2000-01-01T00:00:00.000Z');

/**
 * Canonical tooth identifiers. 20 primary teeth total.
 * Naming: <jaw>_<type>_<side> where jaw = upper|lower, side = left|right.
 */
const VALID_TOOTH_IDS = [
  'upper_central_incisor_left',
  'upper_central_incisor_right',
  'upper_lateral_incisor_left',
  'upper_lateral_incisor_right',
  'upper_canine_left',
  'upper_canine_right',
  'upper_first_molar_left',
  'upper_first_molar_right',
  'upper_second_molar_left',
  'upper_second_molar_right',
  'lower_central_incisor_left',
  'lower_central_incisor_right',
  'lower_lateral_incisor_left',
  'lower_lateral_incisor_right',
  'lower_canine_left',
  'lower_canine_right',
  'lower_first_molar_left',
  'lower_first_molar_right',
  'lower_second_molar_left',
  'lower_second_molar_right',
] as const;

const createToothSchema = z.object({
  toothId: z.enum(VALID_TOOTH_IDS),
  appearedOn: z.coerce
    .date()
    .refine((d) => d.getTime() >= MIN_DATE.getTime(), 'Date is too far in the past')
    .refine((d) => !isFutureISTDate(d), 'Date cannot be in the future'),
});

function publicLog(log: { id: string; toothId: string; appearedOn: Date; createdAt: Date }) {
  return {
    id: log.id,
    toothId: log.toothId,
    appearedOn: log.appearedOn,
    createdAt: log.createdAt,
  };
}

const router = Router();

// GET /babies/:id/teeth — list all tooth logs for this baby
router.get('/babies/:id/teeth', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const logs = await ToothLog.find({ babyId: baby._id }).sort({ appearedOn: 1 });
  res.json({
    logs: logs.map((l) => publicLog(l)),
    total: VALID_TOOTH_IDS.length,
    appeared: logs.length,
  });
});

// POST /babies/:id/teeth — mark a tooth as appeared
router.post('/babies/:id/teeth', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const body = createToothSchema.parse(req.body);
  if (body.appearedOn.getTime() < baby.dob.getTime()) {
    res.status(400).json({ error: 'Date cannot be before the baby was born' });
    return;
  }
  // Upsert: if tooth was already logged, update the date.
  const log = await ToothLog.findOneAndUpdate(
    { babyId: baby._id, toothId: body.toothId },
    { $set: { appearedOn: body.appearedOn } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.status(201).json({ log: publicLog(log) });
});

// DELETE /babies/:id/teeth/:logId — remove a tooth log
router.delete('/babies/:id/teeth/:logId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const { logId } = req.params;
  const log = isValidObjectId(logId) ? await ToothLog.findById(logId) : null;
  if (!log || log.babyId.toString() !== baby._id.toString()) {
    res.status(404).json({ error: 'Tooth log not found' });
    return;
  }
  await log.deleteOne();
  res.json({ ok: true });
});

export default router;
