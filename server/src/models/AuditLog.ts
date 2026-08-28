import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// Append-only audit trail for PHI access (DPDP accountability). Records WHO did
// WHAT to WHICH resource and WHEN — but NEVER stores PHI values: only changed
// field KEYS. There are no update/delete paths, and AuditLog is excluded from
// right-to-erasure (retained, actor pseudonymised) — see eraseUser.ts.
export type AuditAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'access_denied'
  | 'login'
  | 'export'
  | 'consent_grant'
  | 'consent_revoke';
export const AUDIT_ACTIONS: AuditAction[] = ['read', 'create', 'update', 'delete', 'access_denied', 'login', 'export', 'consent_grant', 'consent_revoke'];

export interface IAuditLog {
  actorUserId?: Types.ObjectId;
  actorName?: string; // SNAPSHOT of the actor's name at the time — business identity, PHI-safe. Readable after the user is deleted.
  actorRole?: string;
  impersonatorUserId?: Types.ObjectId; // admin behind an impersonated session (JWT `act`)
  // Coarse category (unchanged — powers the existing PHI-access trail + filters).
  action: AuditAction;
  // Precise dotted business action, e.g. "invoice.paid", "laborder.report_uploaded".
  // Written by logAction(); indexed so the list can filter on it.
  actionKey?: string;
  // One-line, human-readable summary. MUST be PHI-free (no patient names/values),
  // same rule as changedFields — the caller is responsible.
  description?: string;
  resourceType: string;
  resourceId?: Types.ObjectId;
  // SNAPSHOT of the affected record's human-facing id/number (invoice no, order no,
  // patient CODE — a pseudonymous id, never a name). Readable after the row is gone.
  targetEntityId?: string;
  doctorUserId?: Types.ObjectId; // tenant the resource belongs to
  patientId?: Types.ObjectId; // patient whose CLINICAL data was touched (name resolved at read, never snapshotted)
  targetUserId?: Types.ObjectId; // a non-patient user whose ACCOUNT was affected (staff/parent) — FK only
  changedFields?: string[]; // field KEYS only — NEVER PHI values
  meta?: Record<string, unknown>; // free-form, PHI-free (amount, quantity, status, filename…)
  ip?: string;
  userAgent?: string;
  requestId?: string;
  outcome: 'allow' | 'deny';
  at: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    actorRole: { type: String },
    impersonatorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    actionKey: { type: String, index: true },
    description: { type: String },
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId },
    targetEntityId: { type: String },
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    changedFields: { type: [String], default: undefined },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
    outcome: { type: String, enum: ['allow', 'deny'], required: true },
  },
  { timestamps: { createdAt: 'at', updatedAt: false } },
);
auditLogSchema.index({ doctorUserId: 1, at: -1 });
auditLogSchema.index({ patientId: 1, at: -1 });
auditLogSchema.index({ actorUserId: 1, at: -1 }); // "this actor's actions", newest-first
auditLogSchema.index({ targetUserId: 1, at: -1 }); // "actions on this account", newest-first
auditLogSchema.index({ at: -1 }); // global newest-first (admin-all)

// Append-only at the model layer (defence in depth — bulkWrite/raw driver can still
// bypass; true tamper-evidence needs write-restricted DB creds / WORM storage). No
// update/delete/replace, and an existing row cannot be re-saved. AuditLog is also
// excluded from erasure, so blocking deletes here is safe.
function blockAuditMutation(): void {
  throw new Error('AuditLog is append-only.');
}
auditLogSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete'],
  blockAuditMutation,
);
auditLogSchema.pre('save', function preventAuditResave() {
  if (!this.isNew) throw new Error('AuditLog is append-only.');
});

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
