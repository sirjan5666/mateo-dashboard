import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  addDays,
  ageLabelForOffsetDays,
  applicableEntries,
  doseStatus,
  istToday,
  sanitizeNote,
  scheduleEntries,
} from '../vaccines/schedule.js';

// Doctor-side IAP immunization SCHEDULE calculator. Decision support only:
//  - NON-PERSISTING — given a date of birth it computes the whole IAP schedule
//    (due dates + windows) and the due/overdue/upcoming status relative to today,
//    reusing the same schedule data (src/data/iap-schedule.json) and pure
//    derivations (src/vaccines/schedule.ts) as the parent vaccine tracker.
//  - Stores nothing and returns no PHI. "Given" ticking lives in the client only.
const router = Router();
router.use(requireAuth, requireRole('doctor'));

const schema = z.object({
  dob: z.coerce.date(),
  sex: z.enum(['male', 'female']).optional(),
});

router.post('/vaccines/schedule', (req, res) => {
  const { dob, sex } = schema.parse(req.body);
  const today = istToday();
  if (dob.getTime() > today.getTime()) {
    res.status(400).json({ error: 'Date of birth cannot be in the future' });
    return;
  }

  const entries = sex ? applicableEntries(sex) : scheduleEntries.filter((e) => e.applicableTo === 'all');

  const doses = entries
    .map((e) => {
      const windowStart = addDays(dob, e.windowStartDay);
      const windowEnd = addDays(dob, e.windowEndDay);
      return {
        id: e.id,
        vaccine: e.vaccine,
        doseLabel: e.doseLabel,
        series: e.series,
        protectsAgainst: e.protectsAgainst,
        notes: sanitizeNote(e.notes),
        dueDay: e.dueDay,
        ageLabel: ageLabelForOffsetDays(e.dueDay),
        dueDate: addDays(dob, e.dueDay).toISOString(),
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        status: doseStatus({ administeredOn: null, windowStart, windowEnd }, today),
      };
    })
    .sort((a, b) => a.dueDay - b.dueDay || a.vaccine.localeCompare(b.vaccine));

  const summary = { total: doses.length, due: 0, overdue: 0, upcoming: 0 };
  for (const d of doses) {
    if (d.status === 'due') summary.due += 1;
    else if (d.status === 'overdue') summary.overdue += 1;
    else if (d.status === 'upcoming') summary.upcoming += 1;
  }

  res.json({ dob: dob.toISOString(), sex: sex ?? null, doses, summary });
});

export default router;
