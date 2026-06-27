import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IGrowthLog {
  babyId: Types.ObjectId;
  // When the measurement was taken (UTC midnight of the IST calendar date).
  loggedAt: Date;
  weightG?: number;
  lengthCm?: number;
  headCircCm?: number;
  createdAt: Date;
}

const growthLogSchema = new Schema<IGrowthLog>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    loggedAt: { type: Date, required: true },
    weightG: { type: Number },
    lengthCm: { type: Number },
    headCircCm: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const GrowthLog = model<IGrowthLog>('GrowthLog', growthLogSchema);
