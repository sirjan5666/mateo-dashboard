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

export function updateProfile(name: string) {
  return api<{ user: { id: string; name: string; email: string } }>(`/account/profile`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function exportData() {
  return api<Record<string, unknown>>(`/account/export`);
}

export function deleteAccount() {
  return api<{ ok: true }>(`/account`, { method: 'DELETE' });
}
