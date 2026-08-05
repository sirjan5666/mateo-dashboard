/**
 * Mock data for the rebuilt doctor Dashboard (Clinic OS spec 01).
 *
 * ⚠ PLACEHOLDER DATA — not wired to the API yet. Every figure below derives from
 * the canonical dataset in `docs/clinic-os-v2/00-FOUNDATION.md` §9, so the numbers
 * reconcile across screens: the KPI counts equal the donut slices, the visit
 * reasons sum to the monthly visit total, the low-stock alert equals the pharmacy
 * split. Replace with real endpoints before this ships — a merge to `main`
 * auto-deploys to production, and fabricated patient counts must never reach it.
 *
 * Real sources when wiring: `api/doctorOverview`, `api/doctorPatients`,
 * `api/doctorBilling`, `api/doctorAnalytics`, `api/doctorAppointments`.
 */

import type { LocationId } from '../lib/doctorLocation';
import { inr } from '../lib/doctorLocation';

export interface Kpi {
  id: string;
  label: string;
  /** Fallback only — the live value comes from `kpiValuesFor(activeLocation)`. */
  value: string;
  /** Delta percentage, e.g. '12.6%'. Omitted for cards with a status line. */
  delta?: string;
  deltaNote?: string;
  /** Replaces the delta line for cards that report status rather than change. */
  statusNote?: string;
  live?: boolean;
  accent: string;
  /** Solid tile = white glyph on full-strength hue; tint = hue glyph on a pale wash. */
  tile: 'solid' | 'tint';
  tint: string;
  icon: string;
  linkLabel: string;
  to: string;
}

export const KPIS: Kpi[] = [
  {
    id: 'upcoming',
    label: 'Upcoming Appointments',
    value: '13',
    statusNote: 'Next at 11:00 AM',
    accent: '#8B5CF6',
    tile: 'tint',
    tint: '#F5F0FF',
    icon: 'CalendarClock',
    linkLabel: 'View appointments',
    to: '/doctor/appointments',
  },
  {
    id: 'ongoing',
    label: 'Ongoing Appointments',
    value: '2',
    statusNote: 'In consultation now',
    live: true,
    accent: '#22D3EE',
    tile: 'solid',
    tint: '#ECFEFF',
    icon: 'Activity',
    linkLabel: 'View consultations',
    to: '/doctor/consultations',
  },
  {
    id: 'patients',
    label: 'Total Patients',
    value: '2,486',
    delta: '12.6%',
    deltaNote: 'vs last month',
    accent: '#4F63F5',
    tile: 'tint',
    tint: '#EEF2FF',
    icon: 'Users',
    linkLabel: 'View patients',
    to: '/doctor/patients',
  },
  {
    id: 'revenue',
    label: 'Total Revenue (MTD)',
    value: '₹8,76,430',
    delta: '18.4%',
    deltaNote: 'vs last month',
    accent: '#16A34A',
    tile: 'solid',
    tint: '#ECFDF5',
    icon: 'IndianRupee',
    linkLabel: 'View revenue',
    to: '/doctor/revenue',
  },
  {
    id: 'today-revenue',
    label: "Today's Revenue",
    value: '₹1,24,560',
    delta: '14.2%',
    deltaNote: 'vs yesterday',
    accent: '#0EA5A5',
    tile: 'solid',
    tint: '#F0FDFA',
    icon: 'Wallet',
    linkLabel: "View today's revenue",
    to: '/doctor/revenue?range=today',
  },
];

/** Live practice figures behind the five KPI cards. */
export interface DashboardStats {
  upcoming: number;
  ongoing: number;
  patients: number;
  revenueMtd: number;
  revenueToday: number;
}

/**
 * KPI values from the API. `null` (still loading, or the request failed) renders
 * as an em dash — a dashboard for a real practice must never show an invented
 * count while it waits.
 */
export function kpiValuesFor(stats: DashboardStats | null): Record<string, string> {
  if (!stats) {
    return { upcoming: '—', ongoing: '—', patients: '—', revenue: '—', 'today-revenue': '—' };
  }
  return {
    upcoming: String(stats.upcoming),
    ongoing: String(stats.ongoing),
    patients: stats.patients.toLocaleString('en-IN'),
    revenue: inr(stats.revenueMtd),
    'today-revenue': inr(stats.revenueToday),
  };
}

