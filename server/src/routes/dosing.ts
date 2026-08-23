// Pediatric dose-check API (doctor decision-support). Catalog + a deterministic
// check that resolves the baby's weight/age (from the doctor's consultation) and
// runs the dosing engine. The data is DRAFT (drug-dosing.ts) — the response
// carries its review status so the UI can show the "verify" disclaimer.
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Consultation } from '../models/Consultation.js';
import { Baby } from '../models/Baby.js';
import { GrowthLog } from '../models/GrowthLog.js';
import { BRANDS, DRUGS, DOSING_DATA_STATUS, getDrug } from '../data/drug-dosing.js';
import { checkDose } from '../medicines/dosing.js';
import { aiMedicineReference, assistantConfigured } from '../ai/provider.js';
import { IndiaMedicine } from '../models/IndiaMedicine.js';

const MS_PER_MONTH = 30.4375 * 24 * 60 * 60 * 1000;

const checkSchema = z.object({
  drugId: z.string().min(1),
  doseMg: z.number().positive().max(100000).optional(),
  dosesPerDay: z.number().int().min(1).max(24).optional(),
  // Either reference a consultation (server derives the baby's weight + age,
  // doctor-scoped) OR pass weight/age explicitly (standalone reference use).
  consultationId: z.string().optional(),
  weightKg: z.number().positive().max(150).optional(),
  ageMonths: z.number().min(0).max(1200).optional(),
});

const router = Router();

router.get('/catalog', requireAuth, requireRole('doctor'), (_req, res) => {
  res.json({ status: DOSING_DATA_STATUS, drugs: DRUGS, brands: BRANDS });
});

// Real-medicine typeahead over the IndiaMedicine reference catalog (~254k rows).
// Doctor-only. Anchored-prefix regex on the indexed nameLower — fast, and the
// primary source for the prescribe form's medicine search. Reference data only
// (brand + composition + pack); it carries NO dosing guidance.
const medSearchSchema = z.object({ q: z.string().trim().min(2).max(60) });

router.get('/medicines', requireAuth, requireRole('doctor'), async (req, res) => {
  const parsed = medSearchSchema.safeParse({ q: req.query.q });
  if (!parsed.success) {
    res.json({ medicines: [] });
    return;
  }
  const q = parsed.data.q.toLowerCase();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rows = await IndiaMedicine.find({ nameLower: { $regex: `^${escaped}` } })
    .select('name type packSize composition1 composition2')
    .sort({ nameLower: 1 })
    .limit(12)
    .lean();
  res.json({
    medicines: rows.map((r) => ({
      id: String(r._id),
      name: r.name,
      type: r.type ?? null,
      packSize: r.packSize ?? null,
      composition1: r.composition1 ?? null,
      composition2: r.composition2 ?? null,
    })),
  });
});

// AI medicine reference — a doctor-only FALLBACK for names not in the curated
// catalog. Results are AI-generated + UNVERIFIED (see the disclaimer, surfaced
// in the UI); the doctor verifies and prescribes. Degrades to enabled:false when
// no LLM provider is configured. Never fabricates a dose; never mentions formula.
const AI_MEDICINE_DISCLAIMER =
  'AI-generated reference — NOT verified. Confirm the name, dose, interactions and contraindications against a current prescribing reference before prescribing. You remain responsible.';

const aiSearchSchema = z.object({ query: z.string().trim().min(2).max(80) });

router.post('/ai-search', requireAuth, requireRole('doctor'), async (req, res) => {
  const { query } = aiSearchSchema.parse(req.body);
  if (!assistantConfigured()) {
    res.json({ enabled: false, medicines: [], disclaimer: AI_MEDICINE_DISCLAIMER });
    return;
  }
  try {
    const medicines = await aiMedicineReference(query);
    res.json({ enabled: true, medicines, disclaimer: AI_MEDICINE_DISCLAIMER });
  } catch {
    res.json({ enabled: true, medicines: [], disclaimer: AI_MEDICINE_DISCLAIMER, error: 'AI reference is unavailable right now.' });
  }
});

router.post('/check', requireAuth, requireRole('doctor'), async (req, res) => {
  const body = checkSchema.parse(req.body);
  const drug = getDrug(body.drugId);
  if (!drug) {
    res.status(404).json({ error: 'Unknown drug' });
    return;
  }

  let weightKg = body.weightKg;
  let ageMonths = body.ageMonths;
  let baby: { name: string } | null = null;

  if (body.consultationId) {
    const consult = isValidObjectId(body.consultationId) ? await Consultation.findById(body.consultationId) : null;
    if (!consult) {
      res.status(404).json({ error: 'Consultation not found' });
      return;
    }
    // Only the consulting doctor may pull a baby's clinical data for the check.
    if (consult.doctorUserId.toString() !== req.userId) {
      res.status(403).json({ error: 'Only the consulting doctor can run this check.' });
      return;
    }
    const babyDoc = consult.babyId ? await Baby.findById(consult.babyId) : null;
    if (babyDoc) {
      baby = { name: babyDoc.name };
      ageMonths = (Date.now() - babyDoc.dob.getTime()) / MS_PER_MONTH;
      const latest = await GrowthLog.findOne({ babyId: babyDoc._id, weightG: { $ne: null } }).sort({ loggedAt: -1 });
      if (latest?.weightG != null) weightKg = latest.weightG / 1000;
    }
  }

  if (ageMonths == null) {
    res.status(400).json({ error: 'Provide a consultation with a baby, or the baby’s age in months.' });
    return;
  }

  const result = checkDose(drug, { weightKg, ageMonths, doseMg: body.doseMg, dosesPerDay: body.dosesPerDay });
  res.json({
    result,
    resolved: {
      weightKg: weightKg != null ? Math.round(weightKg * 100) / 100 : null,
      ageMonths: Math.round(ageMonths * 10) / 10,
      babyName: baby?.name ?? null,
    },
  });
});

export default router;
