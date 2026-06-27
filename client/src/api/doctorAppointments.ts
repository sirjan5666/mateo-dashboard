import { api } from './client';

// Mirrors server routes/doctorAppointments.ts.
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type AppointmentMode = 'in_person' | 'phone' | 'video';

export interface Appointment {
  id: string;
  patientId: string;
  patient?: { id: string; name: string };
  start: string;
  durationMin: number;
  mode: AppointmentMode;
  status: AppointmentStatus;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  start: string;
  durationMin?: number;
  mode?: AppointmentMode;
  reason?: string;
}
export interface UpdateAppointmentInput {
  start?: string;
  durationMin?: number;
  mode?: AppointmentMode;
  status?: AppointmentStatus;
  reason?: string;
}

export function listSchedule(params: { from?: string; to?: string; status?: AppointmentStatus } = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api<{ appointments: Appointment[] }>(`/doctor/appointments${suffix}`);
}

export function listPatientAppointments(patientId: string) {
  return api<{ appointments: Appointment[] }>(`/doctor/patients/${patientId}/appointments`);
}

export function createAppointment(patientId: string, body: CreateAppointmentInput) {
  return api<{ appointment: Appointment }>(`/doctor/patients/${patientId}/appointments`, { method: 'POST', body: JSON.stringify(body) });
}

export function updateAppointment(appointmentId: string, body: UpdateAppointmentInput) {
  return api<{ appointment: Appointment }>(`/doctor/appointments/${appointmentId}`, { method: 'PATCH', body: JSON.stringify(body) });
}
