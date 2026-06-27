import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { LAB_ANALYTES, LAB_DATA_STATUS, flagValue, labById } from '../labs/reference.js';

// Doctor-side lab-results INTERPRETER. Decision support only:
//  - NON-PERSISTING — it flags entered values against indicative pediatric
//    reference ranges (labs/reference.ts) for an age. Stores nothing, no PHI.
//  - CLAUDE.md hard rule 1 — it reports low/normal/high vs an indicative range,
//    never a diagnosis. The reference data is DRAFT and carries that status.
const router = Router();
router.use(requireAuth, requireRole('doctor'));

router.get('/labs/catalog', (_req, res) => {
  res.json({ status: LAB_DATA_STATUS, analytes: LAB_ANALYTES });
});

const interpretSchema = z.object({
  ageMonths: z.number().min(0).max(1200),
  results: z
    .array(
      z.object({
        analyteId: z.string().min(1),
        value: z.number().finite(),
      }),
    )
    .max(40),
});

router.post('/labs/interpret', (req, res) => {
  const { ageMonths, results } = interpretSchema.parse(req.body);

  const flagged = results
    .map((r) => {
      const a = labById.get(r.analyteId);
      if (!a) return null;
      const flag = flagValue(a, r.value, ageMonths);
      return {
        analyteId: a.id,
        name: a.name,
        unit: a.unit,
        category: a.category,
        decimals: a.decimals,
        note: a.note ?? null,
        value: r.value,
        level: flag?.level ?? 'normal',
        refLow: flag?.low ?? null,
        refHigh: flag?.high ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const abnormal = flagged.filter((f) => f.level !== 'normal').length;
  res.json({ status: LAB_DATA_STATUS, ageMonths, results: flagged, abnormal });
});

export default router;
