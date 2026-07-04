import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  BarChart3,
  Bell,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  CircleCheck,
  CircleDot,
  ClipboardList,
  Clock,
  CreditCard,
  Eye,
  FlaskConical,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  ScrollText,
  Smartphone,
  Sparkles,
  Stethoscope,
  Syringe,
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
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';
import { Card } from '../../components/ui/Card';
import { buttonClass } from '../../components/ui/buttonStyles';
import { toneBadge } from '../../components/ui/tones';
import type { Tone } from '../../components/ui/tones';
import {
  AreaTrend,
  Donut,
  EmptyState,
  Kpi,
  SectionCard,
  SkeletonChart,
  SkeletonKpi,
  SkeletonRows,
  useChartTheme,
} from '../../components/panel/kit';
import type { ChartTheme } from '../../components/panel/kit';
import { cn } from '../../lib/cn';
import { useEntrance, useReveal } from '../../lib/gsap';
import { JOURNEY_TOTAL, daysSinceDob } from '../../lib/journey';
import { greetingIST, todayLongIST, formatTimeIST, relativePastIST, relativeUpcomingIST } from '../../lib/age';

type T = ReturnType<typeof useT>;

// ── constants ────────────────────────────────────────────────────────────────
// JOURNEY_TOTAL + daysSinceDob come from lib/journey — the single source of
// day-N math shared with the parent dashboard's First-2000-Days card (the band
// itself moved there; this page keeps the per-patient day for Recent patients).
const MS_PER_DAY = 86_400_000;

// Developmental stages across the 0→2000-day arc (cumulative end-day).
const STAGES: { key: string; labelKey: string; end: number }[] = [
  { key: 'newborn', labelKey: 'doctor.home.stageNewborn', end: 28 },
  { key: 'infant', labelKey: 'doctor.home.stageInfant', end: 365 },
  { key: 'toddler', labelKey: 'doctor.home.stageToddler', end: 1095 },
  { key: 'preschool', labelKey: 'doctor.home.stagePreschool', end: 1825 },
  { key: 'school', labelKey: 'doctor.home.stageSchool', end: JOURNEY_TOTAL },
];

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

// Patient status → tone + icon per the design spec: Active green, Follow-up
// amber, Monitoring blue, Clearing purple, Maintenance yellow, Discharged grey.
// Pairing each with an icon keeps status legible without relying on colour alone.
const STATUS_META: Record<string, { tone: Tone; icon: LucideIcon }> = {
  active: { tone: 'emerald', icon: CircleDot },
  follow_up: { tone: 'amber', icon: Bell },
  monitoring: { tone: 'sky', icon: Eye },
  clearing: { tone: 'violet', icon: TrendingUp },
  maintenance: { tone: 'amber', icon: RefreshCw },
  discharged: { tone: 'stone', icon: CircleCheck },
};
const FALLBACK_TONES: Tone[] = ['violet', 'sky', 'amber', 'emerald', 'rose', 'stone'];

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function statusTone(status: string): Tone {
  return STATUS_META[status]?.tone ?? 'stone';
}
function statusIcon(status: string): LucideIcon {
  return STATUS_META[status]?.icon ?? CircleDot;
}

function toneHex(t: Tone, theme: ChartTheme): string {
  return { emerald: theme.green, sky: theme.sky, violet: theme.brand2, amber: theme.amber, rose: theme.rose, stone: theme.axis }[t];
}

// Kept at module scope (not inline in render) so the time read stays out of
// React's purity-checked render path — same convention as lib/age.ts.
function isWithinDays(iso: string, days: number): boolean {
  return Date.now() - Date.parse(iso) <= days * MS_PER_DAY;
}

function stageLabel(day: number, t: T): string {
  const s = STAGES.find((x) => day <= x.end) ?? STAGES[STAGES.length - 1];
  return t(s.labelKey);
}

interface JourneyChild {
  id: string;
  name: string;
  day: number;
  status: string;
}

// NOTE: the "First 2000 Days" journey band moved to the PARENT dashboard
// (components/journey/BabyJourneyCard) per the owner's call — parents see their
// own child's journey; this page keeps only the per-patient Day-N math, which
// still powers the "Day N · Stage" line in Recent patients below.

