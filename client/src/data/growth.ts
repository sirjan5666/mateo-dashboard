/**
 * Growth chart data for PT-0002486 (Clinic OS spec 08).
 *
 * ⚠ PLACEHOLDER DATA — not wired to the API yet. The WHO curves below are a
 * coarse boys 0–5y shape sufficient for the mock; replace with the real WHO
 * LMS tables (already in `server/src/data/`) when this is wired.
 */

export type MetricKey = 'height' | 'weight' | 'bmi' | 'head';

export interface Metric {
  key: MetricKey;
  label: string;
  /** Chart title, e.g. "Height for Age". */
  title: string;
  /** Growth Summary label — "Head Circumference" drops the "for Age" suffix. */
  summaryLabel: string;
  unit: string;
  axisLabel: string;
  ticks: number[];
  /** Percentile shown in the Growth Summary panel. */
  percentile: number;
  /** Column header in the measurements table. */
  column: string;
}

export const METRICS: Metric[] = [
  { key: 'height', label: 'Height', title: 'Height for Age', summaryLabel: 'Height for Age', unit: 'cm', axisLabel: 'Height (cm)', ticks: [60, 70, 80, 90, 100, 110, 120], percentile: 50, column: 'Height' },
  { key: 'weight', label: 'Weight', title: 'Weight for Age', summaryLabel: 'Weight for Age', unit: 'kg', axisLabel: 'Weight (kg)', ticks: [4, 8, 12, 16, 20, 24], percentile: 62, column: 'Weight' },
  { key: 'bmi', label: 'BMI', title: 'BMI for Age', summaryLabel: 'BMI for Age', unit: '', axisLabel: 'BMI (kg/m²)', ticks: [12, 14, 16, 18, 20], percentile: 55, column: 'BMI' },
  { key: 'head', label: 'Head Circumference', title: 'Head Circumference for Age', summaryLabel: 'Head Circumference', unit: 'cm', axisLabel: 'Head circ. (cm)', ticks: [34, 38, 42, 46, 50, 54], percentile: 48, column: 'Head Circ.' },
];

/**
 * Measurements always carry one decimal: 86.0 must not render as "86", and
 * 49.0 must not render as "49". JS number literals drop the trailing zero, so
 * every displayed value goes through here.
 */
export function fmtMeasure(v: number): string {
  return v.toFixed(1);
}

/** 50th, 62nd, 55th, 48th — suffixes generated, never hard-coded. */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** X domain in months, plotted against the literal tick labels below. */
export const AGE_TICKS = [
  { months: 0, label: '0' },
  { months: 6, label: '6m' },
  { months: 12, label: '1y' },
  { months: 18, label: '1.5y' },
  { months: 24, label: '2y' },
  { months: 30, label: '2.5y' },
  { months: 36, label: '3y' },
  { months: 42, label: '3.5y' },
  { months: 48, label: '4y' },
  { months: 54, label: '4.5y' },
  { months: 60, label: '5y' },
];

export interface CurveSet {
  p3: number[];
  p15: number[];
  p50: number[];
  p85: number[];
  p97: number[];
}

