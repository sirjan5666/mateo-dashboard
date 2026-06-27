import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export type RecordType = 'checkup' | 'illness' | 'medication' | 'allergy' | 'measurement' | 'note' | 'other';

export interface IHealthRecord {
  babyId: Types.ObjectId;
  recordType: RecordType;
  title: string;
  recordDate: Date;
  provider?: string;
  notes?: string;
  createdAt: Date;
}

const healthRecordSchema = new Schema<IHealthRecord>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    recordType: { type: String, enum: ['checkup', 'illness', 'medication', 'allergy', 'measurement', 'note', 'other'], required: true },
    title: { type: String, required: true, trim: true },
    recordDate: { type: Date, required: true },
    provider: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const HealthRecord = model<IHealthRecord>('HealthRecord', healthRecordSchema);
