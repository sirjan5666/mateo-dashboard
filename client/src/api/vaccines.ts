import { api } from './client';

export type DoseStatus = 'done' | 'due' | 'overdue' | 'upcoming';

export interface VaccineDose {
  id: string;
  vaccineId: string;
  vaccineName: string;
  doseLabel: string;
  series: string | null;
  protectsAgainst: string | null;
  notes: string;
  dueDate: string;
  windowStart: string;
  windowEnd: string;
  administeredOn: string | null;
  brand: string | null;
  isCustom: boolean;
  status: DoseStatus;
  ageLabel: string;
}

export interface VaccineSummary {
  total: number;
  done: number;
  due: number;
  overdue: number;
  upcoming: number;
}

export function listVaccines(babyId: string) {
  return api<{ doses: VaccineDose[]; summary: VaccineSummary }>(`/babies/${babyId}/vaccines`);
}

// administeredOn: 'YYYY-MM-DD' records an administration; null clears it.
export function setVaccineAdministered(doseId: string, administeredOn: string | null, brand?: string) {
  return api<{ dose: VaccineDose }>(`/vaccines/${doseId}`, {
    method: 'PATCH',
    body: JSON.stringify({ administeredOn, brand }),
  });
}

export interface CustomVaccineInput {
  vaccineName: string;
  doseLabel?: string;
  administeredOn: string;
  brand?: string;
}

export function addCustomVaccine(babyId: string, input: CustomVaccineInput) {
  return api<{ dose: VaccineDose }>(`/babies/${babyId}/vaccines/custom`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Onboarding baseline (NOT subscription-gated): the vaccines whose window has
// opened, so a parent can tick which were already given, and mark them in one call.
export function listBaselineVaccines(babyId: string) {
  return api<{ doses: VaccineDose[] }>(`/babies/${babyId}/vaccines/baseline`);
}

export function markBaselineVaccines(babyId: string, doseIds: string[]) {
  return api<{ ok: true; marked: number }>(`/babies/${babyId}/vaccines/baseline`, {
    method: 'POST',
    body: JSON.stringify({ doseIds }),
  });
}
