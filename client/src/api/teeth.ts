import { api } from './client';

export interface ToothLogEntry {
  id: string;
  toothId: string;
  appearedOn: string;
  createdAt: string;
}

export interface TeethResponse {
  logs: ToothLogEntry[];
  total: number;
  appeared: number;
}

export function listTeeth(babyId: string) {
  return api<TeethResponse>(`/babies/${babyId}/teeth`);
}

export function markTooth(babyId: string, toothId: string, appearedOn: string) {
  return api<{ log: ToothLogEntry }>(`/babies/${babyId}/teeth`, {
    method: 'POST',
    body: JSON.stringify({ toothId, appearedOn }),
  });
}

export function unmarkTooth(babyId: string, logId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/teeth/${logId}`, { method: 'DELETE' });
}
