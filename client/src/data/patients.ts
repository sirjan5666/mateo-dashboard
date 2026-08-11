import type { LocationId } from '../lib/doctorLocation';
import type { Patient as ApiPatient } from '../api/doctorPatients';

/**
 * Patient roster (Clinic OS spec 06).
 *
 * ⚠ PLACEHOLDER DATA — not wired to the API yet.
 *
 * Ages are NEVER stored. CLAUDE.md: "Baby ages computed from DOB at read time —
 * never store 'age'". `formatAge` derives them from `dob` against TODAY, which
 * is pinned to the dataset's reference date so the mock stays deterministic.
 * Wiring this up later means swapping TODAY for `new Date()` and nothing else.
 */

/** The dataset's "today" — 8 May 2025, matching every other Clinic OS screen. */
/**
 * Ages are computed against the real clock now that patients come from the API.
 * Kept as a function, not a captured constant, so a long-lived tab does not
 * freeze everyone's age at the moment it loaded.
 */
export const today = () => new Date();

export interface Patient {
  id: string;
  /**
   * The short, human patient number shown and printed (e.g. "00017"), not the
   * 24-character database id. Null on legacy rows created before numbering.
   */
  code: string | null;
  name: string;
  guardian: string;
  gender: 'Male' | 'Female' | 'Other';
  /** ISO yyyy-mm-dd. The single source for age. */
  dob: string;
  registeredOn: string;
  /** null = never visited. */
  lastVisit: string | null;
  phone: string;
  locationId: LocationId;
  email: string;
  tint: string;
  fg: string;
}

/** Whole years and months between dob and `now`, truncated (never rounded up). */
export function ageParts(dob: string, now: Date = today()): { years: number; months: number } {
  const d = new Date(dob);
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months };
}

export function formatAge(dob: string, now: Date = today()): string {
  const { years, months } = ageParts(dob, now);
  return `${years}y ${months}m`;
}

