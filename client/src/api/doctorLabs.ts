import { api } from './client';

export type LabLevel = 'low' | 'normal' | 'high';

export interface AgeRange {
  minAgeM: number;
  maxAgeM: number;
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

export interface LabResult {
  analyteId: string;
  name: string;
  unit: string;
  category: string;
  decimals: number;
  note: string | null;
  value: number;
  level: LabLevel;
  refLow: number | null;
  refHigh: number | null;
}

export interface LabInterpretResult {
  status: string;
  ageMonths: number;
  results: LabResult[];
  abnormal: number;
}

export function getLabCatalog() {
  return api<{ status: string; analytes: LabAnalyte[] }>('/doctor/labs/catalog');
}

export function interpretLabs(body: { ageMonths: number; results: { analyteId: string; value: number }[] }) {
  return api<LabInterpretResult>('/doctor/labs/interpret', { method: 'POST', body: JSON.stringify(body) });
}
