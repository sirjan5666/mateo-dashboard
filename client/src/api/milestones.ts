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

// ── Developmental Milestones (10 domains, 0–60 months) ─────────────────────

export type DevDomain =
  | 'gross_motor'
  | 'fine_motor'
  | 'cognitive'
  | 'language'
  | 'social_emotional'
  | 'vision'
  | 'hearing'
  | 'physical_growth'
  | 'sensory_processing'
  | 'adaptive';

export interface DevMilestoneItem {
  id: string;
  domain: DevDomain;
  name: string;
  description: string;
  ageRangeMonths: { min: number; max: number };
  redFlags: string[];
  achieved: boolean;
  achievedOn: string | null;
  status: MilestoneStatus;
}

export interface DevDomainSummary {
  domain: DevDomain;
  label: string;
  emoji: string;
  description: string;
  total: number;
  achieved: number;
  watch: number;
}

export interface DevelopmentalConcern {
  id: string;
  category: 'speech' | 'motor' | 'social' | 'general';
  title: string;
  signs: string[];
  ageNote: string;
}

export interface DevMilestonesResponse {
  milestones: DevMilestoneItem[];
  domains: DevDomainSummary[];
  concerns: DevelopmentalConcern[];
  ageMonths: number;
  summary: { achieved: number; total: number; watch: number };
}

export function listDevMilestones(babyId: string, all?: boolean) {
  const q = all ? '?all=1' : '';
  return api<DevMilestonesResponse>(`/babies/${babyId}/dev-milestones${q}`);
}
