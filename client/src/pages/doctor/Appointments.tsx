import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Ban, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, CircleCheck, Clock, MapPin, Percent, Phone, UserX, Video } from 'lucide-react';
import { ApiError } from '../../api/client';
import { listSchedule, createAppointment, updateAppointment } from '../../api/doctorAppointments';
import type { Appointment, AppointmentMode, AppointmentStatus } from '../../api/doctorAppointments';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { useT } from '../../i18n/context';
import { Card } from '../../components/ui/Card';
import { StatusPill } from '../../components/ui/StatusPill';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import type { SegmentOption } from '../../components/ui/SegmentedControl';
import { Tabs } from '../../components/ui/Tabs';
import type { TabItem } from '../../components/ui/Tabs';
import { Table, TBody, TD, TH, THead, TR } from '../../components/ui/Table';
import { DropdownMenu } from '../../components/ui/DropdownMenu';
import type { DropdownEntry } from '../../components/ui/DropdownMenu';
import { Pagination } from '../../components/ui/Pagination';
import { Kpi, EmptyState, SkeletonKpi, SkeletonRows } from '../../components/panel/kit';
import type { Tone } from '../../components/ui/tones';
import { buttonClass } from '../../components/ui/buttonStyles';
import { inputCls } from '../../components/ui/field';
import { formatTimeIST } from '../../lib/age';
import { cn } from '../../lib/cn';

type T = ReturnType<typeof useT>;
type View = 'calendar' | 'list';
type ListTab = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
const PAGE_SIZE = 10;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DURATIONS = [15, 20, 30, 45, 60];

const S_META: Record<AppointmentStatus, { labelKey: string; tone: Tone; icon: LucideIcon; dot: string }> = {
  scheduled: { labelKey: 'doctor.appts.stScheduled', tone: 'sky', icon: Clock, dot: '#0d9488' },
  completed: { labelKey: 'doctor.appts.stCompleted', tone: 'emerald', icon: CircleCheck, dot: '#059669' },
  cancelled: { labelKey: 'doctor.appts.stCancelled', tone: 'stone', icon: Ban, dot: '#94a3b8' },
  no_show: { labelKey: 'doctor.appts.stNoShow', tone: 'rose', icon: UserX, dot: '#ef4444' },
};
const MODE_META: Record<AppointmentMode, { labelKey: string; icon: LucideIcon }> = {
  in_person: { labelKey: 'doctor.appts.modeInPerson', icon: MapPin },
  phone: { labelKey: 'doctor.appts.modePhone', icon: Phone },
  video: { labelKey: 'doctor.appts.modeVideo', icon: Video },
};

// Module-scope date reads (kept out of React's purity-checked render path).
const pad = (n: number) => String(n).padStart(2, '0');
function istKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
function todayIstKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
function currentMonthCursor(): { y: number; m: number } {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() };
}
function isoWindow(daysBack: number, daysFwd: number): { from: string; to: string } {
  const now = Date.now();
  return { from: new Date(now - daysBack * 86_400_000).toISOString(), to: new Date(now + daysFwd * 86_400_000).toISOString() };
}

