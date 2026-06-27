import { api } from './client';

export type ConsultationStatus = 'booked' | 'completed' | 'cancelled';

export interface Consultation {
  id: string;
  slotStart: string;
  slotEnd: string;
  reason: string;
  status: ConsultationStatus;
  payment: { amount: number; status: 'paid' | 'pending'; method: string; paidAt?: string };
  meetLink: string | null;
  doctor: { profileId: string; name: string };
  parent: { name: string };
  baby: { id: string; name: string | null } | null;
  createdAt: string;
}

export interface BookInput {
  doctorId: string; // doctor profile id
  babyId?: string;
  slotStart: string; // ISO
  reason?: string;
}

export function bookConsultation(input: BookInput) {
  return api<{ consultation: Consultation }>('/consultations', { method: 'POST', body: JSON.stringify(input) });
}

export interface ConcernCheck {
  triggered: boolean;
  severity: 'emergency' | 'soft' | null;
  category: string | null;
  response: string | null;
}
// Deterministic red-flag pre-screen for the booking concern box. The matching
// engine is server-side (CLAUDE.md hard rule 2); this just runs it with the baby's age.
export function checkConcern(text: string, babyId?: string) {
  return api<ConcernCheck>('/consultations/concern-check', { method: 'POST', body: JSON.stringify({ text, babyId }) });
}

export function listConsultations() {
  return api<{ consultations: Consultation[] }>('/consultations');
}

export interface FollowUp {
  prescriptionId: string;
  followUpDate: string;
  doctorName: string;
  doctorProfileId: string | null;
  babyId: string | null;
  babyName: string | null;
}
export function listFollowUps() {
  return api<{ followUps: FollowUp[] }>('/follow-ups');
}

export function getConsultation(id: string) {
  return api<{ consultation: Consultation }>(`/consultations/${id}`);
}

export function updateConsultation(id: string, status: 'completed' | 'cancelled') {
  return api<{ consultation: Consultation }>(`/consultations/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

// Doctor sets (or clears, with '') the video-call link for a consultation.
export function setMeetLink(id: string, meetLink: string) {
  return api<{ consultation: Consultation }>(`/consultations/${id}/meet-link`, { method: 'PUT', body: JSON.stringify({ meetLink }) });
}

export interface ConsultationReview {
  rating: number;
  comment: string | null;
  createdAt: string;
}
export function getReview(id: string) {
  return api<{ review: ConsultationReview | null }>(`/consultations/${id}/review`);
}
export function submitReview(id: string, rating: number, comment?: string) {
  return api<{ review: ConsultationReview }>(`/consultations/${id}/review`, { method: 'POST', body: JSON.stringify({ rating, comment }) });
}

// Doctor's read-only clinical snapshot of the consulted baby.
export interface BabySnapshot {
  baby: { name: string; dob: string; sex: 'male' | 'female' };
  vaccines: { done: number; due: number; overdue: number; total: number; next: { vaccineName: string; doseLabel: string; dueDate: string } | null };
  growth: {
    latest: { loggedAt: string; weightG: number | null; lengthCm: number | null; headCircCm: number | null } | null;
    weightPercentile: number | null;
    points: { loggedAt: string; weightG: number }[];
  };
  symptoms: { loggedAt: string; temperatureC: number | null; level: 'ok' | 'watch' | 'urgent' }[];
  feeds: { feedsToday: number; breastMinToday: number };
  diapers: { wetToday: number; dirtyToday: number };
  milestones: string[];
  allergies: { name: string; severity: string; reaction: string | null }[];
}
export function getBabySnapshot(id: string) {
  return api<BabySnapshot>(`/consultations/${id}/baby-snapshot`);
}
