import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// One record per patient holding the TEMPLATE-DRIVEN values. `fields` is a typed
// Mongoose Map keyed by the template's field keys.
//
// ENCRYPTION IS NOT AUTOMATIC HERE. The generic encryptedFields() plugin only
// covers fixed top-level paths and is NOT attached to this model — it cannot reach
// a dynamic Map. Sensitive values are encrypted by encryptSensitiveFields() (see
// records/recordCrypto.ts), which the writePatientRecord() choke point (commit 4)
// MUST call before save, and decryptSensitiveFields() which the response shaper
// MUST call before returning. A bare `new PatientRecord(...).save()` would store
// plaintext — always go through the choke point.
//
// `status` + `tags` are promoted to first-class indexed columns (status key +
// history-tag keys from the template) so the roster list stays an index lookup.
// `searchText` is a NON-PHI denormalization of `searchable` (never `sensitive`)
// fields only — the sensitive+searchable combination is rejected at template save.
export interface IPatientRecord {
  doctorUserId: Types.ObjectId; // denormalized tenant (for scoped queries + audit)
  patientId: Types.ObjectId;
  templateId: Types.ObjectId;
  templateVersion: number; // stamped at write — old records never break on template edits
  status: string; // a status key from the template
  tags: string[]; // history-tag keys from the template
  fields: Map<string, unknown>; // values keyed by field key; sensitive ones encrypted via recordCrypto at the write choke point
  searchText?: string; // denormalized from `searchable` fields only (NON-PHI)
  createdAt: Date;
  updatedAt: Date;
}

const patientRecordSchema = new Schema<IPatientRecord>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, unique: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'SpecialtyTemplate', required: true },
    templateVersion: { type: Number, required: true },
    status: { type: String, required: true, index: true },
    tags: { type: [String], default: [], index: true },
    fields: { type: Map, of: Schema.Types.Mixed, default: () => new Map<string, unknown>() },
    searchText: { type: String },
  },
  { timestamps: true },
);
patientRecordSchema.index({ doctorUserId: 1, status: 1 });
patientRecordSchema.index({ doctorUserId: 1, tags: 1 });
patientRecordSchema.index({ searchText: 'text' });

export const PatientRecord = model<IPatientRecord>('PatientRecord', patientRecordSchema);
