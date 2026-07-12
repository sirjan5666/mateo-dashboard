import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IBaby {
  userId: Types.ObjectId;
  name: string;
  dob: Date;
  sex: 'male' | 'female';
  // Chosen cartoon avatar key, e.g. "boy-01" / "girl-07"; optional (falls back to initials)
  avatar?: string;
  birthWeightG?: number;
  birthLengthCm?: number;
  birthHeadCircCm?: number;
  // Gestational age at birth in weeks (24–42). < 37 => premature → the growth +
  // milestone journeys evaluate against CORRECTED age (see lib/correctedAge.ts).
  // Vaccines and solids stay on chronological age.
  gestationalAgeWeeks?: number;
  // Static baseline notes captured once at onboarding (not trackers). Feed the AI
  // context + surface on the profile; feeding stays brand-neutral / IMS-compliant
  // (breastfed | mixed — the app never records or recommends formula).
  bloodGroup?: string;
  feedingType?: 'breastfed' | 'mixed';
  knownAllergies?: string[];
  pediatricianName?: string;
  pediatricianPhone?: string;
  // Onboarding feeding baseline: the date solids were first introduced. Absent means
  // "not started" (exclusively breastfeeding). Drives the nutrition journey + the
  // 6-month "ready to start solids?" nudge. Guidance stays breastfeeding-first / IMS-compliant.
  solidsStartedOn?: Date;
  createdAt: Date;
}

const babySchema = new Schema<IBaby>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    // Stored as a UTC Date; age is always computed from dob at read time, never stored
    dob: { type: Date, required: true },
    sex: { type: String, enum: ['male', 'female'], required: true },
    avatar: { type: String },
    birthWeightG: { type: Number },
    birthLengthCm: { type: Number },
    birthHeadCircCm: { type: Number },
    gestationalAgeWeeks: { type: Number, min: 20, max: 42 },
    bloodGroup: { type: String, trim: true },
    feedingType: { type: String, enum: ['breastfed', 'mixed'] },
    knownAllergies: { type: [String], default: undefined },
    pediatricianName: { type: String, trim: true },
    pediatricianPhone: { type: String, trim: true },
    solidsStartedOn: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Baby = model<IBaby>('Baby', babySchema);
