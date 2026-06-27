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
  actorRole?: string;
  impersonatorUserId?: Types.ObjectId; // admin behind an impersonated session (JWT `act`)
  action: AuditAction;
  resourceType: string;
  resourceId?: Types.ObjectId;
  doctorUserId?: Types.ObjectId; // tenant the resource belongs to
  patientId?: Types.ObjectId;
  changedFields?: string[]; // field KEYS only — NEVER PHI values
  ip?: string;
  userAgent?: string;
  requestId?: string;
  outcome: 'allow' | 'deny';
  at: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    impersonatorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId },
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    changedFields: { type: [String], default: undefined },
    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
    outcome: { type: String, enum: ['allow', 'deny'], required: true },
  },
  { timestamps: { createdAt: 'at', updatedAt: false } },
);
auditLogSchema.index({ doctorUserId: 1, at: -1 });
auditLogSchema.index({ patientId: 1, at: -1 });

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
