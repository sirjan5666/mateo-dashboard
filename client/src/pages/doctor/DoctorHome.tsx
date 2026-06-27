import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Baby,
  BarChart3,
  Bell,
  Calculator,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  FlaskConical,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  ScrollText,
  Sparkles,
  Smartphone,
  Stethoscope,
  Syringe,
  TrendingUp,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { useAuth } from '../../auth/context';
import { ApiError } from '../../api/client';
import { getOverview } from '../../api/doctorOverview';
import type { Overview, OverviewAppt } from '../../api/doctorOverview';
import { getMyDoctorProfile } from '../../api/doctors';
import type { DoctorProfile } from '../../api/doctors';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { Avatar } from '../../components/ui/Avatar';
import { Pill } from '../../components/ui/Pill';
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
import { gsap, prefersReducedMotion, useEntrance, useReveal } from '../../lib/gsap';
import { greetingIST, todayLongIST, formatTimeIST, relativePastIST, relativeUpcomingIST } from '../../lib/age';

// ── constants ────────────────────────────────────────────────────────────────
const MS_PER_DAY = 86_400_000;
const JOURNEY_TOTAL = 2000; // the "first 2000 days" window (~5.5 years)

// Developmental stages across the 0→2000-day arc (cumulative end-day).
const STAGES: { key: string; label: string; end: number }[] = [
  { key: 'newborn', label: 'Newborn', end: 28 },
  { key: 'infant', label: 'Infant', end: 365 },
  { key: 'toddler', label: 'Toddler', end: 1095 },
  { key: 'preschool', label: 'Preschool', end: 1825 },
  { key: 'school', label: 'School-ready', end: JOURNEY_TOTAL },
];

const APPT_MODE: Record<OverviewAppt['mode'], { label: string; icon: LucideIcon }> = {
  in_person: { label: 'In person', icon: MapPin },
  phone: { label: 'Phone', icon: Phone },
  video: { label: 'Video', icon: Video },
};
const APPT_STATUS_TONE: Record<OverviewAppt['status'], Tone> = { scheduled: 'sky', completed: 'emerald', cancelled: 'stone', no_show: 'rose' };

// Status → badge colour per the design spec: Active green, Follow-up amber,
// Monitoring blue, Clearing purple, Maintenance yellow(amber), Discharged grey.
const STATUS_TONE: Record<string, Tone> = {
  active: 'emerald',
  follow_up: 'amber',
  monitoring: 'sky',
  clearing: 'violet',
  maintenance: 'amber',
  discharged: 'stone',
};
const FALLBACK_TONES: Tone[] = ['violet', 'sky', 'amber', 'emerald', 'rose', 'stone'];

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function toneHex(t: Tone, theme: ChartTheme): string {
  return { emerald: theme.green, sky: theme.sky, violet: theme.brand2, amber: theme.amber, rose: theme.rose, stone: theme.axis }[t];
}

function daysSinceDob(dob: string): number {
  return Math.floor((Date.now() - Date.parse(dob)) / MS_PER_DAY);
}

// Kept at module scope (not inline in render) so the time read stays out of
// React's purity-checked render path — same convention as lib/age.ts.
function isWithinDays(iso: string, days: number): boolean {
  return Date.now() - Date.parse(iso) <= days * MS_PER_DAY;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Stable 0–4 vertical lane for a dot, so children don't stack on one line.
function laneOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h % 5;
}

function stageOfDay(day: number): string {
  return STAGES.find((s) => day <= s.end)?.label ?? 'School-ready';
}

interface JourneyChild {
  id: string;
  name: string;
  day: number;
  status: string;
}

