import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { encryptedFields } from '../lib/crypto/mongooseEncryption.js';

// A clinical encounter (visit note) for a patient, in SOAP form. Doctor-owned and
// tenant-scoped like every EHR document. The four SOAP narrative fields are PHI and
// are field-encrypted at rest (fixed top-level string paths → the encryptedFields
// plugin fits directly); decryption happens in the response shaper, never via getters.
export type EncounterKind = 'visit' | 'follow_up' | 'phone' | 'procedure' | 'note';
export const ENCOUNTER_KINDS: EncounterKind[] = ['visit', 'follow_up', 'phone', 'procedure', 'note'];

export interface IEncounter {
  doctorUserId: Types.ObjectId; // TENANT
  patientId: Types.ObjectId;
  date: Date; // when the encounter happened
  kind: EncounterKind;
  subjective?: string; // PHI — encrypted at rest
  objective?: string; // PHI — encrypted at rest
  assessment?: string; // PHI — encrypted at rest
  plan?: string; // PHI — encrypted at rest
  createdAt: Date;
  updatedAt: Date;
}

const encounterSchema = new Schema<IEncounter>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    date: { type: Date, required: true },
    kind: { type: String, enum: ENCOUNTER_KINDS, default: 'visit' },
    subjective: { type: String },
    objective: { type: String },
    assessment: { type: String },
    plan: { type: String },
  },
  { timestamps: true },
);
// Tenant-scoped patient timeline (newest first).
encounterSchema.index({ doctorUserId: 1, patientId: 1, date: -1 });

encryptedFields(encounterSchema, ['subjective', 'objective', 'assessment', 'plan']);

export const Encounter = model<IEncounter>('Encounter', encounterSchema);