/** Spoken form for screen readers — "4 years 3 months". */
export function spokenAge(dob: string, now: Date = today()): string {
  const { years, months } = ageParts(dob, now);
  const y = `${years} ${years === 1 ? 'year' : 'years'}`;
  const m = `${months} ${months === 1 ? 'month' : 'months'}`;
  return `${y} ${m}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `toLocaleDateString('en-GB', { month: 'short' })` renders September as "Sept"
 * under current ICU, which breaks the fixed column width. Format explicitly.
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export const PATIENTS: Patient[] = [
  {
    id: 'PT-0002486',
    code: '02486',
    name: 'Aarav Mehta',
    guardian: 'Neha Mehta',
    gender: 'Male',
    dob: '2021-01-12',
    registeredOn: '2025-05-08',
    lastVisit: '2025-05-08',
    phone: '+91 98765 43210',
    locationId: 'greenview',
    email: 'neha.mehta@example.com',
    tint: '#EEF2FF',
    fg: '#3B4FE0',
  },
  {
    id: 'PT-0002485',
    code: '02485',
    name: 'Myra Kapoor',
    guardian: 'Rohan Kapoor',
    gender: 'Female',
    dob: '2022-06-18',
    registeredOn: '2025-05-08',
    lastVisit: '2025-05-05',
    phone: '+91 91234 56789',
    locationId: 'greenview',
    email: 'rohan.kapoor@example.com',
    tint: '#F5F0FF',
    fg: '#8B5CF6',
  },
  {
    id: 'PT-0002484',
    code: '02484',
    name: 'Kabir Singh',
    guardian: 'Pooja Singh',
    gender: 'Male',
    dob: '2018-11-22',
    registeredOn: '2025-05-07',
    lastVisit: '2025-05-07',
    phone: '+91 99887 77665',
    locationId: 'happy-kids',
    email: 'pooja.singh@example.com',
    tint: '#ECFDF5',
    fg: '#16A34A',
  },
  {
    id: 'PT-0002483',
    code: '02483',
    name: 'Siya Verma',
    guardian: 'Amit Verma',
    gender: 'Female',
    dob: '2022-01-05',
    registeredOn: '2025-05-07',
    lastVisit: '2025-05-01',
    phone: '+91 90123 44556',
    locationId: 'little-care',
    email: 'amit.verma@example.com',
    tint: '#FFF7ED',
    fg: '#B45309',
  },
  {
    id: 'PT-0002482',
    code: '02482',
    name: 'Ishaan Gupta',
    guardian: 'Priya Gupta',
    gender: 'Male',
    dob: '2020-04-30',
    registeredOn: '2025-05-06',
    lastVisit: '2025-05-06',
    phone: '+91 98712 33445',
    locationId: 'greenview',
    email: 'priya.gupta@example.com',
    tint: '#EFF6FF',
    fg: '#2563EB',
  },
  {
    id: 'PT-0002481',
    code: '02481',
    name: 'Anaya Reddy',
    guardian: 'Sandeep Reddy',
    gender: 'Female',
    dob: '2023-09-14',
    registeredOn: '2025-05-06',
    lastVisit: null,
    phone: '+91 88990 11223',
    locationId: 'joy-kids',
    email: 'sandeep.reddy@example.com',
    tint: '#FCDCE4',
    fg: '#BE123C',
  },
  {
    id: 'PT-0002480',
    code: '02480',
    name: 'Vivaan Patel',
    guardian: 'Dhara Patel',
    gender: 'Male',
    dob: '2018-02-03',
    registeredOn: '2025-05-05',
    lastVisit: '2025-05-02',
    phone: '+91 93211 55667',
    locationId: 'greenview',
    email: 'dhara.patel@example.com',
    tint: '#D7F5EE',
    fg: '#0E9F8F',
  },
  {
    id: 'PT-0002479',
    code: '02479',
    name: 'Avni Sharma',
    guardian: 'Kunal Sharma',
    gender: 'Female',
    dob: '2020-08-19',
    registeredOn: '2025-05-05',
    lastVisit: null,
    phone: '+91 98123 77889',
    locationId: 'sunshine',
    email: 'kunal.sharma@example.com',
    tint: '#EDE9FE',
    fg: '#6D5AE0',
  },
];

export const AGE_GROUPS = [
  { value: 'all', label: 'All Age Groups' },
  { value: '0-1', label: '0 – 1 year', min: 0, max: 1 },
  { value: '1-5', label: '1 – 5 years', min: 1, max: 5 },
  { value: '5-12', label: '5 – 12 years', min: 5, max: 12 },
  { value: '12+', label: '12+ years', min: 12, max: 200 },
];

export const GENDERS = [
  { value: 'all', label: 'All Genders' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

export const SORTS = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'lastVisit', label: 'Last Visit' },
  { value: 'age', label: 'Age' },
];

/**
 * The short patient number to show in the UI — the five-digit code when the
 * patient has one, otherwise the last six characters of the database id so a
 * legacy row still reads as an identifier rather than a 24-character wall.
 */
export function patientLabel(p: Pick<Patient, 'code' | 'id'>): string {
  if (p.code) return `#${p.code}`;
  return p.id.length > 6 ? p.id.slice(-6).toUpperCase() : p.id;
}

/** Deterministic avatar wash, so a patient keeps the same colour across renders. */
const TINTS = [
  { tint: '#EDE9FE', fg: '#6D5AE0' }, { tint: '#E4EBFD', fg: '#2B6FF0' },
  { tint: '#DCF7E6', fg: '#12A150' }, { tint: '#FDECD3', fg: '#E8890B' },
  { tint: '#FCE7F3', fg: '#EC4899' }, { tint: '#E0F2FE', fg: '#0891B2' },
];

/**
 * API patient → the shape this page's table, cards and modals already render.
 *
 * `guardian` and `email` have no home on the Patient model yet, so they come
 * back empty and render as em dashes rather than being invented.
 */
export function fromApi(p: ApiPatient): Patient {
  let h = 0;
  for (let i = 0; i < p.id.length; i += 1) h = (h * 31 + p.id.charCodeAt(i)) >>> 0;
  const c = TINTS[h % TINTS.length];
  const sex = (p.sex || '').toLowerCase();
  return {
    id: p.id,
    code: p.code,
    name: p.displayName,
    guardian: '',
    gender: sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : 'Other',
    dob: p.dob ?? '',
    registeredOn: p.createdAt.slice(0, 10),
    lastVisit: p.lastVisitAt ? p.lastVisitAt.slice(0, 10) : null,
    phone: p.phone ?? '',
    locationId: p.locationId ?? '',
    email: '',
    tint: c.tint,
    fg: c.fg,
  };
}
