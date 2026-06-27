import { api } from './client';

export type MilestoneDomain = 'motor' | 'social' | 'language';
export type MilestoneStatus = 'achieved' | 'upcoming' | 'inwindow' | 'watch';

export interface MilestoneItem {
  id: string;
  label: string;
  description: string;
  domain: MilestoneDomain;
  source: 'WHO' | 'general';
  windowStartMonth: number;
  windowEndMonth: number;
  achieved: boolean;
  achievedOn: string | null;
  status: MilestoneStatus;
}

export interface MilestonesResponse {
  milestones: MilestoneItem[];
  summary: { achieved: number; total: number; watch: number };
}

export function listMilestones(babyId: string) {
  return api<MilestonesResponse>(`/babies/${babyId}/milestones`);
}

export function markMilestone(babyId: string, milestoneId: string, achievedOn: string) {
  return api<{ ok: true }>(`/babies/${babyId}/milestones/${milestoneId}`, {
    method: 'POST',
    body: JSON.stringify({ achievedOn }),
  });
}

export function unmarkMilestone(babyId: string, milestoneId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/milestones/${milestoneId}`, { method: 'DELETE' });
}
