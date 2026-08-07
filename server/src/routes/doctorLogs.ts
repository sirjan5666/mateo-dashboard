import { Router } from 'express';
import { Types } from 'mongoose';
import { guardRoutes } from '../middleware/permissions.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { EmailLog, EMAIL_STATUSES } from '../models/EmailLog.js';
import { Patient } from '../models/Patient.js';
import { User } from '../models/User.js';
import { decryptField } from '../lib/crypto/fieldCipher.js';

/**
 * Audit Logs and Email Logs, read-only.
 *
 * The audit trail already exists — `middleware/audit.ts` writes a row on every
 * doctor-domain request. This is the first endpoint that reads it back.
 *
 * ⚠ NO PHI LEAVES HERE. AuditLog itself stores only ids and changed field KEYS.
 * Patient display names ARE resolved (the doctor already owns those records and
 * a log listing "68f2…" is useless), but nothing else is decrypted, and the
 * whole query is tenant-scoped so one practice can never read another's trail.
 */
const router = Router();
// RBAC: a staff session is narrowed to what its role allows. The doctor who
// owns the practice passes every check — see middleware/permissions.ts.
guardRoutes(router, 'audit');

const MAX = 200;

// GET /api/doctor/logs/audit?action=&resourceType=&outcome=&limit=
router.get('/logs/audit', async (req, res) => {
  const { action, resourceType, outcome } = req.query;
  const filter: Record<string, unknown> = {};
  if (typeof action === 'string' && (AUDIT_ACTIONS as string[]).includes(action)) filter.action = action;
  if (typeof resourceType === 'string' && resourceType) filter.resourceType = resourceType;
  if (outcome === 'allow' || outcome === 'deny') filter.outcome = outcome;

  const limit = Math.min(Number(req.query.limit) || 100, MAX);
  const rows = await AuditLog.find(scopeToDoctor(req, filter)).sort({ at: -1 }).limit(limit);

  // Resolve the names the doctor already owns — ids alone make the screen useless.
  const patientIds = [...new Set(rows.filter((r) => r.patientId).map((r) => r.patientId!.toString()))];
  const actorIds = [...new Set(rows.filter((r) => r.actorUserId).map((r) => r.actorUserId!.toString()))];
  const [patients, actors] = await Promise.all([
    patientIds.length ? Patient.find(scopeToDoctor(req, { _id: { $in: patientIds } })).select('displayName') : [],
    actorIds.length ? User.find({ _id: { $in: actorIds } }).select('name') : [],
  ]);
  const patientNames = new Map(patients.map((p) => [p._id.toString(), decryptField(p.displayName)]));
  const actorNames = new Map(actors.map((a) => [a._id.toString(), a.name]));

  res.json({
    entries: rows.map((r) => ({
      id: r._id,
      at: r.at,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId ?? null,
      // A patient owned by another tenant resolves to null, never a foreign name.
      patientName: r.patientId ? patientNames.get(r.patientId.toString()) ?? null : null,
      actorName: r.actorUserId ? actorNames.get(r.actorUserId.toString()) ?? null : null,
      actorRole: r.actorRole ?? null,
      changedFields: r.changedFields ?? [],
      outcome: r.outcome,
      ip: r.ip ?? null,
    })),
    actions: AUDIT_ACTIONS,
  });
});

// GET /api/doctor/logs/audit/summary — the KPI strip.
router.get('/logs/audit/summary', async (req, res) => {
  const doctorId = new Types.ObjectId(req.userId); // $match does not cast
  const dayAgo = new Date(Date.now() - 86_400_000);

  const [total, today, denied, byAction, byResource] = await Promise.all([
    AuditLog.countDocuments(scopeToDoctor(req)),
    AuditLog.countDocuments(scopeToDoctor(req, { at: { $gte: dayAgo } })),
    AuditLog.countDocuments(scopeToDoctor(req, { outcome: 'deny' })),
    AuditLog.aggregate<{ _id: string; count: number }>([
      { $match: { doctorUserId: doctorId } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AuditLog.aggregate<{ _id: string; count: number }>([
      { $match: { doctorUserId: doctorId } },
      { $group: { _id: '$resourceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  res.json({
    kpis: { total, last24h: today, denied },
    byAction: byAction.map((a) => ({ label: a._id, count: a.count })),
    byResource: byResource.map((r) => ({ label: r._id, count: r.count })),
  });
});

// GET /api/doctor/logs/email?status=&kind=
router.get('/logs/email', async (req, res) => {
  const { status, kind } = req.query;
  const filter: Record<string, unknown> = {};
  if (typeof status === 'string' && (EMAIL_STATUSES as string[]).includes(status)) filter.status = status;
  if (typeof kind === 'string' && kind) filter.kind = kind;

  const limit = Math.min(Number(req.query.limit) || 100, MAX);
  const rows = await EmailLog.find(scopeToDoctor(req, filter)).sort({ createdAt: -1 }).limit(limit);
  const counts = await EmailLog.aggregate<{ _id: string; count: number }>([
    { $match: { doctorUserId: new Types.ObjectId(req.userId) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const by = (s: string) => counts.find((c) => c._id === s)?.count ?? 0;
  res.json({
    entries: rows.map((e) => ({
      id: e._id,
      at: e.createdAt,
      to: e.to,
      subject: e.subject,
      kind: e.kind,
      status: e.status,
      error: e.error ?? null,
    })),
    kpis: { sent: by('sent'), failed: by('failed'), skipped: by('skipped') },
    statuses: EMAIL_STATUSES,
  });
});

export default router;
