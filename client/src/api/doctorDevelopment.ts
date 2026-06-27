import { api } from './client';

export type MilestoneDomain = 'motor' | 'social' | 'language';
export type MilestoneStatus = 'achieved' | 'upcoming' | 'inwindow' | 'watch';

export interface DevMilestone {
  id: string;
  label: string;
  description: string;
  domain: MilestoneDomain;
  source: 'WHO' | 'general';
  windowStartMonth: number;
  windowEndMonth: number;
  status: MilestoneStatus;
}

export interface DevAssessment {
  ageMonths: number;
  milestones: DevMilestone[];
}

// Returns the developmental-milestone set with each item's window + base status
// for an age. Persists nothing; "achieved" ticking is client-side only.
export function assessDevelopment(body: { ageMonths: number }) {
  return api<DevAssessment>('/doctor/development/assess', { method: 'POST', body: JSON.stringify(body) });
}
