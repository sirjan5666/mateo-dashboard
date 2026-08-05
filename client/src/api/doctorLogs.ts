import { api } from './client';

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  patientName: string | null;
  actorName: string | null;
  actorRole: string | null;
  /** Field KEYS only — the audit trail never stores PHI values. */
  changedFields: string[];
  outcome: 'allow' | 'deny';
  ip: string | null;
}

export interface AuditSummary {
  kpis: { total: number; last24h: number; denied: number };
  byAction: { label: string; count: number }[];
  byResource: { label: string; count: number }[];
}

export function listAudit(params: { action?: string; resourceType?: string; outcome?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.action) qs.set('action', params.action);
  if (params.resourceType) qs.set('resourceType', params.resourceType);
  if (params.outcome) qs.set('outcome', params.outcome);
  const suffix = qs.toString() ? `?${qs}` : '';
  return api<{ entries: AuditEntry[]; actions: string[] }>(`/doctor/logs/audit${suffix}`);
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
