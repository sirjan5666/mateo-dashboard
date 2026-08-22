// Pure developmental-milestone reference + status logic. No DB access.
// Windows from data/who-milestones.json. Per CLAUDE.md hard rule 1, the "watch"
// status is a gentle nudge to mention it to a pediatrician — never a diagnosis.
import milestoneData from '../data/who-milestones.json' with { type: 'json' };
import {
  developmentalMilestones,
  developmentalConcerns,
  DEV_DOMAINS,
  type DevDomain,
  type DevMilestone,
  type DevelopmentalConcern,
} from '../data/developmental-milestones.js';

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

// ── Developmental milestones (10 domains, 0–60 months) ─────────────────────

export { developmentalMilestones, developmentalConcerns, DEV_DOMAINS };
export type { DevDomain, DevMilestone, DevelopmentalConcern };

/** All developmental milestone IDs (for validating achievement marks). */
export const devMilestoneById = new Map(developmentalMilestones.map((m) => [m.id, m]));

/** Combined lookup: finds a milestone by ID in EITHER the WHO set or the dev set. */
export function findMilestoneById(id: string): { found: true; windowEnd: number } | { found: false } {
  const who = milestoneById.get(id);
  if (who) return { found: true, windowEnd: who.windowEndMonth };
  const dev = devMilestoneById.get(id);
  if (dev) return { found: true, windowEnd: dev.ageRangeMonths.max };
  return { found: false };
}

/** Status for a dev milestone (same semantics as the WHO milestoneStatus). */
export function devMilestoneStatus(m: DevMilestone, ageMonths: number, achieved: boolean): MilestoneStatus {
  if (achieved) return 'achieved';
  if (ageMonths < m.ageRangeMonths.min) return 'upcoming';
  if (ageMonths <= m.ageRangeMonths.max) return 'inwindow';
  return 'watch';
}

/**
 * Filter developmental milestones to those relevant for a given age.
 * "Relevant" = the expected window has started, OR the baby is within 3 months
 * of the window opening (upcoming preview), OR already achieved.
 */
export function filterDevMilestonesByAge(
  ageMonths: number,
  achievedIds: Set<string>,
  options?: { includeAllUpcoming?: boolean },
): DevMilestone[] {
  const preview = 3; // show milestones up to 3 months before window opens
  return developmentalMilestones.filter((m) => {
    if (achievedIds.has(m.id)) return true;
    if (options?.includeAllUpcoming) return true;
    // Show if age is near or within the window
    return ageMonths >= m.ageRangeMonths.min - preview;
  });
}