// ── signature: First 2000 Days journey band ──────────────────────────────────
function JourneyBand({ kids, graduates, undated }: { kids: JourneyChild[]; graduates: number; undated: number }) {
  const bandRef = useRef<HTMLDivElement>(null);
  const med = median(kids.map((c) => c.day));

  // Stagger the plotted children in once they render (scale-pop along the track).
  useEffect(() => {
    const root = bandRef.current;
    if (!root || prefersReducedMotion()) return;
    const dots = root.querySelectorAll('[data-journey-dot]');
    if (!dots.length) return;
    const tween = gsap.fromTo(
      dots,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)', stagger: { each: 0.04, amount: Math.min(0.8, dots.length * 0.04) }, delay: 0.25 },
    );
    return () => {
      tween.kill();
      gsap.set(dots, { clearProps: 'scale,opacity,transform' });
    };
  }, [kids]);

  return (
    <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--hairline)' }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.64rem] font-bold uppercase tracking-[0.16em] text-stone-400">First 2000 days</p>
          <p className="mt-0.5 text-sm text-stone-600">
            <span className="font-bold text-stone-900">{kids.length}</span> children on the journey
            {kids.length > 0 && (
              <>
                {' · median '}
                <span className="font-bold text-stone-900">Day {med.toLocaleString('en-IN')}</span>{' '}
                <span className="text-stone-400">({stageOfDay(med)})</span>
              </>
            )}
          </p>
        </div>
        {(graduates > 0 || undated > 0) && (
          <div className="flex items-center gap-1.5 text-[0.7rem] font-semibold">
            {graduates > 0 && <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-500">{graduates} graduated</span>}
            {undated > 0 && <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-400">{undated} undated</span>}
          </div>
        )}
      </div>

      {/* stage labels */}
      <div className="mt-4 flex text-[0.62rem] font-bold uppercase tracking-[0.08em] text-stone-400">
        {STAGES.map((s, i) => {
          const prev = i === 0 ? 0 : STAGES[i - 1].end;
          const w = ((s.end - prev) / JOURNEY_TOTAL) * 100;
          return (
            <span key={s.key} className="truncate px-1" style={{ width: `${w}%` }}>
              {s.label}
            </span>
          );
        })}
      </div>

      {/* the band */}
      <div
        ref={bandRef}
        className="relative mt-1.5 h-[78px] overflow-hidden rounded-2xl"
        style={{ background: 'var(--journey-track)' }}
      >
        {/* developmental gradient underlay */}
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.16]" style={{ background: 'var(--journey-gradient)' }} />
        {/* stage dividers */}
        {STAGES.slice(0, -1).map((s) => (
          <span
            key={s.key}
            aria-hidden="true"
            className="absolute inset-y-0 w-px"
            style={{ left: `${(s.end / JOURNEY_TOTAL) * 100}%`, background: 'var(--hairline)' }}
          />
        ))}

        {/* median marker */}
        {kids.length > 0 && (
          <div aria-hidden="true" className="absolute inset-y-0" style={{ left: `${(med / JOURNEY_TOTAL) * 100}%` }}>
            <span className="absolute inset-y-2 -left-px w-0.5 rounded-full bg-[var(--primary)] opacity-60" />
            <span className="journey-now absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--primary)]" />
          </div>
        )}

        {/* plotted children */}
        {kids.map((c) => {
          const tone = STATUS_TONE[c.status] ?? 'sky';
          const top = 12 + laneOf(c.id) * 13; // 12 → 64px lanes within the 78px band
          return (
            <span
              key={c.id}
              data-journey-dot
              title={`${c.name} · Day ${c.day.toLocaleString('en-IN')} · ${stageOfDay(c.day)}`}
              className={cn('absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-[var(--surface-card)]', toneDotBg(tone))}
              style={{ left: `${(c.day / JOURNEY_TOTAL) * 100}%`, top }}
            />
          );
        })}

        {kids.length === 0 && (
          <p className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-stone-400">
            Add a date of birth to plot your patients across the first 2000 days.
          </p>
        )}
      </div>

      {/* axis */}
      <div className="mt-2 flex justify-between text-[0.66rem] font-semibold text-stone-400">
        <span>Day 0 · Birth</span>
        <span>Day 2,000 · ~5.5 yrs</span>
      </div>
    </div>
  );
}

