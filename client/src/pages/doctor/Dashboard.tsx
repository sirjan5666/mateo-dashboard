import { useEffect, useState } from 'react';
import { Loader2, Sun } from 'lucide-react';
import { useAuth } from '../../auth/context';
import { useActiveLocation } from '../../lib/doctorLocation';
import { subtitleFor } from '../../data/doctorDashboard';
import type { Kpi } from '../../data/doctorDashboard';
import { inr } from '../../lib/doctorLocation';
import { getOverview } from '../../api/doctorOverview';
import type { Overview } from '../../api/doctorOverview';
import { KpiCard } from '../../components/doctor/v2/KpiCard';
import { AppointmentsOverview, NewVsReturning, PatientDemographics, TopVisitReasons } from '../../components/doctor/v2/charts';
import { AlertsReminders, RecentPatients, TodaysSchedule } from '../../components/doctor/v2/panels';
import type { AlertRow } from '../../components/doctor/v2/panels';
import { getAnalytics, getReport } from '../../api/doctorAnalytics';
import type { Analytics, DoctorReport } from '../../api/doctorAnalytics';
import { getDashboardAlerts } from '../../api/doctorDashboard';
import { RangeSelector, rangeForPreset } from '../../components/doctor/v2/RangeSelector';
import type { DateRange, RangePreset } from '../../components/doctor/v2/RangeSelector';

/** First name only — "Good morning, Dr. Ananya". */
function greetingName(fullName?: string | null): string {
  const cleaned = (fullName ?? '').replace(/^Dr\.?\s*/i, '').trim();
  const first = cleaned.split(/\s+/)[0];
  return first ? `Dr. ${first}` : 'Doctor';
}

/**
 * The KPI cards, scoped to the selected date range. Values come straight from the
 * range report; a missing report renders em dashes — never an invented count on a
 * clinical dashboard. Total Patients is deliberately all-time: a roster does not
 * shrink because you narrowed the window.
 */
function buildRangeKpis(report: DoctorReport | null, totalPatients: number | null): Kpi[] {
  const num = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'));
  const base = { delta: undefined, deltaNote: undefined } as const;
  return [
    { ...base, id: 'new-patients', label: 'New Patients', value: report ? num(report.patients.newCount) : '—', statusNote: 'In this range', accent: '#8B5CF6', tile: 'tint', tint: '#F5F0FF', icon: 'Users', linkLabel: 'View patients', to: '/doctor/patients' },
    { ...base, id: 'appointments', label: 'Appointments', value: report ? num(report.appointments.total) : '—', statusNote: 'In this range', accent: '#4F63F5', tile: 'tint', tint: '#EEF2FF', icon: 'CalendarClock', linkLabel: 'View appointments', to: '/doctor/appointments' },
    { ...base, id: 'consultations', label: 'Consultations', value: report ? num(report.consultations.total) : '—', statusNote: 'In this range', accent: '#22D3EE', tile: 'solid', tint: '#ECFEFF', icon: 'Activity', linkLabel: 'View consultations', to: '/doctor/messages' },
    { ...base, id: 'revenue', label: 'Revenue Collected', value: report ? inr(report.revenue.collected) : '—', statusNote: 'In this range', accent: '#16A34A', tile: 'solid', tint: '#ECFDF5', icon: 'IndianRupee', linkLabel: 'View revenue', to: '/doctor/revenue' },
    { ...base, id: 'patients', label: 'Total Patients', value: num(totalPatients), statusNote: 'All time', accent: '#0EA5A5', tile: 'tint', tint: '#F0FDFA', icon: 'Users', linkLabel: 'View patients', to: '/doctor/patients' },
  ];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { activeId, active, clinics } = useActiveLocation();
  const overall = activeId === 'overall';

  // Live operational panels — Today's Schedule, Alerts, and the all-time patient
  // count. These are "now", not range-scoped, so they load once.
  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [overviewRes, analyticsRes, alertRes] = await Promise.all([
          getOverview(),
          getAnalytics(),
          getDashboardAlerts(),
        ]);
        if (cancelled) return;
        setOverview(overviewRes);
        setAnalytics(analyticsRes);
        setAlerts(alertRes.alerts);
      } catch {
        if (!cancelled) { setOverview(null); setAnalytics(null); setAlerts([]); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // The KPI row and the analytical charts follow the selected date range.
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('30d'));
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const rangeKey = `${preset}:${range?.from ?? ''}:${range?.to ?? ''}`;
  useEffect(() => {
    let cancelled = false;
    void getReport(range ?? undefined)
      .then((r) => { if (!cancelled) setReport(r); })
      .catch(() => { if (!cancelled) setReport(null); })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  // The clock, not a date frozen in the mockup.
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Range-scoped KPI cards, straight from the report for the chosen window.
  // Total Patients stays all-time (the roster does not shrink with the range).
  const rangeKpis = buildRangeKpis(report, overview?.counts.activePatients ?? null);

  /**
   * The charts keep their design; the numbers are the practice's own, now for
   * the selected range. Palettes stay client-side — a colour is presentation.
   */
  const AGE_COLORS = ['#3B4FE0', '#4F63F5', '#6366F1', '#A5C4F5', '#CBD5E1'];
  const APPT_COLORS: Record<string, string> = {
    Completed: '#22C55E', Scheduled: '#4F63F5', Cancelled: '#EF4444', 'No-show': '#F59E0B',
  };

  const demographics = (report?.patients.byAge ?? []).map((g, i) => ({
    label: g.label, value: g.count, color: AGE_COLORS[i % AGE_COLORS.length],
  }));
  // New vs Returning stays a six-month trend (the report has no monthly series);
  // it is a trend, not a range window, so it reads independently.
  const visitTrend = (analytics?.encountersByMonth ?? []).map((e, i) => {
    const added = analytics?.patientsByMonth[i]?.count ?? 0;
    return { label: e.month, new: added, returning: Math.max(0, e.count - added) };
  });
  const apptMix = (report?.appointments.byStatus ?? []).map((a) => ({
    label: a.label, value: a.count, color: APPT_COLORS[a.label] ?? '#94A3B8',
  }));
  const visitReasons = (report?.consultations.byKind ?? []).map((k) => ({
    label: k.label, value: k.count,
  }));

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold leading-8 tracking-[-0.02em] text-[#0F172A]">
            Good morning, {greetingName(user?.name)}
            <Sun className="h-5 w-5 shrink-0 text-[#F59E0B]" />
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">{subtitleFor(activeId, active.name, clinics.length)}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {reportLoading && <Loader2 aria-label="Updating" className="h-4 w-4 animate-spin text-[#94A3B8]" />}
            <RangeSelector preset={preset} range={range} onChange={(p, r) => { setReportLoading(true); setPreset(p); setRange(r); }} />
          </div>
          <span className="text-[11.5px] font-medium text-[#94A3B8]">{today}</span>
        </div>
      </div>

      {/* KPI row — figures for the selected range (Total Patients is all-time). */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {rangeKpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} overallNote={overall} />
        ))}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.06fr_1.15fr_0.95fr]">
        <PatientDemographics data={demographics} />
        <NewVsReturning data={visitTrend} />
        <div className="flex flex-col gap-5">
          <TodaysSchedule rows={overview?.today ?? []} />
          <AlertsReminders alerts={alerts} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[0.92fr_1.08fr_1.30fr]">
        <AppointmentsOverview data={apptMix} />
        <TopVisitReasons data={visitReasons} />
        <div className="lg:col-span-2 xl:col-span-1">
          <RecentPatients rows={overview?.recentPatients ?? []} />
        </div>
      </div>
    </div>
  );
}
