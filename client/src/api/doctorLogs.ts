import { api } from './client';

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  /** Precise dotted business action (e.g. "invoice.paid"); null on older rows. */
  actionKey: string | null;
  /** One-line human summary; null on rows written before descriptions existed. */
  description: string | null;
  resourceType: string;
  resourceId: string | null;
  /** Snapshot of the affected record's human-facing id (invoice no, order no, patient code). */
  targetEntityId: string | null;
  patientName: string | null;
  actorName: string | null;
  actorRole: string | null;
  /** True when done through an impersonated ("act as") session. */
  impersonated: boolean;
  /** Field KEYS only — the audit trail never stores PHI values. */
  changedFields: string[];
  /** Free-form, PHI-free (amount, quantity, status, filename…). */
  meta: Record<string, unknown> | null;
  outcome: 'allow' | 'deny';
  ip: string | null;
}

export interface AuditSummary {
  kpis: { total: number; last24h: number; denied: number };
  byAction: { label: string; count: number }[];
  byResource: { label: string; count: number }[];
}

export function listAudit(params: { action?: string; resourceType?: string; outcome?: string; from?: string; to?: string; q?: string; skip?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.action) qs.set('action', params.action);
  if (params.resourceType) qs.set('resourceType', params.resourceType);
  if (params.outcome) qs.set('outcome', params.outcome);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.q) qs.set('q', params.q);
  if (params.skip) qs.set('skip', String(params.skip));
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return api<{ entries: AuditEntry[]; total: number; actions: string[] }>(`/doctor/logs/audit${suffix}`);
}

export function getAuditSummary() {
  return api<AuditSummary>('/doctor/logs/audit/summary');
}

export interface EmailEntry {
  id: string;
  at: string;
  to: string;
  subject: string;
  kind: string;
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
}

export function listEmailLogs(params: { status?: string; kind?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.kind) qs.set('kind', params.kind);
  const suffix = qs.toString() ? `?${qs}` : '';
  return api<{ entries: EmailEntry[]; kpis: { sent: number; failed: number; skipped: number }; statuses: string[] }>(
    `/doctor/logs/email${suffix}`,
  );
}
