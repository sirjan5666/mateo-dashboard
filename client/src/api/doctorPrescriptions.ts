import { api } from './client';

// Mirrors server routes/doctorPrescriptions.ts (one medication per row).
export type RxStatus = 'active' | 'completed' | 'stopped';

export interface Prescription {
  id: string;
  patientId: string;
  encounterId: string | null;
  date: string;
  drug: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  status: RxStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PrescriptionInput {
  drug?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  date?: string;
  status?: RxStatus;
}

export function listPrescriptions(patientId: string) {
  return api<{ prescriptions: Prescription[] }>(`/doctor/patients/${patientId}/prescriptions`);
}

/** Clinic-wide: every medication this doctor has prescribed, with patient names. */
export function listAllPrescriptions(status?: RxStatus) {
  return api<{ prescriptions: (Prescription & { patientName: string })[] }>(
    `/doctor/prescriptions${status ? `?status=${status}` : ''}`,
  );
}

export function createPrescription(patientId: string, body: PrescriptionInput & { drug: string }) {
  return api<{ prescription: Prescription }>(`/doctor/patients/${patientId}/prescriptions`, { method: 'POST', body: JSON.stringify(body) });
}

export function updatePrescription(rxId: string, body: PrescriptionInput) {
  return api<{ prescription: Prescription }>(`/doctor/prescriptions/${rxId}`, { method: 'PATCH', body: JSON.stringify(body) });
}
