import { api } from './client';

export type SymptomLevel = 'ok' | 'watch' | 'urgent';

export interface SymptomEntry {
  id: string;
  loggedAt: string;
  temperatureC: number | null;
  symptoms: string[];
  notes: string | null;
  level: SymptomLevel;
  reasons: string[];
  createdAt: string;
}

export interface SymptomSummary {
  latestTempC: number | null;
  maxTemp7dC: number | null;
  hasUrgentRecently: boolean;
}

export interface SymptomCreateInput {
  loggedAt: string;
  temperatureC?: number;
  symptoms?: string[];
  notes?: string;
}

// Picker catalog — mirrors server/src/health/symptoms.ts. `serious` ones escalate.
export const SYMPTOM_OPTIONS: { key: string; label: string; serious: boolean }[] = [
  { key: 'cough', label: 'Cough', serious: false },
  { key: 'runny_nose', label: 'Runny or blocked nose', serious: false },
  { key: 'mild_rash', label: 'Mild rash', serious: false },
  { key: 'diarrhoea', label: 'Loose stools / diarrhoea', serious: false },
  { key: 'vomiting_mild', label: 'Occasional vomiting', serious: false },
  { key: 'reduced_feeding', label: 'Feeding / eating less', serious: false },
  { key: 'fussiness', label: 'Fussy / crying more', serious: false },
  { key: 'ear_pulling', label: 'Pulling at ears', serious: false },
  { key: 'teething', label: 'Teething', serious: false },
  { key: 'difficulty_breathing', label: 'Difficulty or fast breathing', serious: true },
  { key: 'bluish_lips', label: 'Bluish lips or skin', serious: true },
  { key: 'seizure', label: 'Seizure / fits', serious: true },
  { key: 'unresponsive', label: 'Very drowsy or hard to wake', serious: true },
  { key: 'persistent_vomiting', label: 'Persistent or projectile vomiting', serious: true },
  { key: 'blood_in_stool_vomit', label: 'Blood in vomit or stool', serious: true },
  { key: 'dehydration', label: 'No wet nappy / sunken soft spot', serious: true },
  { key: 'rash_not_fading', label: "Rash that doesn't fade on pressure", serious: true },
  { key: 'stiff_neck', label: 'Stiff neck', serious: true },
];

export const SYMPTOM_LABEL = new Map(SYMPTOM_OPTIONS.map((s) => [s.key, s.label]));

export function listSymptoms(babyId: string) {
  return api<{ logs: SymptomEntry[]; summary: SymptomSummary }>(`/babies/${babyId}/symptoms`);
}
export function createSymptom(babyId: string, input: SymptomCreateInput) {
  return api<{ log: SymptomEntry }>(`/babies/${babyId}/symptoms`, { method: 'POST', body: JSON.stringify(input) });
}
export function deleteSymptom(babyId: string, logId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/symptoms/${logId}`, { method: 'DELETE' });
}
