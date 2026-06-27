import { Router } from 'express';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { VaccineDose } from '../models/VaccineDose.js';
import type { IVaccineDose } from '../models/VaccineDose.js';
import { requireAuth } from '../middleware/auth.js';
import { loadOwnedBaby, loadOwnedDose } from '../middleware/ownership.js';
import {
  ageLabelForOffsetDays,
  daysBetween,
  doseStatus,
  istToday,
  sanitizeNote,
  scheduleById,
} from '../vaccines/schedule.js';
import type { DoseStatus } from '../vaccines/schedule.js';

function publicDose(dose: HydratedDocument<IVaccineDose>, dob: Date, today: Date) {
  // Descriptive metadata (series, protects_against, notes) is looked up live so
  // pediatrician corrections to iap-schedule.json flow through without migration.
  const entry = scheduleById.get(dose.vaccineId);
  return {
    id: dose.id as string,
    vaccineId: dose.vaccineId,
    vaccineName: dose.vaccineName,
    doseLabel: dose.doseLabel,
    series: entry?.series ?? null,
    protectsAgainst: entry?.protectsAgainst ?? null,
    notes: entry ? sanitizeNote(entry.notes) : '',
    dueDate: dose.dueDate,
    windowStart: dose.windowStart,
    windowEnd: dose.windowEnd,
    administeredOn: dose.administeredOn,
    status: doseStatus(dose, today),
    ageLabel: ageLabelForOffsetDays(daysBetween(dob, dose.dueDate)),
  };
}

// null clears an administration; a date records one. null is tried first so a
// null body is not coerced to the epoch by z.coerce.date().
const markDoseSchema = z.object({
  administeredOn: z.union([z.null(), z.coerce.date()]),
});

const router = Router();

router.get('/babies/:id/vaccines', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const doses = await VaccineDose.find({ babyId: baby._id }).sort({ dueDate: 1, vaccineName: 1 });
  const today = istToday();
  const items = doses.map((d) => publicDose(d, baby.dob, today));

  const summary: Record<DoseStatus, number> & { total: number } = {
    total: items.length,
    done: 0,
    due: 0,
    overdue: 0,
    upcoming: 0,
  };
  for (const d of items) summary[d.status]++;

  res.json({ doses: items, summary });
});

router.patch('/vaccines/:doseId', requireAuth, loadOwnedDose, async (req, res) => {
  const { administeredOn } = markDoseSchema.parse(req.body);
  const dose = req.dose!;
  const baby = req.baby!;
  const today = istToday();

  if (administeredOn !== null) {
    if (administeredOn.getTime() > today.getTime()) {
      res.status(400).json({ error: 'Administration date cannot be in the future' });
      return;
    }
    if (administeredOn.getTime() < baby.dob.getTime()) {
      res.status(400).json({ error: 'Administration date cannot be before the baby was born' });
      return;
    }
  }

  dose.administeredOn = administeredOn;
  await dose.save();
  res.json({ dose: publicDose(dose, baby.dob, today) });
});

export default router;
