// Pediatric lab reference ranges + deterministic abnormal-flagging. No DB access.
// DRAFT, INDICATIVE values for decision support only — pediatric reference ranges
// vary by lab, method, assay and population. CLAUDE.md hard rule 1: this flags a
// value as outside an indicative range; it never diagnoses. Requires clinical
// sign-off before any real use.
export const LAB_DATA_STATUS = 'DRAFT — indicative pediatric reference ranges, not clinically validated';

export type LabLevel = 'low' | 'normal' | 'high';

export interface AgeRange {
  minAgeM: number;
  maxAgeM: number; // exclusive; use 1200 for "and older"
  low: number;
  high: number;
}

export interface LabAnalyte {
  id: string;
  name: string;
  aka?: string;
  unit: string;
  category: string;
  decimals: number;
  ranges: AgeRange[];
  note?: string;
}

// Indicative ranges; age bands in months. Sources are general pediatric texts —
// every value is provisional and must be confirmed against the issuing lab.
export const LAB_ANALYTES: LabAnalyte[] = [
  {
    id: 'hb',
    name: 'Hemoglobin',
    aka: 'Hb',
    unit: 'g/dL',
    category: 'CBC',
    decimals: 1,
    ranges: [
      { minAgeM: 0, maxAgeM: 1, low: 13.5, high: 21.5 },
      { minAgeM: 1, maxAgeM: 6, low: 9.5, high: 13.5 },
      { minAgeM: 6, maxAgeM: 24, low: 10.5, high: 13.5 },
      { minAgeM: 24, maxAgeM: 72, low: 11.5, high: 13.5 },
      { minAgeM: 72, maxAgeM: 1200, low: 11.5, high: 15.5 },
    ],
    note: 'Physiologic nadir around 2–3 months.',
  },
  {
    id: 'wbc',
    name: 'White cell count',
    aka: 'WBC / TLC',
    unit: '10³/µL',
    category: 'CBC',
    decimals: 1,
    ranges: [
      { minAgeM: 0, maxAgeM: 1, low: 9, high: 30 },
      { minAgeM: 1, maxAgeM: 12, low: 6, high: 17.5 },
      { minAgeM: 12, maxAgeM: 72, low: 5, high: 15.5 },
      { minAgeM: 72, maxAgeM: 1200, low: 4.5, high: 13.5 },
    ],
  },
  {
    id: 'platelets',
    name: 'Platelets',
    aka: 'PLT',
    unit: '10³/µL',
    category: 'CBC',
    decimals: 0,
    ranges: [{ minAgeM: 0, maxAgeM: 1200, low: 150, high: 450 }],
  },
  {
    id: 'crp',
    name: 'C-reactive protein',
    aka: 'CRP',
    unit: 'mg/L',
    category: 'Inflammation',
    decimals: 1,
    ranges: [{ minAgeM: 0, maxAgeM: 1200, low: 0, high: 10 }],
    note: 'Elevation is non-specific; interpret with the clinical picture.',
  },
  {
    id: 'tsh',
    name: 'TSH',
    aka: 'Thyroid stimulating hormone',
    unit: 'mIU/L',
    category: 'Thyroid',
    decimals: 2,
    ranges: [
      { minAgeM: 0, maxAgeM: 1, low: 1, high: 20 },
      { minAgeM: 1, maxAgeM: 12, low: 0.8, high: 8.2 },
      { minAgeM: 12, maxAgeM: 72, low: 0.7, high: 6 },
      { minAgeM: 72, maxAgeM: 1200, low: 0.5, high: 4.5 },
    ],
  },
  {
    id: 'vitd',
    name: 'Vitamin D (25-OH)',
    aka: '25-hydroxyvitamin D',
    unit: 'ng/mL',
    category: 'Vitamins',
    decimals: 1,
    ranges: [{ minAgeM: 0, maxAgeM: 1200, low: 20, high: 100 }],
    note: 'Indicative bands: <20, 20–30, 30–100, >100 ng/mL — interpret with the full clinical picture.',
  },
  {
    id: 'ferritin',
    name: 'Ferritin',
    aka: 'Iron stores',
    unit: 'ng/mL',
    category: 'Iron',
    decimals: 0,
    ranges: [
      { minAgeM: 0, maxAgeM: 12, low: 15, high: 200 },
      { minAgeM: 12, maxAgeM: 60, low: 6, high: 60 },
      { minAgeM: 60, maxAgeM: 1200, low: 10, high: 120 },
    ],
    note: 'Acute-phase reactant — may be falsely normal/high with inflammation.',
  },
];

export const labById = new Map(LAB_ANALYTES.map((a) => [a.id, a]));

function bandFor(a: LabAnalyte, ageMonths: number): AgeRange | null {
  const exact = a.ranges.find((r) => ageMonths >= r.minAgeM && ageMonths < r.maxAgeM);
  if (exact) return exact;
  // The last band is open-ended ("and older"), so any age at/above its start clamps
  // to it (incl. ageMonths === the final maxAgeM). An age below the first band → no
  // range (defensive; every analyte's first band starts at 0 today).
  const last = a.ranges[a.ranges.length - 1];
  return last && ageMonths >= last.minAgeM ? last : null;
}

export interface LabFlag {
  level: LabLevel;
  low: number;
  high: number;
}

/** Deterministic flag for a value at an age. null if the analyte has no range. */
export function flagValue(a: LabAnalyte, value: number, ageMonths: number): LabFlag | null {
  const b = bandFor(a, ageMonths);
  if (!b) return null;
  const level: LabLevel = value < b.low ? 'low' : value > b.high ? 'high' : 'normal';
  return { level, low: b.low, high: b.high };
}
