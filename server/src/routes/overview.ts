import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Baby } from '../models/Baby.js';
import { VaccineDose } from '../models/VaccineDose.js';
import type { IVaccineDose } from '../models/VaccineDose.js';
import { doseStatus, istToday } from '../vaccines/schedule.js';
import type { DoseStatus } from '../vaccines/schedule.js';

const router = Router();

router.use(requireAuth);

interface VaccineCounts {
  done: number;
  due: number;
  overdue: number;
  upcoming: number;
  total: number;
}

function emptyCounts(): VaccineCounts {
  return { done: 0, due: 0, overdue: 0, upcoming: 0, total: 0 };
}

/**
 * Dashboard aggregate for the authenticated user — per-baby vaccine summaries,
 * the next actionable dose per baby, headline totals, and a cross-baby
 * upcoming/attention feed. All figures derived from real tracker data.
 */
router.get('/', async (req, res) => {
  const babies = await Baby.find({ userId: req.userId }).sort({ createdAt: -1 });
  const babyIds = babies.map((b) => b._id);
  const doses = babyIds.length > 0 ? await VaccineDose.find({ babyId: { $in: babyIds } }) : [];
  const today = istToday();

  const counts = new Map<string, VaccineCounts>();
  // Earliest pending (not-yet-given) dose per baby — overdue items sort first.
  const nextDue = new Map<string, IVaccineDose>();
  const pending: { dose: IVaccineDose; status: DoseStatus }[] = [];

  for (const dose of doses) {
    const key = dose.babyId.toString();
    const c = counts.get(key) ?? emptyCounts();
    const status = doseStatus(dose, today);
    c[status]++;
    c.total++;
    counts.set(key, c);

    if (status !== 'done') {
      pending.push({ dose, status });
      const current = nextDue.get(key);
      if (!current || dose.dueDate.getTime() < current.dueDate.getTime()) nextDue.set(key, dose);
    }
  }

  const babyViews = babies.map((b) => {
    const key = b._id.toString();
    const c = counts.get(key) ?? emptyCounts();
    const nd = nextDue.get(key);
    return {
      id: b.id as string,
      name: b.name,
      dob: b.dob,
      sex: b.sex,
      birthWeightG: b.birthWeightG,
      birthLengthCm: b.birthLengthCm,
      birthHeadCircCm: b.birthHeadCircCm,
      createdAt: b.createdAt,
      vaccines: c,
      nextDue: nd
        ? {
            vaccineName: nd.vaccineName,
            doseLabel: nd.doseLabel,
            dueDate: nd.dueDate,
            status: doseStatus(nd, today),
          }
        : null,
    };
  });

  const dosesGiven = babyViews.reduce((sum, b) => sum + b.vaccines.done, 0);
  const dueSoon = babyViews.reduce((sum, b) => sum + b.vaccines.due, 0);
  const overdue = babyViews.reduce((sum, b) => sum + b.vaccines.overdue, 0);
  // "Up to date" = of the doses whose window has CLOSED (given + overdue), how
  // many are given. A dose still inside its open window ('due') is on-time, not
  // behind, so it is excluded — a baby with only open/future windows reads 100%.
  const windowClosed = dosesGiven + overdue;
  const upToDatePct = windowClosed === 0 ? 100 : Math.round((dosesGiven / windowClosed) * 100);

  const byBabyName = new Map(babies.map((b) => [b._id.toString(), b.name]));
  const upcoming = pending
    .sort((a, b) => a.dose.dueDate.getTime() - b.dose.dueDate.getTime())
    .slice(0, 6)
    .map(({ dose, status }) => ({
      babyId: dose.babyId.toString(),
      babyName: byBabyName.get(dose.babyId.toString()) ?? '',
      vaccineName: dose.vaccineName,
      doseLabel: dose.doseLabel,
      dueDate: dose.dueDate,
      status,
    }));

  res.json({
    babies: babyViews,
    totals: { babies: babies.length, dosesGiven, dueSoon, overdue, upToDatePct },
    upcoming,
  });
});

export default router;
