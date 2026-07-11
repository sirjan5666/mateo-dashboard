// The "First 2,000 Days" journey engine. Turns the baby's age (a day number 1..2000)
// into the age-appropriate slice of the authored timeline + the day's notification.
//
// Pure, deterministic, read-time — nothing here is stored per baby. Reference data
// is the workbook-derived timeline-2000.json + daily-notifications.json (Phase 0).
// Everything is population-level guidance, NEVER a per-child deadline (CLAUDE.md).

import timelineData from '../data/timeline-2000.json' with { type: 'json' };
import dailyData from '../data/daily-notifications.json' with { type: 'json' };

const DAY_MS = 86_400_000;
export const JOURNEY_TOTAL_DAYS = 2000;

export interface TimelineEntry {
  day: number;
  ageLabel: string;
  period: string;
  domain: string;
  theme: string;
  description: string;
  visionMilestone: string;
  cognitiveMilestone: string;
  growthSnapshot: string;
  parentTip: string;
  doctorFlag: string;
  notificationText: string;
  isMilestoneCheck: boolean;
}

export interface DailyNotification {
  day: number;
  ageMonths: number | null;
  contentType: string;
  en: string;
  hinglish: string;
}

export type JourneyLanguage = 'en' | 'hi' | 'hi-en';

// Sorted once at module load so the lookups below can rely on order.
const ENTRIES: TimelineEntry[] = ([...(timelineData.entries as TimelineEntry[])]).sort((a, b) => a.day - b.day);
const MILESTONE_CHECKS: TimelineEntry[] = ENTRIES.filter((e) => e.isMilestoneCheck);
const NOTIFICATIONS: DailyNotification[] = dailyData.notifications as DailyNotification[];
const NOTIFICATION_BY_DAY = new Map<number, DailyNotification>(NOTIFICATIONS.map((n) => [n.day, n]));

/**
 * Current journey day for a baby, 1-indexed so birth day = Day 1 (matching the
 * timeline). Not clamped — a >2000 result means the baby has "graduated".
 */
export function journeyDay(dob: Date, now: Date = new Date()): number {
  const days = Math.floor((now.getTime() - dob.getTime()) / DAY_MS);
  return days + 1;
}

/** The most recent timeline anchor at or before `day` (where the baby "is now"). */
export function currentAnchor(day: number): TimelineEntry {
  let found = ENTRIES[0];
  for (const e of ENTRIES) {
    if (e.day <= day) found = e;
    else break;
  }
  return found;
}

/** The next timeline anchor strictly after `day`, or null past the end. */
export function nextAnchor(day: number): TimelineEntry | null {
  for (const e of ENTRIES) {
    if (e.day > day) return e;
  }
  return null;
}

/** The active developmental checkpoint window (most recent milestone-check ≤ day). */
export function currentMilestoneCheck(day: number): TimelineEntry | null {
  let found: TimelineEntry | null = null;
  for (const e of MILESTONE_CHECKS) {
    if (e.day <= day) found = e;
    else break;
  }
  return found;
}

/** The next developmental checkpoint after `day`, or null past the end. */
export function nextMilestoneCheck(day: number): TimelineEntry | null {
  for (const e of MILESTONE_CHECKS) {
    if (e.day > day) return e;
  }
  return null;
}

/**
 * The authored notification for `day` in the requested language. The daily copy
 * exists in English + Hinglish only, so 'hi' falls back to English (there is no
 * pure-Hindi daily set yet — see RECONCILIATION / i18n follow-up).
 */
export function notificationForDay(day: number, language: JourneyLanguage): { contentType: string; text: string } | null {
  const clamped = Math.min(Math.max(day, 1), JOURNEY_TOTAL_DAYS);
  const n = NOTIFICATION_BY_DAY.get(clamped);
  if (!n) return null;
  const text = language === 'hi-en' ? n.hinglish : n.en;
  return { contentType: n.contentType, text };
}
