import type { DoctorReport } from '../api/doctorAnalytics';

/**
 * Reports & Analytics (Clinic OS spec 12) — the whole screen, mapped from
 * GET /doctor/analytics/report.
 *
 * Every figure here is a real count for the selected range. This file used to
 * also export a block of design-reference placeholders (₹18,74,560 of revenue,
 * 2,486 patients, a May-2025 appointment series); they are gone, because they
 * were what the page kept showing.
 *
 * The one rule: nothing is invented. A figure the report does not carry comes
 * back empty or null, and the screen renders an empty state rather than a
 * plausible-looking number.
 */

const PIE = ['#4F46E5', '#2B6FF0', '#12A150', '#F59E0B', '#EC4899', '#CBD5E1'];
const AVATAR_TINTS = [
  { tint: '#EDE9FE', fg: '#6D5AE0' },
  { tint: '#E4EBFD', fg: '#2B6FF0' },
  { tint: '#DCF7E6', fg: '#12A150' },
  { tint: '#FDECD3', fg: '#F59E0B' },
];

export const inr0 = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** "12 May" in the viewer's locale — the x-axis and the range labels. */
export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

/** "12 May 2025" — for a range that may span a year boundary. */
export const fullDayLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Whole-rupee y-axis ticks. Revenue is returned in RUPEES, so the axis has to
 * scale itself — the page previously hard-coded a 0–20 "lakh" axis and plotted
 * rupee amounts against it, which put every real bar flat on the floor.
 */
export function moneyTick(v: number): string {
  if (v === 0) return '0';
  if (Math.abs(v) >= 10_000_000) return `${+(v / 10_000_000).toFixed(1)}Cr`;
  if (Math.abs(v) >= 100_000) return `${+(v / 100_000).toFixed(1)}L`;
  if (Math.abs(v) >= 1_000) return `${+(v / 1_000).toFixed(1)}k`;
  return String(Math.round(v));
}

/**
 * Period-on-period change. `null` when the previous window was empty: a rise
 * from nothing is not a percentage, and "+100%" off a zero base is a lie.
 */
export function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** "2 min ago" / "3 days ago", from an ISO instant. */
export function elapsedSince(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const secs = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return fullDayLabel(iso);
}

/**
 * The icon + tint each activity row gets, chosen from its dotted action key
 * (`invoice.paid`, `appointment.booked`, `patient.created`, …). Unknown keys
 * fall through to a neutral row rather than being dropped — the audit trail
 * grows new action keys as the app does.
 */
function activityLook(action: string): { icon: string; tint: string; fg: string } {
  if (action.startsWith('invoice') || action.includes('paid')) return { icon: 'Receipt', tint: '#DCF7E6', fg: '#12A150' };
  if (action.startsWith('appointment')) return { icon: 'CalendarDays', tint: '#E4EBFD', fg: '#2B6FF0' };
  if (action.startsWith('patient')) return { icon: 'UserRound', tint: '#EDE9FE', fg: '#6D5AE0' };
  if (action.startsWith('prescription') || action.startsWith('laborder')) return { icon: 'Stethoscope', tint: '#DCF7E6', fg: '#12A150' };
  if (action.startsWith('report')) return { icon: 'FileText', tint: '#FDECD3', fg: '#F59E0B' };
  return { icon: 'FileClock', tint: '#EEF2FF', fg: '#3B4FE0' };
}

