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
  /** Booking-time clinical context, encrypted at rest server-side. */
  symptoms: string | null;
  notes: string | null;
  locationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  start: string;
  durationMin?: number;
  mode?: AppointmentMode;
  reason?: string;
  symptoms?: string;
  notes?: string;
  locationId?: string;
}
export interface UpdateAppointmentInput extends Partial<CreateAppointmentInput> {
  status?: AppointmentStatus;
}

export function listSchedule(params: { from?: string; to?: string; status?: AppointmentStatus } = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api<{ appointments: Appointment[] }>(`/doctor/appointments${suffix}`);
}

/**
 * One appointment by id. The reschedule form loads from here — scanning a date
 * window instead silently produced a blank form for anything outside it.
 */
export function getAppointment(appointmentId: string) {
  return api<{ appointment: Appointment }>(`/doctor/appointments/${appointmentId}`);
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
