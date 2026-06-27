// Pediatric drug-dosing reference for the doctor prescribing safety-check.
//
// ⚠️ STATUS: DRAFT. These are INDICATIVE, widely-published pediatric parameters
// expressed as plain data — they are NOT a substitute for a current prescribing
// reference and MUST be reviewed and signed off by a pediatrician / clinical
// pharmacist before launch (same gate as iap-schedule.json / who-milestones.json).
// The checker is DECISION SUPPORT only: it flags and informs; the prescriber
// decides and remains responsible. Verify every value against an authoritative
// source (e.g. WHO Model Formulary for Children, IAP drug formulary, the product
// label / national formulary) for the specific indication.
//
// Dosing math is deterministic (medicines/dosing.ts) — never computed by the LLM.

export const DOSING_DATA_STATUS =
  'DRAFT — indicative values pending pediatrician / clinical-pharmacist sign-off. Reference only; verify against current prescribing references.';

export type ReviewStatus = 'draft' | 'reviewed';

export interface PaediatricDosing {
  mgPerKgPerDose: { min: number; max: number };
  maxMgPerKgPerDay?: number;
  maxSingleDoseMg?: number; // absolute cap regardless of weight
  maxDailyDoseMg?: number; // absolute cap regardless of weight
  usualFrequency?: string; // display only
}

export interface AgeRule {
  months: number; // applies when the baby is younger than this
  level: 'warning' | 'danger';
  reason: string;
}

export interface Drug {
  id: string;
  name: string; // active ingredient / generic
  aka?: string;
  category: string;
  route: string;
  dosing?: PaediatricDosing; // omitted for entries that are contraindication-only
  ageFloor?: AgeRule;
  contraindications: string[]; // always surfaced as warnings
  cautions: string[]; // always surfaced as info
  source: string;
  reviewStatus: ReviewStatus;
}

export interface BrandStrength {
  drugId: string;
  mg: number; // mg per single unit
  per: 'tablet' | 'ml';
}
export interface Brand {
  id: string;
  name: string; // e.g. "Dolo 650"
  form: 'Tablet' | 'Syrup' | 'Suspension' | 'Drops';
  strengths: BrandStrength[];
  reviewStatus: ReviewStatus;
}

const SOURCE = 'Indicative (WHO Model Formulary for Children / IAP) — DRAFT, verify';

export const DRUGS: Drug[] = [
  {
    id: 'paracetamol',
    name: 'Paracetamol',
    aka: 'Acetaminophen',
    category: 'Analgesic / antipyretic',
    route: 'Oral',
    dosing: { mgPerKgPerDose: { min: 10, max: 15 }, maxMgPerKgPerDay: 60, maxSingleDoseMg: 1000, maxDailyDoseMg: 4000, usualFrequency: 'every 4–6 hours' },
    contraindications: ['Severe hepatic impairment'],
    cautions: ['Count total paracetamol from ALL sources (many combination products contain it)', 'Do not exceed 4 doses in 24 h without advice'],
    source: SOURCE,
    reviewStatus: 'draft',
  },
  {
    id: 'ibuprofen',
    name: 'Ibuprofen',
    category: 'NSAID',
    route: 'Oral',
    dosing: { mgPerKgPerDose: { min: 5, max: 10 }, maxMgPerKgPerDay: 40, maxSingleDoseMg: 400, maxDailyDoseMg: 1200, usualFrequency: 'every 6–8 hours' },
    ageFloor: { months: 3, level: 'danger', reason: 'Not recommended under 3 months / below ~5 kg' },
    contraindications: ['Active GI bleeding or peptic ulcer', 'Significant dehydration or renal impairment'],
    cautions: ['Give with food', 'Avoid in dengue / bleeding-risk illness', 'Caution in asthma'],
    source: SOURCE,
    reviewStatus: 'draft',
  },
  {
    id: 'amoxicillin',
    name: 'Amoxicillin',
    category: 'Antibiotic (penicillin)',
    route: 'Oral',
    dosing: { mgPerKgPerDose: { min: 7, max: 15 }, maxMgPerKgPerDay: 45, maxSingleDoseMg: 1000, maxDailyDoseMg: 1750, usualFrequency: 'divided 2–3 times a day' },
    contraindications: ['Penicillin / beta-lactam allergy'],
    cautions: ['Higher doses (≈80–90 mg/kg/day) are used for acute otitis media — confirm the indication', 'Total daily dose is divided across 2–3 doses'],
    source: SOURCE,
    reviewStatus: 'draft',
  },
  {
    id: 'azithromycin',
    name: 'Azithromycin',
    category: 'Antibiotic (macrolide)',
    route: 'Oral',
    dosing: { mgPerKgPerDose: { min: 5, max: 10 }, maxMgPerKgPerDay: 10, maxSingleDoseMg: 500, maxDailyDoseMg: 500, usualFrequency: 'once daily' },
    contraindications: ['Macrolide allergy', 'Significant hepatic impairment'],
    cautions: ['Regimen varies (e.g. 10 mg/kg day 1 then 5 mg/kg, or 10 mg/kg × 3 days) — confirm the course', 'QT-prolongation caution'],
    source: SOURCE,
    reviewStatus: 'draft',
  },
  {
    id: 'aspirin',
    name: 'Aspirin',
    aka: 'Acetylsalicylic acid',
    category: 'NSAID / antiplatelet',
    route: 'Oral',
    // No general pediatric analgesic/antipyretic dose — intentionally omitted.
    ageFloor: { months: 192, level: 'danger', reason: 'Avoid in children & teenagers — risk of Reye’s syndrome' },
    contraindications: ['Do NOT use for fever / viral illness in children (Reye’s syndrome)', 'Use only for specific conditions (e.g. Kawasaki disease) under specialist supervision'],
    cautions: ['Bleeding risk'],
    source: SOURCE,
    reviewStatus: 'draft',
  },
  {
    id: 'codeine',
    name: 'Codeine',
    category: 'Opioid',
    route: 'Oral',
    // No pediatric dose — contraindicated in young children.
    ageFloor: { months: 144, level: 'danger', reason: 'Contraindicated under 12 years — risk of severe respiratory depression' },
    contraindications: ['Contraindicated < 12 years (FDA/EMA)', 'Avoid after tonsillectomy/adenoidectomy', 'Avoid in breastfeeding mothers'],
    cautions: ['Ultra-rapid metabolisers at higher risk'],
    source: SOURCE,
    reviewStatus: 'draft',
  },
];

