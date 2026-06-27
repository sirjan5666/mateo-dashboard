// WHO Child Growth Standards percentile/z-score math (LMS method, Cole & Green).
// Data in src/data/who-growth/ are the official WHO L,M,S parameters (0-24 months),
// redistributed by the CDC. Weight is in kg, length & head circ in cm.
import wfaBoys from '../data/who-growth/wfa-boys.json' with { type: 'json' };
import wfaGirls from '../data/who-growth/wfa-girls.json' with { type: 'json' };
import lfaBoys from '../data/who-growth/lfa-boys.json' with { type: 'json' };
import lfaGirls from '../data/who-growth/lfa-girls.json' with { type: 'json' };
import hcfaBoys from '../data/who-growth/hcfa-boys.json' with { type: 'json' };
import hcfaGirls from '../data/who-growth/hcfa-girls.json' with { type: 'json' };

export type Indicator = 'weight' | 'length' | 'head';
export type Sex = 'male' | 'female';

interface LMSRow {
  month: number;
  L: number;
  M: number;
  S: number;
}

const TABLES: Record<Indicator, Record<Sex, LMSRow[]>> = {
  weight: { male: wfaBoys, female: wfaGirls },
  length: { male: lfaBoys, female: lfaGirls },
  head: { male: hcfaBoys, female: hcfaGirls },
};

export const MAX_MONTHS = 24;

// --- normal distribution helpers ---

// Abramowitz & Stegun 7.1.26 — |error| < 1.5e-7.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// Acklam's inverse normal CDF — accurate to ~1.1e-9 over (0,1).
export function normalInverse(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// --- LMS method ---

function lmsToZ(value: number, { L, M, S }: { L: number; M: number; S: number }): number {
  return L === 0 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S);
}

function valueAtZ({ L, M, S }: { L: number; M: number; S: number }, z: number): number {
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** L, M, S at a fractional age in months, linearly interpolated and clamped to 0-24. */
function lmsAt(table: LMSRow[], ageMonths: number): { L: number; M: number; S: number } {
  const t = Math.max(0, Math.min(MAX_MONTHS, ageMonths));
  const lo = Math.floor(t);
  const hi = Math.ceil(t);
  if (lo === hi) return table[lo];
  const f = t - lo;
  return {
    L: lerp(table[lo].L, table[hi].L, f),
    M: lerp(table[lo].M, table[hi].M, f),
    S: lerp(table[lo].S, table[hi].S, f),
  };
}

export interface PercentileResult {
  z: number;
  percentile: number; // 0.1 – 99.9, clamped for display
  /** age was outside the WHO 0-24 month tables and clamped */
  outOfRange: boolean;
}

/** Percentile + z-score for a measurement. value in kg (weight) or cm (length/head). */
export function computePercentile(
  indicator: Indicator,
  sex: Sex,
  ageMonths: number,
  value: number,
): PercentileResult {
  const lms = lmsAt(TABLES[indicator][sex], ageMonths);
  const z = lmsToZ(value, lms);
  const percentile = Math.min(99.9, Math.max(0.1, normalCdf(z) * 100));
  return { z, percentile, outOfRange: ageMonths < 0 || ageMonths > MAX_MONTHS };
}

// WHO-style chart bands.
export const BAND_PERCENTILES = [3, 15, 50, 85, 97] as const;

export interface BandPoint {
  month: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
}

/** Reference curves (value at each band percentile) for months 0-24, for the chart. */
export function bandCurves(indicator: Indicator, sex: Sex): BandPoint[] {
  const table = TABLES[indicator][sex];
  const zByBand = BAND_PERCENTILES.map((p) => normalInverse(p / 100));
  return table.map((row) => {
    const [p3, p15, p50, p85, p97] = zByBand.map((z) => valueAtZ(row, z));
    return { month: row.month, p3, p15, p50, p85, p97 };
  });
}

/**
 * Major percentile zone, for detecting band crossings. 0 = below 3rd … 5 = above 97th.
 * A drop of 2+ zones between consecutive logs is the "percentile crossing" flag.
 */
export function percentileZone(percentile: number): number {
  if (percentile < 3) return 0;
  if (percentile < 15) return 1;
  if (percentile < 50) return 2;
  if (percentile < 85) return 3;
  if (percentile < 97) return 4;
  return 5;
}