export default function Appointments() {
  const t = useT();
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('calendar');
  const [cursor, setCursor] = useState(currentMonthCursor);
  const [selectedDay, setSelectedDay] = useState<string>(() => todayIstKey());
  const [listTab, setListTab] = useState<ListTab>('scheduled');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Appointment | null>(null);

  const todayKey = useMemo(() => todayIstKey(), []);

  function reload() {
    const w = isoWindow(120, 120);
    return listSchedule({ from: w.from, to: w.to })
      .then((d) => setAppts(d.appointments))
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : t('doctor.appts.errLoad')));
  }

  useEffect(() => {
    reload();
    listPatients()
      .then((d) => setPatients(d.patients.filter((p) => !p.archivedAt)))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // appts grouped by IST day for the calendar.
  const byDay = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of appts ?? []) {
      const k = istKey(a.start);
      (m.get(k) ?? m.set(k, []).get(k)!).push(a);
    }
    for (const list of m.values()) list.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    return m;
  }, [appts]);

  const kpis = useMemo(() => {
    const list = appts ?? [];
    const monthPrefix = `${cursor.y}-${pad(cursor.m + 1)}`;
    const today = list.filter((a) => istKey(a.start) === todayKey && a.status !== 'cancelled').length;
    const monthBooked = list.filter((a) => istKey(a.start).startsWith(monthPrefix) && a.status !== 'cancelled').length;
    const completed = list.filter((a) => a.status === 'completed').length;
    const noShow = list.filter((a) => a.status === 'no_show').length;
    const completion = completed + noShow > 0 ? Math.round((completed / (completed + noShow)) * 100) : null;
    return { today, monthBooked, completion, noShow };
  }, [appts, cursor, todayKey]);

  const dayAppts = byDay.get(selectedDay) ?? [];

  // list view rows
  const listRows = useMemo(() => {
    const list = (appts ?? []).filter((a) => a.status === listTab);
    return [...list].sort((a, b) => (listTab === 'scheduled' ? Date.parse(a.start) - Date.parse(b.start) : Date.parse(b.start) - Date.parse(a.start)));
  }, [appts, listTab]);
  const pageCount = Math.max(1, Math.ceil(listRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = listRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function changeStatus(a: Appointment, status: AppointmentStatus) {
    await updateAppointment(a.id, { status }).catch(() => undefined);
    await reload();
    setDetail(null);
  }
  function rowItems(a: Appointment): DropdownEntry[] {
    const items: DropdownEntry[] = [{ key: 'view', label: t('doctor.appts.view'), icon: CalendarDays }];
    if (a.status === 'scheduled') {
      items.push(
        { key: 'completed', label: t('doctor.appts.markComplete'), icon: CircleCheck },
        'separator',
        { key: 'no_show', label: t('doctor.appts.markNoShow'), icon: UserX },
        { key: 'cancelled', label: t('doctor.appts.cancelVisit'), icon: Ban, danger: true },
      );
    }
    return items;
  }
  function onRowAction(a: Appointment, key: string) {
    if (key === 'view') setDetail(a);
    else void changeStatus(a, key as AppointmentStatus);
  }

  const shiftMonth = (delta: number) =>
    setCursor((c) => {
      const total = c.y * 12 + c.m + delta;
      return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
    });

  const monthCells = useMemo(() => {
    const firstWeekday = new Date(cursor.y, cursor.m, 1).getDay();
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${cursor.y}-${pad(cursor.m + 1)}-${pad(d)}`);
    return cells;
  }, [cursor]);

  const listTabs: TabItem<ListTab>[] = [
    { value: 'scheduled', label: t('doctor.appts.tabUpcoming'), count: (appts ?? []).filter((a) => a.status === 'scheduled').length || undefined },
    { value: 'completed', label: t('doctor.appts.tabCompleted') },
    { value: 'cancelled', label: t('doctor.appts.tabCancelled') },
    { value: 'no_show', label: t('doctor.appts.tabNoShow') },
  ];
  const viewOptions: SegmentOption<View>[] = [
    { value: 'calendar', label: t('doctor.appts.viewCalendar') },
    { value: 'list', label: t('doctor.appts.viewList') },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">{t('doctor.appts.title')}</h1>
          <p className="text-sm text-stone-500">{t('doctor.appts.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <SegmentedControl options={viewOptions} value={view} onChange={setView} />
          <button onClick={() => setCreating(true)} className={buttonClass('primary', 'md', 'shadow-card')}>
            <CalendarPlus className="h-4 w-4" />
            {t('doctor.appts.create')}
          </button>
        </div>
      </div>

      {error && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* KPI strip */}
      {!appts ? (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonKpi key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Kpi icon={CalendarDays} label={t('doctor.appts.kpiToday')} value={kpis.today} accent={{ bg: '#eef2ff', fg: '#1e3a8a' }} variant="tinted" sub={t('doctor.appts.kpiTodaySub')} />
          <Kpi icon={CalendarDays} label={t('doctor.appts.kpiMonth')} value={kpis.monthBooked} accent={{ bg: '#f0fdfa', fg: '#0d9488' }} variant="tinted" sub={MONTHS[cursor.m]} />
          <Kpi icon={Percent} label={t('doctor.appts.kpiCompletion')} value={kpis.completion ?? 0} suffix="%" accent={{ bg: '#ecfdf5', fg: '#059669' }} variant="tinted" sub={t('doctor.appts.kpiCompletionSub')} />
          <Kpi icon={UserX} label={t('doctor.appts.kpiNoShows')} value={kpis.noShow} accent={{ bg: '#fef2f2', fg: '#ef4444' }} variant="tinted" sub={t('doctor.appts.kpiNoShowsSub')} />
        </div>
      )}

      {view === 'calendar' ? (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          {/* Month calendar */}
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-stone-900">
                {MONTHS[cursor.m]} {cursor.y}
              </h2>
              <div className="flex items-center gap-1">
                <button onClick={() => shiftMonth(-1)} aria-label={t('doctor.appts.prevMonth')} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--hairline)] text-stone-600 hover:bg-[var(--surface-sunken)]">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => { setCursor(currentMonthCursor()); setSelectedDay(todayKey); }} className="rounded-lg border border-[var(--hairline)] px-2.5 py-1.5 text-xs font-bold text-stone-600 hover:bg-[var(--surface-sunken)]">
                  {t('doctor.appts.today')}
                </button>
                <button onClick={() => shiftMonth(1)} aria-label={t('doctor.appts.nextMonth')} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--hairline)] text-stone-600 hover:bg-[var(--surface-sunken)]">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[0.62rem] font-bold uppercase tracking-wide text-stone-400">
              {WEEKDAYS.map((w, i) => (
                <div key={i} className="pb-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((key, i) => {
                if (!key) return <div key={`b${i}`} />;
                const day = Number(key.slice(-2));
                const list = byDay.get(key) ?? [];
                const isToday = key === todayKey;
                const isSel = key === selectedDay;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(key)}
                    className={cn(
                      'flex min-h-[64px] flex-col rounded-xl border p-1.5 text-left transition-colors',
                      isSel ? 'border-[var(--primary)] bg-[var(--accent)]' : 'border-[var(--hairline)] hover:bg-[var(--surface-sunken)]',
                    )}
                  >
                    <span className={cn('mb-0.5 text-xs font-bold tabular-nums', isToday ? 'grid h-5 w-5 place-items-center rounded-full bg-[var(--primary)] text-white' : 'text-stone-600')}>{day}</span>
                    <span className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                      {list.slice(0, 2).map((a) => (
                        <span key={a.id} className="flex items-center gap-1 truncate text-[0.6rem] font-semibold text-stone-600">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: S_META[a.status].dot }} />
                          <span className="truncate">{a.patient?.name?.split(' ')[0] ?? '—'}</span>
                        </span>
                      ))}
                      {list.length > 2 && <span className="text-[0.58rem] font-bold text-stone-400">+{list.length - 2}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Day agenda */}
          <Card className="p-4 sm:p-5">
            <p className="text-[0.62rem] font-bold uppercase tracking-wide text-stone-400">{selectedDay === todayKey ? t('doctor.appts.today') : t('doctor.appts.agenda')}</p>
            <h2 className="mb-3 font-display text-lg font-extrabold text-stone-900">{new Date(`${selectedDay}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}</h2>
            {dayAppts.length === 0 ? (
              <EmptyState icon={CalendarDays} text={t('doctor.appts.dayEmpty')} />
            ) : (
              <div className="space-y-1.5">
                {dayAppts.map((a) => {
                  const Mode = MODE_META[a.mode].icon;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setDetail(a)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--hairline)] p-2.5 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                      style={{ borderLeft: `3px solid ${S_META[a.status].dot}` }}
                    >
                      <span className="w-14 shrink-0 font-display text-sm font-bold tabular-nums text-stone-700">{formatTimeIST(a.start)}</span>
                      <Avatar name={a.patient?.name ?? '—'} size="sm" hashColor />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-stone-800">{a.patient?.name ?? '—'}</span>
                        <span className="flex items-center gap-1 text-xs text-stone-400">
                          <Mode className="h-3 w-3" />
                          {t(MODE_META[a.mode].labelKey)} · {a.durationMin}m
                        </span>
                      </span>
                      <StatusPill label={t(S_META[a.status].labelKey)} tone={S_META[a.status].tone} icon={S_META[a.status].icon} />
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      ) : (
        /* List view */
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--hairline)] p-4">
            <Tabs items={listTabs} value={listTab} onChange={(v) => { setListTab(v); setPage(1); }} />
          </div>
          {!appts ? (
            <div className="p-5">
              <SkeletonRows n={5} />
            </div>
          ) : listRows.length === 0 ? (
            <EmptyState icon={CalendarDays} text={t('doctor.appts.listEmpty')} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>{t('doctor.appts.colDate')}</TH>
                      <TH>{t('doctor.appts.colTime')}</TH>
                      <TH>{t('doctor.appts.colPatient')}</TH>
                      <TH>{t('doctor.appts.colType')}</TH>
                      <TH>{t('doctor.appts.colStatus')}</TH>
                      <TH className="w-10 text-right" />
                    </TR>
                  </THead>
                  <TBody>
                    {pageRows.map((a) => {
                      const Mode = MODE_META[a.mode].icon;
                      return (
                        <TR key={a.id} onClick={() => setDetail(a)} className="cursor-pointer">
                          <TD className="whitespace-nowrap text-stone-600">{new Date(`${istKey(a.start)}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}</TD>
                          <TD className="whitespace-nowrap font-display text-sm font-bold tabular-nums text-stone-700">{formatTimeIST(a.start)}</TD>
                          <TD>
                            <span className="flex items-center gap-2.5">
                              <Avatar name={a.patient?.name ?? '—'} size="sm" hashColor />
                              <span className="truncate font-semibold text-stone-800">{a.patient?.name ?? '—'}</span>
                            </span>
                          </TD>
                          <TD>
                            <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                              <Mode className="h-3.5 w-3.5" />
                              {t(MODE_META[a.mode].labelKey)} · {a.durationMin}m
                            </span>
                          </TD>
                          <TD>
                            <StatusPill label={t(S_META[a.status].labelKey)} tone={S_META[a.status].tone} icon={S_META[a.status].icon} />
                          </TD>
                          <TD className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu items={rowItems(a)} onSelect={(k) => onRowAction(a, k)} label="Appointment actions" />
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
              <div className="p-4">
                <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} totalLabel={t('doctor.appts.showing', { n: pageRows.length, total: listRows.length })} />
              </div>
            </>
          )}
        </Card>
      )}

      {detail && <DetailModal appt={detail} onClose={() => setDetail(null)} onStatus={changeStatus} t={t} />}
      {creating && (
        <CreateModal
          patients={patients}
          initialDate={selectedDay}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void reload();
          }}
          t={t}
        />
      )}
    </div>
  );
}

function DetailModal({ appt, onClose, onStatus, t }: { appt: Appointment; onClose: () => void; onStatus: (a: Appointment, s: AppointmentStatus) => void; t: T }) {
  const Mode = MODE_META[appt.mode].icon;
  const day = new Date(`${istKey(appt.start)}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
  const fact = (label: string, value: string) => (
    <div>
      <p className="text-[0.62rem] font-bold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="font-semibold text-stone-800">{value}</p>
    </div>
  );
  return (
    <Modal open title={appt.patient?.name ?? t('doctor.appts.view')} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <Avatar name={appt.patient?.name ?? '—'} size="md" hashColor />
            <span className="font-semibold text-stone-900">{appt.patient?.name ?? '—'}</span>
          </span>
          <StatusPill label={t(S_META[appt.status].labelKey)} tone={S_META[appt.status].tone} icon={S_META[appt.status].icon} />
        </div>
        <div className="grid grid-cols-2 gap-4 rounded-2xl bg-[var(--surface-sunken)] p-4">
          {fact(t('doctor.appts.colDate'), day)}
          {fact(t('doctor.appts.colTime'), `${formatTimeIST(appt.start)} · ${appt.durationMin}m`)}
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-wide text-stone-400">{t('doctor.appts.colType')}</p>
            <p className="flex items-center gap-1.5 font-semibold text-stone-800">
              <Mode className="h-4 w-4 text-stone-500" />
              {t(MODE_META[appt.mode].labelKey)}
            </p>
          </div>
          {appt.reason ? fact(t('doctor.appts.reason'), appt.reason) : null}
        </div>
        {appt.status === 'scheduled' && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--hairline)] pt-4">
            <button onClick={() => onStatus(appt, 'cancelled')} className={buttonClass('secondary', 'md')}>
              <Ban className="h-4 w-4" />
              {t('doctor.appts.cancelVisit')}
            </button>
            <button onClick={() => onStatus(appt, 'no_show')} className={buttonClass('secondary', 'md')}>
              <UserX className="h-4 w-4" />
              {t('doctor.appts.markNoShow')}
            </button>
            <button onClick={() => onStatus(appt, 'completed')} className={buttonClass('primary', 'md')}>
              <CircleCheck className="h-4 w-4" />
              {t('doctor.appts.markComplete')}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function CreateModal({ patients, initialDate, onClose, onCreated, t }: { patients: Patient[]; initialDate: string; onClose: () => void; onCreated: () => void; t: T }) {
  const [patientId, setPatientId] = useState('');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState<AppointmentMode>('in_person');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!patientId) {
      setErr(t('doctor.appts.errPatient'));
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const start = new Date(`${date}T${time}:00+05:30`).toISOString();
      await createAppointment(patientId, { start, durationMin: duration, mode, reason: reason.trim() || undefined });
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t('doctor.appts.errCreate'));
    } finally {
      setSaving(false);
    }
  }

  const modeOptions: SegmentOption<AppointmentMode>[] = [
    { value: 'in_person', label: t('doctor.appts.modeInPerson') },
    { value: 'video', label: t('doctor.appts.modeVideo') },
    { value: 'phone', label: t('doctor.appts.modePhone') },
  ];

  return (
    <Modal open title={t('doctor.appts.createTitle')} onClose={onClose} size="md">
      {err && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-stone-700">
          {t('doctor.appts.patient')}
          <select className={inputCls} value={patientId} onChange={(e) => setPatientId(e.target.value)} autoFocus>
            <option value="">{t('doctor.appts.selectPatient')}</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-stone-700">
            {t('doctor.appts.colDate')}
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            {t('doctor.appts.colTime')}
            <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm font-medium text-stone-700">
          {t('doctor.appts.duration')}
          <select className={inputCls} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('doctor.appts.colType')}</span>
          <SegmentedControl options={modeOptions} value={mode} onChange={setMode} />
        </div>
        <label className="block text-sm font-medium text-stone-700">
          {t('doctor.appts.reason')}
          <textarea className={inputCls} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('doctor.appts.reasonPlaceholder')} />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={buttonClass('secondary', 'md')}>
          {t('doctor.appts.cancel')}
        </button>
        <button onClick={() => void submit()} disabled={saving} className={buttonClass('primary', 'md')}>
          {saving ? t('doctor.appts.creating') : t('doctor.appts.create')}
        </button>
      </div>
    </Modal>
  );
}
