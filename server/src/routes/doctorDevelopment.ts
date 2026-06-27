import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { milestones, milestoneStatus } from '../milestones/milestones.js';

// Doctor-side developmental-milestone SCREENING aid. Decision support only:
//  - NON-PERSISTING — given an age it returns the WHO/general milestone set with
//    each item's window + base status (achieved=false), reusing the same pure
//    reference + status logic (src/milestones/milestones.ts) as the parent
//    tracker. Stores nothing; the doctor's "achieved" ticking lives client-side.
//  - CLAUDE.md hard rule 1 — a "watch" (past-window, unachieved) item is a prompt
//    to consider a developmental review, NEVER a diagnosis. Wording stays neutral.
const router = Router();
router.use(requireAuth, requireRole('doctor'));

const schema = z.object({ ageMonths: z.number().min(0).max(72) });

router.post('/development/assess', (req, res) => {
  const { ageMonths } = schema.parse(req.body);
  const items = milestones
    .map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      domain: m.domain,
      source: m.source,
      windowStartMonth: m.windowStartMonth,
      windowEndMonth: m.windowEndMonth,
      status: milestoneStatus(m, ageMonths, false),
    }))
    .sort((a, b) => a.windowEndMonth - b.windowEndMonth || a.windowStartMonth - b.windowStartMonth);
  res.json({ ageMonths, milestones: items });
});

export default router;
