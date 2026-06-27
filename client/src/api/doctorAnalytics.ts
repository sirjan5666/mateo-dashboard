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
