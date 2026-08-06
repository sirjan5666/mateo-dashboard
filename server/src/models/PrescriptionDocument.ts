import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { encryptedFields } from '../lib/crypto/mongooseEncryption.js';

/**
 * The printable prescription — the HEADER of a prescription document.
 *
 * The medication lines are NOT stored here. They stay in DoctorPrescription,
 * linked by `documentId`, so a medicine still has exactly one home: the Patient
 * Workspace tab, the clinic-wide list, the parent-side medicine reminders and
 * this printed sheet all read the same rows. Duplicating the lines into the
 * document is what would let a printed sheet drift from the active medication
 * list — the one thing a prescription must never do.
 *
 * Everything clinical here is free text about a child, so it is field-encrypted
 * at rest and decrypted only in the response shaper (same rule as Encounter).
 */
export interface IPrescriptionDocument {
  doctorUserId: Types.ObjectId; // TENANT
  patientId: Types.ObjectId;
  /** Which clinic's letterhead this was issued on. */
  locationId?: Types.ObjectId;
  encounterId?: Types.ObjectId;
  /** Human-facing id printed top-right, e.g. RX250518-00123. Unique per doctor. */
  number: string;
  issuedAt: Date;
  diagnosis?: string; // PHI — encrypted
  /** "Review after N days". Undefined = no review advised. */
  reviewAfterDays?: number;
  /** Investigations advised, one per printed line. PHI — encrypted as JSON. */
  investigationsEnc?: string;
  /** General advice, one per printed bullet. PHI-adjacent — encrypted as JSON. */
  adviceEnc?: string;
  /** Weight in kg at issue time, copied from the growth record so a reprint of an
   *  old prescription shows the weight it was actually dosed against. */
  weightKg?: number;
  createdAt: Date;
  updatedAt: Date;
}

const prescriptionDocumentSchema = new Schema<IPrescriptionDocument>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'ClinicLocation' },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    number: { type: String, required: true },
    issuedAt: { type: Date, required: true },
    diagnosis: { type: String },
    reviewAfterDays: { type: Number, min: 0, max: 365 },
    investigationsEnc: { type: String },
    adviceEnc: { type: String },
    weightKg: { type: Number, min: 0, max: 300 },
  },
  { timestamps: true },
);

prescriptionDocumentSchema.index({ doctorUserId: 1, patientId: 1, issuedAt: -1 });
// Per-doctor prescription numbers must be unique — makes a concurrent-create
// collision a duplicate-key error to retry rather than two sheets with one id.
prescriptionDocumentSchema.index({ doctorUserId: 1, number: 1 }, { unique: true });

encryptedFields(prescriptionDocumentSchema, ['diagnosis', 'investigationsEnc', 'adviceEnc']);

export const PrescriptionDocument = model<IPrescriptionDocument>('PrescriptionDocument', prescriptionDocumentSchema);
