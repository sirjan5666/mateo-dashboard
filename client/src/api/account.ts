import { api } from './client';

export interface EmergencyContact {
  id: string;
  name: string;
  relation: string | null;
  phone: string;
}

export interface ContactInput {
  name: string;
  relation?: string;
  phone: string;
}

export function listContacts() {
  return api<{ contacts: EmergencyContact[] }>(`/account/contacts`);
}
export function addContact(input: ContactInput) {
  return api<{ contact: EmergencyContact }>(`/account/contacts`, { method: 'POST', body: JSON.stringify(input) });
}
export function deleteContact(contactId: string) {
  return api<{ ok: true }>(`/account/contacts/${contactId}`, { method: 'DELETE' });
}

export interface ProfileUpdate {
  name?: string;
  heightCm?: number;
  weightKg?: number;
}

export function updateProfile(update: ProfileUpdate) {
  return api<{ user: { id: string; name: string; email: string; heightCm?: number; weightKg?: number } }>(`/account/profile`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return api<{ ok: true }>(`/account/password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// DPDP: a doctor-invited parent personally affirms the consent screen on first login.
export function confirmConsent() {
  return api<{ ok: true }>(`/account/confirm-consent`, { method: 'POST' });
}

export function exportData() {
  return api<Record<string, unknown>>(`/account/export`);
}

export function deleteAccount() {
  return api<{ ok: true }>(`/account`, { method: 'DELETE' });
}
