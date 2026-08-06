import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Loader2,
  BadgeCheck, Bookmark, Calendar, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, Clock, FileText, Hourglass, MapPin, Pencil, Phone, Plus, Trash2, UserRound, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { APPT_STATUS, EMPTY_HOUR, HOURS, LUNCH_HOUR, TONE_STYLE, appointmentFromApi, istDayKey } from '../../data/appointments';
import { listSchedule, updateAppointment } from '../../api/doctorAppointments';
import { createEncounter } from '../../api/doctorEncounters';
import type { Appointment, ApptStatus } from '../../data/appointments';
import { useAuth } from '../../auth/context';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const STATUS_GLYPH: Record<ApptStatus, LucideIcon> = { completed: Check, confirmed: CalendarDays, pending: Hourglass, cancelled: X };

function StatusChip({ status }: { status: ApptStatus }) {
  const s = APPT_STATUS[status];
  const G = STATUS_GLYPH[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-[7px] rounded-[7px] border bg-white px-[11px] py-[5px] text-[11.5px] font-semibold"
      style={{ color: s.fg, borderColor: `${s.fg}33` }}
    >
      <G aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
      {s.label}
    </span>
  );
}

function DetailRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[#64748B]" />
        <dt className="text-[12.5px] font-semibold text-[#64748B]">{label}</dt>
      </div>
      <dd className="mt-[5px] pl-[26px] text-[13.5px] font-medium text-[#0F172A]">{children}</dd>
    </div>
  );
}

/**
 * The calendar works in IST wall-clock, matching the rest of the app. Before
 * this the week and month grids were hard-coded scaffolding — literally
 * `['Mon 12', 'Tue 13', …]` with every booking forced into the first column,
 * and a month whose only populated cell was the 12th — so no real appointment
 * ever appeared, and the arrows and Today had no handlers at all.
 */
const IST_OFFSET_MIN = 330;

/** The UTC instant of IST midnight on the given IST calendar day. */
const fromIstDay = (key: string) => new Date(`${key}T00:00:00.000Z`).getTime() - IST_OFFSET_MIN * 60_000;

const addDays = (key: string, n: number) => istDayKey(new Date(fromIstDay(key) + n * 86_400_000));

