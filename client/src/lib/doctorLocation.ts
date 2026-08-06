import { createContext, useContext } from 'react';
import type { ClinicLocationDto } from '../api/doctorLocations';

/**
 * Multi-clinic scoping for the doctor panel.
 *
 * A doctor practises across several clinics. The location chosen in the top bar
 * scopes the panel; `overall` is the aggregate row. Everything here is now
 * SERVER-BACKED — `DoctorShell` fetches `/doctor/locations` on mount and feeds
 * `LocationCtx`. There is no hardcoded clinic list any more.
 *
 * Location ids are Mongo ObjectIds, plus the reserved literal 'overall'.
 */

export type LocationId = string;
export const OVERALL: LocationId = 'overall';

export interface LocationTiming {
  day: string;
  hours: string;
}

export interface ClinicLocation {
  id: LocationId;
  name: string;
  /** Short name for tight spots (mobile pill, chips). */
  shortName: string;
  primary?: boolean;
  addressLine: string;
  cityLine: string;
  phone: string;
  email: string;
  /** Avatar wash + glyph colour. `hue` is also the switcher dot. */
  tint: string;
  hue: string;
  timings: LocationTiming[];
  // ── admin metadata (Locations Management) ──
  status: 'active' | 'inactive';
  addedOn: string;
  timezone: string;
  currency: string;
  services: string[];
  notes: string;
  code: string;
  city: string;
  state: string;
  pincode: string;
  /** Statutory identifiers for printed pharmacy invoices. Empty = print nothing. */
  drugLicenceNo: string;
  gstin: string;
  teamMembers: number;
  patients: number | null;
  revenueMtd: number | null;
  /**
   * Consultations are still not split per clinic — Encounter carries no
   * location. `null` renders as an em dash rather than a fabricated zero.
   */
  consultationsMtd: number | null;
  appointmentsMtd: number | null;
}

/** Wash colours paired with the server's `hue`. */
function tintFor(hue: string): string {
  const map: Record<string, string> = {
    '#4F63F5': '#EEF2FF',
    '#12A150': '#DCF7E6',
    '#F59E0B': '#FDECD3',
    '#8B5CF6': '#EDE9FE',
    '#EC4899': '#FCE7F3',
    '#0EA5E9': '#E0F2FE',
  };
  return map[hue] ?? '#EEF2FF';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatAdded(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Server DTO → the shape the Locations cards and the switcher already render. */
export function fromDto(dto: ClinicLocationDto): ClinicLocation {
  return {
    id: dto.id,
    name: dto.name,
    shortName: dto.name.split(' ')[0] || dto.name,
    primary: dto.isPrimary,
    addressLine: dto.addressLine,
    cityLine: `${dto.city}, ${dto.pincode}`,
    phone: dto.phone ?? '',
    email: dto.email ?? '',
    tint: tintFor(dto.hue),
    hue: dto.hue,
    // One free-text opening-hours line, shown as a single row.
    timings: dto.openingHours ? [{ day: 'Opening hours', hours: dto.openingHours }] : [],
    status: dto.active ? 'active' : 'inactive',
    addedOn: formatAdded(dto.createdAt),
    timezone: 'Asia/Kolkata (IST)',
    currency: 'INR (₹)',
    services: dto.services,
    notes: '',
    code: dto.code,
    city: dto.city,
    state: dto.state,
    pincode: dto.pincode,
    drugLicenceNo: dto.drugLicenceNo ?? '',
    gstin: dto.gstin ?? '',
    teamMembers: dto.teamMembers ?? 0,
    patients: dto.patients ?? 0,
    revenueMtd: dto.revenueMtd ?? 0,
    consultationsMtd: null,
    appointmentsMtd: dto.appointmentsMtd ?? 0,
  };
}

/** The "All Locations" row — derived from whatever the server returned. */
export function aggregateOf(clinics: ClinicLocation[]): ClinicLocation {
  return {
    id: OVERALL,
    name: 'All Locations',
    shortName: 'All Locations',
    addressLine: clinics.length
      ? `Combined data from ${clinics.length} clinic${clinics.length === 1 ? '' : 's'}`
      : 'No clinics added yet',
    cityLine: [...new Set(clinics.map((c) => c.city))].join(' · '),
    phone: '',
    email: '',
    tint: '#EEF2FF',
    hue: '#4F63F5',
    timings: [],
    status: 'active',
    addedOn: '—',
    timezone: 'Asia/Kolkata (IST)',
    currency: 'INR (₹)',
    services: [...new Set(clinics.flatMap((c) => c.services))],
    notes: 'Combined view. Select a single clinic to edit its details.',
    code: 'overall',
    city: '',
    state: '',
    pincode: '',
    // Statutory ids belong to ONE clinic — the combined row has none.
    drugLicenceNo: '',
    gstin: '',
    teamMembers: clinics.reduce((t, c) => t + c.teamMembers, 0),
    patients: clinics.reduce((t, c) => t + (c.patients ?? 0), 0),
    revenueMtd: clinics.reduce((t, c) => t + (c.revenueMtd ?? 0), 0),
    consultationsMtd: null,
    appointmentsMtd: clinics.reduce((t, c) => t + (c.appointmentsMtd ?? 0), 0),
  };
}

/** Placeholder used before the first fetch resolves — never rendered as data. */
export const EMPTY_LOCATION: ClinicLocation = aggregateOf([]);

export const STORAGE_KEY = 'mateo:activeLocation';

export function readStoredLocation(): LocationId {
  try {
    return localStorage.getItem(STORAGE_KEY) || OVERALL;
  } catch {
    return OVERALL;
  }
}

export function writeStoredLocation(id: LocationId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/** ₹ with Indian digit grouping and no decimals. */
export function inr(rupees: number): string {
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/** Money that may be unknown — an em dash beats a fabricated zero. */
export function inrOrDash(rupees: number | null): string {
  return rupees === null ? '—' : inr(rupees);
}

export function countOrDash(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-IN');
}

interface LocationCtxValue {
  /** Overall first, then the doctor's clinics. Empty until the fetch resolves. */
  locations: ClinicLocation[];
  clinics: ClinicLocation[];
  activeId: LocationId;
  active: ClinicLocation;
  setActiveId: (id: LocationId) => void;
  loading: boolean;
  /** Re-fetch after an add / edit / primary / deactivate. */
  refresh: () => Promise<void>;
}

export const LocationCtx = createContext<LocationCtxValue>({
  locations: [],
  clinics: [],
  activeId: OVERALL,
  active: EMPTY_LOCATION,
  setActiveId: () => {},
  loading: true,
  refresh: async () => {},
});

export function useActiveLocation(): LocationCtxValue {
  return useContext(LocationCtx);
}