export function analyticsFromReport(r: DoctorReport, now: Date = new Date()) {
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
  const prev = r.previous;

  // The revenue headline is money RECEIVED in the window (paidAt), which is
  // exactly what the bars sum to — so the total and the chart can never disagree.
  const revenueTotal = r.revenue.total;

  // Appointments and consultations, per day, on the shared x-axis the server
  // builds. Both series come back day-aligned, so a plain zip is safe.
  const consultByDate = new Map(r.consultations.byDay.map((d) => [d.date, d.count]));
  const apptSeries = r.appointments.byDay.map((d) => ({
    day: dayLabel(d.date),
    date: d.date,
    appointments: d.count,
    consultations: consultByDate.get(d.date) ?? 0,
  }));

  const serviceTotal = r.services.reduce((t, s) => t + s.count, 0);
  const topServiceCount = r.services[0]?.count ?? 0;

  return {
    /**
     * Five KPIs, each with the change against the previous equal-length window.
     * `delta: null` means the previous window was empty — the card then shows
     * the figure alone instead of a fabricated percentage.
     */
    kpis: [
      { id: 'appts', tint: '#EDE9FE', fg: '#6D5AE0', icon: 'CalendarDays', label: 'Total Appointments', value: apptTotal.toLocaleString('en-IN'), delta: deltaPct(apptTotal, prev.appointments) },
      { id: 'consults', tint: '#DCF7E6', fg: '#12A150', icon: 'Stethoscope', label: 'Total Consultations', value: consultTotal.toLocaleString('en-IN'), delta: deltaPct(consultTotal, prev.consultations) },
      { id: 'patients', tint: '#EEF2FF', fg: '#3B4FE0', icon: 'Users', label: 'New Patients', value: r.patients.newCount.toLocaleString('en-IN'), delta: deltaPct(r.patients.newCount, prev.newPatients) },
      { id: 'collected', tint: '#DCF7E6', fg: '#12A150', icon: 'IndianRupee', label: 'Revenue Collected', value: inr0(revenueTotal), delta: deltaPct(revenueTotal, prev.revenueTotal) },
      { id: 'invoiced', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Receipt', label: 'Invoiced', value: inr0(r.revenue.invoiced), delta: null },
    ],
    /** Rupees, not lakhs — the axis formats itself via `moneyTick`. */
    revenueBars: days.map((d) => ({ period: dayLabel(d.date), date: d.date, value: d.amount })),
    /**
     * The daily run-rate: the mean across EVERY day in the window, quiet days
     * included. Averaging only the days that took money would flatter a clinic
     * that saw patients twice a week.
     */
    revenueAvg: days.length ? Math.round(days.reduce((t, d) => t + d.amount, 0) / days.length) : 0,
    revenueTotal,
    revenueDelta: deltaPct(revenueTotal, prev.revenueTotal),
    apptSeries,
    apptStatusSplit: slices(r.appointments.byStatus),
    demographics: slices(r.patients.byAge),
    gender: slices(r.patients.byGender),
    source: slices(r.patients.bySource),
    consultKinds: slices(r.consultations.byKind),
    /**
     * Top services, billed. `solid` is the bar width as a share of the BIGGEST
     * service (so the leader fills the track and the rest are readable against
     * it); `share` is the honest share of all billed line items.
     */
    topServices: r.services.map((s) => ({
      name: s.label,
      count: s.count,
      amount: s.amount,
      share: serviceTotal ? Math.round((s.count / serviceTotal) * 100) : 0,
      solid: topServiceCount ? Math.round((s.count / topServiceCount) * 100) : 0,
    })),
    /**
     * Appointments per clinic location. This replaced "Top Providers": nothing
     * attributes an appointment to a provider (one practice is one doctor, and
     * staff are reception/OPD/accounts), so that card could only ever have been
     * made up.
     */
    topLocations: r.appointments.byLocation.map((l, i) => ({
      name: l.label,
      count: l.count,
      ...AVATAR_TINTS[i % AVATAR_TINTS.length],
    })),
    activity: r.activity.map((a) => ({
      id: a.id,
      title: a.description,
      subtitle: [a.actorName, a.entityId].filter(Boolean).join(' · '),
      elapsed: elapsedSince(a.at, now),
      datetime: a.at,
      ...activityLook(a.action),
    })),
    comparison: `vs ${dayLabel(prev.from)} – ${dayLabel(prev.to)}`,
    rangeLabel: `${fullDayLabel(r.range.from)} – ${fullDayLabel(r.range.to)}`,
    totalPatients: r.patients.totalActive,
    collectionRate: r.revenue.collectionRate,
    avgDurationMin: r.appointments.avgDurationMin,
  };
}

export type ReportAnalytics = ReturnType<typeof analyticsFromReport>;
