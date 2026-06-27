import { api } from './client';
import type { ThreadMessage } from '../components/MessageThread';

export interface ThreadSummary {
  patientId: string;
  patientName: string;
  lastSender: 'doctor' | 'patient';
  lastBody: string;
  lastAt: string;
  unread: number;
}

export function listThreads() {
  return api<{ threads: ThreadSummary[] }>('/doctor/threads');
}

export function listMessages(patientId: string) {
  return api<{ messages: ThreadMessage[] }>(`/doctor/patients/${patientId}/messages`);
}

export function sendMessage(patientId: string, body: string) {
  return api<{ message: ThreadMessage }>(`/doctor/patients/${patientId}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
}
