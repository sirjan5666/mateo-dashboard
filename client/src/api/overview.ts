import { api } from './client';
import type { DoseStatus } from './vaccines';

export interface VaccineCounts {
  done: number;
  due: number;
  overdue: number;
  upcoming: number;
  total: number;
}

export interface NextDue {
  vaccineName: string;
  doseLabel: string;
  dueDate: string;
  status: DoseStatus;
}

export interface OverviewBaby {
  id: string;
  name: string;
  dob: string;
  sex: 'male' | 'female';
  birthWeightG?: number;
  birthLengthCm?: number;
  birthHeadCircCm?: number;
  createdAt: string;
  vaccines: VaccineCounts;
  nextDue: NextDue | null;
}

export interface UpcomingItem {
  babyId: string;
  babyName: string;
  vaccineName: string;
  doseLabel: string;
  dueDate: string;
  status: DoseStatus;
}

export interface Overview {
  // True for unsubscribed parents: babies + profile basics only, vaccine
  // aggregates zeroed server-side (the plan gates tracker-derived data).
  locked?: boolean;
  babies: OverviewBaby[];
  totals: {
    babies: number;
    dosesGiven: number;
    dueSoon: number;
    overdue: number;
    upToDatePct: number;
  };
  upcoming: UpcomingItem[];
}

export function getOverview() {
  return api<Overview>('/overview');
}
