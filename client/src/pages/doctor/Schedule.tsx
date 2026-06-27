import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Ban, CalendarClock, Check, CircleCheck, Clock, MapPin, Phone, UserX, Video, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ApiError } from '../../api/client';
import { listSchedule, updateAppointment } from '../../api/doctorAppointments';
import type { Appointment, AppointmentMode, AppointmentStatus } from '../../api/doctorAppointments';
import { useT } from '../../i18n/context';
import { Card } from '../../components/ui/Card';
import { StatusPill } from '../../components/ui/StatusPill';
import { Avatar } from '../../components/ui/Avatar';
import { BrandTile } from '../../components/ui/BrandTile';
import { buttonClass } from '../../components/ui/buttonStyles';
import { toneDot } from '../../components/ui/tones';
import type { Tone } from '../../components/ui/tones';
import { cn } from '../../lib/cn';

const STATUS_META: Record<AppointmentStatus, { tone: Tone; icon: LucideIcon; labelKey: string; border: string }> = {
  scheduled: { tone: 'sky', icon: Clock, labelKey: 'doctor.appt.scheduled', border: 'border-l-sky-400' },
  completed: { tone: 'emerald', icon: CircleCheck, labelKey: 'doctor.appt.completed', border: 'border-l-emerald-400' },
  cancelled: { tone: 'stone', icon: Ban, labelKey: 'doctor.appt.cancelled', border: 'border-l-stone-300' },
  no_show: { tone: 'rose', icon: UserX, labelKey: 'doctor.appt.noShow', border: 'border-l-rose-400' },
};
const MODE: Record<AppointmentMode, { icon: LucideIcon; labelKey: string }> = {
  in_person: { icon: MapPin, labelKey: 'doctor.home.modeInPerson' },
  phone: { icon: Phone, labelKey: 'doctor.home.modePhone' },
  video: { icon: Video, labelKey: 'doctor.home.modeVideo' },
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA');
}
function dayLabel(key: string, t: ReturnType<typeof useT>) {
  const today = new Date().toLocaleDateString('en-CA');
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA');
  if (key === today) return t('doctor.schedule.dayToday');
  if (key === tomorrow) return t('doctor.schedule.dayTomorrow');
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5">
        <span className={cn('h-2 w-2 rounded-full', toneDot[tone])} />
        <p className="text-[0.68rem] font-bold uppercase tracking-wide text-stone-400">{label}</p>
      </div>
      <p className="mt-1 font-display text-2xl font-extrabold leading-none tabular-nums text-stone-900">{value}</p>
    </Card>
  );
}

export default function Schedule() {
  const t = useT();
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSchedule({ from: startOfToday() })
      .then((d) => {
        if (!cancelled) setItems(d.appointments);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load the schedule');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function refresh() {
    listSchedule({ from: startOfToday() })
      .then((d) => setItems(d.appointments))
      .catch(() => undefined);
  }

  async function setStatus(id: string, status: AppointmentStatus) {
    setBusyId(id);
    try {
      await updateAppointment(id, { status });
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update the appointment');
    } finally {
      setBusyId(null);
    }
  }

  const grouped = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of items ?? []) {
      const k = dayKey(a.start);
      const list = m.get(k) ?? [];
      list.push(a);
      m.set(k, list);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const today = new Date().toLocaleDateString('en-CA');
    return {
      today: list.filter((a) => dayKey(a.start) === today).length,
      scheduled: list.filter((a) => a.status === 'scheduled').length,
      total: list.length,
    };
  }, [items]);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex items-center gap-3">
        <BrandTile icon={CalendarClock} iconClassName="h-6 w-6" className="h-12 w-12 rounded-2xl shadow-soft" />
        <div>
          <p className="eyebrow">Doctor</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">{t('doctor.schedule.title')}</h1>
          <p className="text-sm text-stone-500">{t('doctor.schedule.subtitle')}</p>
        </div>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {items !== null && items.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <MiniStat label={t('doctor.schedule.today')} value={stats.today} tone="sky" />
          <MiniStat label={t('doctor.schedule.scheduled')} value={stats.scheduled} tone="violet" />
          <MiniStat label={t('doctor.schedule.inView')} value={stats.total} tone="stone" />
        </div>
      )}

      {items === null ? (
        <p className="mt-8 text-sm text-stone-500">{t('doctor.schedule.loading')}</p>
      ) : grouped.length === 0 ? (
        <Card className="mt-6 px-6 py-12 text-center">
          <CalendarClock className="mx-auto h-7 w-7 text-stone-300" />
          <h2 className="mt-2 font-display text-lg font-semibold text-stone-900">{t('doctor.schedule.nothingTitle')}</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stone-500">{t('doctor.schedule.nothingHint')}</p>
        </Card>
      ) : (
        <div className="mt-6 space-y-7">
          {grouped.map(([key, appts]) => (
            <section key={key}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-bold text-stone-600">{dayLabel(key, t)}</h2>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[0.7rem] font-bold tabular-nums text-stone-500">{appts.length}</span>
              </div>
              {/* color-coded vertical timeline */}
              <div className="relative ml-1 space-y-3 border-l-2 border-stone-100 pl-6">
                {appts.map((a) => {
                  const meta = STATUS_META[a.status];
                  const mode = MODE[a.mode];
                  const Mode = mode.icon;
                  return (
                    <div key={a.id} className="relative">
                      <span className={cn('absolute -left-[31px] top-4 h-3 w-3 rounded-full ring-4 ring-white', toneDot[meta.tone])} />
                      <Card className={cn('border-l-4 p-4', meta.border)}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <span className="font-display text-base font-bold tabular-nums text-stone-900">{fmtTime(a.start)}</span>
                          <span className="text-sm tabular-nums text-stone-400">{a.durationMin}m</span>
                          {a.patient && <Avatar name={a.patient.name} size="sm" hashColor />}
                          {a.patient ? (
                            <Link to={`/doctor/patients/${a.patient.id}`} className="font-semibold text-emerald-800 hover:underline">
                              {a.patient.name}
                            </Link>
                          ) : (
                            <span className="font-semibold text-stone-700">{t('doctor.schedule.patient')}</span>
                          )}
                          <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                            <Mode className="h-3.5 w-3.5" />
                            {t(mode.labelKey)}
                          </span>
                          <StatusPill label={t(meta.labelKey)} tone={meta.tone} icon={meta.icon} className="ml-auto" />
                        </div>
                        {a.reason && <p className="mt-1.5 text-sm text-stone-600">{a.reason}</p>}
                        {a.status === 'scheduled' && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button onClick={() => void setStatus(a.id, 'completed')} disabled={busyId === a.id} className={buttonClass('primary', 'sm')}>
                              <Check className="h-3.5 w-3.5" />
                              {t('doctor.schedule.complete')}
                            </button>
                            <button onClick={() => void setStatus(a.id, 'no_show')} disabled={busyId === a.id} className={buttonClass('secondary', 'sm')}>
                              {t('doctor.schedule.noShow')}
                            </button>
                            <button
                              onClick={() => void setStatus(a.id, 'cancelled')}
                              disabled={busyId === a.id}
                              className="inline-flex items-center gap-1 px-2 text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              {t('doctor.schedule.cancel')}
                            </button>
                          </div>
                        )}
                      </Card>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
