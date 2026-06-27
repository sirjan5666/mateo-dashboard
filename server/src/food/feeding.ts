// Pure complementary-feeding guidance derived from data/complementary-feeding.json.
// No database access — safe to reuse in the chat context builder and the food route.
// Brand-neutral and homemade-first per the IMS Act 1992 (CLAUDE.md hard rule 4).
import feedingData from '../data/complementary-feeding.json' with { type: 'json' };

export interface FeedingStage {
  id: string;
  label: string;
  ageStartMonth: number;
  ageEndMonth: number;
  texture: string;
  frequency: string;
  amount: string;
  ideas: Record<string, string[]>;
  tips: string[];
}

interface RawStage {
  id: string;
  label: string;
  age_start_month: number;
  age_end_month: number;
  texture: string;
  frequency: string;
  amount: string;
  ideas: Record<string, string[]>;
  tips: string[];
}

export interface UnderSixMonths {
  headline: string;
  guidance: string;
  ifNotBreastfeeding: string;
  readiness: string[];
  readinessNote: string;
}

export interface NeverFeedItem {
  item: string;
  why: string;
}

export const feedingMeta = feedingData.meta;

export const feedingPrinciples: string[] = feedingData.principles as string[];

export const underSixMonths: UnderSixMonths = {
  headline: feedingData.under_six_months.headline,
  guidance: feedingData.under_six_months.guidance,
  ifNotBreastfeeding: feedingData.under_six_months.if_not_breastfeeding,
  readiness: feedingData.under_six_months.readiness as string[],
  readinessNote: feedingData.under_six_months.readiness_note,
};

export const feedingStages: FeedingStage[] = (feedingData.stages as RawStage[]).map((s) => ({
  id: s.id,
  label: s.label,
  ageStartMonth: s.age_start_month,
  ageEndMonth: s.age_end_month,
  texture: s.texture,
  frequency: s.frequency,
  amount: s.amount,
  ideas: s.ideas,
  tips: s.tips,
}));

export const neverFeed: NeverFeedItem[] = feedingData.never_feed as NeverFeedItem[];

export const feedingSafety: string[] = feedingData.safety as string[];

export const feedingNote: string = feedingData.feeding_note;

/** The minimum whole-month age at which complementary feeding begins. */
export const SOLIDS_START_MONTH = 6;

/**
 * Stage matching the baby's current age in WHOLE months, or null below 6 months
 * (where exclusive breastfeeding is recommended and no solids should be suggested).
 */
export function stageForAge(ageMonths: number): FeedingStage | null {
  if (ageMonths < SOLIDS_START_MONTH) return null;
  return feedingStages.find((s) => ageMonths >= s.ageStartMonth && ageMonths < s.ageEndMonth) ?? null;
}
