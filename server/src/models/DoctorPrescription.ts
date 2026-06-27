import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { encryptedFields } from '../lib/crypto/mongooseEncryption.js';

// A single prescribed medication for a patient (one row per drug), optionally tied
// to an encounter. Doctor-owned + tenant-scoped, distinct from the marketplace-side
// `Prescription` model. The medication free-text (drug/dose/frequency/duration/
// instructions) is PHI and is field-encrypted at rest — decrypted only in the shaper.
export type RxStatus = 'active' | 'completed' | 'stopped';
export const RX_STATUSES: RxStatus[] = ['active', 'completed', 'stopped'];

export interface IDoctorPrescription {
  doctorUserId: Types.ObjectId; // TENANT
  patientId: Types.ObjectId;
  encounterId?: Types.ObjectId; // optional link to the visit it was issued at
  date: Date;
  drug: string; // PHI — encrypted at rest
  dose?: string; // PHI — encrypted at rest (e.g. "250 mg")
  frequency?: string; // PHI — encrypted (e.g. "Twice daily")
  duration?: string; // PHI — encrypted (e.g. "5 days")
  instructions?: string; // PHI — encrypted (e.g. "After food")
  status: RxStatus;
  createdAt: Date;
  updatedAt: Date;
}

const prescriptionSchema = new Schema<IDoctorPrescription>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    date: { type: Date, required: true },
    drug: { type: String, required: true },
    dose: { type: String },
    frequency: { type: String },
    duration: { type: String },
    instructions: { type: String },
    status: { type: String, enum: RX_STATUSES, default: 'active' },
  },
  { timestamps: true },
);
// Tenant-scoped patient medication list (newest first).
prescriptionSchema.index({ doctorUserId: 1, patientId: 1, date: -1 });

encryptedFields(prescriptionSchema, ['drug', 'dose', 'frequency', 'duration', 'instructions']);

export const DoctorPrescription = model<IDoctorPrescription>('DoctorPrescription', prescriptionSchema);
