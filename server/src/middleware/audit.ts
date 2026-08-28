import type { NextFunction, Request, Response } from 'express';
import { Types, isValidObjectId } from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import type { AuditAction } from '../models/AuditLog.js';

declare module 'express-serve-static-core' {
  interface Request {
    // Set by recordAudit so the auditAccess finish-hook does not also write a
    // (degraded, field-key-less) duplicate row for an explicitly-audited write.
    auditedExplicitly?: boolean;
  }
}

// Audit trail for PHI access (DPDP accountability). Two ways to record:
//  - auditAccess(resourceType): middleware that logs the access on response
//    finish (captures READS and access-denied centrally, non-blocking).
//  - recordAudit(req, {...}): explicit call from WRITE handlers, where the
//    changed field KEYS are known. NEVER pass PHI values in changedFields.

/** Map an HTTP method to the audit action it represents. */
export function auditActionForMethod(method: string): AuditAction {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'read';
  }
}

export interface AuditInput {
  action: AuditAction;
  resourceType: string;
  resourceId?: Types.ObjectId | string;
  patientId?: Types.ObjectId | string;
  doctorUserId?: Types.ObjectId | string;
  changedFields?: string[]; // field KEYS only — NEVER PHI values
  outcome: 'allow' | 'deny';
}

/** Write one audit row from the request context. Awaited by write handlers. */
export async function recordAudit(req: Request, input: AuditInput): Promise<void> {
  req.auditedExplicitly = true;
  if (req.userId && !req.userRole) {
    // actorRole is only populated by requireRole; an audited PHI route should be
    // role-gated. Surface (without PHI) if a route audited after requireAuth alone.
    console.warn('[audit] recording with no actorRole — chain requireRole before audited PHI routes');
  }
  await AuditLog.create({
    actorUserId: req.userId,
    actorRole: req.userRole,
    impersonatorUserId: req.impersonatorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    doctorUserId: input.doctorUserId ?? req.userId,
    patientId: input.patientId,
    changedFields: input.changedFields,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.get('x-request-id'),
    outcome: input.outcome,
  });
}

/** Best-effort coarse category for a dotted business action, for the enum column. */
function coarseFromKey(key: string): AuditAction {
  const k = key.toLowerCase();
  if (/(^|\.)(login|logout|signin|impersonate)/.test(k)) return 'login';
  if (/consent/.test(k) && /revoke/.test(k)) return 'consent_revoke';
  if (/consent/.test(k) && /grant/.test(k)) return 'consent_grant';
  if (/(export|download)/.test(k)) return 'export';
  if (/\.(deleted|delete|remove|removed|cancel|cancelled|canceled|disable|disabled)$/.test(k)) return 'delete';
  if (/\.(created|create|add|added|issue|issued|register|registered|book|booked|upload|uploaded)$/.test(k)) return 'create';
  return 'update';
}

const toOid = (v: Types.ObjectId | string | undefined): Types.ObjectId | undefined =>
  v == null ? undefined : (typeof v === 'string' ? (isValidObjectId(v) ? new Types.ObjectId(v) : undefined) : v);

export interface LogActionInput {
  /** Dotted business action, e.g. 'invoice.paid', 'auth.impersonate.start'. */
  action: string;
  /** One-line human summary. MUST be PHI-free (no patient names/values). */
  description: string;
  target?: {
    /** Patient whose clinical data was touched (name resolved at read, never snapshotted). */
    patient?: Types.ObjectId | string;
    /** A non-patient user account affected (staff / parent). FK only. */
    user?: Types.ObjectId | string;
    /** The main affected record. `humanId` is snapshotted (invoice no, order no, patient CODE). */
    entity?: { type: string; id?: Types.ObjectId | string; humanId?: string | number };
  };
  /** Free-form, PHI-free (amount, quantity, status, filename…). */
  meta?: Record<string, unknown>;
  outcome?: 'allow' | 'deny';
  /** Tenant override; defaults to the actor's own id. */
  doctorUserId?: Types.ObjectId | string;
}

