import { api } from './client';

export interface MedicineCourse {
  prescriptionId: string;
  itemIndex: number;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes: string | null;
  prescribedAt: string;
  source: 'doctor' | 'self';
  doctorName: string | null;
  active: boolean;
  givenToday: number;
  lastGivenAt: string | null;
  totalGiven: number;
}

export interface ManualMedicineItem {
  medicine: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  notes?: string;
}

export interface OcrItem {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
}
export interface OcrResult {
  available: boolean;
  items: OcrItem[];
  error?: string;
}

export interface MedicinesResponse {
  active: MedicineCourse[];
  completed: MedicineCourse[];
}

export interface Adherence {
  givenToday: number;
  lastGivenAt: string | null;
  totalGiven: number;
}

export function listMedicines(babyId: string) {
  return api<MedicinesResponse>(`/babies/${babyId}/medicines`);
}
export function logDose(babyId: string, prescriptionId: string, itemIndex: number) {
  return api<Adherence>(`/babies/${babyId}/medicines/${prescriptionId}/${itemIndex}/doses`, { method: 'POST' });
}
export function undoDose(babyId: string, prescriptionId: string, itemIndex: number) {
  return api<Adherence>(`/babies/${babyId}/medicines/${prescriptionId}/${itemIndex}/doses`, { method: 'DELETE' });
}
export function setCourseActive(babyId: string, prescriptionId: string, itemIndex: number, active: boolean) {
  return api<{ active: boolean }>(`/babies/${babyId}/medicines/${prescriptionId}/${itemIndex}`, { method: 'PATCH', body: JSON.stringify({ active }) });
}

// Parent adds their own medicines (offline doctor / typed in).
export function addManualMedicines(babyId: string, items: ManualMedicineItem[], diagnosis?: string) {
  return api<{ ok: true }>(`/babies/${babyId}/medicines/manual`, { method: 'POST', body: JSON.stringify({ items, diagnosis }) });
}

// Read medicines from a prescription photo (multipart — raw fetch, not the JSON helper).
export async function ocrPrescription(babyId: string, file: File): Promise<OcrResult> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(`/api/babies/${babyId}/medicines/ocr`, { method: 'POST', credentials: 'same-origin', body: fd });
  if (!res.ok) {
    let msg = 'Could not read the photo';
    try {
      const b: unknown = await res.json();
      if (b && typeof b === 'object' && 'error' in b && typeof b.error === 'string') msg = b.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<OcrResult>;
}
