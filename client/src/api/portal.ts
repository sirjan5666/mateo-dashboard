import { api } from './client';
import type { FieldDef, StatusOption } from './doctorPatients';
import type { ThreadMessage } from '../components/MessageThread';

export interface PortalMe {
  patient: { id: string; displayName: string; dob: string | null; sex: string; phone: string | null; status: string };
  doctor: { name: string } | null;
  template: { name: string; fields: FieldDef[]; statuses: StatusOption[] } | null;
  record: { status: string; tags: string[]; fields: Record<string, unknown>; updatedAt: string } | null;
}

export interface PortalEncounter {
  id: string;
  date: string;
  kind: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
}

export interface PortalPrescription {
  id: string;
  date: string;
  drug: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  status: 'active' | 'completed' | 'stopped';
}

export interface PortalAppointment {
  id: string;
  start: string;
  durationMin: number;
  mode: 'in_person' | 'phone' | 'video';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  reason: string | null;
}

export function getPortalMe() {
  return api<PortalMe>('/portal/me');
}
export function getPortalEncounters() {
  return api<{ encounters: PortalEncounter[] }>('/portal/encounters');
}
export function getPortalPrescriptions() {
  return api<{ prescriptions: PortalPrescription[] }>('/portal/prescriptions');
}
export function getPortalAppointments() {
  return api<{ appointments: PortalAppointment[] }>('/portal/appointments');
}
export function getPortalMessages() {
  return api<{ messages: ThreadMessage[] }>('/portal/messages');
}
export function sendPortalMessage(body: string) {
  return api<{ message: ThreadMessage }>('/portal/messages', { method: 'POST', body: JSON.stringify({ body }) });
}
