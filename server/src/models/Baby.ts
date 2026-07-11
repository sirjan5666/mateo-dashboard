import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IBaby {
  userId: Types.ObjectId;
  name: string;
  dob: Date;
  sex: 'male' | 'female';
  birthWeightG?: number;
  birthLengthCm?: number;
  birthHeadCircCm?: number;
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
    birthWeightG: { type: Number },
    birthLengthCm: { type: Number },
    birthHeadCircCm: { type: Number },
    solidsStartedOn: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Baby = model<IBaby>('Baby', babySchema);
