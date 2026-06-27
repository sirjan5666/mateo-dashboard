import { api } from './client';

export interface VaccineSummary {
  done: number;
  due: number;
  overdue: number;
  upcoming: number;
  total: number;
}
export type DoseStatus = 'done' | 'due' | 'overdue' | 'upcoming';
export interface ReportDose {
  id: string;
  vaccineName: string;
  doseLabel: string;
  dueDate: string;
  administeredOn: string | null;
  status: DoseStatus;
}

export interface BabyReport {
  generatedAt: string;
  parent: { name: string };
  baby: {
    id: string;
    name: string;
    dob: string;
    sex: 'male' | 'female';
    birthWeightG?: number;
    birthLengthCm?: number;
    birthHeadCircCm?: number;
  };
  vaccines: { summary: VaccineSummary; doses: ReportDose[] };
  growth: { id: string; loggedAt: string; weightG?: number; lengthCm?: number; headCircCm?: number }[];
  skin: { id: string; loggedAt: string; area: string; description: string; severity: string }[];
  food: { id: string; loggedAt: string; mealType: string; foodName: string; reaction: string; isNewFood: boolean }[];
  sleep: { id: string; loggedAt: string; kind: string; durationMin: number; quality?: string }[];
  feeds: { id: string; loggedAt: string; kind: string; side: string | null; durationMin: number | null; amountMl: number | null }[];
  diapers: { id: string; loggedAt: string; kind: string; consistency: string | null; color: string | null }[];
  allergies: { id: string; name: string; severity: string; reaction: string | null }[];
  symptoms: { id: string; loggedAt: string; temperatureC: number | null; symptoms: string[]; notes: string | null }[];
  milestones: { id: string; milestoneId: string; label: string; achievedOn: string }[];
  records: { id: string; recordType: string; title: string; recordDate: string; provider: string | null; notes: string | null }[];
  appointments: { id: string; scheduledAt: string; reason: string; completed: boolean }[];
}

export function getBabyReport(babyId: string) {
  return api<BabyReport>(`/babies/${babyId}/report`);
}
