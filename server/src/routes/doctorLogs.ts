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

// GET /api/doctor/logs/audit?action=&actionKey=&resourceType=&outcome=&from=&to=&q=&skip=&limit=
// Newest-first, tenant-scoped (a staff session is further narrowed by its role via
// guardRoutes('audit'); the practice owner sees the whole tenant's trail).
router.get('/logs/audit', async (req, res) => {
  const { action, actionKey, resourceType, outcome, q } = req.query;
  const filter: Record<string, unknown> = {};
  if (typeof action === 'string' && (AUDIT_ACTIONS as string[]).includes(action)) filter.action = action;
  if (typeof actionKey === 'string' && actionKey) filter.actionKey = actionKey;
  if (typeof resourceType === 'string' && resourceType) filter.resourceType = resourceType;
  if (outcome === 'allow' || outcome === 'deny') filter.outcome = outcome;

  // Date range on `at` (from/to inclusive-ish; `to` is treated as end-of-day-ish
  // by the caller passing an ISO instant).
  const at: Record<string, Date> = {};
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
  if (from && !Number.isNaN(from.getTime())) at.$gte = from;
  if (to && !Number.isNaN(to.getTime())) at.$lte = to;
  if (Object.keys(at).length) filter.at = at;

  // Text search over the PHI-free columns only — description + actor name snapshot
  // + the dotted action. Patient/target names are never searchable (they're PHI).
  if (typeof q === 'string' && q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ description: rx }, { actorName: rx }, { actionKey: rx }, { resourceType: rx }];
  }

  const limit = Math.min(Number(req.query.limit) || 50, MAX);
  const skip = Math.max(Number(req.query.skip) || 0, 0);
  const scoped = scopeToDoctor(req, filter);
  const [rows, total] = await Promise.all([
    AuditLog.find(scoped).sort({ at: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(scoped),
  ]);

  // Names the doctor already owns are resolved for display (ids alone are useless).
  // The actorName SNAPSHOT wins when present (readable even after the user is gone);
  // older rows fall back to a live lookup. Patient names are only ever resolved,
  // never snapshotted.
  const patientIds = [...new Set(rows.filter((r) => r.patientId).map((r) => r.patientId!.toString()))];
  const actorIds = [...new Set(rows.filter((r) => r.actorUserId && !r.actorName).map((r) => r.actorUserId!.toString()))];
  const [patients, actors] = await Promise.all([
    patientIds.length ? Patient.find(scopeToDoctor(req, { _id: { $in: patientIds } })).select('displayName code') : [],
    actorIds.length ? User.find({ _id: { $in: actorIds } }).select('name') : [],
  ]);
  const patientNames = new Map(patients.map((p) => [p._id.toString(), decryptField(p.displayName)]));
  const actorNames = new Map(actors.map((a) => [a._id.toString(), a.name]));

  res.json({
    entries: rows.map((r) => ({
      id: r._id,
      at: r.at,
      action: r.action,
      actionKey: r.actionKey ?? null,
      description: r.description ?? null,
      resourceType: r.resourceType,
      resourceId: r.resourceId ?? null,
      targetEntityId: r.targetEntityId ?? null,
      // A patient owned by another tenant resolves to null, never a foreign name.
      patientName: r.patientId ? patientNames.get(r.patientId.toString()) ?? null : null,
      actorName: r.actorName ?? (r.actorUserId ? actorNames.get(r.actorUserId.toString()) ?? null : null),
      actorRole: r.actorRole ?? null,
      impersonated: !!r.impersonatorUserId,
      changedFields: r.changedFields ?? [],
      meta: r.meta ?? null,
      outcome: r.outcome,
      ip: r.ip ?? null,
    })),
    total,
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
