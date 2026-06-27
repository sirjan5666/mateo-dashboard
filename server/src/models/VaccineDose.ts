import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IVaccineDose {
  babyId: Types.ObjectId;
  // id from iap-schedule.json (e.g. "bcg", "dtp_1"); descriptive metadata
  // (protects_against, notes, series) is looked up from the schedule by this id
  // at read time, so pediatrician corrections to the JSON flow through.
  vaccineId: string;
  vaccineName: string;
  doseLabel: string;
  // Baby-specific timing, snapshotted from DOB at expansion time (UTC midnight).
  dueDate: Date;
  windowStart: Date;
  windowEnd: Date;
  administeredOn: Date | null; // null = pending
  reminderSentAt: Date | null; // set by the step-4 reminder job
}

const vaccineDoseSchema = new Schema<IVaccineDose>({
  babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
  vaccineId: { type: String, required: true },
  vaccineName: { type: String, required: true },
  doseLabel: { type: String, required: true },
  dueDate: { type: Date, required: true },
  windowStart: { type: Date, required: true },
  windowEnd: { type: Date, required: true },
  administeredOn: { type: Date, default: null },
  reminderSentAt: { type: Date, default: null },
});

// One row per (baby, schedule entry); also lets sync upsert by this key.
vaccineDoseSchema.index({ babyId: 1, vaccineId: 1 }, { unique: true });

export const VaccineDose = model<IVaccineDose>('VaccineDose', vaccineDoseSchema);
