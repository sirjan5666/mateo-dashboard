// Deterministic pediatric dose checker — pure functions, no LLM, fully unit-tested
// (dosing.test.ts). Given a drug + the baby's weight/age + the intended dose, it
// computes the recommended single-dose range for THIS baby and flags problems
// (age contraindication, below/above the usual range, over the single or daily
// maximum, or "weight not logged"). `level` reflects those COMPUTED findings; the
// drug's standing contraindications/cautions are passed through as advisories for
// the prescriber to weigh (the tool can't know the child's allergies/conditions).
// It is DECISION SUPPORT — it informs; the prescriber decides. Data is DRAFT
// pending clinical sign-off (drug-dosing.ts).
import type { Drug, ReviewStatus } from '../data/drug-dosing.js';

export type DoseLevel = 'ok' | 'info' | 'warning' | 'danger';

export interface DoseMessage {
  level: DoseLevel;
  text: string;
}

export interface DoseCheckInput {
  weightKg?: number;
  ageMonths: number;
  doseMg?: number; // intended single dose
  dosesPerDay?: number; // intended frequency
}

export interface DoseCheckResult {
  level: DoseLevel; // worst level across the computed (age + dose) findings
  needsWeight: boolean;
  recommendedSingleMg?: { min: number; max: number };
  recommendedDailyMaxMg?: number;
  perKgPerDose?: { min: number; max: number };
  usualFrequency?: string;
  messages: DoseMessage[]; // computed findings — drive `level`
  contraindications: string[]; // standing advisories (shown, do not drive `level`)
  cautions: string[];
  source: string;
  reviewStatus: ReviewStatus;
}

const RANK: Record<DoseLevel, number> = { ok: 0, info: 1, warning: 2, danger: 3 };
function worst(a: DoseLevel, b: DoseLevel): DoseLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Total mg for a count of brand units, e.g. 1 × Dolo 650 = 650 mg. */
export function unitsToMg(perUnitMg: number, count: number): number {
  return Math.round(perUnitMg * count * 100) / 100;
}

export function checkDose(drug: Drug, input: DoseCheckInput): DoseCheckResult {
  const messages: DoseMessage[] = [];
  let level: DoseLevel = 'ok';
  const add = (lvl: DoseLevel, text: string) => {
    messages.push({ level: lvl, text });
    level = worst(level, lvl);
  };

  // 1) Age contraindication / caution (a definite, computed finding).
  if (drug.ageFloor && input.ageMonths < drug.ageFloor.months) {
    add(drug.ageFloor.level, drug.ageFloor.reason);
  }

  const result: DoseCheckResult = {
    level,
    needsWeight: false,
    messages,
    contraindications: drug.contraindications,
    cautions: drug.cautions,
    source: drug.source,
    reviewStatus: drug.reviewStatus,
  };

  // 2) Weight-based dose range (only for drugs that carry dosing).
  const d = drug.dosing;
  if (d) {
    result.perKgPerDose = d.mgPerKgPerDose;
    result.usualFrequency = d.usualFrequency;

    if (input.weightKg == null) {
      result.needsWeight = true;
      add('info', 'Log the baby’s weight to check the dose against weight-based limits.');
    } else {
      const w = input.weightKg;
      const recMin = Math.round(w * d.mgPerKgPerDose.min);
      let recMax = Math.round(w * d.mgPerKgPerDose.max);
      if (d.maxSingleDoseMg != null) recMax = Math.min(recMax, d.maxSingleDoseMg);
      result.recommendedSingleMg = { min: recMin, max: recMax };

      const dailyCaps: number[] = [];
      if (d.maxMgPerKgPerDay != null) dailyCaps.push(Math.round(w * d.maxMgPerKgPerDay));
      if (d.maxDailyDoseMg != null) dailyCaps.push(d.maxDailyDoseMg);
      const dailyMax = dailyCaps.length ? Math.min(...dailyCaps) : undefined;
      result.recommendedDailyMaxMg = dailyMax;

      if (input.doseMg != null && input.doseMg > 0) {
        const dose = input.doseMg;
        if (d.maxSingleDoseMg != null && dose > d.maxSingleDoseMg) {
          add('danger', `Exceeds the maximum single dose (${d.maxSingleDoseMg} mg).`);
        } else if (dose > recMax) {
          add('warning', `Above the usual single dose for ${w} kg (${recMin}–${recMax} mg).`);
        } else if (dose < recMin) {
          add('warning', `Below the usual single dose for ${w} kg (${recMin}–${recMax} mg).`);
        } else {
          add('ok', `Within the usual single-dose range (${recMin}–${recMax} mg) for ${w} kg.`);
        }

        if (input.dosesPerDay != null && input.dosesPerDay > 0 && dailyMax != null) {
          const dailyTotal = Math.round(dose * input.dosesPerDay);
          if (dailyTotal > dailyMax) {
            add('danger', `Total ${dailyTotal} mg/day exceeds the daily maximum (${dailyMax} mg/day).`);
          }
        }
      }
    }
  }

  result.level = level;
  return result;
}
