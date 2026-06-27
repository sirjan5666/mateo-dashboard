import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A prescription issued by a doctor for a consultation. The doctor's and
// patient's header details are composed at read time from the profile + baby, so
// edits there flow through; this document holds the clinical content.
export interface IPrescriptionItem {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

// 'doctor' = issued by a Mateo doctor in a consultation; 'self' = the parent
// added their own (typed in, or read from a prescription photo by OCR).
export type PrescriptionSource = 'doctor' | 'self';

export interface IPrescription {
  consultationId?: Types.ObjectId; // absent for self-added
  doctorUserId?: Types.ObjectId; // absent for self-added
  parentUserId: Types.ObjectId;
  babyId?: Types.ObjectId;
  source: PrescriptionSource;
  diagnosis: string;
  items: IPrescriptionItem[];
  advice: string;
  followUpDate?: Date;
  createdAt: Date;
}

const itemSchema = new Schema<IPrescriptionItem>(
  {
    medicine: { type: String, required: true, trim: true },
    dosage: { type: String, default: '', trim: true },
    frequency: { type: String, default: '', trim: true },
    duration: { type: String, default: '', trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false },
);

const prescriptionSchema = new Schema<IPrescription>(
  {
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation', index: true },
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    parentUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby' },
    source: { type: String, enum: ['doctor', 'self'], default: 'doctor' },
    diagnosis: { type: String, default: '', trim: true },
    items: { type: [itemSchema], default: [] },
    advice: { type: String, default: '', trim: true },
    followUpDate: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Prescription = model<IPrescription>('Prescription', prescriptionSchema);