// ── patient demographics — sums to 2,486 (§9.4) ──────────────────────────────
export const DEMOGRAPHICS = [
  { label: '0 – 1 year', value: 556, color: '#3B4FE0' },
  { label: '1 – 5 years', value: 1024, color: '#4F63F5' },
  { label: '5 – 12 years', value: 642, color: '#6366F1' },
  { label: '12+ years', value: 264, color: '#A5C4F5' },
];
export const DEMOGRAPHICS_TOTAL = DEMOGRAPHICS.reduce((s, d) => s + d.value, 0); // 2,486

// ── new vs returning, May 2025 (31 days) — §9.5 ──────────────────────────────
// Returning is the UPPER series (1,236); New is lower (482). Verified sums.
const RETURNING = [
  20, 26, 32, 38, 31, 24, 18, 28, 35, 42, 48, 40, 30, 22, 31, 39, 47, 50, 45, 34, 25, 44, 50, 58, 68, 52, 41, 35, 52, 62,
  69,
];
const NEW = [
  9, 11, 13, 15, 12, 10, 8, 12, 14, 16, 18, 15, 12, 10, 13, 15, 18, 20, 17, 14, 11, 16, 18, 21, 24, 20, 16, 13, 19, 24,
  28,
];

export const VISIT_TREND = RETURNING.map((returning, i) => ({
  day: i + 1,
  label: `${i + 1} May`,
  returning,
  new: NEW[i],
}));

export const TOTAL_RETURNING = RETURNING.reduce((s, n) => s + n, 0); // 1,236
export const TOTAL_NEW = NEW.reduce((s, n) => s + n, 0); // 482
export const TOTAL_VISITS = TOTAL_RETURNING + TOTAL_NEW; // 1,718
export const RETURNING_SHARE = (TOTAL_RETURNING / TOTAL_VISITS) * 100; // 71.9%

// ── today's schedule ─────────────────────────────────────────────────────────
export type ScheduleStatus = 'completed' | 'ongoing' | 'confirmed';

export interface ScheduleRow {
  time: string;
  patient: string;
  pid: string;
  age: string;
  type: string;
  status: ScheduleStatus;
}

export const SCHEDULE: ScheduleRow[] = [
  { time: '09:00 AM', patient: 'Myra Kapoor', pid: 'PT-0002485', age: '2y', type: 'Follow-up', status: 'completed' },
  { time: '10:00 AM', patient: 'Aarav Mehta', pid: 'PT-0002486', age: '4y', type: 'Consultation', status: 'completed' },
  { time: '11:00 AM', patient: 'Kabir Singh', pid: 'PT-0002484', age: '6y', type: 'Vaccination', status: 'ongoing' },
  { time: '12:00 PM', patient: 'Siya Patel', pid: 'PT-0002455', age: '3y', type: 'Consultation', status: 'confirmed' },
  { time: '01:00 PM', patient: 'Ishaan Gupta', pid: 'PT-0002482', age: '5y', type: 'Follow-up', status: 'confirmed' },
];

export const SCHEDULE_STATUS_META: Record<ScheduleStatus, { label: string; bg: string; fg: string; pulse?: boolean }> = {
  completed: { label: 'Completed', bg: '#DCFCE7', fg: '#15803D' },
  ongoing: { label: 'Ongoing', bg: '#CFFAFE', fg: '#0E7490', pulse: true },
  confirmed: { label: 'Confirmed', bg: '#EEF2FF', fg: '#3B4FE0' },
};

// ── alerts ───────────────────────────────────────────────────────────────────
export interface AlertRow {
  id: string;
  icon: string;
  accent: string;
  tint: string;
  title: string;
  note: string;
  to: string;
}

