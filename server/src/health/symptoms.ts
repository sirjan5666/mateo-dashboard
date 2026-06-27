// Deterministic fever/symptom assessment for the symptom tracker. Mirrors the
// caution-first philosophy of ai/red-flags.ts: we never diagnose — we only flag
// when a reading warrants watching or urgent medical care, and always point to a
// pediatrician. Erring toward caution is intentional. Doctor must review before
// launch.

export type SymptomLevel = 'ok' | 'watch' | 'urgent';

export interface SymptomDef {
  key: string;
  label: string;
  danger: boolean; // a danger symptom alone escalates to "urgent"
}

// Curated catalog. Danger symptoms map to ai/red-flags.ts emergency categories.
export const SYMPTOMS: SymptomDef[] = [
  // Common — usually "watch"
  { key: 'cough', label: 'Cough', danger: false },
  { key: 'runny_nose', label: 'Runny or blocked nose', danger: false },
  { key: 'mild_rash', label: 'Mild rash', danger: false },
  { key: 'diarrhoea', label: 'Loose stools / diarrhoea', danger: false },
  { key: 'vomiting_mild', label: 'Occasional vomiting', danger: false },
  { key: 'reduced_feeding', label: 'Feeding / eating less', danger: false },
  { key: 'fussiness', label: 'Fussy / crying more', danger: false },
  { key: 'ear_pulling', label: 'Pulling at ears', danger: false },
  { key: 'teething', label: 'Teething', danger: false },
  // Serious — escalate to "urgent"
  { key: 'difficulty_breathing', label: 'Difficulty or fast breathing', danger: true },
  { key: 'bluish_lips', label: 'Bluish lips or skin', danger: true },
  { key: 'seizure', label: 'Seizure / fits', danger: true },
  { key: 'unresponsive', label: 'Very drowsy or hard to wake', danger: true },
  { key: 'persistent_vomiting', label: 'Persistent or projectile vomiting', danger: true },
  { key: 'blood_in_stool_vomit', label: 'Blood in vomit or stool', danger: true },
  { key: 'dehydration', label: 'No wet nappy / sunken soft spot', danger: true },
  { key: 'rash_not_fading', label: "Rash that doesn't fade on pressure", danger: true },
  { key: 'stiff_neck', label: 'Stiff neck', danger: true },
];

export const SYMPTOM_KEYS = SYMPTOMS.map((s) => s.key);
const SYMPTOM_BY_KEY = new Map(SYMPTOMS.map((s) => [s.key, s]));

export interface Assessment {
  level: SymptomLevel;
  reasons: string[];
}

// Assess a single entry. ageDays = baby's age (in days) at the time logged.
export function assessSymptoms(input: { temperatureC?: number | null; symptoms?: string[]; ageDays?: number | null }): Assessment {
  const reasons: string[] = [];
  let urgent = false;
  let watch = false;

  const symptoms = input.symptoms ?? [];
  for (const key of symptoms) {
    const def = SYMPTOM_BY_KEY.get(key);
    if (def?.danger) {
      urgent = true;
      reasons.push(`${def.label} can be serious in a baby.`);
    }
  }
  // Vomiting + diarrhoea together raises dehydration risk.
  if (symptoms.includes('diarrhoea') && (symptoms.includes('vomiting_mild') || symptoms.includes('persistent_vomiting'))) {
    watch = true;
    reasons.push('Vomiting and diarrhoea together can quickly dehydrate a baby — watch fluids closely.');
  }

  const t = input.temperatureC;
  if (typeof t === 'number') {
    const ageDays = input.ageDays ?? null;
    if (ageDays != null && ageDays < 90 && t >= 38.0) {
      urgent = true;
      reasons.push('A fever in a baby under 3 months is always treated as an emergency.');
    } else if (t >= 40.0) {
      urgent = true;
      reasons.push('A very high temperature (40°C / 104°F or above) needs prompt medical care.');
    } else if (t <= 35.0) {
      urgent = true;
      reasons.push('A low body temperature (35°C / 95°F or below) can be serious in a baby.');
    } else if (t >= 39.0) {
      watch = true;
      reasons.push('A high temperature (39°C / 102.2°F or above) — monitor closely and consult your pediatrician.');
    } else if (t >= 38.0) {
      watch = true;
      reasons.push('A mild fever (38°C / 100.4°F or above).');
    }
  }

  const level: SymptomLevel = urgent ? 'urgent' : watch ? 'watch' : 'ok';
  return { level, reasons };
}
