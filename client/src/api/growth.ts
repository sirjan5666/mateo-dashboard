import { api } from './client';

export type Indicator = 'weight' | 'length' | 'head';

export interface GrowthMetric {
  value: number; // kg (weight) or cm (length/head)
  percentile: number;
  z: number;
  outOfRange: boolean;
}

export interface GrowthLogPoint {
  id: string;
  loggedAt: string;
  ageMonths: number;
  weightG?: number;
  lengthCm?: number;
  headCircCm?: number;
  metrics: Partial<Record<Indicator, GrowthMetric>>;
}

export interface BandPoint {
  month: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
}

export interface GrowthInsight {
  indicator: Indicator;
  kind: 'crossing' | 'stagnation';
  message: string;
}

export interface Growth {
  baby: { id: string; name: string; dob: string; sex: 'male' | 'female' };
  logs: GrowthLogPoint[];
  bands: Record<Indicator, BandPoint[]>;
  insights: GrowthInsight[];
}

export interface GrowthInput {
  loggedAt: string;
  weightG?: number;
  lengthCm?: number;
  headCircCm?: number;
}

export function getGrowth(babyId: string) {
  return api<Growth>(`/babies/${babyId}/growth`);
}

export function addGrowthLog(babyId: string, input: GrowthInput) {
  return api<{ log: GrowthLogPoint }>(`/babies/${babyId}/growth`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteGrowthLog(babyId: string, logId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/growth/${logId}`, { method: 'DELETE' });
}
