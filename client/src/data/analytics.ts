/** Reports & Analytics (Clinic OS spec 12). ⚠ PLACEHOLDER DATA. */

export const ANALYTICS_KPIS = [
  { id: 'appts', tint: '#EDE9FE', fg: '#6D5AE0', icon: 'CalendarDays', label: 'Total Appointments', value: '1,248', delta: '18%' },
  { id: 'consults', tint: '#DCF7E6', fg: '#12A150', icon: 'Stethoscope', label: 'Total Consultations', value: '982', delta: '15%' },
  { id: 'new', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'UserRound', label: 'New Patients', value: '356', delta: '12%' },
  { id: 'revenue', tint: '#FDECD3', fg: '#F59E0B', icon: 'IndianRupee', label: 'Total Revenue', value: '₹18,74,560', delta: '22%' },
  { id: 'outstanding', tint: '#FDE2E2', fg: '#EF4444', icon: 'FileText', label: 'Outstanding Amount', value: '₹2,99,380', delta: '8%' },
];

/** All five compare against the same window, with an en-dash. */
export const COMPARISON = 'vs 24 Apr – 30 Apr';

export const APPT_SERIES = [
  { day: '01 May', appointments: 118, consultations: 92 },
  { day: '02 May', appointments: 165, consultations: 124 },
  { day: '03 May', appointments: 124, consultations: 88 },
  { day: '04 May', appointments: 104, consultations: 71 },
  { day: '05 May', appointments: 138, consultations: 105 },
  { day: '06 May', appointments: 112, consultations: 79 },
  { day: '07 May', appointments: 132, consultations: 104 },
  { day: '08 May', appointments: 149, consultations: 112 },
  { day: '09 May', appointments: 121, consultations: 86 },
  { day: '10 May', appointments: 108, consultations: 68 },
  { day: '11 May', appointments: 141, consultations: 109 },
  { day: '12 May', appointments: 136, consultations: 98 },
];

export const REVENUE_BARS = [
  { period: '07–13 Apr', value: 12.6, highlight: false },
  { period: '14–20 Apr', value: 13.1, highlight: false },
  { period: '21–27 Apr', value: 15.4, highlight: false },
  { period: '28 Apr – 04 May', value: 17.2, highlight: false },
  { period: '05–12 May', value: 18.7, highlight: true },
];
export const REVENUE_AVG = 14.2;

export const DEMOGRAPHICS = [
  { label: '0 – 1 Year', color: '#4F46E5', share: 18, count: 448 },
  { label: '1 – 5 Years', color: '#22C55E', share: 32, count: 796 },
  { label: '6 – 12 Years', color: '#8B5CF6', share: 28, count: 696 },
  { label: '13 – 18 Years', color: '#A78BFA', share: 12, count: 298 },
  { label: '18+ Years', color: '#CBD5E1', share: 10, count: 248 },
];

export const APPT_STATUS_SPLIT = [
  { label: 'Completed', color: '#22C55E', share: 62, count: 773 },
  { label: 'Confirmed', color: '#4F46E5', share: 23, count: 287 },
  { label: 'Pending', color: '#F59E0B', share: 8, count: 100 },
  { label: 'Cancelled', color: '#EF4444', share: 5, count: 62 },
  { label: 'No Show', color: '#94A3B8', share: 2, count: 26 },
];

export const TOP_SERVICES = [
  { name: 'General Consultation', count: 682, share: 55, solid: 79, light: 100 },
  { name: 'Vaccination', count: 312, share: 25, solid: 52 },
  { name: 'Well Baby Checkup', count: 186, share: 15, solid: 27 },
  { name: 'Follow-up', count: 98, share: 8, solid: 15 },
  { name: 'Others', count: 46, share: 4, solid: 7 },
];

export const RECENT_REPORTS = [
  { name: 'Appointments Report', type: 'Appointments', range: '01 May 2025 - 12 May 2025', on: '12 May 2025, 11:30 AM', by: 'Dr. Ananya Sharma' },
  { name: 'Revenue Report', type: 'Revenue', range: '01 May 2025 - 12 May 2025', on: '12 May 2025, 11:25 AM', by: 'Dr. Ananya Sharma' },
  { name: 'Patient Demographics', type: 'Patients', range: '01 May 2025 - 12 May 2025', on: '12 May 2025, 11:15 AM', by: 'Dr. Ananya Sharma' },
  { name: 'Billing & Collection Report', type: 'Billing', range: '01 May 2025 - 12 May 2025', on: '12 May 2025, 11:10 AM', by: 'Dr. Ananya Sharma' },
];

export const QUICK_REPORTS = [
  { icon: 'CalendarDays', label: 'Appointments Report' },
  { icon: 'Stethoscope', label: 'Consultations Report' },
  { icon: 'IndianRupee', label: 'Revenue Report' },
  { icon: 'Users', label: 'Patient Demographics' },
  { icon: 'FileText', label: 'Billing & Collection Report' },
  { icon: 'FileClock', label: 'Outstanding Report' },
];

