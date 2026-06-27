import { api } from './client';

export type DoseStatus = 'done' | 'due' | 'overdue' | 'upcoming';

export interface ScheduleDose {
  id: string;
  vaccine: string;
  doseLabel: string;
  series: string;
  protectsAgainst: string;
  notes: string;
  dueDay: number;
  ageLabel: string;
  dueDate: string;
  windowStart: string;
  windowEnd: string;
  status: DoseStatus;
}

export interface VaxSummary {
  total: number;
  due: number;
  overdue: number;
  upcoming: number;
}

export interface VaxScheduleResult {
  dob: string;
  sex: 'male' | 'female' | null;
  doses: ScheduleDose[];
  summary: VaxSummary;
}

// Computes the IAP immunization schedule for a date of birth. Persists nothing.
export function getVaccineSchedule(body: { dob: string; sex?: 'male' | 'female' }) {
  return api<VaxScheduleResult>('/doctor/vaccines/schedule', { method: 'POST', body: JSON.stringify(body) });
}
