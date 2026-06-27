import { api } from './client';

export interface OverviewAppt {
  id: string;
  patientId: string;
  patientName: string;
  start: string;
  durationMin: number;
  mode: 'in_person' | 'phone' | 'video';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
}

export interface OverviewPatient {
  id: string;
  name: string;
  status: string;
  specialtyTemplateId: string;
  updatedAt: string;
}

export interface Overview {
  counts: { activePatients: number; todayAppointments: number; weekEncounters: number; upcoming: number; unreadMessages: number };
  today: OverviewAppt[];
  upcoming: OverviewAppt[];
  recentPatients: OverviewPatient[];
  encountersByDay: { date: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
}

export function getOverview() {
  return api<Overview>('/doctor/overview');
}
