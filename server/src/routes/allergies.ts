import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { Allergy, ALLERGY_SEVERITIES } from '../models/Allergy.js';
import type { IAllergy, AllergySeverity } from '../models/Allergy.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby } from '../middleware/ownership.js';

const createAllergySchema = z.object({
  name: z.string().trim().min(1, 'Enter the allergen').max(100),
  severity: z.enum(ALLERGY_SEVERITIES as [AllergySeverity, ...AllergySeverity[]]).optional().default('mild'),
  reaction: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
});

function publicAllergy(a: IAllergy & { id: string }) {
  return {
    id: a.id,
    name: a.name,
    severity: a.severity,
    reaction: a.reaction ?? null,
    notes: a.notes ?? null,
    createdAt: a.createdAt,
  };
}

const router = Router();

router.get('/babies/:id/allergies', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const allergies = await Allergy.find({ babyId: req.baby!._id }).sort({ createdAt: -1 });
  res.json({ allergies: allergies.map((a) => publicAllergy(a)) });
});

router.post('/babies/:id/allergies', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const body = createAllergySchema.parse(req.body);
  const a = await Allergy.create({ babyId: req.baby!._id, ...body });
  res.status(201).json({ allergy: publicAllergy(a) });
});

router.delete('/babies/:id/allergies/:allergyId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const { allergyId } = req.params;
  const a = isValidObjectId(allergyId) ? await Allergy.findById(allergyId) : null;
  if (!a || a.babyId.toString() !== req.baby!._id.toString()) {
    res.status(404).json({ error: 'Allergy not found' });
    return;
  }
  await a.deleteOne();
  res.json({ ok: true });
});

export default router;
