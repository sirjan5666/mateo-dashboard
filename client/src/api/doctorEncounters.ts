import { api } from './client';

// Mirrors server routes/doctorEncounters.ts (SOAP visit notes).
export type EncounterKind = 'visit' | 'follow_up' | 'phone' | 'procedure' | 'note';

export interface Encounter {
  id: string;
  date: string;
  kind: EncounterKind;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EncounterInput {
  date?: string;
  kind?: EncounterKind;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export function listEncounters(patientId: string) {
  return api<{ encounters: Encounter[] }>(`/doctor/patients/${patientId}/encounters`);
}

export function createEncounter(patientId: string, body: EncounterInput) {
  return api<{ encounter: Encounter }>(`/doctor/patients/${patientId}/encounters`, { method: 'POST', body: JSON.stringify(body) });
}

export function updateEncounter(encounterId: string, body: EncounterInput) {
  return api<{ encounter: Encounter }>(`/doctor/encounters/${encounterId}`, { method: 'PATCH', body: JSON.stringify(body) });
}
