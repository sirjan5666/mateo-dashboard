import { api } from './client';

export type FeedKind = 'breast' | 'expressed' | 'water' | 'other';
export type FeedSide = 'left' | 'right' | 'both';

export interface FeedLog {
  id: string;
  loggedAt: string;
  kind: FeedKind;
  side: FeedSide | null;
  durationMin: number | null;
  amountMl: number | null;
  notes: string | null;
  createdAt: string;
}

export interface FeedSummary {
  feedsToday: number;
  breastMinutesToday: number;
  avgPerDay: number;
}

export interface FeedResponse {
  logs: FeedLog[];
  summary: FeedSummary;
}

export interface FeedInput {
  loggedAt: string;
  kind: FeedKind;
  side?: FeedSide;
  durationMin?: number;
  amountMl?: number;
  notes?: string;
}

export function listFeeds(babyId: string) {
  return api<FeedResponse>(`/babies/${babyId}/feeds`);
}
export function addFeed(babyId: string, input: FeedInput) {
  return api<{ log: FeedLog }>(`/babies/${babyId}/feeds`, { method: 'POST', body: JSON.stringify(input) });
}
export function deleteFeed(babyId: string, logId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/feeds/${logId}`, { method: 'DELETE' });
}
