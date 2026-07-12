import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { VaccineDose } from '../models/VaccineDose.js';
import type { IVaccineDose } from '../models/VaccineDose.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby, loadOwnedDose } from '../middleware/ownership.js';
import { awardTrackerEntry, reverse } from '../points/service.js';
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

router.get('/babies/:id/vaccines', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
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

router.patch('/vaccines/:doseId', requireAuth, requireSubscription, loadOwnedDose, async (req, res) => {
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
  // Marking a dose given earns ★ (idempotent per dose); clearing it claws back.
  if (administeredOn !== null) {
    void awardTrackerEntry(req.userId!, 'vaccine_dose', dose.id, `earn:vaccine:${dose.id}`).catch((e) =>
      console.error('sitare award failed:', e),
    );
  } else {
    void reverse({ dedupeKey: `earn:vaccine:${dose.id}`, reason: 'vaccine_cleared' }).catch((e) =>
      console.error('sitare reverse failed:', e),
    );
  }
  res.json({ dose: publicDose(dose, baby.dob, today) });
});

// ── Onboarding baseline seeding — NOT subscription-gated ──────────────────────
// Recording which vaccines were ALREADY given is one-time account SETUP, so a
// not-yet-subscribed (doctor-invited) parent may do it during onboarding. Ongoing
// vaccine-tracker use — the full list + individual edits above — stays behind
// requireSubscription. These two routes only READ the not-yet-given candidates and
// SET them given once (never clear), so they can't be used to bypass the paywall.
router.get('/babies/:id/vaccines/baseline', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const today = istToday();
  const doses = await VaccineDose.find({ babyId: baby._id }).sort({ dueDate: 1, vaccineName: 1 });
  // Candidates for "already given": the window has opened (due/overdue) + unmarked.
  const candidates = doses.filter((d) => !d.administeredOn && ['due', 'overdue'].includes(doseStatus(d, today)));
  res.json({ doses: candidates.map((d) => publicDose(d, baby.dob, today)) });
});

const baselineSchema = z.object({ doseIds: z.array(z.string()).max(200) });
router.post('/babies/:id/vaccines/baseline', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const { doseIds } = baselineSchema.parse(req.body);
  let marked = 0;
  for (const id of doseIds.filter((x) => isValidObjectId(x))) {
    const dose = await VaccineDose.findOne({ _id: id, babyId: baby._id });
    if (dose && !dose.administeredOn) {
      dose.administeredOn = dose.dueDate; // recorded as given on its scheduled date
      await dose.save();
      marked++;
    }
  }
  res.json({ ok: true, marked });
});

export default router;