export const ALERTS: AlertRow[] = [
  {
    id: 'pending',
    icon: 'AlertCircle',
    accent: '#EF4444',
    tint: '#FEF2F2',
    title: '3 appointments pending confirmation',
    note: 'Tap to review',
    to: '/doctor/appointments?status=pending',
  },
  {
    id: 'stock',
    icon: 'AlertTriangle',
    accent: '#F59E0B',
    tint: '#FFF7ED',
    title: '18 medicine items need attention',
    note: '3 out of stock · 15 running low',
    to: '/doctor/pharmacy',
  },
  {
    id: 'followups',
    icon: 'CalendarCheck',
    accent: '#16A34A',
    tint: '#F0FDF4',
    title: '12 follow-ups due today',
    note: 'Tap to view list',
    to: '/doctor/patients?filter=followup-due',
  },
];

// ── today's appointments donut — sums to 42 (§9.3) ───────────────────────────
export const APPT_STATUSES = [
  { label: 'Completed', value: 20, color: '#22C55E' },
  { label: 'Upcoming', value: 13, color: '#4F63F5' },
  { label: 'Ongoing', value: 2, color: '#22D3EE' },
  { label: 'Cancelled', value: 3, color: '#EF4444' },
  { label: 'No Show', value: 4, color: '#94A3B8' },
];
export const APPT_TOTAL = APPT_STATUSES.reduce((s, d) => s + d.value, 0); // 42

// ── top visit reasons — of TOTAL_VISITS (§9.6) ───────────────────────────────
export const VISIT_REASONS = [
  { label: 'Fever', value: 412 },
  { label: 'Cough & Cold', value: 358 },
  { label: 'Vaccination', value: 296 },
  { label: 'Routine Checkup', value: 241 },
  { label: 'Stomach Pain', value: 187 },
];

// ── recent patients ──────────────────────────────────────────────────────────
export type CareStatus = 'prescribed' | 'in-consultation' | 'followup-due' | 'waiting';

export interface RecentPatient {
  initials: string;
  name: string;
  pid: string;
  age: string;
  gender: string;
  status: CareStatus;
  date: string;
  time: string;
  tint: string;
  fg: string;
}

export const RECENT_PATIENTS: RecentPatient[] = [
  { initials: 'AM', name: 'Aarav Mehta', pid: 'PT-0002486', age: '4y', gender: 'Male', status: 'prescribed', date: '08 May 2025', time: '10:00 AM', tint: '#EEF2FF', fg: '#3B4FE0' },
  { initials: 'MK', name: 'Myra Kapoor', pid: 'PT-0002485', age: '2y', gender: 'Female', status: 'prescribed', date: '08 May 2025', time: '09:00 AM', tint: '#F5F0FF', fg: '#8B5CF6' },
  { initials: 'KS', name: 'Kabir Singh', pid: 'PT-0002484', age: '6y', gender: 'Male', status: 'in-consultation', date: '08 May 2025', time: '11:00 AM', tint: '#ECFDF5', fg: '#16A34A' },
  { initials: 'RV', name: 'Reyansh Verma', pid: 'PT-0002471', age: '3y', gender: 'Male', status: 'followup-due', date: '07 May 2025', time: '03:15 PM', tint: '#FFF7ED', fg: '#F59E0B' },
  { initials: 'SI', name: 'Siya Patel', pid: 'PT-0002455', age: '5y', gender: 'Female', status: 'prescribed', date: '07 May 2025', time: '02:00 PM', tint: '#EFF6FF', fg: '#2563EB' },
];

export const CARE_STATUS_META: Record<CareStatus, { label: string; bg: string; fg: string }> = {
  prescribed: { label: 'Prescribed', bg: '#DCFCE7', fg: '#15803D' },
  'in-consultation': { label: 'In consultation', bg: '#CFFAFE', fg: '#0E7490' },
  'followup-due': { label: 'Follow-up due', bg: '#F5F0FF', fg: '#7C3AED' },
  waiting: { label: 'Waiting', bg: '#FFF7ED', fg: '#B45309' },
};

/** Header line under the greeting, scoped to the active location. */
export function subtitleFor(locationId: LocationId, locationName: string, clinicCount = 0): string {
  return locationId === 'overall'
    ? `Here's what's happening across ${clinicCount} clinic${clinicCount === 1 ? '' : 's'} today.`
    : `Here's what's happening at ${locationName} today.`;
}
