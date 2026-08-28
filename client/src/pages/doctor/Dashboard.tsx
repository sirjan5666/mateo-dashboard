import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Stethoscope, Sun } from 'lucide-react';
import { useAuth } from '../../auth/context';
import { useActiveLocation } from '../../lib/doctorLocation';
import { subtitleFor } from '../../data/doctorDashboard';
import type { Kpi } from '../../data/doctorDashboard';
import { getSpecialtyConfig } from '../../data/specialtyDashboard';
import { NewPrescriptionButton } from '../../components/doctor/v2/NewPrescriptionButton';
import { inr } from '../../lib/doctorLocation';
import { cn } from '../../lib/cn';
import { getOverview } from '../../api/doctorOverview';
import type { Overview } from '../../api/doctorOverview';
import { KpiCard } from '../../components/doctor/v2/KpiCard';
import { AppointmentsOverview, NewVsReturning, PatientDemographics, TopVisitReasons } from '../../components/doctor/v2/charts';
import { AlertsReminders, RecentPatients, TodaysSchedule } from '../../components/doctor/v2/panels';
import type { AlertRow } from '../../components/doctor/v2/panels';
import { getAnalytics, getReport } from '../../api/doctorAnalytics';
import type { Analytics, DoctorReport } from '../../api/doctorAnalytics';
import { getDashboardAlerts } from '../../api/doctorDashboard';
import { getPresence, setPresence } from '../../api/doctorAppointments';
import type { DoctorPresence } from '../../api/doctorAppointments';
import { RangeSelector, rangeForPreset } from '../../components/doctor/v2/RangeSelector';
import type { DateRange, RangePreset } from '../../components/doctor/v2/RangeSelector';
import { DoorClosed, DoorOpen } from 'lucide-react';

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

/**
 * The doctor's live In/Out status. Reception flips it when the doctor arrives or
 * leaves; it is separate from the working-hours schedule and from any single
 * appointment. When Out, a patient cannot be seen right now — the whole point.
 */
