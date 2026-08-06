import { api } from './client';
import type { AlertRow } from '../components/doctor/v2/panels';

/** Real dashboard signals — an empty list means nothing needs attention. */
export function getDashboardAlerts() {
  return api<{ alerts: AlertRow[] }>('/doctor/dashboard/alerts');
}
