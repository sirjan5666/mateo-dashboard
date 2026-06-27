import { Types } from 'mongoose';
import { VaccineDose } from '../models/VaccineDose.js';
import { applicableEntries, addDays } from './schedule.js';
import type { Sex } from './schedule.js';

/**
 * Make a baby's VaccineDose rows match the schedule for its DOB and sex.
 * Called on baby creation and whenever DOB or sex changes. Idempotent:
 * recomputes due/window dates for existing rows but never touches
 * administeredOn / reminderSentAt, so a parent's records survive a DOB edit.
 */
export async function syncDosesForBaby(baby: { id: string; dob: Date; sex: Sex }): Promise<void> {
  const babyId = new Types.ObjectId(baby.id);
  const entries = applicableEntries(baby.sex);

  const ops = entries.map((e) => ({
    updateOne: {
      filter: { babyId, vaccineId: e.id },
      update: {
        $set: {
          vaccineName: e.vaccine,
          doseLabel: e.doseLabel,
          dueDate: addDays(baby.dob, e.dueDay),
          windowStart: addDays(baby.dob, e.windowStartDay),
          windowEnd: addDays(baby.dob, e.windowEndDay),
        },
        $setOnInsert: { administeredOn: null, reminderSentAt: null },
      },
      upsert: true,
    },
  }));
  if (ops.length > 0) await VaccineDose.bulkWrite(ops);

  // Sex change can make some doses (e.g. HPV) inapplicable. Drop only pending
  // ones, so an already-recorded administration is never silently lost.
  const applicableIds = entries.map((e) => e.id);
  await VaccineDose.deleteMany({
    babyId,
    vaccineId: { $nin: applicableIds },
    administeredOn: null,
  });
}
