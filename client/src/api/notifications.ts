import { api } from './client';

export interface DoctorNotifications {
  messages: { total: number; byPatient: { patientId: string; count: number }[] };
}
export interface PortalNotifications {
  messages: { total: number };
}

export function getDoctorNotifications() {
  return api<DoctorNotifications>('/doctor/notifications');
}
export function getPortalNotifications() {
  return api<PortalNotifications>('/portal/notifications');
}
