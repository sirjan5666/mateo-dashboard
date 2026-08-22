import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export type SleepKind = 'nap' | 'night';
export type SleepQuality = 'settled' | 'restless' | 'unsettled';

export interface ISleepInterval {
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
}

export interface ISleepLog {
  babyId: Types.ObjectId;
  loggedAt: Date;
  kind: SleepKind;
  durationMin: number;
  intervals?: ISleepInterval[];
  quality?: SleepQuality;
  notes?: string;
  createdAt: Date;
}

const sleepIntervalSchema = new Schema<ISleepInterval>(
  {
    startTime: { type: String },
    endTime: { type: String },
    durationMinutes: { type: Number, required: true, min: 1, max: 1440 },
  },
  { _id: false },
);

const sleepLogSchema = new Schema<ISleepLog>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    loggedAt: { type: Date, required: true },
    kind: { type: String, enum: ['nap', 'night'], required: true },
    durationMin: { type: Number, required: true, min: 1, max: 1440 },
    intervals: { type: [sleepIntervalSchema], default: undefined },
    quality: { type: String, enum: ['settled', 'restless', 'unsettled'] },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const SleepLog = model<ISleepLog>('SleepLog', sleepLogSchema);
