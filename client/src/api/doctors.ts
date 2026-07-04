import { api } from './client';

export type DoctorStatus = 'pending' | 'approved' | 'rejected';

export interface DoctorAvailability {
  days: number[]; // 0=Sun … 6=Sat
  startTime: string; // "HH:MM"
  endTime: string;
  slotMinutes: number;
}

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export const WEEK_DAYS: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export interface DayHours {
  start: string; // "HH:MM"
  end: string;
  closed: boolean;
}
export type WorkingHours = Record<WeekDay, DayHours>;

export interface DoctorNotifications {
  email: boolean;
  sms: boolean;
  reminders: boolean;
}

export interface BankDetails {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export interface DoctorProfile {
  id: string;
  name: string;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  registrationNo: string;
  bio: string;
  consultationFee: number;
  languages: string[];
  clinicName: string | null;
  clinicAddress: string | null;
  city: string | null;
  availability: DoctorAvailability;
  workingHours: WorkingHours | null;
  notifications: DoctorNotifications;
  bankDetails: BankDetails | null;
  status: DoctorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorProfileInput {
  specialization: string;
  qualifications?: string;
  experienceYears?: number;
  registrationNo?: string;
  bio?: string;
  consultationFee: number;
  languages?: string[];
  clinicName?: string;
  clinicAddress?: string;
  city?: string;
  availability?: DoctorAvailability;
  workingHours?: WorkingHours;
  notifications?: DoctorNotifications;
  bankDetails?: BankDetails;
}

export function getMyDoctorProfile() {
  return api<{ profile: DoctorProfile | null }>('/doctors/me');
}

export function saveMyDoctorProfile(input: DoctorProfileInput) {
  return api<{ profile: DoctorProfile }>('/doctors/me', { method: 'PUT', body: JSON.stringify(input) });
}

// ── Parent-facing directory ──
// A doctor as a parent sees them (no status / contact details).
export interface DoctorListing {
  id: string;
  name: string;
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
  avgRating: number | null;
  reviewCount: number;
}

export interface DaySlots {
  date: string; // 'YYYY-MM-DD'
  slots: { start: string; end: string }[];
}

export interface DoctorReview {
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: string;
}

export function listDoctors() {
  return api<{ doctors: DoctorListing[] }>('/doctors');
}

export function getDoctor(id: string) {
  return api<{ doctor: DoctorListing }>(`/doctors/${id}`);
}

export function getDoctorSlots(id: string) {
  return api<{ days: DaySlots[] }>(`/doctors/${id}/slots`);
}

export function getDoctorReviews(id: string) {
  return api<{ reviews: DoctorReview[] }>(`/doctors/${id}/reviews`);
}
