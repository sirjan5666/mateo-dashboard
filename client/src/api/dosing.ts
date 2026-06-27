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