// Common Indian brands → active ingredient + per-unit strength. Lets a doctor pick
// a brand (e.g. "Dolo 650") and the UI converts a tablet/ml count to mg. Product
// strengths are also DRAFT — verify against the current pack.
export const BRANDS: Brand[] = [
  { id: 'dolo-650', name: 'Dolo 650', form: 'Tablet', strengths: [{ drugId: 'paracetamol', mg: 650, per: 'tablet' }], reviewStatus: 'draft' },
  { id: 'crocin-500', name: 'Crocin 500', form: 'Tablet', strengths: [{ drugId: 'paracetamol', mg: 500, per: 'tablet' }], reviewStatus: 'draft' },
  { id: 'calpol-250-syrup', name: 'Calpol 250 Syrup', form: 'Syrup', strengths: [{ drugId: 'paracetamol', mg: 50, per: 'ml' }], reviewStatus: 'draft' }, // 250 mg / 5 ml
  { id: 'brufen-400', name: 'Brufen 400', form: 'Tablet', strengths: [{ drugId: 'ibuprofen', mg: 400, per: 'tablet' }], reviewStatus: 'draft' },
  { id: 'brufen-syrup', name: 'Brufen Syrup', form: 'Syrup', strengths: [{ drugId: 'ibuprofen', mg: 20, per: 'ml' }], reviewStatus: 'draft' }, // 100 mg / 5 ml
  { id: 'mox-250', name: 'Mox 250', form: 'Tablet', strengths: [{ drugId: 'amoxicillin', mg: 250, per: 'tablet' }], reviewStatus: 'draft' },
  { id: 'novamox-125-syrup', name: 'Novamox 125 Syrup', form: 'Syrup', strengths: [{ drugId: 'amoxicillin', mg: 25, per: 'ml' }], reviewStatus: 'draft' }, // 125 mg / 5 ml
  { id: 'azithral-250', name: 'Azithral 250', form: 'Tablet', strengths: [{ drugId: 'azithromycin', mg: 250, per: 'tablet' }], reviewStatus: 'draft' },
  { id: 'azee-200-syrup', name: 'Azee 200 Syrup', form: 'Syrup', strengths: [{ drugId: 'azithromycin', mg: 40, per: 'ml' }], reviewStatus: 'draft' }, // 200 mg / 5 ml
  { id: 'aspirin', name: 'Aspirin / Disprin', form: 'Tablet', strengths: [{ drugId: 'aspirin', mg: 325, per: 'tablet' }], reviewStatus: 'draft' },
];

export function getDrug(id: string): Drug | undefined {
  return DRUGS.find((d) => d.id === id);
}
export function getBrand(id: string): Brand | undefined {
  return BRANDS.find((b) => b.id === id);
}
