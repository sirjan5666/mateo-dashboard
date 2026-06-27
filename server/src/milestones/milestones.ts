// Pure developmental-milestone reference + status logic. No DB access.
// Windows from data/who-milestones.json. Per CLAUDE.md hard rule 1, the "watch"
// status is a gentle nudge to mention it to a pediatrician — never a diagnosis.
import milestoneData from '../data/who-milestones.json' with { type: 'json' };

export type MilestoneDomain = 'motor' | 'social' | 'language';
export type MilestoneStatus = 'achieved' | 'upcoming' | 'inwindow' | 'watch';

export interface Milestone {
  id: string;
  label: string;
  description: string;
  domain: MilestoneDomain;
  source: 'WHO' | 'general';
  windowStartMonth: number;
  windowEndMonth: number;
}

interface RawMilestone {
  id: string;
  label: string;
  description: string;
  domain: string;
  source: string;
  window_start_month: number;
  window_end_month: number;
}

export const milestones: Milestone[] = (milestoneData.milestones as RawMilestone[]).map((m) => ({
  id: m.id,
  label: m.label,
  description: m.description,
  domain: (m.domain as MilestoneDomain) ?? 'motor',
  source: m.source === 'WHO' ? 'WHO' : 'general',
  windowStartMonth: m.window_start_month,
  windowEndMonth: m.window_end_month,
}));

export const milestoneById = new Map(milestones.map((m) => [m.id, m]));

/** Status for one milestone given the baby's age (fractional months) + whether achieved. */
export function milestoneStatus(m: Milestone, ageMonths: number, achieved: boolean): MilestoneStatus {
  if (achieved) return 'achieved';
  if (ageMonths < m.windowStartMonth) return 'upcoming';
  if (ageMonths <= m.windowEndMonth) return 'inwindow';
  return 'watch';
}
