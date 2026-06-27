import { api } from './client';

export type UserRole = 'parent' | 'doctor' | 'admin' | 'patient';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  consentAcceptedAt?: string;
  createdAt?: string;
  // True when an admin is currently impersonating this user.
  impersonating?: boolean;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role?: 'parent' | 'doctor';
  consentAccepted: true;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function signup(input: SignupInput) {
  return api<{ user: User }>('/auth/signup', { method: 'POST', body: JSON.stringify(input) });
}

export function login(input: LoginInput) {
  return api<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

export function logout() {
  return api<{ ok: true }>('/auth/logout', { method: 'POST' });
}

export function getMe() {
  return api<{ user: User }>('/auth/me');
}

export function stopImpersonating() {
  return api<{ user: User }>('/auth/stop-impersonating', { method: 'POST' });
}