/**
 * Business-action audit logger — "who did what, when, on whose data".
 *
 * FIRE-AND-FORGET and NEVER THROWS: the write is not awaited and any failure is
 * only console-logged, so a broken audit write can never break the action that
 * triggered it. Do NOT `await` this. Actor context (id, name snapshot, role,
 * impersonator) is derived from `req`; the caller supplies the action, a PHI-free
 * description, the target, and meta.
 */
export function logAction(req: Request, input: LogActionInput): void {
  try {
    const entity = input.target?.entity;
    void AuditLog.create({
      actorUserId: req.userId,
      actorName: req.authUser?.name, // SNAPSHOT — business identity, PHI-safe
      actorRole: req.userRole,
      impersonatorUserId: req.impersonatorId,
      action: coarseFromKey(input.action),
      actionKey: input.action,
      description: input.description,
      resourceType: entity?.type ?? 'action',
      resourceId: toOid(entity?.id),
      targetEntityId: entity?.humanId != null ? String(entity.humanId) : undefined,
      doctorUserId: toOid(input.doctorUserId) ?? req.userId,
      patientId: toOid(input.target?.patient),
      targetUserId: toOid(input.target?.user),
      meta: input.meta,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.get('x-request-id'),
      outcome: input.outcome ?? 'allow',
    }).catch((err) => console.error('[audit] logAction write failed', input.action, err));
  } catch (err) {
    console.error('[audit] logAction threw', err);
  }
}

/**
 * Middleware that records a PHI access once the response is sent. Captures reads
 * and access-denied (401/403) outcomes centrally. Read-side auditing is
 * fail-open-but-logged: a failed audit write must never break the request, but it
 * is surfaced on the server console.
 *
 * ORDERING CONTRACT: mount auditAccess as the OUTERMOST middleware on a route —
 * BEFORE loadOwnedPatient/loadOwnedRecord/requireConsent. Those gates short-circuit
 * with res.status(404|403) and never call next(), so if auditAccess ran after them
 * the finish-listener would not be registered and the denial would go UN-audited —
 * exactly the cross-tenant probe we most need to log. auditAccess reads req.patient
 * lazily inside the finish callback, so the SUCCESS path still captures patientId
 * even though it runs first. Example:
 *   router.get('/:id', auditAccess('patient'), loadOwnedPatient, requireConsent('treatment'), handler)
 *
 * Put this on READ routes; write handlers call recordAudit() explicitly with the
 * changed field keys (and that suppresses the implicit success row below).
 */
export function auditAccess(resourceType: string) {
  return function (req: Request, res: Response, next: NextFunction): void {
    res.on('finish', () => {
      const denied = res.statusCode === 401 || res.statusCode === 403;
      const action = denied ? 'access_denied' : auditActionForMethod(req.method);
      // A successful mutation already audited explicitly by the handler — don't
      // write a degraded duplicate. Still capture reads and ALL denials.
      if (req.auditedExplicitly && !denied && action !== 'read') return;
      // On a cross-tenant 403, loadOwnedPatient did not set req.patient but exposes
      // the victim's ids via req.deniedResource — attribute the attempt to them.
      const resourceId =
        req.patient?._id ??
        req.deniedResource?.patientId ??
        (isValidObjectId(req.params.id) ? new Types.ObjectId(String(req.params.id)) : undefined);
      void recordAudit(req, {
        action,
        resourceType,
        resourceId,
        patientId: req.patient?._id ?? req.deniedResource?.patientId,
        doctorUserId: req.deniedResource?.doctorUserId, // victim tenant on deny; recordAudit falls back to req.userId otherwise
        outcome: res.statusCode < 400 ? 'allow' : 'deny',
      }).catch((err) => console.error('[audit] failed to record access', err));
    });
    next();
  };
}
