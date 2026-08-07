import { api } from './client';

/**
 * Staff sign-in. Separate from `api/auth.ts` because staff are not `User` rows —
 * they belong to a practice. The cookie is the same one, with the doctor as its
 * subject, which is why the doctor panel works for them unchanged.
 */

export interface StaffSelf {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employeeCode: string | null;
  locationId: string | null;
  status: 'invited' | 'active' | 'disabled';
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}

export interface StaffSessionPayload {
  staff: StaffSelf | null;
  role: { id: string; name: string; description: string | null } | null;
  practice?: { doctorUserId: string; doctorName: string };
  /** Flat `module:action` strings. Empty for a doctor — they own everything. */
  permissions: string[];
  /** Present only on the doctor's own session. */
  owner?: boolean;
}

export interface StaffDevice {
  id: string;
  device: string;
  ip: string | null;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export function staffLogin(body: { email: string; password: string }) {
  return api<StaffSessionPayload>('/staff/auth/login', { method: 'POST', body: JSON.stringify(body) });
}

export function staffRefresh() {
  return api<StaffSessionPayload>('/staff/auth/refresh', { method: 'POST' });
}

export function staffLogout() {
  return api<{ ok: true }>('/staff/auth/logout', { method: 'POST' });
}

/** Who is signed in. Returns `owner: true` for the doctor's own session. */
export function staffMe() {
  return api<StaffSessionPayload & { owner?: boolean; role?: string | null }>('/staff/auth/me');
}

/** What an invitation link is for, before asking the recipient for a password. */
export function readInvite(token: string) {
  return api<{ name: string; email: string; practice: string }>(`/staff/auth/invite/${encodeURIComponent(token)}`);
}

export function activateStaff(body: { token: string; password: string }) {
  return api<{ ok: true; email: string }>('/staff/auth/activate', { method: 'POST', body: JSON.stringify(body) });
}

/** Always resolves — the server does not reveal whether an address is known. */
export function forgotStaffPassword(email: string) {
  return api<{ ok: true }>('/staff/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) });
}

export function resetStaffPassword(body: { token: string; password: string }) {
  return api<{ ok: true; email: string }>('/staff/auth/reset', { method: 'POST', body: JSON.stringify(body) });
}

export function listStaffSessions() {
  return api<{ sessions: StaffDevice[] }>('/staff/auth/sessions');
}

export function revokeStaffSession(body: { sessionId?: string; all?: boolean }) {
  return api<{ revoked: number }>('/staff/auth/sessions/revoke', { method: 'POST', body: JSON.stringify(body) });
}

export function changeStaffPassword(body: { currentPassword: string; newPassword: string }) {
  return api<{ ok: true }>('/staff/auth/password', { method: 'POST', body: JSON.stringify(body) });
}