function toneDotBg(t: Tone): string {
  return {
    emerald: 'bg-green-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    sky: 'bg-sky-500',
    violet: 'bg-violet-500',
    stone: 'bg-stone-400',
  }[t];
}

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
  const body = (
    <Card className={cn('flex h-full items-start gap-3 p-4', to ? 'pop-hover' : 'opacity-80')}>
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', toneBadge[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-stone-800">{label}</p>
          {soon && <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-stone-400">Soon</span>}
          {badge ? <span className="ml-auto inline-grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[0.7rem] font-bold text-white">{badge}</span> : null}
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
  const Mode = APPT_MODE[a.mode].icon;
  return (
    <Link to={`/doctor/patients/${a.patientId}`} className="group flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-stone-100">
      <div className="w-14 shrink-0 font-display text-sm font-bold tabular-nums text-stone-700">{formatTimeIST(a.start)}</div>
      <Avatar name={a.patientName} size="sm" tone={APPT_STATUS_TONE[a.status]} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-stone-800">{a.patientName}</p>
        <p className="inline-flex items-center gap-1 text-xs text-stone-500">
          <Mode className="h-3 w-3" />
          {APPT_MODE[a.mode].label} · {a.durationMin}m
        </p>
      </div>
      <Pill tone={APPT_STATUS_TONE[a.status]}>{titleCase(a.status)}</Pill>
      <ChevronRight className="h-4 w-4 text-stone-300 transition-colors group-hover:text-stone-500" />
    </Link>
  );
}

// ── dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ data, patients, firstName, profile }: { data: Overview; patients: Patient[] | null; firstName: string; profile: DoctorProfile | null }) {
  const { counts } = data;
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
      ? `You have ${counts.todayAppointments} appointment${counts.todayAppointments === 1 ? '' : 's'} today.`
      : counts.activePatients === 0
        ? 'Add your first patient to get started.'
        : 'No appointments today — you’re all caught up.';
  const summary = counts.unreadMessages > 0 ? `${base} ${counts.unreadMessages} unread message${counts.unreadMessages === 1 ? '' : 's'}.` : base;

  const total = data.statusBreakdown.reduce((s, r) => s + r.count, 0);
  const weekData = data.encountersByDay.map((d) => ({
    day: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }),
    count: d.count,
  }));
  const weekSpark = data.encountersByDay.map((d) => d.count);
  const donutData = data.statusBreakdown.map((r, i) => ({
    label: titleCase(r.status),
    value: r.count,
    color: toneHex(STATUS_TONE[r.status] ?? FALLBACK_TONES[i % FALLBACK_TONES.length], theme),
  }));
  const nextUp = data.upcoming.slice(0, 4);

  // Honest clinical watchlist — real signals only, highest-attention first.
  const watchAll: { icon: LucideIcon; tone: Tone; label: string; count: number; to: string }[] = [
    { icon: MessageSquare, tone: 'rose', label: 'Parent messages waiting', count: counts.unreadMessages, to: '/doctor/messages' },
    { icon: Bell, tone: 'amber', label: 'Follow-up patients', count: byStatus('follow_up'), to: '/doctor/patients' },
    { icon: Activity, tone: 'sky', label: 'Children in observation', count: byStatus('monitoring'), to: '/doctor/patients' },
    { icon: CalendarDays, tone: 'violet', label: 'Appointments today', count: counts.todayAppointments, to: '/doctor/schedule' },
  ];
  const watch = watchAll.filter((w) => w.count > 0);

  const QUICK: { icon: LucideIcon; label: string; to: string; tone: Tone }[] = [
    { icon: UserPlus, label: 'Add patient', to: '/doctor/patients', tone: 'sky' },
    { icon: ScrollText, label: 'Prescription', to: '/doctor/patients', tone: 'violet' },
    { icon: Syringe, label: 'Vaccination', to: '/doctor/vaccines', tone: 'rose' },
    { icon: TrendingUp, label: 'Growth entry', to: '/doctor/growth', tone: 'emerald' },
    { icon: FlaskConical, label: 'Lab report', to: '/doctor/patients', tone: 'amber' },
    { icon: CalendarPlus, label: 'Follow-up', to: '/doctor/schedule', tone: 'sky' },
    { icon: Video, label: 'Video consult', to: '/doctor/appointments', tone: 'violet' },
  ];

  const MODULES: { icon: LucideIcon; label: string; desc: string; to?: string; tone: Tone; soon?: boolean; badge?: number }[] = [
    { icon: Users, label: 'Patients', desc: 'Profiles & full history', to: '/doctor/patients', tone: 'sky' },
    { icon: CalendarDays, label: 'Schedule', desc: 'Day & week planner', to: '/doctor/schedule', tone: 'violet' },
    { icon: MessageSquare, label: 'Messages', desc: 'Secure parent chat', to: '/doctor/messages', tone: 'emerald', badge: counts.unreadMessages },
    { icon: CalendarClock, label: 'Consultations', desc: 'Video & in-person', to: '/doctor/appointments', tone: 'amber' },
    { icon: ScrollText, label: 'Prescriptions', desc: 'Smart Rx + dose calc', tone: 'violet', soon: true },
    { icon: TrendingUp, label: 'Growth charts', desc: 'WHO percentile bands', to: '/doctor/growth', tone: 'emerald' },
    { icon: Syringe, label: 'Vaccinations', desc: 'IAP schedule & due dates', to: '/doctor/vaccines', tone: 'rose' },
    { icon: Calculator, label: 'Dose calculator', desc: 'Weight & age based', to: '/doctor/dose', tone: 'sky' },
    { icon: Baby, label: 'Neonatology', desc: 'Corrected age & fluids', to: '/doctor/neonatology', tone: 'amber' },
    { icon: Activity, label: 'Development', desc: 'Milestones & red flags', to: '/doctor/development', tone: 'violet' },
    { icon: FlaskConical, label: 'Lab interpreter', desc: 'Flag abnormal values', to: '/doctor/labs', tone: 'sky' },
    { icon: Sparkles, label: 'AI scribe', desc: 'Voice notes → EMR draft', tone: 'emerald', soon: true },
    { icon: ClipboardList, label: 'Templates', desc: 'Well-baby, fever, more', tone: 'amber', soon: true },
    { icon: BarChart3, label: 'Analytics', desc: 'Trends & compliance', to: '/doctor/analytics', tone: 'violet' },
    { icon: CreditCard, label: 'Billing', desc: 'Receipts & collections', to: '/doctor/billing', tone: 'rose' },
    { icon: Smartphone, label: 'Parent app', desc: 'MateoCare connection', tone: 'sky', soon: true },
  ];

  return (
    <div ref={rootRef} className="space-y-5">
      {(!profile || profile.status !== 'approved') && (
        <Link
          to="/doctor/profile"
          className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {profile ? 'Your public profile is under review.' : 'Set up your public profile to accept consultations.'}
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
              {greetingIST()}, Dr. {firstName}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-stone-500">{summary}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link to="/doctor/patients" className={buttonClass('primary', 'md', 'shadow-card')}>
              <Plus className="h-4 w-4" />
              Add patient
            </Link>
            <Link to="/doctor/schedule" className={buttonClass('secondary', 'md')}>
              <CalendarDays className="h-4 w-4" />
              Schedule
            </Link>
          </div>
        </div>

        {journey ? (
          <JourneyBand kids={journey.children} graduates={journey.graduates} undated={journey.undated} />
        ) : (
          <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--hairline)' }}>
            <div className="h-3 w-32 animate-pulse rounded bg-stone-200/70" />
            <div className="mt-4 h-[78px] animate-pulse rounded-2xl bg-stone-200/50" />
          </div>
        )}
      </Card>

      {/* Today's snapshot */}
      <div>
        <h2 className="mb-3 px-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-stone-400">Today’s snapshot</h2>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={CalendarDays} label="Appointments" value={counts.todayAppointments} sub="today" tone="sky" />
          <Kpi icon={UserPlus} label="New patients" value={newThisWeek} sub="last 7 days" tone="violet" />
          <Kpi icon={Bell} label="Follow-ups" value={byStatus('follow_up')} sub="due" tone="amber" />
          <Kpi icon={Activity} label="Observation" value={byStatus('monitoring')} sub="being watched" tone="rose" />
          <Kpi icon={Stethoscope} label="Visit notes" value={counts.weekEncounters} sub="this week" tone="emerald" spark={weekSpark} />
          <Kpi icon={MessageSquare} label="Unread" value={counts.unreadMessages} sub="messages" tone="sky" />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 px-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-stone-400">Quick actions</h2>
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
            title="Weekly activity"
            eyebrow="Visit notes · last 7 days"
            action={<span className="font-display text-xl font-extrabold text-stone-900">{weekSpark.reduce((s, n) => s + n, 0)}</span>}
          >
            <AreaTrend data={weekData} xKey="day" series={[{ key: 'count', name: 'Visit notes', color: theme.brand }]} height={236} />
          </SectionCard>

          <SectionCard
            title="Today’s schedule"
            icon={CalendarDays}
            action={
              <Link to="/doctor/schedule" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                View all
              </Link>
            }
          >
            {data.today.length === 0 ? (
              <EmptyState icon={CalendarDays} text="No appointments today." />
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
          <SectionCard title="Clinical watchlist" icon={AlertTriangle} eyebrow="Needs your attention">
            {watch.length === 0 ? (
              <EmptyState icon={Sparkles} text="All clear — nothing needs attention." />
            ) : (
              <div className="space-y-0.5">
                {watch.map((w) => (
                  <WatchRow key={w.label} {...w} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Patients by status">
            {total === 0 ? <EmptyState icon={Users} text="No patients yet." /> : <Donut data={donutData} centerValue={total} centerLabel="patients" />}
          </SectionCard>

          <SectionCard
            title="Upcoming"
            icon={Clock}
            action={
              <Link to="/doctor/appointments" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                All
              </Link>
            }
          >
            {nextUp.length === 0 ? (
              <p className="text-sm text-stone-500">Nothing scheduled ahead.</p>
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
        title="Recent patients"
        icon={Users}
        action={
          <Link to="/doctor/patients" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            View all
          </Link>
        }
      >
        {data.recentPatients.length === 0 ? (
          <EmptyState icon={Users} text="No patients yet." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.recentPatients.map((p) => {
              const tone = STATUS_TONE[p.status] ?? 'stone';
              const day = dayById.get(p.id);
              return (
                <Link
                  key={p.id}
                  to={`/doctor/patients/${p.id}`}
                  className="pop-hover flex items-center gap-3 rounded-2xl border p-3"
                  style={{ borderColor: 'var(--hairline)' }}
                >
                  <Avatar name={p.name} size="md" tone={tone} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-stone-800">{p.name}</p>
                    <p className="truncate text-xs text-stone-400">
                      {day != null ? `Day ${day.toLocaleString('en-IN')} · ${stageOfDay(day)}` : `Updated ${relativePastIST(p.updatedAt).toLowerCase()}`}
                    </p>
                  </div>
                  <Pill tone={tone}>{titleCase(p.status)}</Pill>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Clinical modules */}
      <div>
        <div className="mb-3 flex items-end justify-between px-1">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-stone-400">Clinical modules</h2>
          <span className="text-[0.7rem] font-medium text-stone-400">The full MateoCare pediatric suite</span>
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
