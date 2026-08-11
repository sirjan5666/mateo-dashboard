import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { encryptedFields } from '../lib/crypto/mongooseEncryption.js';

/**
 * The three per-patient stores the Patient Workspace tabs need and the EHR did
 * not have: recorded growth measurements, clinical notes, and documents.
 *
 * All doctor-owned and tenant-scoped (doctorUserId), same boundary as Encounter.
 *
 * PHI HANDLING follows the Encounter/Invoice precedent: free text is
 * field-encrypted at rest and decrypted only in the response shaper, while
 * NUMBERS stay plain so growth can be charted and aggregated without decrypting
 * every row. A measurement value is not identifying on its own; the link to the
 * patient is what is sensitive, and that is the tenant-scoped id.
 */

// ── Growth measurements ──────────────────────────────────────────────────────

export interface IGrowthMeasurement {
  doctorUserId: Types.ObjectId; // TENANT
  patientId: Types.ObjectId;
  takenAt: Date;
  /** Plain so charts can be built in the DB. All optional — a visit may record one. */
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  /** Derived on write from weight + height when both are present. */
  bmi?: number;
  recordedBy?: string;
  note?: string; // PHI — encrypted
  createdAt: Date;
  updatedAt: Date;
}

const growthSchema = new Schema<IGrowthMeasurement>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    takenAt: { type: Date, required: true },
    weightKg: { type: Number, min: 0, max: 300 },
    heightCm: { type: Number, min: 0, max: 250 },
    headCircumferenceCm: { type: Number, min: 0, max: 100 },
    bmi: { type: Number, min: 0, max: 200 },
    recordedBy: { type: String, trim: true, maxlength: 120 },
    note: { type: String },
  },
  { timestamps: true },
);
growthSchema.index({ doctorUserId: 1, patientId: 1, takenAt: -1 });
encryptedFields(growthSchema, ['note']);

export const GrowthMeasurement = model<IGrowthMeasurement>('GrowthMeasurement', growthSchema);

// ── Clinical notes ───────────────────────────────────────────────────────────

export const NOTE_CATEGORIES = [
  'Clinical Note', 'General Note', 'Follow-up Note', 'Treatment Note', 'Observation',
] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export interface IPatientNote {
  doctorUserId: Types.ObjectId; // TENANT
  patientId: Types.ObjectId;
  category: NoteCategory;
  /** PHI — the whole point of a note is the clinical detail. Encrypted. */
  text: string;
  author: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<IPatientNote>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    category: { type: String, enum: NOTE_CATEGORIES, default: 'General Note' },
    text: { type: String, required: true },
    author: { type: String, trim: true, maxlength: 120 },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);
// Pinned first, then newest — the order the Notes tab renders.
noteSchema.index({ doctorUserId: 1, patientId: 1, pinned: -1, createdAt: -1 });
encryptedFields(noteSchema, ['text']);

export const PatientNote = model<IPatientNote>('PatientNote', noteSchema);

// ── Documents ────────────────────────────────────────────────────────────────

export const DOCUMENT_TYPES = [
  'Identity', 'Medical Record', 'Report', 'Lab Report', 'Prescription', 'Notes', 'Other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface IPatientDocument {
  doctorUserId: Types.ObjectId; // TENANT
  patientId: Types.ObjectId;
  /** Display name — PHI-adjacent ("Blood Test Report — Rhea"), so encrypted. */
  name: string;
  type: DocumentType;
  /** Stored file name on disk; never the original client-supplied path. */
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy?: string;
  note?: string; // PHI — encrypted
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IPatientDocument>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: DOCUMENT_TYPES, default: 'Other' },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    uploadedBy: { type: String, trim: true, maxlength: 120 },
    note: { type: String },
  },
  { timestamps: true },
);
documentSchema.index({ doctorUserId: 1, patientId: 1, createdAt: -1 });
encryptedFields(documentSchema, ['name', 'note']);

export const PatientDocument = model<IPatientDocument>('PatientDocument', documentSchema);

// ── Immunisations ────────────────────────────────────────────────────────────

export interface IImmunisation {
  doctorUserId: Types.ObjectId; // TENANT
  patientId: Types.ObjectId;
  vaccine: string;
  doseLabel?: string;
  status: 'given' | 'due' | 'overdue';
  givenAt?: Date;
  dueAt?: Date;
  batch?: string;
  administeredBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const immunisationSchema = new Schema<IImmunisation>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    vaccine: { type: String, required: true, trim: true, maxlength: 120 },
    doseLabel: { type: String, trim: true, maxlength: 60 },
    status: { type: String, enum: ['given', 'due', 'overdue'], default: 'due' },
    givenAt: { type: Date },
    dueAt: { type: Date },
    batch: { type: String, trim: true, maxlength: 40 },
    administeredBy: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true },
);
immunisationSchema.index({ doctorUserId: 1, patientId: 1, dueAt: 1 });

export const Immunisation = model<IImmunisation>('Immunisation', immunisationSchema);
