import { api } from './client';
import type { WorkingHours } from './doctors';

/** Account-level preferences edited on the Settings page. */
export interface ClinicPreferences {
  dateFormat: 'DD MMM YYYY' | 'DD/MM/YYYY';
  timeFormat: '12' | '24';
  currency: string;
  language: 'en' | 'hi';
  defaultPage: 'dashboard' | 'appointments' | 'patients';
  patientPortal: boolean;
  autoPatientId: boolean;
  appointmentReminders: boolean;
  whatsappNotifications: boolean;
  onlineBooking: boolean;
  dataBackup: boolean;
  sessionTimeoutMins: number;
}

export interface ClinicSettings {
  /** The primary clinic's contact details; null until a location is added. */
  clinic: { id: string; name: string; email: string; phone: string } | null;
  workingHours: WorkingHours;
  preferences: ClinicPreferences;
}

export interface SettingsInput {
  clinic?: { name: string; email?: string; phone?: string };
  workingHours?: WorkingHours;
  preferences?: Partial<ClinicPreferences>;
}

export function getSettings() {
  return api<ClinicSettings>('/doctor/settings');
}

/** Saves any subset; sections left out are untouched. Returns the fresh state. */
export function saveSettings(body: SettingsInput) {
  return api<ClinicSettings>('/doctor/settings', { method: 'PUT', body: JSON.stringify(body) });
}
