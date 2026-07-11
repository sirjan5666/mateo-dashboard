import { api } from './client';

export type InsightTracker =
  | 'growth'
  | 'food'
  | 'sleep'
  | 'milestones'
  | 'skin'
  | 'vaccines';

export type InsightStatus = 'ok' | 'watch' | 'doctor';

export interface TrackerInsightResult {
  enabled: boolean;
  status?: InsightStatus;
  observation?: string;
  suggestion?: string;
  source?: 'rule' | 'ai';
}

// Ask mateo.ai for its read on one tracker's logged data.
export function getTrackerInsight(babyId: string, tracker: InsightTracker, language: 'en' | 'hi') {
  return api<TrackerInsightResult>(`/babies/${babyId}/insight`, {
    method: 'POST',
    body: JSON.stringify({ tracker, language }),
  });
}
