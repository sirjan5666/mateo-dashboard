import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// First-class, versioned, append-only consent (DPDP). Each grant/withdrawal is a
// NEW row (history is never mutated). The latest row for (patient, purpose,
// current policyVersion) determines whether PHI processing is permitted —
// enforced by the requireConsent(purpose) middleware. Withdrawal must be as easy
// as granting and must stop processing.
export type ConsentPurpose = 'treatment' | 'record_storage' | 'telemedicine' | 'data_sharing';
export const CONSENT_PURPOSES: ConsentPurpose[] = ['treatment', 'record_storage', 'telemedicine', 'data_sharing'];

export interface IConsentRecord {
  patientId: Types.ObjectId;
  subjectUserId?: Types.ObjectId; // the patient's portal user, when self-granted
  doctorUserId: Types.ObjectId; // tenant
  purpose: ConsentPurpose;
  policyVersion: string;
  status: 'granted' | 'withdrawn';
  method?: 'portal' | 'in_clinic';
  grantedIp?: string;
  userAgent?: string;
  evidenceDocId?: Types.ObjectId;
  at: Date;
}

const consentRecordSchema = new Schema<IConsentRecord>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    subjectUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: CONSENT_PURPOSES, required: true },
    policyVersion: { type: String, required: true },
    status: { type: String, enum: ['granted', 'withdrawn'], required: true },
    method: { type: String, enum: ['portal', 'in_clinic'] },
    grantedIp: { type: String },
    userAgent: { type: String },
    evidenceDocId: { type: Schema.Types.ObjectId },
  },
  { timestamps: { createdAt: 'at', updatedAt: false } },
);
// Latest consent for a (patient, purpose) is a single indexed lookup.
consentRecordSchema.index({ patientId: 1, purpose: 1, at: -1 });
consentRecordSchema.index({ doctorUserId: 1, at: -1 });

// Immutable history (append a new row to change consent). Mutating updates are
// rejected, but a pure $unset is allowed so erasure can scrub identifiers, and
// deletes are allowed so right-to-erasure can purge the rows (see eraseUser.ts).
consentRecordSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'], function guardConsentUpdate() {
  const u = (this as unknown as { getUpdate(): Record<string, unknown> | null }).getUpdate() ?? {};
  const set = (u.$set ?? {}) as Record<string, unknown>;
  const rootFields = Object.keys(u).filter((k) => !k.startsWith('$')); // replaceOne / raw field writes
  // Allowed: $unset (erasure scrub) + the auto-injected $setOnInsert timestamp
  // (`at`, from createdAt). Block any real value write: a non-empty $set, root
  // field writes, or any other mutating operator ($inc/$push/…).
  const otherOps = Object.keys(u).filter((k) => k.startsWith('$') && k !== '$unset' && k !== '$setOnInsert' && k !== '$set');
  const mutates = Object.keys(set).length > 0 || rootFields.length > 0 || otherOps.length > 0;
  if (mutates) {
    throw new Error('ConsentRecord history is immutable; append a new row instead (only $unset is allowed, for erasure).');
  }
});
consentRecordSchema.pre('save', function preventConsentResave() {
  if (!this.isNew) throw new Error('ConsentRecord history is immutable; append a new row instead.');
});

export const ConsentRecord = model<IConsentRecord>('ConsentRecord', consentRecordSchema);
