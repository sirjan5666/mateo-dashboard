import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Clock,
  IndianRupee,
  MapPin,
  Phone,
  Plus,
  Share2,
  Stethoscope,
  TrendingUp,
  UserPlus,
  Users,
  UserX,
  Video,
} from 'lucide-react';
import { useAuth } from '../../auth/context';
import { useT } from '../../i18n/context';
import { ApiError } from '../../api/client';
import { getOverview } from '../../api/doctorOverview';
import type { Overview, OverviewAppt } from '../../api/doctorOverview';
import { getMyDoctorProfile } from '../../api/doctors';
import type { DoctorProfile } from '../../api/doctors';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { getBillingSummary } from '../../api/doctorBilling';
import type { BillingSummary } from '../../api/doctorBilling';
import { getReport } from '../../api/doctorAnalytics';
import type { DoctorReport } from '../../api/doctorAnalytics';
import { listSchedule } from '../../api/doctorAppointments';
import type { Appointment } from '../../api/doctorAppointments';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';
import { Card } from '../../components/ui/Card';
import { buttonClass } from '../../components/ui/buttonStyles';
import type { Tone } from '../../components/ui/tones';
import { AreaTrend, BarRow, Donut, EmptyState, Kpi, SectionCard, SkeletonChart, SkeletonKpi, SkeletonRows } from '../../components/panel/kit';
import { cn } from '../../lib/cn';
import { useEntrance } from '../../lib/gsap';
import { greetingIST, todayLongIST, formatTimeIST } from '../../lib/age';

type T = ReturnType<typeof useT>;

// ── doctor-panel palette (exact spec hex) ────────────────────────────────────
// Primary navy · medical green · teal accent — matched to the scoped
// [data-theme="pro"][data-panel="doctor"] CSS block so charts (which need
// concrete colours, not CSS vars) stay in sync with the surface theme.
const NAVY = '#1e3a8a';
const GREEN = '#059669';
const TEAL = '#0d9488';
const SLATE = '#94a3b8';
const ROSE = '#ef4444';

const MS_PER_DAY = 86_400_000;

const APPT_MODE: Record<OverviewAppt['mode'], { labelKey: string; icon: LucideIcon }> = {
  in_person: { labelKey: 'doctor.home.modeInPerson', icon: MapPin },
  phone: { labelKey: 'doctor.home.modePhone', icon: Phone },
  video: { labelKey: 'doctor.home.modeVideo', icon: Video },
};
const APPT_STATUS_META: Record<OverviewAppt['status'], { tone: Tone; icon: LucideIcon }> = {
  scheduled: { tone: 'sky', icon: Clock },
  completed: { tone: 'emerald', icon: CircleCheck },
  cancelled: { tone: 'stone', icon: Ban },
  no_show: { tone: 'rose', icon: UserX },
};
// Appointment-status → chart colour (donut). Kept honest and legible: teal for
// booked, green for done, slate for cancelled, rose for missed.
const APPT_STATUS_COLOR: Record<string, string> = {
  Scheduled: TEAL,
  Completed: GREEN,
  Cancelled: SLATE,
  'No-show': ROSE,
};

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Deterministic (pure) label helpers — no Date.now(), safe in the render path.
function trendLabel(dateISO: string, range: 7 | 30): string {
  const d = new Date(`${dateISO}T00:00:00+05:30`);
  return range === 7
    ? d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' });
}
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}
// Module-scope time read (kept out of React's purity-checked render path).
function isWithinDays(iso: string, days: number): boolean {
  return Date.now() - Date.parse(iso) <= days * MS_PER_DAY;
}

// ── appointment mode cell ─────────────────────────────────────────────────────
function ModeCell({ mode, t }: { mode: OverviewAppt['mode']; t: T }) {
  const Icon = APPT_MODE[mode].icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
      <Icon className="h-3.5 w-3.5" />
      {t(APPT_MODE[mode].labelKey)}
    </span>
  );
}

