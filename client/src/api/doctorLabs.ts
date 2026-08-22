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

// ── Lab Orders ──

export type LabOrderStatus = 'ordered' | 'sample_collected' | 'in_progress' | 'completed' | 'cancelled';

export interface LabOrderTestResult {
  analyteId: string;
  name: string;
  value: number | null;
  unit: string;
  level: LabLevel | null;
  refLow: number | null;
  refHigh: number | null;
}

export interface LabOrderDto {
  id: string;
  patientId: string;
  patientName: string;
  orderNumber: string;
  tests: string[];
  status: LabOrderStatus;
  priority: 'routine' | 'urgent';
  results: LabOrderTestResult[];
  notes: string | null;
  orderedAt: string;
  sampleCollectedAt: string | null;
  completedAt: string | null;
}

export function getLabOrders(params?: { status?: LabOrderStatus; patientId?: string }) {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.patientId) q.set('patientId', params.patientId);
  const qs = q.toString();
  return api<{ orders: LabOrderDto[] }>(`/doctor/labs/orders${qs ? `?${qs}` : ''}`);
}

export function createLabOrder(body: { patientId: string; tests: string[]; priority?: 'routine' | 'urgent'; notes?: string }) {
  return api<{ id: string; orderNumber: string; status: LabOrderStatus }>('/doctor/labs/orders', { method: 'POST', body: JSON.stringify(body) });
}

export function updateLabOrderStatus(id: string, status: LabOrderStatus) {
  return api<{ status: LabOrderStatus }>(`/doctor/labs/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function addLabOrderResults(id: string, body: { results: { analyteId: string; value: number }[]; ageMonths: number }) {
  return api<{ results: LabOrderTestResult[]; status: LabOrderStatus }>(`/doctor/labs/orders/${id}/results`, { method: 'POST', body: JSON.stringify(body) });
}