// ── quick action tile ────────────────────────────────────────────────────────
function ActionTile({ icon: Icon, label, to, tone }: { icon: LucideIcon; label: string; to: string; tone: Tone }) {
  return (
    <Link to={to} className="group">
      <Card className="pop-hover flex h-full flex-col items-start gap-3 p-4">
        <span className={cn('grid h-11 w-11 place-items-center rounded-2xl transition-transform group-hover:scale-105', toneBadge[tone])}>
          <Icon className="h-[22px] w-[22px]" />
        </span>
        <span className="text-sm font-semibold leading-snug text-stone-800">{label}</span>
      </Card>
    </Link>
  );
}

// ── clinical module tile ─────────────────────────────────────────────────────
function ModuleTile({ icon: Icon, label, desc, to, tone, soon, badge }: { icon: LucideIcon; label: string; desc: string; to?: string; tone: Tone; soon?: boolean; badge?: number }) {
  const t = useT();
  const body = (
    <Card className={cn('flex h-full items-start gap-3 p-4', to ? 'pop-hover' : 'opacity-80')}>
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', toneBadge[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-stone-800">{label}</p>
          {soon && <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-stone-400">{t('doctor.home.soon')}</span>}
          {badge ? <span className="ml-auto inline-grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[0.7rem] font-bold tabular-nums text-white">{badge}</span> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-stone-400">{desc}</p>
      </div>
      {to && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-stone-300 transition-colors group-hover:text-stone-500" />}
    </Card>
  );
  return to ? (
    <Link to={to} className="group">
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  );
}

// ── watchlist row ────────────────────────────────────────────────────────────
function WatchRow({ icon: Icon, tone, label, count, to }: { icon: LucideIcon; tone: Tone; label: string; count: number; to: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-stone-100">
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', toneBadge[tone])}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-700">{label}</span>
      <span className="font-display text-base font-extrabold tabular-nums text-stone-900">{count}</span>
      <ChevronRight className="h-4 w-4 text-stone-300 transition-colors group-hover:text-stone-500" />
    </Link>
  );
}

// ── schedule row ─────────────────────────────────────────────────────────────
function ScheduleRow({ a }: { a: OverviewAppt }) {
  const t = useT();
  const Mode = APPT_MODE[a.mode].icon;
  const status = APPT_STATUS_META[a.status];
  return (
    <Link to={`/doctor/patients/${a.patientId}`} className="group flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-stone-100">
      <div className="w-14 shrink-0 font-display text-sm font-bold tabular-nums text-stone-700">{formatTimeIST(a.start)}</div>
      <Avatar name={a.patientName} size="sm" hashColor />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-stone-800">{a.patientName}</p>
        <p className="inline-flex items-center gap-1 text-xs text-stone-500">
          <Mode className="h-3 w-3" />
          {t(APPT_MODE[a.mode].labelKey)} · <span className="tabular-nums">{a.durationMin}m</span>
        </p>
      </div>
      <StatusPill label={titleCase(a.status)} tone={status.tone} icon={status.icon} />
      <ChevronRight className="h-4 w-4 text-stone-300 transition-colors group-hover:text-stone-500" />
    </Link>
  );
}

// ── dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ data, patients, firstName, profile }: { data: Overview; patients: Patient[] | null; firstName: string; profile: DoctorProfile | null }) {
  const { counts } = data;
  const t = useT();
  const theme = useChartTheme();
  const rootRef = useEntrance<HTMLDivElement>([]);
  const actionsRef = useReveal<HTMLDivElement>([], { y: 14 });
  const modulesRef = useReveal<HTMLDivElement>([patients], { y: 14 });

  const byStatus = (s: string) => data.statusBreakdown.find((r) => r.status === s)?.count ?? 0;

  // Real "first 2000 days" plotting from patient DOBs (no server change needed).
  const journey = useMemo(() => {
    if (!patients) return null;
    const active = patients.filter((p) => !p.archivedAt);
    const children: JourneyChild[] = [];
    let graduates = 0;
    let undated = 0;
    for (const p of active) {
      if (!p.dob) {
        undated += 1;
        continue;
      }
      const day = daysSinceDob(p.dob);
      if (day < 0) continue;
      if (day > JOURNEY_TOTAL) {
        graduates += 1;
        continue;
      }
      children.push({ id: p.id, name: p.displayName, day, status: p.status });
    }
    return { children, graduates, undated };
  }, [patients]);

  const newThisWeek = useMemo(() => {
    if (!patients) return 0;
    return patients.filter((p) => !p.archivedAt && isWithinDays(p.createdAt, 7)).length;
  }, [patients]);

  const dayById = useMemo(() => {
    const m = new Map<string, number>();
    journey?.children.forEach((c) => m.set(c.id, c.day));
    return m;
  }, [journey]);

  const base =
    counts.todayAppointments > 0
      ? t(counts.todayAppointments === 1 ? 'doctor.home.summaryApptOne' : 'doctor.home.summaryApptMany', { n: counts.todayAppointments })
      : counts.activePatients === 0
        ? t('doctor.home.summaryFirst')
        : t('doctor.home.summaryNoAppts');
  const summary =
    counts.unreadMessages > 0
      ? `${base} ${t(counts.unreadMessages === 1 ? 'doctor.home.summaryUnreadOne' : 'doctor.home.summaryUnreadMany', { n: counts.unreadMessages })}`
      : base;

  const total = data.statusBreakdown.reduce((s, r) => s + r.count, 0);
  const weekData = data.encountersByDay.map((d) => ({
    day: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }),
    count: d.count,
  }));
  const weekSpark = data.encountersByDay.map((d) => d.count);
  const donutData = data.statusBreakdown.map((r, i) => ({
    label: titleCase(r.status),
    value: r.count,
    color: toneHex(STATUS_META[r.status]?.tone ?? FALLBACK_TONES[i % FALLBACK_TONES.length], theme),
  }));
  const nextUp = data.upcoming.slice(0, 4);

  // Honest clinical watchlist — real signals only, highest-attention first.
  const watchAll: { icon: LucideIcon; tone: Tone; label: string; count: number; to: string }[] = [
    { icon: MessageSquare, tone: 'rose', label: t('doctor.home.watchMessages'), count: counts.unreadMessages, to: '/doctor/messages' },
    { icon: Bell, tone: 'amber', label: t('doctor.home.watchFollowUp'), count: byStatus('follow_up'), to: '/doctor/patients' },
    { icon: Activity, tone: 'sky', label: t('doctor.home.watchObservation'), count: byStatus('monitoring'), to: '/doctor/patients' },
    { icon: CalendarDays, tone: 'violet', label: t('doctor.home.watchAppts'), count: counts.todayAppointments, to: '/doctor/schedule' },
  ];
  const watch = watchAll.filter((w) => w.count > 0);

  const QUICK: { icon: LucideIcon; label: string; to: string; tone: Tone }[] = [
    { icon: UserPlus, label: t('doctor.home.qaAddPatient'), to: '/doctor/patients', tone: 'sky' },
    { icon: ScrollText, label: t('doctor.home.qaPrescription'), to: '/doctor/patients', tone: 'violet' },
    { icon: Syringe, label: t('doctor.home.qaVaccination'), to: '/doctor/patients', tone: 'rose' },
    { icon: TrendingUp, label: t('doctor.home.qaGrowth'), to: '/doctor/patients', tone: 'emerald' },
    { icon: FlaskConical, label: t('doctor.home.qaLab'), to: '/doctor/patients', tone: 'amber' },
    { icon: CalendarPlus, label: t('doctor.home.qaFollowUp'), to: '/doctor/schedule', tone: 'sky' },
    { icon: Video, label: t('doctor.home.qaVideo'), to: '/doctor/appointments', tone: 'violet' },
  ];

  const MODULES: { icon: LucideIcon; label: string; desc: string; to?: string; tone: Tone; soon?: boolean; badge?: number }[] = [
    { icon: Users, label: t('doctor.home.modPatients'), desc: t('doctor.home.modPatientsD'), to: '/doctor/patients', tone: 'sky' },
    { icon: CalendarDays, label: t('doctor.home.modSchedule'), desc: t('doctor.home.modScheduleD'), to: '/doctor/schedule', tone: 'violet' },
    { icon: MessageSquare, label: t('doctor.home.modMessages'), desc: t('doctor.home.modMessagesD'), to: '/doctor/messages', tone: 'emerald', badge: counts.unreadMessages },
    { icon: CalendarClock, label: t('doctor.home.modConsults'), desc: t('doctor.home.modConsultsD'), to: '/doctor/appointments', tone: 'amber' },
    { icon: ScrollText, label: t('doctor.home.modRx'), desc: t('doctor.home.modRxD'), tone: 'violet', soon: true },
    { icon: Activity, label: t('doctor.home.modTools'), desc: t('doctor.home.modToolsD'), to: '/doctor/patients', tone: 'emerald' },
    { icon: Sparkles, label: t('doctor.home.modScribe'), desc: t('doctor.home.modScribeD'), tone: 'emerald', soon: true },
    { icon: ClipboardList, label: t('doctor.home.modTemplates'), desc: t('doctor.home.modTemplatesD'), tone: 'amber', soon: true },
    { icon: BarChart3, label: t('doctor.home.modAnalytics'), desc: t('doctor.home.modAnalyticsD'), to: '/doctor/analytics', tone: 'violet' },
    { icon: CreditCard, label: t('doctor.home.modBilling'), desc: t('doctor.home.modBillingD'), to: '/doctor/billing', tone: 'rose' },
    { icon: Smartphone, label: t('doctor.home.modParentApp'), desc: t('doctor.home.modParentAppD'), tone: 'sky', soon: true },
  ];

  return (
    <div ref={rootRef} className="space-y-5">
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

      {/* Hero + signature journey band */}
      <Card data-entrance="hero" className="hero-aurora relative overflow-hidden p-6 sm:p-7">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">{todayLongIST()}</p>
            <h1 className="mt-1.5 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-3xl">
              {t('doctor.home.greeting', { greeting: greetingIST(), name: firstName })}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-stone-500">{summary}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link to="/doctor/patients" className={buttonClass('primary', 'md', 'shadow-card')}>
              <Plus className="h-4 w-4" />
              {t('doctor.home.addPatient')}
            </Link>
          </div>
        </div>

        {/* The full journey band now lives on each parent's dashboard; the hero
            keeps a one-line pulse of the practice's 2000-day cohort. */}
        {journey && journey.children.length > 0 && (
          <p className="mt-5 border-t pt-4 text-sm text-stone-500" style={{ borderColor: 'var(--hairline)' }}>
            <span className="font-bold tabular-nums text-stone-800">{journey.children.length}</span>{' '}
            {t(journey.children.length === 1 ? 'doctor.home.journeyChildOne' : 'doctor.home.journeyChildMany', { n: journey.children.length }).replace(/^\d+\s*/, '')}
            {journey.graduates > 0 && <span className="text-stone-400"> · {t('doctor.home.journeyGraduated', { n: journey.graduates })}</span>}
          </p>
        )}
      </Card>

      {/* Today's snapshot */}
      <div>
        <h2 className="mb-3 px-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-stone-400">{t('doctor.home.snapshot')}</h2>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={CalendarDays} label={t('doctor.home.kpiAppointments')} value={counts.todayAppointments} sub={t('doctor.home.kpiSubToday')} tone="sky" />
          <Kpi icon={UserPlus} label={t('doctor.home.kpiNewPatients')} value={newThisWeek} sub={t('doctor.home.kpiSubWeek7')} tone="violet" />
          <Kpi icon={Bell} label={t('doctor.home.kpiFollowUps')} value={byStatus('follow_up')} sub={t('doctor.home.kpiSubDue')} tone="amber" />
          <Kpi icon={Activity} label={t('doctor.home.kpiObservation')} value={byStatus('monitoring')} sub={t('doctor.home.kpiSubWatched')} tone="rose" />
          <Kpi icon={Stethoscope} label={t('doctor.home.kpiVisitNotes')} value={counts.weekEncounters} sub={t('doctor.home.kpiSubWeek')} tone="emerald" spark={weekSpark} />
          <Kpi icon={MessageSquare} label={t('doctor.home.kpiUnread')} value={counts.unreadMessages} sub={t('doctor.home.kpiSubMsgs')} tone="sky" />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 px-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-stone-400">{t('doctor.home.quickActions')}</h2>
        <div ref={actionsRef} className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 xl:grid-cols-7">
          {QUICK.map((q) => (
            <ActionTile key={q.label} {...q} />
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <SectionCard
            title={t('doctor.home.weekly')}
            eyebrow={t('doctor.home.weeklySub')}
            action={<span className="font-display text-xl font-extrabold tabular-nums text-stone-900">{weekSpark.reduce((s, n) => s + n, 0)}</span>}
          >
            <AreaTrend data={weekData} xKey="day" series={[{ key: 'count', name: t('doctor.home.kpiVisitNotes'), color: theme.brand }]} height={236} />
          </SectionCard>

          <SectionCard
            title={t('doctor.home.todaySchedule')}
            icon={CalendarDays}
            action={
              <Link to="/doctor/schedule" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                {t('doctor.home.viewAll')}
              </Link>
            }
          >
            {data.today.length === 0 ? (
              <EmptyState icon={CalendarDays} text={t('doctor.home.noApptsToday')} />
            ) : (
              <div className="space-y-0.5">
                {data.today.map((a) => (
                  <ScheduleRow key={a.id} a={a} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="min-w-0 space-y-5">
          <SectionCard title={t('doctor.home.watchlist')} icon={AlertTriangle} eyebrow={t('doctor.home.watchSub')}>
            {watch.length === 0 ? (
              <EmptyState icon={Sparkles} text={t('doctor.home.allClear')} />
            ) : (
              <div className="space-y-0.5">
                {watch.map((w) => (
                  <WatchRow key={w.label} {...w} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('doctor.home.byStatus')}>
            {total === 0 ? (
              <EmptyState icon={Users} text={t('doctor.home.noPatients')} />
            ) : (
              <Donut data={donutData} centerValue={total} centerLabel={t('doctor.home.patientsUnit')} />
            )}
          </SectionCard>

          <SectionCard
            title={t('doctor.home.upcoming')}
            icon={Clock}
            action={
              <Link to="/doctor/appointments" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                {t('doctor.home.all')}
              </Link>
            }
          >
            {nextUp.length === 0 ? (
              <p className="text-sm text-stone-500">{t('doctor.home.nothingAhead')}</p>
            ) : (
              <div className="space-y-1.5">
                {nextUp.map((a) => {
                  const M = APPT_MODE[a.mode].icon;
                  return (
                    <Link key={a.id} to={`/doctor/patients/${a.patientId}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-stone-100">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700">
                        <M className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-800">{a.patientName}</p>
                        <p className="truncate text-xs text-stone-400">{relativeUpcomingIST(a.start)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Recent patients — with live journey position */}
      <SectionCard
        title={t('doctor.home.recent')}
        icon={Users}
        action={
          <Link to="/doctor/patients" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            {t('doctor.home.viewAll')}
          </Link>
        }
      >
        {data.recentPatients.length === 0 ? (
          <EmptyState icon={Users} text={t('doctor.home.noPatients')} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.recentPatients.map((p) => {
              const day = dayById.get(p.id);
              return (
                <Link
                  key={p.id}
                  to={`/doctor/patients/${p.id}`}
                  className="pop-hover flex items-center gap-3 rounded-2xl border p-3"
                  style={{ borderColor: 'var(--hairline)' }}
                >
                  <Avatar name={p.name} size="md" hashColor />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-stone-800">{p.name}</p>
                    <p className="truncate text-xs text-stone-400">
                      {day != null
                        ? t('doctor.home.dayStage', { day: day.toLocaleString('en-IN'), stage: stageLabel(day, t) })
                        : t('doctor.home.updated', { when: relativePastIST(p.updatedAt).toLowerCase() })}
                    </p>
                  </div>
                  <StatusPill label={titleCase(p.status)} tone={statusTone(p.status)} icon={statusIcon(p.status)} />
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Clinical modules */}
      <div>
        <div className="mb-3 flex items-end justify-between px-1">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-stone-400">{t('doctor.home.modules')}</h2>
          <span className="text-[0.7rem] font-medium text-stone-400">{t('doctor.home.modulesSub')}</span>
        </div>
        <div ref={modulesRef} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((m) => (
            <ModuleTile key={m.label} {...m} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DoctorHome() {
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOverview()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load your dashboard');
      });
    listPatients()
      .then((d) => {
        if (!cancelled) setPatients(d.patients);
      })
      .catch(() => {
        if (!cancelled) setPatients([]);
      });
    getMyDoctorProfile()
      .then((d) => {
        if (!cancelled) setProfile(d.profile);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user?.name?.replace(/^Dr\.?\s+/i, '').split(' ')[0] ?? '';

  if (error) return <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>;
  if (!data) {
    return (
      <div className="space-y-5">
        <Card className="p-6 sm:p-7">
          <div className="h-3 w-28 animate-pulse rounded bg-stone-200/70" />
          <div className="mt-3 h-8 w-64 animate-pulse rounded bg-stone-200/70" />
          <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-stone-200/70" />
          <div className="mt-6 h-[78px] animate-pulse rounded-2xl bg-stone-200/50" />
        </Card>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonKpi key={i} />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <SkeletonChart height={236} />
            <SkeletonChart height={160} />
          </div>
          <div className="space-y-5">
            <Card className="p-5 sm:p-6">
              <SkeletonRows n={4} />
            </Card>
            <SkeletonChart height={150} />
          </div>
        </div>
      </div>
    );
  }
  return <Dashboard data={data} patients={patients} firstName={firstName} profile={profile} />;
}
