import { api } from './client';

export type SleepKind = 'nap' | 'night';
export type SleepQuality = 'settled' | 'restless' | 'unsettled';

export interface SleepLog {
  id: string;
  loggedAt: string;
  kind: SleepKind;
  durationMin: number;
  quality: SleepQuality | null;
  notes: string | null;
  createdAt: string;
}

export interface SleepSummary {
  todayMinutes: number;
  todayNaps: number;
  avgPerDayMinutes: number;
}

export interface SleepInput {
  loggedAt: string;
  kind: SleepKind;
  durationMin: number;
  quality?: SleepQuality;
  notes?: string;
}

export interface SleepResponse {
  logs: SleepLog[];
  summary: SleepSummary;
}

export function listSleep(babyId: string) {
  return api<SleepResponse>(`/babies/${babyId}/sleep`);
}

export function addSleep(babyId: string, input: SleepInput) {
  return api<{ log: SleepLog }>(`/babies/${babyId}/sleep`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteSleep(babyId: string, logId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/sleep/${logId}`, { method: 'DELETE' });
}

/** "7h 30m" / "45m" from minutes. */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
