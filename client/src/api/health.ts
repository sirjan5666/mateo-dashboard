import { api } from './client';

export type RecordType = 'checkup' | 'illness' | 'medication' | 'allergy' | 'measurement' | 'note' | 'other';

export interface HealthRecord {
  id: string;
  recordType: RecordType;
  title: string;
  recordDate: string;
  provider: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RecordInput {
  recordType: RecordType;
  title: string;
  recordDate: string;
  provider?: string;
  notes?: string;
}

export interface Appointment {
  id: string;
  scheduledAt: string;
  reason: string;
  location: string | null;
  notes: string | null;
  completed: boolean;
  createdAt: string;
}

export interface AppointmentInput {
  scheduledAt: string;
  reason: string;
  location?: string;
  notes?: string;
}

export function listRecords(babyId: string) {
  return api<{ records: HealthRecord[] }>(`/babies/${babyId}/records`);
}
export function addRecord(babyId: string, input: RecordInput) {
  return api<{ record: HealthRecord }>(`/babies/${babyId}/records`, { method: 'POST', body: JSON.stringify(input) });
}
export function deleteRecord(babyId: string, recordId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/records/${recordId}`, { method: 'DELETE' });
}

export function listAppointments(babyId: string) {
  return api<{ appointments: Appointment[] }>(`/babies/${babyId}/appointments`);
}
export function addAppointment(babyId: string, input: AppointmentInput) {
  return api<{ appointment: Appointment }>(`/babies/${babyId}/appointments`, { method: 'POST', body: JSON.stringify(input) });
}
export function setAppointmentDone(babyId: string, apptId: string, completed: boolean) {
  return api<{ appointment: Appointment }>(`/babies/${babyId}/appointments/${apptId}`, { method: 'PATCH', body: JSON.stringify({ completed }) });
}
export function deleteAppointment(babyId: string, apptId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/appointments/${apptId}`, { method: 'DELETE' });
}
