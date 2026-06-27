import { api } from './client';

export interface PrescriptionItem {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  diagnosis: string;
  items: PrescriptionItem[];
  advice: string;
  followUpDate: string | null;
  createdAt: string;
  doctor: { name: string; specialization: string; qualifications: string; registrationNo: string; clinicName: string | null };
  patient: { name: string; dob: string; sex: 'male' | 'female' } | null;
}

export interface PrescriptionInput {
  diagnosis?: string;
  items: PrescriptionItem[];
  advice?: string;
  followUpDate?: string;
}

export function listPrescriptions(consultId: string) {
  return api<{ prescriptions: Prescription[] }>(`/consultations/${consultId}/prescriptions`);
}

export function createPrescription(consultId: string, input: PrescriptionInput) {
  return api<{ prescription: Prescription }>(`/consultations/${consultId}/prescription`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
