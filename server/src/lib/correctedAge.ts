// Corrected (adjusted) age for premature babies.
//
// Standard pediatric practice (WHO/AAP): for a baby born before 37 weeks,
// evaluate GROWTH percentiles and DEVELOPMENTAL MILESTONES against a corrected
// age = chronological age minus the number of weeks born early. Correction is
// applied until the CHRONOLOGICAL age reaches 24 months, then dropped.
//
// It does NOT apply to vaccinations or the start of solids — those follow
// chronological age. Callers must only use corrected age for growth + milestones.

const MS_PER_MONTH = 86_400_000 * 30.4375;
const TERM_WEEKS = 40;
const PRETERM_THRESHOLD_WEEKS = 37;
const CORRECT_UNTIL_MONTHS = 24;
const DAYS_PER_MONTH = 30.4375;

/** Weeks a baby was born early (0 if term / unknown). */
export function prematurityWeeks(gestationalAgeWeeks?: number | null): number {
  if (gestationalAgeWeeks == null || gestationalAgeWeeks >= PRETERM_THRESHOLD_WEEKS) return 0;
  return Math.max(0, TERM_WEEKS - gestationalAgeWeeks);
}

/** True if this baby is premature (< 37 weeks gestation). */
export function isPreterm(gestationalAgeWeeks?: number | null): boolean {
  return prematurityWeeks(gestationalAgeWeeks) > 0;
}

/** Chronological age in fractional months at `at` (default now). */
export function chronologicalMonths(dob: Date, at: Date = new Date()): number {
  return (at.getTime() - dob.getTime()) / MS_PER_MONTH;
}

/**
 * Corrected age in fractional months for growth/milestone evaluation. Equals the
 * chronological age for term babies, or once chronological age passes 24 months.
 */
export function correctedAgeMonths(dob: Date, gestationalAgeWeeks: number | null | undefined, at: Date = new Date()): number {
  const chrono = chronologicalMonths(dob, at);
  const premo = prematurityWeeks(gestationalAgeWeeks);
  if (premo === 0 || chrono >= CORRECT_UNTIL_MONTHS) return chrono;
  return Math.max(0, chrono - (premo * 7) / DAYS_PER_MONTH);
}

/** Whether correction is still in effect (preterm AND under 24 months chronological). */
export function correctionApplies(dob: Date, gestationalAgeWeeks: number | null | undefined, at: Date = new Date()): boolean {
  return prematurityWeeks(gestationalAgeWeeks) > 0 && chronologicalMonths(dob, at) < CORRECT_UNTIL_MONTHS;
}
