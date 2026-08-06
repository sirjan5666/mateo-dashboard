import { api } from './client';

// Mirrors server routes/doctorPrescriptionDocs.ts — the printable prescription.

export interface PrescriptionHeader {
  id: string;
  /** Printed top-right, e.g. RX250518-00123. */
  number: string;
  issuedAt: string;
  diagnosis: string | null;
  reviewAfterDays: number | null;
  investigations: string[];
  advice: string[];
  /** Weight at issue, frozen so a reprint shows what was dosed against. */
  weightKg: number | null;
  locationId: string | null;
  encounterId: string | null;
}

export interface PrescriptionLine {
  id: string;
  drug: string;
  strength: string | null;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  status: 'active' | 'completed' | 'stopped';
}

export interface PrescriptionSheetData {
  document: PrescriptionHeader;
  items: PrescriptionLine[];
  patient: {
    id: string;
    displayName: string;
    dob: string | null;
    sex: string;
    phone: string | null;
    address: string | null;
    allergies: string | null;
  } | null;
  doctor: {
    name: string;
    qualifications: string | null;
    specialization: string | null;
    registrationNo: string | null;
  };
  clinic: {
    name: string;
    address: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    openingHours: string | null;
  } | null;
}

export interface PrescriptionItemInput {
  drug: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface IssuePrescriptionInput {
  issuedAt?: string;
  diagnosis?: string;
  reviewAfterDays?: number;
  investigations?: string[];
  advice?: string[];
  locationId?: string;
  encounterId?: string;
  items: PrescriptionItemInput[];
}

export function listPrescriptionDocs(patientId: string) {
  return api<{ documents: (PrescriptionHeader & { medicineCount: number })[] }>(
    `/doctor/patients/${patientId}/prescription-documents`,
  );
}

/** Everything the printed sheet renders, in one tenant-scoped read. */
export function getPrescriptionSheet(docId: string) {
  return api<PrescriptionSheetData>(`/doctor/prescription-documents/${docId}`);
}

export function issuePrescription(patientId: string, body: IssuePrescriptionInput) {
  return api<{ document: PrescriptionHeader }>(`/doctor/patients/${patientId}/prescription-documents`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