function InOutToggle({ presence, busy, onToggle }: {
  presence: DoctorPresence | null; busy: boolean; onToggle: (next: boolean) => void;
}) {
  const isIn = presence?.in === true;
  const sinceLabel = presence?.since
    ? new Date(presence.since).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })
    : null;
  return (
    <div className="flex items-center gap-2.5 rounded-[11px] border border-[#E2E6F0] bg-white px-2.5 py-2">
      <span aria-hidden="true" className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-[9px]', isIn ? 'bg-[#DCF7E6]' : 'bg-[#F1F3F9]')}>
        {isIn ? <DoorOpen className="h-[18px] w-[18px] text-[#12A150]" /> : <DoorClosed className="h-[18px] w-[18px] text-[#64748B]" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', isIn ? 'bg-[#12A150]' : 'bg-[#94A3B8]')} />
          <span className="text-[13px] font-bold text-[#0F172A]">Doctor {isIn ? 'In' : 'Out'}</span>
        </span>
        <span className="block text-[11px] font-medium text-[#94A3B8]">
          {sinceLabel ? `Since ${sinceLabel}` : 'Not marked yet'}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onToggle(!isIn)}
        disabled={busy}
        aria-label={isIn ? 'Mark the doctor as Out' : 'Mark the doctor as In'}
        className={cn(
          'ml-1 flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[12.5px] font-bold text-white transition-[filter] hover:brightness-105 disabled:opacity-60',
          isIn ? 'bg-[#E03131]' : 'bg-[#12A150]',
        )}
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Mark {isIn ? 'Out' : 'In'}
      </button>
    </div>
  );
}

/**
 * Read-only speciality badge. A doctor's speciality is chosen at profile setup
 * (and by the admin who creates them) and stays fixed — it is deliberately NOT
 * switchable from the dashboard.
 */
function SpecialtyPill() {
  const { user } = useAuth();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-[11.5px] font-bold text-[#4F46E5]">
      <Stethoscope className="h-3 w-3" />
      {getSpecialtyConfig(user?.specialization).label}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeId, active, clinics } = useActiveLocation();
  const overall = activeId === 'overall';

  // The doctor's live In/Out presence — loaded once, flipped by the front desk.
  const [presence, setPresenceState] = useState<DoctorPresence | null>(null);
  const [presenceBusy, setPresenceBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void getPresence().then((r) => { if (!cancelled) setPresenceState(r.presence); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  function togglePresence(next: boolean) {
    setPresenceBusy(true);
    void setPresence(next)
      .then((r) => setPresenceState(r.presence))
      .catch(() => undefined)
      .finally(() => setPresenceBusy(false));
  }

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
  // One handler for the top RangeSelector and the per-panel range pills (spec #26).
  const changeRange = (p: RangePreset) => { setReportLoading(true); setPreset(p); setRange(rangeForPreset(p)); };
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
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <SpecialtyPill />
            <p className="text-sm text-[#64748B]">{subtitleFor(activeId, active.name, clinics.length)}</p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-start justify-end gap-3 sm:w-auto sm:shrink-0">
          <NewPrescriptionButton />
          <InOutToggle presence={presence} busy={presenceBusy} onToggle={togglePresence} />
          <div className="flex min-w-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              {reportLoading && <Loader2 aria-label="Updating" className="h-4 w-4 animate-spin text-[#94A3B8]" />}
              <RangeSelector preset={preset} range={range} onChange={(p, r) => { setReportLoading(true); setPreset(p); setRange(r); }} />
            </div>
            <span className="text-[11.5px] font-medium text-[#94A3B8]">{today}</span>
          </div>
        </div>
      </div>

      {/* When the doctor is out, patients cannot be seen — say so loudly, and
          point the front desk at the schedule to reschedule what's affected. */}
      {presence && !presence.in && (
        <div role="status" className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-[#F8D9B4] bg-[#FEF6E9] px-4 py-3">
          <DoorClosed aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[#B45309]" />
          <p className="text-[13px] font-medium text-[#8A5A0B]">
            The doctor is currently marked <strong>Out</strong>. Patients cannot be seen right now — appointments in this
            time may need to be rescheduled or have their status updated.
          </p>
          <button type="button" onClick={() => navigate('/doctor/appointments')}
            className="ml-auto h-8 rounded-[8px] border border-[#E8C98A] bg-white px-3 text-[12.5px] font-bold text-[#8A5A0B] hover:bg-[#FFFBF3]">
            Open schedule
          </button>
        </div>
      )}

      {/* KPI row — figures for the selected range (Total Patients is all-time). */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {rangeKpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} overallNote={overall} />
        ))}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.06fr_1.15fr_0.95fr]">
        <PatientDemographics data={demographics} preset={preset} onPreset={changeRange} />
        <NewVsReturning data={visitTrend} preset={preset} onPreset={changeRange} />
        <div className="flex flex-col gap-5">
          <TodaysSchedule rows={overview?.today ?? []} />
          {/* Consultation summary alongside today's schedule */}
          {overview && (
            <div className="rounded-[14px] border border-[#ECEEF4] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-[#4F46E5]" />
                <h2 className="font-display text-[15px] font-bold tracking-[-0.01em] text-[#0F172A]">Consultations</h2>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-[10px] bg-[#F0EFFE] px-3.5 py-2.5">
                  <p className="text-[20px] font-extrabold text-[#4F46E5]">{overview.counts.weekEncounters}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">This week</p>
                </div>
                <div className="rounded-[10px] bg-[#ECFAF1] px-3.5 py-2.5">
                  <p className="text-[20px] font-extrabold text-[#12A150]">
                    {overview.statusBreakdown.find((s) => s.status === 'completed')?.count ?? 0}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">Completed today</p>
                </div>
              </div>
            </div>
          )}
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
