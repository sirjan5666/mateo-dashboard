/**
 * Appointments for 12 May 2025 (Clinic OS spec 10).
 * ⚠ PLACEHOLDER DATA — not wired to the API yet.
 */

export type ApptStatus = 'completed' | 'confirmed' | 'pending' | 'cancelled';
/** Confirmed appears in two block tints in the reference — blue and violet. */
export type BlockTone = 'green' | 'blue' | 'amber' | 'violet' | 'red';

export interface Appointment {
  id: string;
  /** The raw instant, so the calendar can bucket by IST day and hour. */
  startISO: string;
  /** IST calendar day, 'yyyy-mm-dd' — the week and month grids key off this. */
  dayKey: string;
  hour: string;
  start: string;
  end: string;
  patient: string;
  patientId: string;
  age: string;
  sex: string;
  phone: string;
  type: string;
  status: ApptStatus;
  tone: BlockTone;
  duration: string;
  location: string;
  locationAddress: string;
  bookingSource: string;
  notes: string;
  createdOn: string;
}

export const HOURS = ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'];

/** 01:00 PM is the lunch break; 06:00 PM is the empty add slot. */
export const LUNCH_HOUR = '01:00 PM';
export const EMPTY_HOUR = '06:00 PM';

const CLINIC = 'Greenview Children Clinic';
// Spec 10 §6.3: "Delhi 110016" — no comma before the PIN on this screen.
const CLINIC_ADDR = '23, Green Park Main, New Delhi, Delhi 110016';

export const APPOINTMENTS: Appointment[] = [
  { id: 'A1', startISO: '', dayKey: '', hour: '09:00 AM', start: '09:00 AM', end: '09:30 AM', patient: 'Aarav Mehta', patientId: 'PT-0002486', age: '4y 2m', sex: 'Male', phone: '+91 98765 43210', type: 'Follow-up', status: 'completed', tone: 'green', duration: '30 Minutes', location: CLINIC, locationAddress: CLINIC_ADDR, bookingSource: 'Walk-in', notes: 'Review after fever.', createdOn: '09 May 2025, 11:20 AM by Receptionist' },
  { id: 'A2', startISO: '', dayKey: '', hour: '10:00 AM', start: '10:00 AM', end: '10:30 AM', patient: 'Myra Kapoor', patientId: 'PT-0002485', age: '2y 11m', sex: 'Female', phone: '+91 91234 56789', type: 'General Consultation', status: 'confirmed', tone: 'blue', duration: '30 Minutes', location: CLINIC, locationAddress: CLINIC_ADDR, bookingSource: 'Online Booking', notes: 'Child has mild cough and cold.', createdOn: '10 May 2025, 06:15 PM by Receptionist' },
  { id: 'A3', startISO: '', dayKey: '', hour: '11:00 AM', start: '11:00 AM', end: '11:30 AM', patient: 'Kabir Singh', patientId: 'PT-0002484', age: '6y 5m', sex: 'Male', phone: '+91 99887 77665', type: 'Vaccination', status: 'pending', tone: 'amber', duration: '30 Minutes', location: CLINIC, locationAddress: CLINIC_ADDR, bookingSource: 'Phone', notes: 'DPT booster due.', createdOn: '11 May 2025, 09:40 AM by Reception' },
  { id: 'A4', startISO: '', dayKey: '', hour: '12:00 PM', start: '12:00 PM', end: '12:30 PM', patient: 'Siya Verma', patientId: 'PT-0002483', age: '3y 4m', sex: 'Female', phone: '+91 90123 44556', type: 'Follow-up', status: 'confirmed', tone: 'violet', duration: '30 Minutes', location: CLINIC, locationAddress: CLINIC_ADDR, bookingSource: 'Online Booking', notes: 'Rash improving.', createdOn: '10 May 2025, 02:10 PM by Receptionist' },
  { id: 'A5', startISO: '', dayKey: '', hour: '02:00 PM', start: '02:00 PM', end: '02:30 PM', patient: 'Ishaan Gupta', patientId: 'PT-0002482', age: '5y 0m', sex: 'Male', phone: '+91 98712 33445', type: 'General Consultation', status: 'confirmed', tone: 'blue', duration: '30 Minutes', location: CLINIC, locationAddress: CLINIC_ADDR, bookingSource: 'Online Booking', notes: 'Routine review.', createdOn: '11 May 2025, 04:05 PM by Receptionist' },
  { id: 'A6', startISO: '', dayKey: '', hour: '03:00 PM', start: '03:00 PM', end: '03:30 PM', patient: 'Anaya Reddy', patientId: 'PT-0002481', age: '1y 8m', sex: 'Female', phone: '+91 88990 11223', type: 'Well Baby Checkup', status: 'confirmed', tone: 'green', duration: '30 Minutes', location: CLINIC, locationAddress: CLINIC_ADDR, bookingSource: 'Online Booking', notes: 'First well-baby visit at this clinic.', createdOn: '09 May 2025, 05:30 PM by Receptionist' },
  { id: 'A7', startISO: '', dayKey: '', hour: '04:00 PM', start: '04:00 PM', end: '04:30 PM', patient: 'Vivaan Patel', patientId: 'PT-0002480', age: '7y 3m', sex: 'Male', phone: '+91 93211 55667', type: 'Follow-up', status: 'cancelled', tone: 'red', duration: '30 Minutes', location: CLINIC, locationAddress: CLINIC_ADDR, bookingSource: 'Phone', notes: 'Cancelled by guardian.', createdOn: '08 May 2025, 12:00 PM by Reception' },
  { id: 'A8', startISO: '', dayKey: '', hour: '05:00 PM', start: '05:00 PM', end: '05:30 PM', patient: 'Avni Sharma', patientId: 'PT-0002479', age: '4y 9m', sex: 'Female', phone: '+91 98123 77889', type: 'Vaccination', status: 'confirmed', tone: 'blue', duration: '30 Minutes', location: CLINIC, locationAddress: CLINIC_ADDR, bookingSource: 'Online Booking', notes: 'Typhoid dose.', createdOn: '10 May 2025, 10:45 AM by Receptionist' },
];