/**
 * Row 2's subtitle reads "by Aaarav Mehta" (triple-a) in the reference.
 * Kept as a data field so the spelling can be corrected in one place.
 */
export const RECENT_ACTIVITY = [
  { tint: '#E4EBFD', fg: '#2B6FF0', icon: 'CalendarDays', title: 'New appointment booked', subtitle: 'Myra Kapoor for 13 May 2025, 10:00 AM', elapsed: '2 min ago', datetime: '2025-05-12T11:28' },
  { tint: '#DCF7E6', fg: '#12A150', icon: 'Receipt', title: 'Invoice #INV-2025-1248 paid', subtitle: 'by Aaarav Mehta', elapsed: '28 min ago', datetime: '2025-05-12T11:02' },
  { tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Stethoscope', title: 'Consultation completed', subtitle: 'Myra Kapoor', elapsed: '45 min ago', datetime: '2025-05-12T10:45' },
  { tint: '#FDE2E2', fg: '#EF4444', icon: 'UserRound', title: 'New patient registered', subtitle: 'Vivaan Patel', elapsed: '1 hr ago', datetime: '2025-05-12T10:30' },
];

export const TOP_PROVIDERS = [
  { name: 'Dr. Ananya Sharma', count: 542, tint: '#EDE9FE', fg: '#6D5AE0' },
  { name: 'Dr. Rohan Kapoor', count: 286, tint: '#E4EBFD', fg: '#2B6FF0' },
  { name: 'Dr. Priya Gupta', count: 154, tint: '#DCF7E6', fg: '#12A150' },
];

// ── Live wiring ──────────────────────────────────────────────────────────────

import type { DoctorReport } from '../api/doctorAnalytics';

const PIE = ['#4F46E5', '#2B6FF0', '#12A150', '#F59E0B', '#EC4899', '#CBD5E1'];
const inr0 = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

/**
 * The whole Reports & Analytics screen, mapped from GET /doctor/analytics/report.
 *
 * Everything here is a real count for the selected range. Figures the report
 * does not carry — per-provider revenue, per-service revenue, a period-on-period
 * delta — are returned empty so the screen renders an empty state instead of an
 * invented one.
 */
export function analyticsFromReport(r: DoctorReport) {
  /** Shares are whole percentages of the group's own total, never of an invented one. */
  const slices = (rows: { label: string; count: number }[]) => {
    const total = rows.reduce((t, x) => t + x.count, 0);
    return rows.map((x, i) => ({
      label: x.label,
      color: PIE[i % PIE.length],
      share: total ? Math.round((x.count / total) * 100) : 0,
      count: x.count,
    }));
  };

  const days = r.revenue.byDay;
  const apptTotal = r.appointments.total;
  const consultTotal = r.consultations.total;

  return {
    // No delta: comparing to the previous period needs a second range the
    // report does not fetch, so the card shows the figure alone.
    kpis: [
      { id: 'appts', tint: '#EDE9FE', fg: '#6D5AE0', icon: 'CalendarDays', label: 'Total Appointments', value: String(apptTotal) },
      { id: 'consults', tint: '#DCF7E6', fg: '#12A150', icon: 'Stethoscope', label: 'Total Consultations', value: String(consultTotal) },
      { id: 'patients', tint: '#EEF2FF', fg: '#3B4FE0', icon: 'Users', label: 'New Patients', value: String(r.patients.newCount) },
      { id: 'collected', tint: '#DCF7E6', fg: '#12A150', icon: 'IndianRupee', label: 'Revenue Collected', value: inr0(r.revenue.collected) },
      { id: 'invoiced', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Receipt', label: 'Invoiced', value: inr0(r.revenue.invoiced) },
    ],
    revenueBars: days.map((d) => ({ period: dayLabel(d.date), value: d.amount, highlight: false })),
    revenueAvg: days.length ? Math.round(days.reduce((t, d) => t + d.amount, 0) / days.length) : 0,
    /**
     * The report gives per-day revenue but only period totals for appointments
     * and consultations, so the daily split is not knowable — the series shows
     * the days with zeroes rather than spreading a total across them.
     */
    apptSeries: days.map((d) => ({ day: dayLabel(d.date), appointments: 0, consultations: 0 })),
    apptStatusSplit: slices(r.appointments.byStatus),
    demographics: slices(r.patients.byAge),
    gender: slices(r.patients.byGender),
    source: slices(r.patients.bySource),
    consultKinds: slices(r.consultations.byKind),
    /** Neither is derivable: the report carries no per-provider or per-service split. */
    topProviders: [] as { name: string; count: number; tint: string; fg: string }[],
    topServices: [] as { name: string; count: number; share: number; solid: number; light?: number }[],
    comparison: `${dayLabel(r.range.from)} – ${dayLabel(r.range.to)}`,
    collectionRate: r.revenue.collectionRate,
    avgDurationMin: r.appointments.avgDurationMin,
  };
}
