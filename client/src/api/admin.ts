import { api } from './client';
import type { DoctorAvailability } from './doctors';
import type { User } from './auth';

export interface AdminCounts {
  parents: number;
  doctors: number;
  babies: number;
  consultations: number;
}

export interface AdminParent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  babies: number;
}

export interface AdminDoctor {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  registrationNo: string;
  bio: string;
  consultationFee: number;
  languages: string[];
  clinicName: string | null;
  city: string | null;
  availability: DoctorAvailability;
  status: string;
  createdAt: string;
}

// Returned once when an account is created — the admin shares these credentials.
export interface CreatedAccount {
  user: { id: string; name: string; email: string; role: string };
  tempPassword: string;
}

export interface DoctorCreateInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  specialization: string;
  qualifications?: string;
  experienceYears?: number;
  registrationNo?: string;
  bio?: string;
  consultationFee: number;
  languages?: string[];
  clinicName?: string;
  city?: string;
  availability?: DoctorAvailability;
}

export function getAdminOverview() {
  return api<{ counts: AdminCounts }>('/admin/overview');
}

export function listParents() {
  return api<{ parents: AdminParent[] }>('/admin/parents');
}

export function createParent(input: { name: string; email: string; phone?: string; password?: string; referralCode?: string }) {
  return api<CreatedAccount>('/admin/parents', { method: 'POST', body: JSON.stringify(input) });
}

export function updateParent(userId: string, input: { name?: string; email?: string; phone?: string; password?: string }) {
  return api<{ user: { id: string; name: string; email: string; phone: string | null; role: string } }>(`/admin/parents/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listAdminDoctors() {
  return api<{ doctors: AdminDoctor[] }>('/admin/doctors');
}

export function createDoctor(input: DoctorCreateInput) {
  return api<CreatedAccount>('/admin/doctors', { method: 'POST', body: JSON.stringify(input) });
}

export type DoctorUpdateInput = Partial<DoctorCreateInput> & { status?: 'pending' | 'approved' | 'rejected' };

export function updateDoctor(profileId: string, input: DoctorUpdateInput) {
  return api<{ ok: true }>(`/admin/doctors/${profileId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

// ── Parent oversight (read-only) ──
export interface VaccineCounts {
  done: number;
  due: number;
  overdue: number;
  upcoming: number;
  total: number;
}

export interface AdminParentDetail {
  parent: { id: string; name: string; email: string; createdAt: string };
  babies: { id: string; name: string; dob: string; sex: 'male' | 'female'; vaccines: VaccineCounts }[];
}

export interface AdminBabySnapshot {
  baby: { id: string; name: string; dob: string; sex: 'male' | 'female'; birthWeightG?: number; birthLengthCm?: number; birthHeadCircCm?: number };
  owner: { name: string; email: string } | null;
  vaccines: {
    summary: VaccineCounts;
    doses: { id: string; vaccineName: string; doseLabel: string; dueDate: string; administeredOn: string | null; status: 'done' | 'due' | 'overdue' | 'upcoming' }[];
  };
  growth: { id: string; loggedAt: string; weightG?: number; lengthCm?: number; headCircCm?: number }[];
  skin: { id: string; loggedAt: string; area: string; description: string; severity: string }[];
  food: { id: string; loggedAt: string; mealType: string; foodName: string; reaction: string; isNewFood: boolean }[];
  sleep: { id: string; loggedAt: string; kind: string; durationMin: number; quality?: string }[];
  milestones: { id: string; milestoneId: string; achievedOn: string }[];
  records: { id: string; recordType: string; title: string; recordDate: string; provider: string | null; notes: string | null }[];
  appointments: { id: string; scheduledAt: string; reason: string; completed: boolean }[];
  chatSessions: { id: string; title: string; lastMessageAt: string; messages: { id: string; role: 'user' | 'assistant'; content: string; redFlagTriggered: boolean; createdAt: string }[] }[];
}

export function getAdminParent(id: string) {
  return api<AdminParentDetail>(`/admin/parents/${id}`);
}

// ── AI chat oversight (read-only) ──
export interface AdminChatCounts {
  sessions: number;
  live: number;
  messages: number;
  questions: number;
  redFlags: number;
  activeParents: number;
}

export interface AdminChatRow {
  id: string;
  title: string;
  babyId: string;
  babyName: string;
  parentId: string | null;
  parentName: string;
  messages: number;
  questions: number;
  redFlags: number;
  lastMessageAt: string;
  createdAt: string;
  live: boolean;
}

export interface AdminChatsResponse {
  counts: AdminChatCounts;
  liveWindowMinutes: number;
  sessions: AdminChatRow[];
}

export interface AdminChatTranscript {
  session: {
    id: string;
    title: string;
    babyId: string;
    babyName: string;
    parentId: string | null;
    parentName: string;
    parentEmail: string | null;
    lastMessageAt: string;
    createdAt: string;
    live: boolean;
  };
  messages: { id: string; role: 'user' | 'assistant'; content: string; redFlagTriggered: boolean; createdAt: string }[];
}

export function getAdminChats() {
  return api<AdminChatsResponse>('/admin/chats');
}

export function getAdminChatTranscript(sessionId: string) {
  return api<AdminChatTranscript>(`/admin/chats/${sessionId}`);
}

export function getAdminBaby(id: string) {
  return api<AdminBabySnapshot>(`/admin/babies/${id}`);
}

// Switch the current session into the target user (parent/doctor).
export function impersonateUser(userId: string) {
  return api<{ user: User }>(`/admin/impersonate/${userId}`, { method: 'POST' });
}

// Permanently delete a parent/doctor user and all their data.
export function deleteUser(userId: string) {
  return api<{ ok: true }>(`/admin/users/${userId}`, { method: 'DELETE' });
}