export const TONE_STYLE: Record<BlockTone, { bar: string; bg: string }> = {
  green: { bar: '#12A150', bg: '#EAF8F0' },
  blue: { bar: '#2B6FF0', bg: '#EAF2FE' },
  amber: { bar: '#F59E0B', bg: '#FEF6E7' },
  violet: { bar: '#7C5CFF', bg: '#F1EFFE' },
  red: { bar: '#EF4444', bg: '#FDEEEE' },
};

export const APPT_STATUS: Record<ApptStatus, { label: string; fg: string }> = {
  completed: { label: 'Completed', fg: '#12A150' },
  confirmed: { label: 'Confirmed', fg: '#2B6FF0' },
  pending: { label: 'Pending', fg: '#E8890B' },
  cancelled: { label: 'Cancelled', fg: '#E03131' },
};

// ── Live wiring ──────────────────────────────────────────────────────────────

import type { Appointment as ApiAppointment } from '../api/doctorAppointments';

const TONES: BlockTone[] = ['blue', 'violet', 'green', 'amber'];

/** The server's four statuses onto the screen's vocabulary. */
const STATUS_MAP: Record<string, ApptStatus> = {
  scheduled: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'pending',
};

const MODE_LABEL: Record<string, string> = {
  in_person: 'In-person visit', phone: 'Phone consultation', video: 'Video consultation',
};

/**
 * The clinic runs on IST, so the grid buckets on IST wall-clock rather than the
 * browser's zone — otherwise a booking lands in the wrong row (or the wrong day)
 * on any machine set elsewhere. India has no DST, so the offset is a constant.
 */
const IST_OFFSET_MIN = 330;
const istParts = (d: Date) => new Date(d.getTime() + IST_OFFSET_MIN * 60_000);

/** 'yyyy-mm-dd' in IST. */
export function istDayKey(d: Date): string {
  return istParts(d).toISOString().slice(0, 10);
}

/** "09:00 AM" — the same key HOURS uses, so a booking lands in the right row. */
function hourKey(d: Date): string {
  const h = istParts(d).getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:00 ${h < 12 ? 'AM' : 'PM'}`;
}
const clock = (d: Date) =>
  d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

/**
 * Server appointment → the shape the day/week grid already renders.
 *
 * Fields an appointment does not carry — the patient's age, sex, phone, the
 * clinic address, how it was booked — come back empty and render as em dashes
 * rather than being invented.
 */
export function appointmentFromApi(a: ApiAppointment, idx = 0): Appointment {
  const start = new Date(a.start);
  const end = new Date(start.getTime() + a.durationMin * 60_000);
  return {
    id: a.id,
    startISO: a.start,
    dayKey: istDayKey(start),
    hour: hourKey(start),
    start: clock(start),
    end: clock(end),
    patient: a.patient?.name ?? 'Patient',
    patientId: a.patientId,
    age: '',
    sex: '',
    phone: '',
    type: a.reason || MODE_LABEL[a.mode] || 'Consultation',
    status: STATUS_MAP[a.status] ?? 'pending',
    tone: a.status === 'completed' ? 'green' : a.status === 'cancelled' ? 'red' : TONES[idx % TONES.length],
    duration: `${a.durationMin} min`,
    location: '',
    locationAddress: '',
    bookingSource: '',
    notes: a.reason ?? '',
    createdOn: new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  };
}
