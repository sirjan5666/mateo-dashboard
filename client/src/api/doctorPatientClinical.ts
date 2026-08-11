import { api, apiForm } from './client';

// Mirrors server routes/doctorPatientClinical.ts — the per-patient stores behind
// the Patient Workspace tabs. Every path is tenant-scoped server-side.

// ── Growth measurements ──────────────────────────────────────────────────────

export interface GrowthRecord {
  id: string;
  takenAt: string;
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
  /** Derived server-side from weight + height — never sent up. */
  bmi: number | null;
  recordedBy: string | null;
  note: string | null;
}

export interface GrowthRecordInput {
  takenAt: string;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  note?: string;
}

export function listGrowthRecords(patientId: string) {
  return api<{ records: GrowthRecord[] }>(`/doctor/patients/${patientId}/growth-records`);
}

export function createGrowthRecord(patientId: string, body: GrowthRecordInput) {
  return api<{ record: { id: string } }>(`/doctor/patients/${patientId}/growth-records`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteGrowthRecord(patientId: string, recordId: string) {
  return api<{ ok: true }>(`/doctor/patients/${patientId}/growth-records/${recordId}`, { method: 'DELETE' });
}

// ── Notes ────────────────────────────────────────────────────────────────────

export const NOTE_CATEGORIES = [
  'Clinical Note', 'General Note', 'Follow-up Note', 'Treatment Note', 'Observation',
] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export interface ClinicalNote {
  id: string;
  category: NoteCategory;
  text: string;
  author: string | null;
  pinned: boolean;
  createdAt: string;
}

export interface NotesResponse {
  notes: ClinicalNote[];
  /** Derived by the server from the same list, so the donut can never disagree. */
  byCategory: { label: NoteCategory; count: number }[];
  categories: NoteCategory[];
}

export function listNotes(patientId: string) {
  return api<NotesResponse>(`/doctor/patients/${patientId}/notes`);
}

export function createNote(patientId: string, body: { text: string; category?: NoteCategory; pinned?: boolean }) {
  return api<{ note: { id: string } }>(`/doctor/patients/${patientId}/notes`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateNote(patientId: string, noteId: string, body: { text?: string; category?: NoteCategory; pinned?: boolean }) {
  return api<{ note: { id: string; pinned: boolean } }>(`/doctor/patients/${patientId}/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteNote(patientId: string, noteId: string) {
  return api<{ ok: true }>(`/doctor/patients/${patientId}/notes/${noteId}`, { method: 'DELETE' });
}

// ── Documents ────────────────────────────────────────────────────────────────

export const DOCUMENT_TYPES = [
  'Identity', 'Medical Record', 'Report', 'Lab Report', 'Prescription', 'Notes', 'Other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface ClinicalDocument {
  id: string;
  name: string;
  type: DocumentType;
  /** 'PDF' | 'JPG' | … derived from the stored mime type, not the filename. */
  ext: string;
  sizeBytes: number;
  size: string;
  uploadedBy: string | null;
  note: string | null;
  createdAt: string;
}

export interface DocumentsResponse {
  documents: ClinicalDocument[];
  byType: { label: DocumentType; count: number }[];
  totalBytes: number;
  types: DocumentType[];
}

export function listDocuments(patientId: string) {
  return api<DocumentsResponse>(`/doctor/patients/${patientId}/documents`);
}

export function uploadPatientDocument(patientId: string, file: File, meta: { name?: string; type?: DocumentType; note?: string }) {
  const form = new FormData();
  form.append('file', file);
  if (meta.name) form.append('name', meta.name);
  if (meta.type) form.append('type', meta.type);
  if (meta.note) form.append('note', meta.note);
  return apiForm<{ document: { id: string } }>(`/doctor/patients/${patientId}/documents`, form);
}

/** Authenticated stream — the browser sends the JWT cookie with the navigation. */
export function documentFileUrl(patientId: string, docId: string) {
  return `/api/doctor/patients/${patientId}/documents/${docId}/file`;
}

export function deleteDocument(patientId: string, docId: string) {
  return api<{ ok: true }>(`/doctor/patients/${patientId}/documents/${docId}`, { method: 'DELETE' });
}

// ── Immunisations ────────────────────────────────────────────────────────────

export interface Immunisation {
  id: string;
  vaccine: string;
  doseLabel: string | null;
  status: 'given' | 'due' | 'overdue';
  givenAt: string | null;
  dueAt: string | null;
  batch: string | null;
  administeredBy: string | null;
}

export function listImmunisations(patientId: string) {
  return api<{ immunisations: Immunisation[]; summary: { given: number; due: number; overdue: number } }>(
    `/doctor/patients/${patientId}/immunisations`,
  );
}

export function createImmunisation(
  patientId: string,
  body: { vaccine: string; doseLabel?: string; status?: 'given' | 'due'; givenAt?: string; dueAt?: string; batch?: string },
) {
  return api<{ immunisation: { id: string } }>(`/doctor/patients/${patientId}/immunisations`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
