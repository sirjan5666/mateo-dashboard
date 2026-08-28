import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export type LabOrderStatus = 'ordered' | 'sample_collected' | 'in_progress' | 'completed' | 'cancelled';
export const LAB_ORDER_STATUSES: LabOrderStatus[] = ['ordered', 'sample_collected', 'in_progress', 'completed', 'cancelled'];

export interface ILabTestResult {
  analyteId: string;
  name: string;
  value: number | null;
  unit: string;
  level: 'low' | 'normal' | 'high' | null;
  refLow: number | null;
  refHigh: number | null;
}

export interface ILabOrder {
  doctorUserId: Types.ObjectId;
  patientId: Types.ObjectId;
  orderNumber: string;
  tests: string[];
  status: LabOrderStatus;
  priority: 'routine' | 'urgent';
  results: ILabTestResult[];
  notes?: string;
  /** Uploaded report file (stored under uploadsDir; served via the report route). */
  reportFile?: string;
  reportUploadedAt?: Date;
  orderedAt: Date;
  sampleCollectedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const labTestResultSchema = new Schema<ILabTestResult>(
  {
    analyteId: { type: String, required: true },
    name: { type: String, required: true },
    value: { type: Number, default: null },
    unit: { type: String, required: true },
    level: { type: String, enum: ['low', 'normal', 'high', null], default: null },
    refLow: { type: Number, default: null },
    refHigh: { type: Number, default: null },
  },
  { _id: false },
);

const labOrderSchema = new Schema<ILabOrder>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    orderNumber: { type: String, required: true },
    tests: [{ type: String }],
    status: { type: String, enum: LAB_ORDER_STATUSES, default: 'ordered' },
    priority: { type: String, enum: ['routine', 'urgent'], default: 'routine' },
    results: [labTestResultSchema],
    notes: { type: String, maxlength: 2000 },
    reportFile: { type: String },
    reportUploadedAt: { type: Date },
    orderedAt: { type: Date, required: true },
    sampleCollectedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

labOrderSchema.index({ doctorUserId: 1, orderedAt: -1 });

export const LabOrder = model<ILabOrder>('LabOrder', labOrderSchema);
