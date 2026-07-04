import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { encryptedFields } from '../lib/crypto/mongooseEncryption.js';

// A doctor's patient — the DOCTOR-OWNED tenant root of the EHR domain. Every
// patient-owned document is scoped by doctorUserId (the tenant boundary); Doctor A
// can never reach Doctor B's patients. Demographic PHI (name/dob/phone) is
// field-encrypted at rest; decryption happens in the response shaper, never via
// getters. patientUserId links a portal login (set once, later phase).
export type PatientSex = 'male' | 'female' | 'other' | 'unspecified';
export const PATIENT_SEXES: PatientSex[] = ['male', 'female', 'other', 'unspecified'];

export interface IPatient {
  doctorUserId: Types.ObjectId; // TENANT
  patientUserId?: Types.ObjectId; // portal link (sparse, until claimed)
  // Parent-app bridge (doctor "invite parent" flow): the parent User + Baby that
  // were created FROM this patient's demographics. Provenance-only, one-time copy
  // — later edits to Baby never sync back here and doctor routes never read Baby
  // data through these ids. Used for idempotent re-invites + erasure unlinking.
  parentUserId?: Types.ObjectId;
  babyId?: Types.ObjectId;
  specialtyTemplateId: Types.ObjectId;
  displayName: string; // PHI — encrypted at rest
  dob?: string; // PHI — encrypted ISO date string at rest
  sex: PatientSex;
  phone?: string; // PHI — encrypted at rest
  status: string; // a status key defined by the template
  archivedAt?: Date; // soft-delete
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
    parentUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', index: true, sparse: true },
    specialtyTemplateId: { type: Schema.Types.ObjectId, ref: 'SpecialtyTemplate', required: true },
    displayName: { type: String, required: true },
    dob: { type: String },
    sex: { type: String, enum: PATIENT_SEXES, default: 'unspecified' },
    phone: { type: String },
    status: { type: String, required: true },
    archivedAt: { type: Date },
  },
  { timestamps: true },
);

// Tenant-scoped list/query indexes (doctorUserId always leads).
patientSchema.index({ doctorUserId: 1, archivedAt: 1 });
patientSchema.index({ doctorUserId: 1, status: 1 });

// Encrypt PHI demographics at rest (idempotent; decrypt in the response shaper).
encryptedFields(patientSchema, ['displayName', 'dob', 'phone']);

export const Patient = model<IPatient>('Patient', patientSchema);
