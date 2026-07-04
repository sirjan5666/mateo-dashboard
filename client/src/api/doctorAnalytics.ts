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

export interface DoctorReport {
  range: { from: string; to: string };
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
  };
  consultations: {
    total: number;
    byKind: LabelCount[];
  };
}

export function getReport(range?: { from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (range?.from) qs.set('from', range.from);
  if (range?.to) qs.set('to', range.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api<DoctorReport>(`/doctor/analytics/report${suffix}`);
}