function addMonths(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  // Clamp so 31 Jan + 1 month is 28/29 Feb rather than spilling into March.
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Monday of the week containing `key`. */
function weekStart(key: string): string {
  const dow = new Date(`${key}T00:00:00.000Z`).getUTCDay(); // 0 = Sunday
  return addDays(key, dow === 0 ? -6 : 1 - dow);
}

const DAY_MS = 86_400_000;
const IST_DATE = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', weekday: 'long' });
const IST_SHORT = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric' });
const IST_MONTH = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' });
const labelOf = (key: string) => IST_DATE.format(new Date(fromIstDay(key)));

export default function AppointmentsPage() {
  const { user } = useAuth();
  const doctorName = user?.name ?? 'Doctor';
  const todayLabel = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'long' });

  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Day');
  /** The IST day the calendar is looking at. The arrows and Today move this. */
  const [anchor, setAnchor] = useState(() => istDayKey(new Date()));

  /** The IST day range the current view needs — the fetch follows the view. */
  const range = useMemo(() => {
    if (view === 'Day') return { from: anchor, to: anchor };
    if (view === 'Week') {
      const start = weekStart(anchor);
      return { from: start, to: addDays(start, 6) };
    }
    // Six whole weeks, so the leading and trailing days the month grid shows are
    // fetched too rather than rendering as empty cells that look like free days.
    const gridStart = weekStart(`${anchor.slice(0, 7)}-01`);
    return { from: gridStart, to: addDays(gridStart, 41) };
  }, [view, anchor]);

  /** Loads whatever the current view spans. Re-run after every write. */
  const reload = useCallback(async () => {
    const r = await listSchedule({
      from: new Date(fromIstDay(range.from)).toISOString(),
      to: new Date(fromIstDay(range.to) + DAY_MS).toISOString(),
    });
    const list = r.appointments.map(appointmentFromApi);
    setAppointments(list);
    setSelected((cur) => list.find((a) => a.id === cur?.id) ?? list[0] ?? null);
  }, [range.from, range.to]);

  /** Every write goes through here so the grid and the rail can never drift. */
  async function mutate(fn: () => Promise<unknown>) {
    setBusy(true);
    setLoadError(null);
    try {
      await fn();
      await reload();
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  /**
   * "Start Consultation" opens the visit note this appointment becomes: it
   * creates the encounter, marks the slot completed, and lands on the note.
   */
  async function startConsultation(a: Appointment) {
    setBusy(true);
    setLoadError(null);
    try {
      const { encounter } = await createEncounter(a.patientId, { kind: 'visit', subjective: a.notes || a.type });
      await updateAppointment(a.id, { status: 'completed' }).catch(() => undefined);
      navigate('/doctor/consultations/' + encounter.id);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Could not start the consultation');
      setBusy(false);
    }
  }

  // Re-fetches whenever the view or the anchor day moves. Inlined rather than
  // calling `reload()`: every setState must sit behind an await, or
  // react-hooks/set-state-in-effect (an error in this repo) fires.
  useEffect(() => {
    let cancelled = false;
    void listSchedule({
      from: new Date(fromIstDay(range.from)).toISOString(),
      to: new Date(fromIstDay(range.to) + DAY_MS).toISOString(),
    })
      .then((r) => {
        if (cancelled) return;
        const list = r.appointments.map(appointmentFromApi);
        setAppointments(list);
        setSelected((cur) => list.find((a) => a.id === cur?.id) ?? list[0] ?? null);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load the schedule');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const [provider, setProvider] = useState('all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');

  const matches = (a: Appointment) =>
    (provider === 'all') && (type === 'all' || a.type === type) && (status === 'all' || a.status === status);
  const visible = appointments.filter(matches);
  const visibleCount = visible.length;

  /** Appointments of the anchor day only — what the Day grid renders. */
  const dayAppointments = appointments.filter((a) => a.dayKey === anchor);

  /** Monday-first columns of the anchor's week, with real dates. */
  const weekDays = useMemo(() => {
    const start = weekStart(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDays(start, i);
      return { key, label: IST_SHORT.format(new Date(fromIstDay(key))) };
    });
  }, [anchor]);

  /** Six weeks of cells covering the anchor's month, leading/trailing included. */
  const monthCells = useMemo(() => {
    const month = anchor.slice(0, 7);
    const gridStart = weekStart(`${month}-01`);
    return Array.from({ length: 42 }, (_, i) => {
      const key = addDays(gridStart, i);
      return { key, day: Number(key.slice(8)), inMonth: key.slice(0, 7) === month };
    });
  }, [anchor]);

  /** How many visible appointments fall on each IST day. */
  const countByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of visible) m.set(a.dayKey, (m.get(a.dayKey) ?? 0) + 1);
    return m;
  }, [visible]);

  const todayKey = istDayKey(new Date());
  const step = (dir: 1 | -1) =>
    setAnchor((cur) => (view === 'Month' ? addMonths(cur, dir) : addDays(cur, view === 'Week' ? 7 * dir : dir)));

  const headerLabel = view === 'Month'
    ? IST_MONTH.format(new Date(fromIstDay(anchor)))
    : view === 'Week'
      ? `${IST_SHORT.format(new Date(fromIstDay(weekStart(anchor))))} – ${IST_SHORT.format(new Date(fromIstDay(addDays(weekStart(anchor), 6))))}`
      : labelOf(anchor);

  const selectPill = 'h-11 rounded-[10px] border border-[#E2E6F0] bg-white pl-3.5 pr-9 text-[13.5px] font-semibold text-[#334155] appearance-none focus:border-[#3B4FE0] focus:outline-none';

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-[#64748B]">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading schedule…
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-0 xl:grid-cols-[1fr_342px]">
      {/* ── Schedule column ── */}
      <div className="min-w-0 xl:pr-6">
        {loadError && (
          <p role="alert" className="mb-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
            {loadError}
          </p>
        )}
        {/* Header */}
        <div className="mb-[18px] flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[15px]">
              <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px]" style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
                <CalendarDays className="h-[22px] w-[22px] text-white" />
              </span>
              <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">Appointments</h1>
            </div>
            <p className="mt-1.5 text-sm text-[#64748B] sm:pl-[57px]">Schedule, manage and track all appointments.</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <button type="button" aria-label="Register a walk-in" onClick={() => navigate('/doctor/appointments/new')} className="flex h-[46px] items-center gap-2 rounded-[11px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
              <UserRound className="h-[17px] w-[17px] text-[#334155]" />
              <span className="text-sm font-bold text-[#1E2A5A]">Walk-in</span>
            </button>
            <button type="button" aria-label="New appointment" onClick={() => navigate('/doctor/appointments/new')} className="flex h-[46px] items-center gap-2 rounded-[11px] px-[22px] text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105" style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
              <Plus className="h-[18px] w-[18px]" />
              <span className="text-sm font-bold">New Appointment</span>
            </button>
          </div>
        </div>

        <div className={CARD}>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-[#ECEEF4] p-4">
            <button type="button" aria-label={`Previous ${view.toLowerCase()}`} onClick={() => step(-1)}
              className="grid h-10 w-10 place-items-center rounded-[10px] border border-[#E2E6F0] bg-white text-[#334155] hover:bg-[#F7F8FC]">
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
            <div className="flex h-11 items-center gap-[11px] rounded-[10px] border border-[#E2E6F0] bg-white px-4">
              <Calendar aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
              <span className="text-sm font-bold text-[#0F172A]">{headerLabel}</span>
              {/* Jump straight to a date rather than clicking the arrow N times. */}
              <label htmlFor="cal-jump" className="sr-only">Jump to date</label>
              <input id="cal-jump" type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)}
                className="w-[26px] cursor-pointer border-0 bg-transparent p-0 text-transparent outline-none [&::-webkit-calendar-picker-indicator]:opacity-60" />
              <button type="button" aria-label={`Next ${view.toLowerCase()}`} onClick={() => step(1)}>
                <ChevronRight className="h-[18px] w-[18px] text-[#334155]" />
              </button>
            </div>
            <button type="button" onClick={() => setAnchor(todayKey)}
              className="h-11 rounded-[10px] border border-[#E2E6F0] bg-white px-[18px] text-[13.5px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">Today</button>

            <div className="relative">
              <label htmlFor="f-provider" className="sr-only">Provider</label>
              <select id="f-provider" value={provider} onChange={(e) => setProvider(e.target.value)} className={cn(selectPill, 'w-[150px]')}>
                <option value="all">All Providers</option>
                <option value="me">{doctorName}</option>
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
            <div className="relative">
              <label htmlFor="f-type" className="sr-only">Appointment type</label>
              <select id="f-type" value={type} onChange={(e) => setType(e.target.value)} className={cn(selectPill, 'w-[194px]')}>
                <option value="all">All Appointment Types</option>
                {[...new Set(appointments.map((a) => a.type))].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
            <div className="relative">
              <label htmlFor="f-status" className="sr-only">Status</label>
              <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)} className={cn(selectPill, 'w-[132px]')}>
                <option value="all">All Status</option>
                {(['completed', 'confirmed', 'pending', 'cancelled'] as ApptStatus[]).map((s) => <option key={s} value={s}>{APPT_STATUS[s].label}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>

            <div role="radiogroup" aria-label="Schedule view" className="ml-auto flex items-center gap-1.5">
              {(['Day', 'Week', 'Month'] as const).map((v) => (
                <button key={v} role="radio" type="button" aria-checked={view === v} onClick={() => setView(v)}
                  className={cn('h-[42px] rounded-[10px] px-[18px] text-[13.5px] transition-colors',
                    view === v ? 'border-[1.5px] border-[#6366F1] bg-[#F0EFFE] font-bold text-[#3B4FE0]' : 'border border-[#E2E6F0] bg-white font-semibold text-[#334155] hover:bg-[#F7F8FC]')}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {view === 'Day' ? (
            <>
              {/* Provider header */}
              <div className="flex h-[54px] items-center border-b border-[#ECEEF4]">
                <div className="flex h-full w-[104px] shrink-0 items-center border-r border-[#ECEEF4] bg-[#F7F8FC] pl-[22px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                  Time
                </div>
                <div className="flex items-center gap-3 pl-5">
                  <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#EDE9FE] text-[12px] font-bold text-[#6D5AE0]">AS</span>
                  <div>
                    <p className="text-[13.5px] font-bold text-[#0F172A]">{doctorName}</p>
                    <p className="text-[11.5px] font-medium text-[#64748B]">Paediatrician</p>
                  </div>
                </div>
              </div>

              {/* Grid */}
              <div role="grid" aria-label="Day schedule">
                {HOURS.map((h) => {
                  // Scoped to the anchor day so a stale week/month fetch can never leak a
                  // booking from another date into today's grid.
                  const appt = dayAppointments.find((a) => a.hour === h);
                  const dimmed = appt ? !matches(appt) : false;
                  return (
                    <div key={h} role="row" aria-label={h === LUNCH_HOUR ? '1 PM, Lunch break, no appointments' : undefined} className="flex min-h-[66px] border-b border-[#F1F3F9] last:border-b-0">
                      <div className="flex w-[104px] shrink-0 items-center justify-end pr-5 text-[12.5px] font-medium text-[#64748B] sm:w-[104px]">{h}</div>
                      <div className="min-w-0 flex-1 py-2 pl-5 pr-6">
                        {h === LUNCH_HOUR ? (
                          <p className="flex h-[50px] items-center justify-center text-[13px] font-medium text-[#64748B]">Lunch Break</p>
                        ) : h === EMPTY_HOUR ? (
                          <button type="button" onClick={() => navigate('/doctor/appointments/new')}
                            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-[#DDE3F5] transition-colors hover:border-[#3B4FE0] hover:bg-[#F5F7FF]">
                            <Plus className="h-4 w-4 text-[#3B4FE0]" />
                            <span className="text-[13.5px] font-semibold text-[#3B4FE0]">Add Appointment</span>
                          </button>
                        ) : appt ? (
                          <button
                            role="gridcell"
                            type="button"
                            onClick={() => setSelected(appt)}
                            aria-label={`${appt.start} to ${appt.end}, ${appt.patient}, ${appt.age}, ${appt.type}, ${APPT_STATUS[appt.status].label}`}
                            style={{ background: TONE_STYLE[appt.tone].bg, borderLeft: `4px solid ${TONE_STYLE[appt.tone].bar}`, opacity: dimmed ? 0.35 : 1 }}
                            className={cn(
                              'flex h-[50px] w-full items-center gap-3 rounded-[9px] py-2 pl-[15px] pr-3.5 text-left transition-shadow hover:shadow-[0_6px_16px_-8px_rgba(15,23,42,.20)]',
                              selected?.id === appt.id && 'shadow-[0_0_0_3px_rgba(43,111,240,.10)] ring-[1.5px] ring-[#6E97F5]',
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block text-[11.5px] font-semibold" style={{ color: TONE_STYLE[appt.tone].bar }}>
                                {appt.start} – {appt.end}
                              </span>
                              <span className="mt-[3px] flex items-baseline gap-[7px]">
                                <span className="truncate text-[13.5px] font-bold text-[#0F172A]">{appt.patient}</span>
                                <span className="shrink-0 text-xs font-medium text-[#64748B]">({appt.age})</span>
                              </span>
                            </span>
                            <span className="hidden shrink-0 text-[12.5px] font-medium text-[#475569] lg:block lg:w-[150px]">{appt.type}</span>
                            <span className="ml-auto"><StatusChip status={appt.status} /></span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : view === 'Week' ? (
            <div className="overflow-x-auto p-4">
              <div className="grid min-w-[840px] grid-cols-[80px_repeat(7,1fr)] gap-px bg-[#F1F3F9]">
                <div className="bg-[#F7F8FC] p-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]">Time</div>
                {weekDays.map((d) => (
                  <button key={d.key} type="button" onClick={() => { setAnchor(d.key); setView('Day'); }}
                    className={cn('p-2 text-center text-[11.5px] font-bold transition-colors hover:bg-[#EEF1FE]',
                      d.key === todayKey ? 'bg-[#EEF1FE] text-[#3B4FE0]' : 'bg-[#F7F8FC] text-[#334155]')}>
                    {d.label}
                  </button>
                ))}
                {HOURS.map((h) => (
                  <div key={h} className="contents">
                    <div className="bg-white p-2 text-right text-[11.5px] font-medium text-[#64748B]">{h}</div>
                    {weekDays.map((d) => {
                      // Real placement: this day AND this hour, not "column 0".
                      const cell = visible.filter((x) => x.dayKey === d.key && x.hour === h);
                      return (
                        <div key={d.key} className="min-h-[46px] space-y-1 bg-white p-1">
                          {cell.map((a) => (
                            <button key={a.id} type="button" onClick={() => setSelected(a)}
                              aria-label={`${a.start}, ${a.patient}, ${a.type}`}
                              style={{ background: TONE_STYLE[a.tone].bg, borderLeft: `3px solid ${TONE_STYLE[a.tone].bar}` }}
                              className="w-full rounded-[6px] px-2 py-1 text-left text-[11px] font-semibold text-[#0F172A]">
                              <span className="block truncate">{a.patient}</span>
                              <span className="block truncate text-[10px] font-medium text-[#64748B]">{a.start}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-7 gap-px bg-[#F1F3F9]">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="bg-[#F7F8FC] p-2 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">{d}</div>
                ))}
                {monthCells.map((c) => {
                  const n = countByDay.get(c.key) ?? 0;
                  return (
                    <button key={c.key} type="button" onClick={() => { setAnchor(c.key); setView('Day'); }}
                      aria-label={`${c.key}, ${n} appointment${n === 1 ? '' : 's'}`}
                      className={cn('min-h-[92px] p-2 text-left align-top transition-colors hover:bg-[#F5F7FF]',
                        c.inMonth ? 'bg-white' : 'bg-[#FAFBFD]')}>
                      <span className={cn('text-[12px] font-semibold',
                        c.key === todayKey ? 'rounded-full bg-[#4F46E5] px-[7px] py-[2px] text-white'
                          : c.inMonth ? 'text-[#334155]' : 'text-[#C0C8D6]')}>
                        {c.day}
                      </span>
                      {n > 0 && (
                        <span className="mt-1.5 block rounded-[6px] bg-[#EAF2FE] px-2 py-1 text-[11px] font-bold text-[#2B6FF0]">
                          {n} appt{n === 1 ? '' : 's'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <p aria-live="polite" className="sr-only">{visibleCount} appointments visible.</p>
      </div>

      {/* ── Details panel ── */}
      {selected && (
        <aside role="complementary" aria-labelledby="appt-details-title" className="min-w-0 border-t border-[#ECEEF4] bg-white px-[22px] pb-[26px] pt-[22px] xl:border-l xl:border-t-0">
          <div className="mb-4 flex items-center">
            <h2 id="appt-details-title" className="font-display text-[17px] font-extrabold tracking-[-0.02em] text-[#0F172A]">Appointment Details</h2>
            <button type="button" aria-label="Close details" onClick={() => setSelected(null)} className="ml-auto grid h-[30px] w-[30px] place-items-center rounded-[8px] text-[#64748B] hover:bg-[#F1F3F9]">
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="flex gap-3 rounded-[12px] bg-[#EAF1FE] p-[15px]">
            <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-white text-[15px] font-bold text-[#3B4FE0] ring-2 ring-white">
              {selected.patient.split(' ').map((w) => w[0]).join('')}
            </span>
            <div className="min-w-0">
              <p className="font-display text-[15.5px] font-extrabold text-[#0F172A]">{selected.patient}</p>
              <p className="mt-1 text-xs">
                <span className="font-bold text-[#3B4FE0]">{selected.patientId}</span>
                <span aria-hidden="true" className="px-1.5 text-[#CBD5E1]">•</span>
                <span className="font-medium text-[#475569]">{selected.age}</span>
                <span aria-hidden="true" className="px-1.5 text-[#CBD5E1]">•</span>
                <span className="font-medium text-[#475569]">{selected.sex}</span>
              </p>
              <p className="mt-[5px] flex items-center gap-1.5 text-[12.5px] font-medium text-[#334155]">
                <Phone aria-hidden="true" className="h-[13px] w-[13px] text-[#64748B]" />
                {selected.phone}
              </p>
              <span className="mt-2 inline-block rounded-[7px] bg-[#DCE9FE] px-2.5 py-1 text-[11px] font-bold text-[#2B6FF0]">
                {APPT_STATUS[selected.status].label}
              </span>
            </div>
          </div>

          <dl className="mt-5 flex flex-col gap-[18px]">
            <DetailRow icon={Calendar} label="Date & Time">
              {todayLabel} <span aria-hidden="true" className="px-1 text-[#CBD5E1]">•</span> {selected.start} – {selected.end}
            </DetailRow>
            <DetailRow icon={UserRound} label="Provider">
              {doctorName}
              <span className="mt-0.5 block text-[12.5px] font-medium text-[#64748B]">Paediatrician</span>
            </DetailRow>
            <DetailRow icon={ClipboardList} label="Appointment Type">{selected.type}</DetailRow>
            <DetailRow icon={Clock} label="Duration">{selected.duration}</DetailRow>
            <DetailRow icon={MapPin} label="Location">
              {selected.location}
              <span className="mt-0.5 block text-[12.5px] text-[#64748B]">{selected.locationAddress}</span>
            </DetailRow>
            <DetailRow icon={BadgeCheck} label="Status">
              <span className="inline-block rounded-[7px] bg-[#DCE9FE] px-2.5 py-1 text-[11px] font-bold text-[#2B6FF0]">{APPT_STATUS[selected.status].label}</span>
            </DetailRow>
            <DetailRow icon={Bookmark} label="Booking Source">{selected.bookingSource}</DetailRow>
            <DetailRow icon={FileText} label="Notes">{selected.notes}</DetailRow>
            <DetailRow icon={Calendar} label="Created On">{selected.createdOn}</DetailRow>
          </dl>

          <div className="mt-7 grid grid-cols-3 gap-2.5">
            {([
              [Calendar, 'Reschedule', false, () => navigate('/doctor/appointments/new?edit=' + selected.id)],
              [Pencil, 'Patient', false, () => navigate('/doctor/patients/' + selected.patientId)],
              [Trash2, 'Cancel', true, () => void mutate(() => updateAppointment(selected.id, { status: 'cancelled' }))],
            ] as const).map(([Icon, label, danger, act]) => (
              <button key={label} type="button" aria-label={danger ? 'Cancel appointment' : label} disabled={busy}
                onClick={act}
                className={cn('flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white text-[13px] font-bold transition-colors disabled:opacity-50',
                  danger ? 'text-[#EF4444] hover:bg-[#FEF2F2]' : 'text-[#1E2A5A] hover:bg-[#F7F8FC]')}>
                <Icon className={cn('h-4 w-4', danger ? 'text-[#EF4444]' : 'text-[#334155]')} />
                {label}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => void startConsultation(selected)}
            className="mt-3 h-[50px] w-full rounded-[11px] text-[14.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
            style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
            Start Consultation
          </button>
        </aside>
      )}
    </div>
  );
}
