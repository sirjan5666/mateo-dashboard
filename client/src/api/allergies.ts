import { api } from './client';

export type AllergySeverity = 'mild' | 'moderate' | 'severe';

export interface Allergy {
  id: string;
  name: string;
  severity: AllergySeverity;
  reaction: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AllergyInput {
  name: string;
  severity?: AllergySeverity;
  reaction?: string;
  notes?: string;
}

export function listAllergies(babyId: string) {
  return api<{ allergies: Allergy[] }>(`/babies/${babyId}/allergies`);
}
export function addAllergy(babyId: string, input: AllergyInput) {
  return api<{ allergy: Allergy }>(`/babies/${babyId}/allergies`, { method: 'POST', body: JSON.stringify(input) });
}
export function deleteAllergy(babyId: string, allergyId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/allergies/${allergyId}`, { method: 'DELETE' });
}
