import { api } from './client';

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';

export interface AttendanceRow {
  staffId: string;
  name: string;
  employeeCode: string | null;
  status: AttendanceStatus | null;
  checkIn: string | null;
  checkOut: string | null;
  note: string | null;
}

export function getAttendance(date?: string) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return api<{ date: string; staff: AttendanceRow[] }>(`/doctor/attendance${qs}`);
}

export function markAttendance(body: {
  staffId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  note?: string;
}) {
  return api<AttendanceRow & { date: string }>('/doctor/attendance', { method: 'PUT', body: JSON.stringify(body) });
}
