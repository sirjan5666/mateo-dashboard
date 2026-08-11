import { api } from './client';

export interface ClinicLocationDto {
  id: string;
  name: string;
  code: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  phone: string | null;
  email: string | null;
  services: string[];
  openingHours: string | null;
  /** Statutory identifiers printed on pharmacy invoices; null when unset. */
  drugLicenceNo: string | null;
  gstin: string | null;
  isPrimary: boolean;
  active: boolean;
  hue: string;
  createdAt: string;
  /** All real per-location counts, scoped to this clinic. */
  teamMembers: number;
  patients: number;
  revenueMtd: number;
  appointmentsMtd: number;
}

export interface LocationInput {
  name: string;
  code: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
  email?: string;
  services?: string[];
  openingHours?: string;
  drugLicenceNo?: string;
  gstin?: string;
  isPrimary?: boolean;
}

export interface LocationAnalytics {
  practice: {
    totalPatients: number;
    activePatients: number;
    revenueAllTime: number;
    revenueMtd: number;
    invoicesMtd: number;
    appointmentsMtd: number;
  };
  locations: { id: string; name: string; active: boolean; isPrimary: boolean; services: number }[];
  totals: { locations: number; activeLocations: number };
}

export function listLocations() {
  return api<{ locations: ClinicLocationDto[] }>('/doctor/locations');
}

export function getLocationAnalytics() {
  return api<LocationAnalytics>('/doctor/locations/analytics');
}

export function createLocation(body: LocationInput) {
  return api<{ location: ClinicLocationDto }>('/doctor/locations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateLocation(id: string, body: Partial<LocationInput>) {
  return api<{ location: ClinicLocationDto }>(`/doctor/locations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** Both of these return the FULL list — one primary moves two rows at once. */
export function setPrimaryLocation(id: string) {
  return api<{ locations: ClinicLocationDto[] }>(`/doctor/locations/${id}/primary`, { method: 'POST' });
}

export function setLocationActive(id: string, active: boolean) {
  return api<{ locations: ClinicLocationDto[] }>(`/doctor/locations/${id}/active`, {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}