// ── today's appointments table ────────────────────────────────────────────────
function TodayAppts({ appts, t }: { appts: OverviewAppt[]; t: T }) {
  if (appts.length === 0) return <EmptyState icon={CalendarDays} text={t('doctor.home.noApptsToday')} />;
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[24rem] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[0.66rem] font-bold uppercase tracking-wider text-stone-400">
            <th className="px-2 pb-2 font-bold">{t('doctor.home.colTime')}</th>
            <th className="px-2 pb-2 font-bold">{t('doctor.home.colPatient')}</th>
            <th className="hidden px-2 pb-2 font-bold sm:table-cell">{t('doctor.home.colType')}</th>
            <th className="px-2 pb-2 text-right font-bold">{t('doctor.home.colStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {appts.map((a) => {
            const meta = APPT_STATUS_META[a.status];
            return (
              <tr key={a.id} className="group border-t border-[var(--hairline)]">
                <td className="whitespace-nowrap px-2 py-2.5 font-display text-sm font-bold tabular-nums text-stone-700">{formatTimeIST(a.start)}</td>
                <td className="px-2 py-2.5">
                  <Link to={`/doctor/patients/${a.patientId}`} className="flex items-center gap-2.5">
                    <Avatar name={a.patientName} size="sm" hashColor />
                    <span className="truncate font-semibold text-stone-800 group-hover:text-[var(--primary)]">{a.patientName}</span>
                  </Link>
                </td>
                <td className="hidden px-2 py-2.5 sm:table-cell">
                  <ModeCell mode={a.mode} t={t} />
                </td>
                <td className="px-2 py-2.5 text-right">
                  <StatusPill label={titleCase(a.status)} tone={meta.tone} icon={meta.icon} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── recent consultations table ────────────────────────────────────────────────
function RecentConsults({ rows, t }: { rows: Appointment[] | null; t: T }) {
  if (rows === null) return <SkeletonRows n={4} />;
  if (rows.length === 0) return <EmptyState icon={Stethoscope} text={t('doctor.home.noRecentConsults')} />;
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[24rem] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[0.66rem] font-bold uppercase tracking-wider text-stone-400">
            <th className="px-2 pb-2 font-bold">{t('doctor.home.colDate')}</th>
            <th className="px-2 pb-2 font-bold">{t('doctor.home.colPatient')}</th>
            <th className="hidden px-2 pb-2 font-bold sm:table-cell">{t('doctor.home.colType')}</th>
            <th className="px-2 pb-2 text-right font-bold">{t('doctor.home.colStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const name = a.patient?.name ?? '—';
            const meta = APPT_STATUS_META[a.status];
            return (
              <tr key={a.id} className="group border-t border-[var(--hairline)]">
                <td className="whitespace-nowrap px-2 py-2.5 text-xs font-semibold tabular-nums text-stone-500">{shortDate(a.start)}</td>
                <td className="px-2 py-2.5">
                  <Link to={`/doctor/patients/${a.patientId}`} className="flex items-center gap-2.5">
                    <Avatar name={name} size="sm" hashColor />
                    <span className="truncate font-semibold text-stone-800 group-hover:text-[var(--primary)]">{name}</span>
                  </Link>
                </td>
                <td className="hidden px-2 py-2.5 sm:table-cell">
                  <ModeCell mode={a.mode} t={t} />
                </td>
                <td className="px-2 py-2.5 text-right">
                  <StatusPill label={titleCase(a.status)} tone={meta.tone} icon={meta.icon} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── revenue trend card (with 7 / 30-day toggle) ───────────────────────────────
function RevenueTrend({ report, t }: { report: DoctorReport | null; t: T }) {
  const [range, setRange] = useState<7 | 30>(30);
  if (report === null) return <SkeletonChart height={236} />;

  const src = report.revenue.byDay;
  const sliced = range === 7 ? src.slice(-7) : src.slice(-30);
  const data = sliced.map((d) => ({ day: trendLabel(d.date, range), amount: d.amount }));
  const rangeTotal = sliced.reduce((s, d) => s + d.amount, 0);

  return (
    <SectionCard
      title={t('doctor.home.revenueTrend')}
      eyebrow={t('doctor.home.revenueTrendSub')}
      icon={TrendingUp}
      action={
        <div className="flex items-center gap-3">
          <span className="hidden font-display text-lg font-extrabold tabular-nums text-stone-900 sm:inline">₹{rangeTotal.toLocaleString('en-IN')}</span>
          <div className="inline-flex rounded-lg border border-[var(--hairline)] bg-[var(--surface-sunken)] p-0.5">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-bold transition-colors',
                  range === r ? 'bg-[var(--surface-card)] text-[var(--primary)] shadow-sm' : 'text-stone-500 hover:text-stone-700',
                )}
              >
                {t(r === 7 ? 'doctor.home.range7' : 'doctor.home.range30')}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <AreaTrend data={data} xKey="day" series={[{ key: 'amount', name: t('doctor.home.revenueSeries'), color: GREEN }]} height={236} unit="" />
    </SectionCard>
  );
}

// ── dashboard ────────────────────────────────────────────────────────────────
function Dashboard({
  overview,
  billing,
  report,
  recentConsults,
  newLeads,
  firstName,
  profile,
}: {
  overview: Overview;
  billing: BillingSummary | null;
  report: DoctorReport | null;
  recentConsults: Appointment[] | null;
  newLeads: number;
  firstName: string;
  profile: DoctorProfile | null;
}) {
  const { counts } = overview;
  const t = useT();
  const rootRef = useEntrance<HTMLDivElement>([]);

  const revenueSpark = billing?.byDay.map((d) => d.amount) ?? [];

  const donut = useMemo(() => {
    if (!report) return null;
    const slices = report.appointments.byStatus.map((r) => ({
      label: r.label,
      value: r.count,
      color: APPT_STATUS_COLOR[r.label] ?? SLATE,
    }));
    return { slices, total: report.appointments.total };
  }, [report]);

  const source = useMemo(() => {
    if (!report) return null;
    const rows = report.patients.bySource;
    const total = rows.reduce((s, r) => s + r.count, 0);
    return { rows, total };
  }, [report]);

  return (
    <div ref={rootRef} className="space-y-6">
      {(!profile || profile.status !== 'approved') && (
        <Link
          to="/doctor/profile"
          className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {profile ? t('doctor.home.profileReview') : t('doctor.home.profileSetup')}
          <ArrowRight className="ml-auto h-4 w-4" />
        </Link>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">{todayLongIST()}</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-[1.75rem]">
            {t('doctor.home.greeting', { greeting: greetingIST(), name: firstName })}
          </h1>
        </div>
        <Link to="/doctor/patients" className={buttonClass('primary', 'md', 'shadow-card')}>
          <Plus className="h-4 w-4" />
          {t('doctor.home.addPatient')}
        </Link>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi
          icon={IndianRupee}
          label={t('doctor.home.kpiRevenue')}
          value={billing?.collectedToday ?? 0}
          prefix="₹"
          sub={t('doctor.home.kpiRevenueSub')}
          accent={{ bg: '#ecfdf5', fg: GREEN }}
          spark={revenueSpark.length > 1 ? revenueSpark : undefined}
          sparkColor={GREEN}
        />
        <Kpi icon={Users} label={t('doctor.home.kpiTotalPatients')} value={counts.activePatients} sub={t('doctor.home.kpiTotalPatientsSub')} accent={{ bg: '#eef2ff', fg: NAVY }} />
        <Kpi icon={CalendarDays} label={t('doctor.home.kpiApptsToday')} value={counts.todayAppointments} sub={t('doctor.home.kpiSubToday')} accent={{ bg: '#f0fdfa', fg: TEAL }} />
        <Kpi icon={UserPlus} label={t('doctor.home.kpiNewLeads')} value={newLeads} sub={t('doctor.home.kpiNewLeadsSub')} accent={{ bg: '#fffbeb', fg: '#d97706' }} />
      </div>

      {/* Revenue trend (full width) */}
      <RevenueTrend report={report} t={t} />

      {/* Appointment status + patient source */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={t('doctor.home.apptStatus')} eyebrow={t('doctor.home.apptStatusSub')} icon={CalendarClock}>
          {donut === null ? (
            <div className="flex justify-center py-4">
              <SkeletonRows n={3} className="w-full" />
            </div>
          ) : donut.total === 0 ? (
            <EmptyState icon={CalendarClock} text={t('doctor.home.noAppts')} />
          ) : (
            <Donut data={donut.slices} centerValue={donut.total} centerLabel={t('doctor.home.apptUnit')} />
          )}
        </SectionCard>

        <SectionCard title={t('doctor.home.patientSource')} eyebrow={t('doctor.home.patientSourceSub')} icon={Share2}>
          {source === null ? (
            <SkeletonRows n={2} />
          ) : source.total === 0 ? (
            <EmptyState icon={Users} text={t('doctor.home.noPatients')} />
          ) : (
            <div className="space-y-4 py-1">
              {source.rows.map((r, i) => (
                <BarRow key={r.label} label={r.label} value={r.count} total={source.total} color={i === 0 ? NAVY : TEAL} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Today's appointments + recent consultations */}
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title={t('doctor.home.todayAppts')}
          icon={CalendarDays}
          action={
            <Link to="/doctor/appointments" className="text-sm font-semibold text-[var(--primary)] hover:opacity-80">
              {t('doctor.home.viewAll')}
            </Link>
          }
        >
          <TodayAppts appts={overview.today} t={t} />
        </SectionCard>

        <SectionCard
          title={t('doctor.home.recentConsults')}
          eyebrow={t('doctor.home.recentConsultsSub')}
          icon={Stethoscope}
          action={
            <Link to="/doctor/appointments" className="text-sm font-semibold text-[var(--primary)] hover:opacity-80">
              {t('doctor.home.viewAll')}
            </Link>
          }
        >
          <RecentConsults rows={recentConsults} t={t} />
        </SectionCard>
      </div>

      {/* Recent patients (kept — quick jump-in) */}
      <SectionCard
        title={t('doctor.home.recent')}
        icon={Users}
        action={
          <Link to="/doctor/patients" className="text-sm font-semibold text-[var(--primary)] hover:opacity-80">
            {t('doctor.home.viewAll')}
          </Link>
        }
      >
        {overview.recentPatients.length === 0 ? (
          <EmptyState icon={Users} text={t('doctor.home.noPatients')} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {overview.recentPatients.map((p) => (
              <Link
                key={p.id}
                to={`/doctor/patients/${p.id}`}
                className="pop-hover flex items-center gap-3 rounded-2xl border p-3"
                style={{ borderColor: 'var(--hairline)' }}
              >
                <Avatar name={p.name} size="md" hashColor />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-800">{p.name}</p>
                  <p className="truncate text-xs text-stone-400">{titleCase(p.status)}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default function DoctorHome() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [recentConsults, setRecentConsults] = useState<Appointment[] | null>(null);
  const [newLeads, setNewLeads] = useState(0);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getOverview()
      .then((d) => !cancelled && setOverview(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load your dashboard'));
    getBillingSummary()
      .then((d) => !cancelled && setBilling(d))
      .catch(() => undefined);
    getReport()
      .then((d) => !cancelled && setReport(d))
      .catch(() => undefined);
    getMyDoctorProfile()
      .then((d) => !cancelled && setProfile(d.profile))
      .catch(() => undefined);

    // New leads = patients registered in the last 7 days.
    listPatients()
      .then((d: { patients: Patient[] }) => {
        if (cancelled) return;
        setNewLeads(d.patients.filter((p) => !p.archivedAt && isWithinDays(p.createdAt, 7)).length);
      })
      .catch(() => undefined);

    // Recent consultations = completed appointments over the last 30 days.
    const now = new Date();
    const from = new Date(now.getTime() - 30 * MS_PER_DAY);
    listSchedule({ from: from.toISOString(), to: now.toISOString() })
      .then((d) => {
        if (cancelled) return;
        const done = d.appointments
          .filter((a) => a.status === 'completed')
          .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
          .slice(0, 6);
        setRecentConsults(done);
      })
      .catch(() => !cancelled && setRecentConsults([]));

    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user?.name?.replace(/^Dr\.?\s+/i, '').split(' ')[0] ?? '';

  if (error) return <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>;

  if (!overview) {
    return (
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-stone-200/70" />
            <div className="h-8 w-56 animate-pulse rounded bg-stone-200/70" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-xl bg-stone-200/60" />
        </div>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonKpi key={i} />
          ))}
        </div>
        <SkeletonChart height={236} />
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonChart height={180} />
          <SkeletonChart height={180} />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <SkeletonRows n={4} />
          </Card>
          <Card className="p-5 sm:p-6">
            <SkeletonRows n={4} />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      overview={overview}
      billing={billing}
      report={report}
      recentConsults={recentConsults}
      newLeads={newLeads}
      firstName={firstName}
      profile={profile}
    />
  );
}
