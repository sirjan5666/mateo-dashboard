import { api } from './client';

// Mirrors the server doctor-EHR shapes (routes/doctorPatients.ts).
export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  maxLength?: number;
  sensitive?: boolean;
  searchable?: boolean;
  archived?: boolean;
  order?: number;
}

export interface StatusOption {
  key: string;
  label: string;
  tone?: string;
  isDefault?: boolean;
  isTerminal?: boolean;
}

export interface HistoryTag {
  key: string;
  label: string;
  color?: string;
}

export interface Template {
  id: string;
  name: string;
  specialization: string;
  version: number;
  fields: FieldDef[];
  statuses: StatusOption[];
  historyTags: HistoryTag[];
  isGlobal: boolean;
}

/**
 * Core demographics the registration form collects. They live on the patient,
 * not in a specialty template — every clinic needs a guardian, an address and
 * an emergency contact — and they are what makes "Edit Patient" able to show
 * the form as it was filled in.
 */
export interface PatientDemographics {
  address?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  email?: string | null;
  bloodGroup?: string | null;
  guardianName?: string | null;
  guardianRelationship?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  emergencyName?: string | null;
  emergencyRelationship?: string | null;
  emergencyPhone?: string | null;
  birthWeightKg?: number | null;
  birthHeightCm?: number | null;
  birthHeadCircumferenceCm?: number | null;
  deliveryType?: string | null;
  gestationalAgeWeeks?: number | null;
}

/** The same fields on the way IN — no nulls, undefined means "leave alone". */
export type PatientDemographicsInput = {
  [K in keyof PatientDemographics]: NonNullable<PatientDemographics[K]> | undefined;
};

export interface Patient extends PatientDemographics {
  id: string;
  /** Five-digit patient number, sequential per doctor. Null on legacy rows. */
  code: string | null;
  displayName: string;
  dob?: string | null;
  sex: string;
  phone?: string | null;
  status: string;
  specialtyTemplateId: string;
  /** Which of the doctor's clinics the patient is registered at. */
  locationId?: string | null;
  /** Most recent encounter; null when the patient has never been seen. */
  lastVisitAt?: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecordData {
  id: string;
  status: string;
  tags: string[];
  templateVersion: number;
  fields: Record<string, unknown>;
  updatedAt: string;
}

export interface CreatePatientInput extends PatientDemographicsInput {
  templateId: string;
  displayName: string;
  dob?: string;
  sex?: string;
  phone?: string;
  status?: string;
  /** Which of the doctor's clinics the patient registered at. */
  locationId?: string;
}

export interface UpdatePatientInput extends PatientDemographicsInput {
  displayName?: string;
  dob?: string;
  sex?: string;
  phone?: string;
  status?: string;
  locationId?: string;
}

/**
 * The patient number as it is shown and printed — five digits.
 *
 * ONE definition, used by every screen. Previously the workspace printed
 * `PT-` plus six characters of the ObjectId and the prescription printed
 * `PID-` plus four, so the same child carried two different "patient IDs".
 */
export const patientNumber = (code: string | null | undefined) => code ?? '—';

export function listTemplates() {
  return api<{ templates: Template[] }>('/doctor/templates');
}

export function listPatients(params: { includeArchived?: boolean } = {}) {
  const qs = new URLSearchParams();
  if (params.includeArchived) qs.set('includeArchived', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api<{ patients: Patient[] }>(`/doctor/patients${suffix}`);
}

export interface PortalStatus {
  active: boolean;
  email: string | null;
}

export function getPatient(id: string) {
  return api<{ patient: Patient; template: Template | null; record: RecordData | null; portal: PortalStatus; parentAccess: PortalStatus }>(
    `/doctor/patients/${id}`,
  );
}

export function createPortalLogin(patientId: string, body: { email: string; password: string }) {
  return api<{ portal: PortalStatus }>(`/doctor/patients/${patientId}/portal`, { method: 'POST', body: JSON.stringify(body) });
}

// Family-dashboard bridge: creates (or re-invites) the parent-app account for
// this child. tempPassword is present ONLY when the credential email couldn't
// be sent (SMTP unset) — show it once for the doctor to share.
export interface ParentInviteResult {
  email: string;
  emailSent: boolean;
  tempPassword?: string;
}

export function inviteParent(patientId: string, body: { email: string; parentName?: string }) {
  return api<{ invite: ParentInviteResult }>(`/doctor/patients/${patientId}/invite-parent`, { method: 'POST', body: JSON.stringify(body) });
}

export function createPatient(body: CreatePatientInput) {
  return api<{ patient: Patient }>('/doctor/patients', { method: 'POST', body: JSON.stringify(body) });
}

export function updatePatient(id: string, body: UpdatePatientInput) {
  return api<{ patient: Patient }>(`/doctor/patients/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function archivePatient(id: string) {
  return api<{ patient: Patient }>(`/doctor/patients/${id}`, { method: 'DELETE' });
}

export function savePatientRecord(id: string, body: { fields: Record<string, unknown>; tags?: string[]; status?: string }) {
  return api<{ record: RecordData }>(`/doctor/patients/${id}/record`, { method: 'PUT', body: JSON.stringify(body) });
}
