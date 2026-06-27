import { api } from './client';

export type Indicator = 'weight' | 'length' | 'head';

export interface BandPoint {
  month: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
}

export interface PlotMetric {
  value: number;
  percentile: number;
  z: number;
  outOfRange: boolean;
}

export interface PlotPoint {
  ageMonths: number;
  weightG?: number;
  lengthCm?: number;
  headCircCm?: number;
  metrics: Partial<Record<Indicator, PlotMetric>>;
}

export interface GrowthAlert {
  indicator: Indicator;
  level: 'low' | 'high';
  label: string;
  percentile: number;
}

export interface GrowthInsight {
  indicator: Indicator;
  kind: 'crossing' | 'stagnation';
  message: string;
}

export interface PlotInputPoint {
  ageMonths: number;
  weightG?: number;
  lengthCm?: number;
  headCircCm?: number;
}

export interface PlotInput {
  sex: 'male' | 'female';
  points: PlotInputPoint[];
}

export interface PlotResult {
  sex: 'male' | 'female';
  points: PlotPoint[];
  bands: Record<Indicator, BandPoint[]>;
  alerts: GrowthAlert[];
  insights: GrowthInsight[];
}

// WHO growth plotter — computes percentiles for entered measurements. Persists nothing.
export function plotGrowth(body: PlotInput) {
  return api<PlotResult>('/doctor/growth/plot', { method: 'POST', body: JSON.stringify(body) });
}
