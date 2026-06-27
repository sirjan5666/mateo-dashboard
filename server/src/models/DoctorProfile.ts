import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A doctor's professional profile. Created when a doctor (role: 'doctor') fills
// the onboarding form; an admin then approves it before the doctor becomes
// visible to parents in the "available doctors" list.
export type DoctorStatus = 'pending' | 'approved' | 'rejected';
export const DOCTOR_STATUSES: DoctorStatus[] = ['pending', 'approved', 'rejected'];

// Weekly recurring availability. Phase 3 (booking) turns this into concrete
// bookable slots for the next N days, minus anything already booked.
export interface IDoctorAvailability {
  days: number[]; // 0 = Sunday … 6 = Saturday
  startTime: string; // "HH:MM" 24h
  endTime: string; // "HH:MM"
  slotMinutes: number;
}

export interface IDoctorProfile {
  userId: Types.ObjectId;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  registrationNo: string;
  bio: string;
  consultationFee: number; // whole INR
  languages: string[];
  clinicName?: string;
  city?: string;
  availability: IDoctorAvailability;
  status: DoctorStatus;
  createdAt: Date;
  updatedAt: Date;
}

const availabilitySchema = new Schema<IDoctorAvailability>(
  {
    days: { type: [Number], default: [] },
    startTime: { type: String, default: '10:00' },
    endTime: { type: String, default: '17:00' },
    slotMinutes: { type: Number, default: 30 },
  },
  { _id: false },
);

const doctorProfileSchema = new Schema<IDoctorProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    specialization: { type: String, required: true, trim: true },
    qualifications: { type: String, default: '', trim: true },
    experienceYears: { type: Number, default: 0, min: 0, max: 80 },
    registrationNo: { type: String, default: '', trim: true },
    bio: { type: String, default: '', trim: true },
    consultationFee: { type: Number, required: true, min: 0, max: 100000 },
    languages: { type: [String], default: [] },
    clinicName: { type: String, trim: true },
    city: { type: String, trim: true },
    availability: { type: availabilitySchema, default: () => ({}) },
    // Admin-gated visibility: parents only ever see 'approved' doctors.
    status: { type: String, enum: DOCTOR_STATUSES, default: 'pending', index: true },
  },
  { timestamps: true },
);

export const DoctorProfile = model<IDoctorProfile>('DoctorProfile', doctorProfileSchema);
