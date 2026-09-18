import { api } from './client';

export interface Analytics {
  kpis: {
    activePatients: number;
    newThisMonth: number;
    encountersThisMonth: number;
    apptCompletionPct: number | null;
  };
  patientsByMonth: { month: string; count: number }[];
  encountersByMonth: { month: string; count: number }[];
  ageGroups: { label: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  encounterKinds: { kind: string; count: number }[];
  appointmentOutcomes: { status: string; count: number }[];
}

export function getAnalytics() {
  return api<Analytics>('/doctor/analytics');
}

// ── Date-range Reports ──
export interface LabelCount {
  label: string;
  count: number;
}

export interface CountPerDay {
  /** IST calendar date, YYYY-MM-DD. */
  date: string;
  count: number;
}

export interface DoctorReport {
  range: { from: string; to: string };
  /**
   * The equal-length window immediately before `range`. Every "vs …" delta on
   * the page is measured against this — the page used to print a hard-coded
   * 22%.
   */
  previous: {
    from: string;
    to: string;
    revenueTotal: number;
    appointments: number;
    consultations: number;
    newPatients: number;
  };
  revenue: {
    total: number;
    paidInvoices: number;
    collectionRate: number | null;
    collected: number;
    invoiced: number;
    byDay: { date: string; amount: number }[];
    topDays: { date: string; amount: number }[];
  };
  patients: {
    newCount: number;
    /** Same window as newCount but roster-only (archived excluded). */
    activeNewCount: number;
    /** The whole live roster, not just the window — the demographics donut centre. */
    totalActive: number;
    byGender: LabelCount[];
    byAge: LabelCount[];
    byStatus: LabelCount[];
    bySource: LabelCount[];
  };
  appointments: {
    total: number;
    avgDurationMin: number;
    byStatus: LabelCount[];
    byMode: LabelCount[];
    byDay: CountPerDay[];
    /** There is no per-provider split to give: one practice is one doctor. */
    byLocation: LabelCount[];
  };
  consultations: {
    total: number;
    byKind: LabelCount[];
    byDay: CountPerDay[];
  };
  /** Top billed services for the window, with "Others" folded into the tail. */
  services: { label: string; count: number; amount: number }[];
  /** PHI-free business activity from the audit trail, newest first. */
  activity: {
    id: string;
    action: string;
    description: string;
    actorName: string | null;
    entityId: string | null;
    at: string;
  }[];
}

export function getReport(range?: { from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (range?.from) qs.set('from', range.from);
  if (range?.to) qs.set('to', range.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api<DoctorReport>(`/doctor/analytics/report${suffix}`);
}

// ── Saved reports (the Recent Reports table) ──
export type SavedReportType = 'summary' | 'appointments' | 'revenue' | 'patients' | 'services';

export interface SavedReport {
  id: string;
  name: string;
  type: SavedReportType;
  /** IST calendar dates the figures cover. */
  from: string;
  to: string;
  generatedBy: string;
  generatedAt: string;
}

export function listSavedReports(limit = 8) {
  return api<{ reports: SavedReport[] }>(`/doctor/analytics/reports/saved?limit=${limit}`);
}

/** Records an export. `csv` is the snapshot the doctor downloaded. */
export function saveReport(body: { name: string; type: SavedReportType; from: string; to: string; csv: string }) {
  return api<SavedReport>('/doctor/analytics/reports/saved', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** The stored snapshot, so a re-download matches what was exported. */
export function getSavedReport(id: string) {
  return api<SavedReport & { csv: string }>(`/doctor/analytics/reports/saved/${id}`);
}
