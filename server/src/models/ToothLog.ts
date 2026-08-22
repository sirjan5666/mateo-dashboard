import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IToothLog {
  babyId: Types.ObjectId;
  toothId: string;
  appearedOn: Date;
  createdAt: Date;
}

const toothLogSchema = new Schema<IToothLog>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    toothId: { type: String, required: true, trim: true },
    appearedOn: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One record per tooth per baby — never duplicate.
toothLogSchema.index({ babyId: 1, toothId: 1 }, { unique: true });

export const ToothLog = model<IToothLog>('ToothLog', toothLogSchema);