/** Sampled every 6 months, 0 → 60. Curves fan outward with age. */
export const CURVES: Record<MetricKey, CurveSet> = {
  height: {
    p3: [46.1, 61.0, 69.6, 76.0, 81.0, 85.1, 88.7, 92.0, 95.0, 97.8, 100.7],
    p15: [48.0, 63.3, 72.1, 78.6, 83.8, 88.1, 91.9, 95.4, 98.6, 101.6, 104.7],
    p50: [49.9, 67.6, 75.7, 82.3, 87.8, 92.2, 96.1, 99.9, 103.3, 106.7, 110.0],
    p85: [51.8, 71.0, 79.4, 86.1, 91.9, 96.4, 100.5, 104.5, 108.2, 111.8, 115.4],
    p97: [53.7, 73.5, 82.1, 89.0, 95.0, 99.7, 104.0, 108.2, 112.1, 115.9, 119.7],
  },
  weight: {
    p3: [2.5, 6.4, 7.7, 8.6, 9.7, 10.5, 11.3, 12.0, 12.7, 13.4, 14.1],
    p15: [2.9, 7.1, 8.4, 9.4, 10.5, 11.5, 12.4, 13.2, 14.0, 14.8, 15.7],
    p50: [3.3, 7.9, 9.6, 10.9, 12.2, 13.3, 14.3, 15.3, 16.3, 17.3, 18.3],
    p85: [3.9, 8.9, 10.9, 12.4, 13.9, 15.3, 16.6, 17.8, 19.1, 20.4, 21.7],
    p97: [4.4, 9.8, 12.0, 13.7, 15.3, 16.9, 18.4, 19.9, 21.4, 23.0, 24.6],
  },
  bmi: {
    p3: [11.3, 14.7, 14.6, 14.4, 14.2, 14.0, 13.8, 13.7, 13.5, 13.4, 13.3],
    p15: [12.2, 15.7, 15.5, 15.3, 15.1, 14.9, 14.7, 14.5, 14.4, 14.3, 14.2],
    p50: [13.4, 16.9, 16.8, 16.5, 16.3, 16.0, 15.8, 15.6, 15.4, 15.3, 15.2],
    p85: [14.8, 18.2, 18.1, 17.9, 17.6, 17.4, 17.2, 17.0, 16.9, 16.8, 16.7],
    p97: [16.1, 19.4, 19.4, 19.2, 19.0, 18.8, 18.6, 18.5, 18.4, 18.4, 18.4],
  },
  head: {
    p3: [32.1, 41.5, 43.5, 44.7, 45.5, 46.1, 46.6, 47.0, 47.3, 47.6, 47.8],
    p15: [33.1, 42.6, 44.6, 45.8, 46.6, 47.2, 47.7, 48.1, 48.4, 48.7, 48.9],
    p50: [34.5, 43.9, 45.9, 47.1, 48.0, 48.6, 49.1, 49.5, 49.8, 50.1, 50.4],
    p85: [35.8, 45.2, 47.2, 48.4, 49.3, 50.0, 50.5, 50.9, 51.3, 51.6, 51.9],
    p97: [37.0, 46.3, 48.4, 49.6, 50.5, 51.2, 51.8, 52.2, 52.6, 52.9, 53.2],
  },
};

export interface Measurement {
  date: string;
  ageMonths: number;
  /** Display string; the last row reads "6m", not "0y 6m". */
  ageLabel: string;
  height: number;
  weight: number;
  bmi: number;
  head: number;
  percentile: Record<MetricKey, number>;
}

/** Newest first, exactly as the reference lists them. */
export const MEASUREMENTS: Measurement[] = [
  { date: '12 Jan 2025', ageMonths: 48, ageLabel: '4y 2m', height: 100.2, weight: 16.2, bmi: 16.1, head: 50.1, percentile: { height: 50, weight: 62, bmi: 55, head: 48 } },
  { date: '08 Jul 2024', ageMonths: 42, ageLabel: '3y 6m', height: 96.4, weight: 15.1, bmi: 16.2, head: 49.8, percentile: { height: 48, weight: 60, bmi: 56, head: 47 } },
  { date: '10 Jan 2024', ageMonths: 36, ageLabel: '3y 0m', height: 91.1, weight: 13.9, bmi: 16.7, head: 49.4, percentile: { height: 46, weight: 58, bmi: 58, head: 47 } },
  { date: '12 Jul 2023', ageMonths: 30, ageLabel: '2y 6m', height: 86.0, weight: 12.7, bmi: 17.2, head: 49.0, percentile: { height: 48, weight: 57, bmi: 60, head: 46 } },
  { date: '10 Jan 2023', ageMonths: 24, ageLabel: '2y 0m', height: 80.2, weight: 11.4, bmi: 17.7, head: 48.4, percentile: { height: 45, weight: 55, bmi: 62, head: 46 } },
  { date: '11 Jul 2022', ageMonths: 18, ageLabel: '1y 6m', height: 74.6, weight: 10.2, bmi: 18.3, head: 47.5, percentile: { height: 44, weight: 53, bmi: 64, head: 45 } },
  { date: '10 Jan 2022', ageMonths: 12, ageLabel: '1y 0m', height: 69.2, weight: 8.9, bmi: 18.6, head: 46.2, percentile: { height: 46, weight: 51, bmi: 65, head: 45 } },
  { date: '12 Jul 2021', ageMonths: 6, ageLabel: '6m', height: 65.1, weight: 7.6, bmi: 17.9, head: 43.6, percentile: { height: 48, weight: 50, bmi: 63, head: 46 } },
];

export const CURVE_COLORS = {
  p97: '#EF4444',
  p85: '#F59E0B',
  p50: '#16A34A',
  p15: '#F59E0B',
  p3: '#EF4444',
  patient: '#2B6FF0',
} as const;

export const RANGES = [
  { key: '6M', months: 6 },
  { key: '1Y', months: 12 },
  { key: '2Y', months: 24 },
  { key: 'All', months: 60 },
] as const;
