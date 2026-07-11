// Age → typical total-sleep range (hours per 24h). Pure, read-time lookup over the
// sleep-reference dataset. Population-level guidance, never a target (CLAUDE.md):
// the client frames anything outside the band gently, not as a problem.

import sleepData from '../data/sleep-reference.json' with { type: 'json' };

export interface SleepBand {
  label: string;
  ageStartMonth: number;
  ageEndMonth: number;
  minHours: number;
  maxHours: number;
  note: string;
}

const BANDS: SleepBand[] = sleepData.bands as SleepBand[];

/** The typical-sleep band for a baby's age in months, clamped to the ends. */
export function sleepReferenceForAge(ageMonths: number): SleepBand {
  for (const b of BANDS) {
    if (ageMonths >= b.ageStartMonth && ageMonths < b.ageEndMonth) return b;
  }
  // Below the first band (shouldn't happen) → newborn; at/after the last → last band.
  return ageMonths < BANDS[0].ageStartMonth ? BANDS[0] : BANDS[BANDS.length - 1];
}
