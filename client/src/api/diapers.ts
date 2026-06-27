import { api } from './client';

export type DiaperKind = 'wet' | 'dirty' | 'mixed' | 'dry';
export type StoolConsistency = 'soft' | 'normal' | 'firm' | 'watery';
export type StoolColor = 'yellow' | 'brown' | 'green' | 'black' | 'red' | 'pale';

export interface DiaperLog {
  id: string;
  loggedAt: string;
  kind: DiaperKind;
  consistency: StoolConsistency | null;
  color: StoolColor | null;
  concerning: boolean;
  notes: string | null;
  createdAt: string;
}

export interface DiaperSummary {
  wetToday: number;
  dirtyToday: number;
  avgPerDay: number;
}

export interface DiaperResponse {
  logs: DiaperLog[];
  summary: DiaperSummary;
}

export interface DiaperInput {
  loggedAt: string;
  kind: DiaperKind;
  consistency?: StoolConsistency;
  color?: StoolColor;
  notes?: string;
}

export function listDiapers(babyId: string) {
  return api<DiaperResponse>(`/babies/${babyId}/diapers`);
}
export function addDiaper(babyId: string, input: DiaperInput) {
  return api<{ log: DiaperLog }>(`/babies/${babyId}/diapers`, { method: 'POST', body: JSON.stringify(input) });
}
export function deleteDiaper(babyId: string, logId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/diapers/${logId}`, { method: 'DELETE' });
}
