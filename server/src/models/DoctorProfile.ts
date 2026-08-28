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

/**
 * Account-level preferences edited on the Settings page. These are STORED
 * preferences — the ones that already drive behaviour (default landing page,
 * auto patient numbering) are honoured; the notification toggles record intent
 * for the reminder job to read. Nothing here is a clinical or statutory value.
 */
export interface IClinicPreferences {
  dateFormat: 'DD MMM YYYY' | 'DD/MM/YYYY';
  timeFormat: '12' | '24';
  currency: string;
  language: 'en' | 'hi';
  defaultPage: 'dashboard' | 'appointments' | 'patients';
  patientPortal: boolean;
  autoPatientId: boolean;
  appointmentReminders: boolean;
  whatsappNotifications: boolean;
  onlineBooking: boolean;
  dataBackup: boolean;
  /** Minutes of inactivity before sign-out; 0 = never. */
  sessionTimeoutMins: number;
}

export const DEFAULT_PREFERENCES: IClinicPreferences = {
  dateFormat: 'DD MMM YYYY',
  timeFormat: '12',
  currency: 'INR',
  language: 'en',
  defaultPage: 'dashboard',
  patientPortal: true,
  autoPatientId: true,
  appointmentReminders: true,
  whatsappNotifications: true,
  onlineBooking: true,
  dataBackup: true,
  sessionTimeoutMins: 30,
};

// Weekly recurring availability. Phase 3 (booking) turns this into concrete
// bookable slots for the next N days, minus anything already booked.
export interface IDoctorAvailability {
  days: number[]; // 0 = Sunday … 6 = Saturday
  startTime: string; // "HH:MM" 24h
  endTime: string; // "HH:MM"
  slotMinutes: number;
}

/**
 * Whether the doctor is physically IN the clinic right now — a live, operational
 * flag the front desk flips when the doctor arrives and leaves. It is distinct
 * from `workingHours` (the recurring schedule) and from appointment status: it
 * answers "can a patient be seen at this moment?".
 *
 * `in` is the current state; `since` is when it last changed; `by` is who
 * flipped it (the doctor themselves or a named staff member). Every change is
 * also written to the audit log.
 */
export interface IDoctorPresence {
  in: boolean;
  since?: Date;
  by?: string;
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
  // The clinic (org) this doctor belongs to, when grouped under a multi-doctor
  // clinic. Optional — a standalone doctor has none. clinicName is kept in sync
  // for display/prescriptions so nothing has to join to render the clinic name.
  clinicId?: Types.ObjectId;
  clinicName?: string;
  clinicAddress?: string;
  city?: string;
  availability: IDoctorAvailability;
  workingHours?: IWorkingHours;
  notifications?: IDoctorNotifications;
  preferences?: IClinicPreferences;
  presence?: IDoctorPresence;
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
const preferencesSchema = new Schema<IClinicPreferences>(
  {
    dateFormat: { type: String, enum: ['DD MMM YYYY', 'DD/MM/YYYY'], default: 'DD MMM YYYY' },
    timeFormat: { type: String, enum: ['12', '24'], default: '12' },
    currency: { type: String, default: 'INR', maxlength: 8 },
    language: { type: String, enum: ['en', 'hi'], default: 'en' },
    defaultPage: { type: String, enum: ['dashboard', 'appointments', 'patients'], default: 'dashboard' },
    patientPortal: { type: Boolean, default: true },
    autoPatientId: { type: Boolean, default: true },
    appointmentReminders: { type: Boolean, default: true },
    whatsappNotifications: { type: Boolean, default: true },
    onlineBooking: { type: Boolean, default: true },
    dataBackup: { type: Boolean, default: true },
    sessionTimeoutMins: { type: Number, default: 30, min: 0, max: 1440 },
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
    clinicId: { type: Schema.Types.ObjectId, ref: 'Clinic', index: true },
    clinicName: { type: String, trim: true },
    clinicAddress: { type: String, trim: true },
    city: { type: String, trim: true },
    availability: { type: availabilitySchema, default: () => ({}) },
    workingHours: { type: workingHoursSchema },
    notifications: { type: notificationsSchema },
    preferences: { type: preferencesSchema },
    presence: {
      type: new Schema<IDoctorPresence>(
        { in: { type: Boolean, default: false }, since: { type: Date }, by: { type: String } },
        { _id: false },
      ),
    },
    bankDetailsEnc: { type: String },
    // Admin-gated visibility: parents only ever see 'approved' doctors.
    status: { type: String, enum: DOCTOR_STATUSES, default: 'pending', index: true },
  },
  { timestamps: true },
);

// Encrypt the payout banking blob at rest (idempotent; decrypt in the self shaper).
encryptedFields(doctorProfileSchema, ['bankDetailsEnc']);

export const DoctorProfile = model<IDoctorProfile>('DoctorProfile', doctorProfileSchema);
