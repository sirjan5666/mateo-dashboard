import { api } from './client';

// Mirrors the server dose-check shapes (routes/dosing.ts + medicines/dosing.ts).
export type DoseLevel = 'ok' | 'info' | 'warning' | 'danger';
export type ReviewStatus = 'draft' | 'reviewed';

export interface DoseMessage {
  level: DoseLevel;
  text: string;
}

export interface DrugDosing {
  mgPerKgPerDose: { min: number; max: number };
  maxMgPerKgPerDay?: number;
  maxSingleDoseMg?: number;
  maxDailyDoseMg?: number;
  usualFrequency?: string;
}

export interface DosingDrug {
  id: string;
  name: string;
  aka?: string;
  category: string;
  route: string;
  dosing?: DrugDosing;
  ageFloor?: { months: number; level: DoseLevel; reason: string };
  contraindications: string[];
  cautions: string[];
  source: string;
  reviewStatus: ReviewStatus;
}

export interface BrandStrength {
  drugId: string;
  mg: number;
  per: 'tablet' | 'ml';
}
export interface DosingBrand {
  id: string;
  name: string;
  form: string;
  strengths: BrandStrength[];
  reviewStatus: ReviewStatus;
}

export interface DoseCheckResult {
  level: DoseLevel;
  needsWeight: boolean;
  recommendedSingleMg?: { min: number; max: number };
  recommendedDailyMaxMg?: number;
  perKgPerDose?: { min: number; max: number };
  usualFrequency?: string;
  messages: DoseMessage[];
  contraindications: string[];
  cautions: string[];
  source: string;
  reviewStatus: ReviewStatus;
}

export interface DoseCheckResponse {
  result: DoseCheckResult;
  resolved: { weightKg: number | null; ageMonths: number; babyName: string | null };
}

export interface DoseCheckInput {
  drugId: string;
  doseMg?: number;
  dosesPerDay?: number;
  consultationId?: string;
  weightKg?: number;
  ageMonths?: number;
}

export function getDosingCatalog() {
  return api<{ status: string; drugs: DosingDrug[]; brands: DosingBrand[] }>('/dosing/catalog');
}

export function checkDose(input: DoseCheckInput) {
  return api<DoseCheckResponse>('/dosing/check', { method: 'POST', body: JSON.stringify(input) });
}

// AI medicine reference — doctor-only fallback for names not in the curated
// catalog. Every result is AI-generated + unverified (see `disclaimer`).
export interface AiMedicine {
  name: string;
  brands: string[];
  drugClass: string;
  pediatricUse: string;
  form: string;
  typicalDose: string;
  cautions: string[];
  contraindications: string[];
}
export interface AiMedicineSearchResponse {
  enabled: boolean;
  medicines: AiMedicine[];
  disclaimer: string;
  error?: string;
}
export function aiMedicineSearch(query: string) {
  return api<AiMedicineSearchResponse>('/dosing/ai-search', { method: 'POST', body: JSON.stringify({ query }) });
}

// Real Indian-medicine typeahead over the IndiaMedicine reference catalog
// (~254k rows) — the PRIMARY source for the prescribe medicine search. Reference
// only: brand name + composition + pack, no dosing.
export interface DatasetMedicine {
  id: string;
  name: string;
  type: string | null;
  packSize: string | null;
  composition1: string | null;
  composition2: string | null;
}
export function searchMedicines(q: string) {
  return api<{ medicines: DatasetMedicine[] }>(`/dosing/medicines?q=${encodeURIComponent(q)}`);
}
