import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { encryptedFields } from '../lib/crypto/mongooseEncryption.js';

// A doctor's professional profile. Created when a doctor (role: 'doctor') fills
// the onboarding form; an admin then approves it before the doctor becomes
// visible to parents in the "available doctors" list.
export type DoctorStatus = 'pending' | 'approved' | 'rejected';
export const DOCTOR_STATUSES: DoctorStatus[] = ['pending', 'approved', 'rejected'];

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export const WEEK_DAYS: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Per-day clinic working hours shown in Settings (independent Mon–Sun times).
// This is DISPLAY/config; the `availability` block below (single weekly window)
// is what the booking slot-generator uses — kept separate to avoid touching booking.
export interface IDayHours {
  start: string; // "HH:MM"
  end: string;
  closed: boolean;
}
export type IWorkingHours = Record<WeekDay, IDayHours>;

export interface IDoctorNotifications {
  email: boolean;
  sms: boolean;
  reminders: boolean;
}

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
  clinicAddress?: string;
  city?: string;
  availability: IDoctorAvailability;
  workingHours?: IWorkingHours;
  notifications?: IDoctorNotifications;
  // Payout banking — encrypted at rest (account number is sensitive). Stored as an
  // encrypted JSON string {accountHolder,accountNumber,ifsc,bankName}; decrypted only
  // in the owner's self shaper, never sent to anyone else.
  bankDetailsEnc?: string;
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

const dayHoursSchema = new Schema<IDayHours>(
  {
    start: { type: String, default: '10:00' },
    end: { type: String, default: '17:00' },
    closed: { type: Boolean, default: false },
  },
  { _id: false },
);
const workingHoursSchema = new Schema(
  {
    monday: { type: dayHoursSchema },
    tuesday: { type: dayHoursSchema },
    wednesday: { type: dayHoursSchema },
    thursday: { type: dayHoursSchema },
    friday: { type: dayHoursSchema },
    saturday: { type: dayHoursSchema },
    sunday: { type: dayHoursSchema },
  },
  { _id: false },
);
const notificationsSchema = new Schema<IDoctorNotifications>(
  {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    reminders: { type: Boolean, default: true },
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
    clinicAddress: { type: String, trim: true },
    city: { type: String, trim: true },
    availability: { type: availabilitySchema, default: () => ({}) },
    workingHours: { type: workingHoursSchema },
    notifications: { type: notificationsSchema },
    bankDetailsEnc: { type: String },
    // Admin-gated visibility: parents only ever see 'approved' doctors.
    status: { type: String, enum: DOCTOR_STATUSES, default: 'pending', index: true },
  },
  { timestamps: true },
);

// Encrypt the payout banking blob at rest (idempotent; decrypt in the self shaper).
encryptedFields(doctorProfileSchema, ['bankDetailsEnc']);

export const DoctorProfile = model<IDoctorProfile>('DoctorProfile', doctorProfileSchema);
