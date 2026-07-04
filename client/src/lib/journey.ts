// The "First 2000 Days" developmental arc (~5.5 years) — shared between the
// parent dashboard's journey card and the doctor panel's patient-day math.
// Day N is computed from DOB with raw ms division (single source of truth —
// don't reimplement per-panel; lib/age.ts calendar math can differ by a day).

const MS_PER_DAY = 86_400_000;

export const JOURNEY_TOTAL = 2000;

// Cumulative end-day per stage. labelKey is theme-neutral i18n (EN + HI).
export const JOURNEY_STAGES: { key: string; labelKey: string; end: number }[] = [
  { key: 'newborn', labelKey: 'journey.stageNewborn', end: 28 },
  { key: 'infant', labelKey: 'journey.stageInfant', end: 365 },
  { key: 'toddler', labelKey: 'journey.stageToddler', end: 1095 },
  { key: 'preschool', labelKey: 'journey.stagePreschool', end: 1825 },
  { key: 'school', labelKey: 'journey.stageSchool', end: JOURNEY_TOTAL },
];

export function daysSinceDob(dob: string | Date): number {
  const t = typeof dob === 'string' ? Date.parse(dob) : dob.getTime();
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

/** The stage a given journey day falls in (clamps past-2000 to the last stage). */
export function journeyStageKey(day: number): string {
  return (JOURNEY_STAGES.find((s) => day <= s.end) ?? JOURNEY_STAGES[JOURNEY_STAGES.length - 1]).labelKey;
}
