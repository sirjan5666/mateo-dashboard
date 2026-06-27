import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CalendarClock, FileText, HeartPulse, MapPin, Phone, Pill as PillIcon, ShieldCheck, Stethoscope, Video } from 'lucide-react';
import { ApiError } from '../../api/client';
import { getPortalAppointments, getPortalEncounters, getPortalMe, getPortalPrescriptions } from '../../api/portal';
import type { PortalAppointment, PortalEncounter, PortalMe, PortalPrescription } from '../../api/portal';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState, SectionCard, SkeletonRows } from '../../components/panel/kit';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatAge } from '../../lib/age';
import type { Tone } from '../../components/ui/tones';

const TONES: Tone[] = ['emerald', 'amber', 'rose', 'sky', 'violet', 'stone'];
const asTone = (t?: string): Tone => (TONES.includes(t as Tone) ? (t as Tone) : 'stone');
const RX_TONE: Record<PortalPrescription['status'], Tone> = { active: 'emerald', completed: 'stone', stopped: 'rose' };
const APPT_TONE: Record<PortalAppointment['status'], Tone> = { scheduled: 'sky', completed: 'emerald', cancelled: 'stone', no_show: 'rose' };
const MODE: Record<PortalAppointment['mode'], { label: string; icon: LucideIcon }> = {
  in_person: { label: 'In person', icon: MapPin },
  phone: { label: 'Phone', icon: Phone },
  video: { label: 'Video', icon: Video },
};
const title = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function StatTile({ icon: Icon, label, value, sub, tone = 'sky' }: { icon: LucideIcon; label: string; value: string; sub?: string; tone?: Tone }) {
  const BADGE: Record<Tone, string> = {
    emerald: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
    stone: 'bg-stone-100 text-stone-500',
  };
  return (
    <Card data-entrance="card" className="p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[0.66rem] font-bold uppercase tracking-[0.1em] text-stone-400">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${BADGE[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <p className="mt-2 font-display text-lg font-bold leading-tight text-stone-900">{value}</p>
      {sub && <p className="truncate text-sm text-stone-500">{sub}</p>}
    </Card>
  );
}

export default function MyHealth() {
  const [me, setMe] = useState<PortalMe | null>(null);
  const [encounters, setEncounters] = useState<PortalEncounter[]>([]);
  const [prescriptions, setPrescriptions] = useState<PortalPrescription[]>([]);
  const [appointments, setAppointments] = useState<PortalAppointment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPortalMe()
      .then((d) => !cancelled && setMe(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load your record'));
    getPortalEncounters().then((d) => !cancelled && setEncounters(d.encounters)).catch(() => undefined);
    getPortalPrescriptions().then((d) => !cancelled && setPrescriptions(d.prescriptions)).catch(() => undefined);
    getPortalAppointments().then((d) => !cancelled && setAppointments(d.appointments)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>;
  if (!me) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-32 w-full rounded-[var(--card-radius)]" />
        <div className="grid gap-3.5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-[var(--card-radius)]" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="p-5 sm:p-6 lg:col-span-2">
            <SkeletonRows n={4} />
          </Card>
          <Card className="p-5 sm:p-6">
            <SkeletonRows n={3} />
          </Card>
        </div>
      </div>
    );
  }

  const statusTone = asTone(me.template?.statuses.find((s) => s.key === me.record?.status)?.tone);
  const statusLabel = me.template?.statuses.find((s) => s.key === me.record?.status)?.label ?? me.record?.status;
  const recordFields = (me.template?.fields ?? []).filter((f) => !f.archived && me.record?.fields[f.key] != null && me.record?.fields[f.key] !== '');
  const upcoming = appointments.filter((a) => a.status === 'scheduled' && +new Date(a.start) >= +new Date()).sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const activeRx = prescriptions.filter((p) => p.status === 'active');
  const sortedAppts = [...appointments].sort((a, b) => +new Date(b.start) - +new Date(a.start));

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card data-entrance="hero" className="relative overflow-hidden p-6">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={me.patient.displayName} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-stone-400">My health record</p>
            <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">{me.patient.displayName}</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {me.patient.dob ? `${formatAge(me.patient.dob)} · ` : ''}
              {me.patient.sex !== 'unspecified' ? `${title(me.patient.sex)} · ` : ''}
              {me.doctor ? `Cared for by Dr. ${me.doctor.name}` : ''}
            </p>
          </div>
          {me.record && <Pill tone={statusTone}>{statusLabel}</Pill>}
        </div>
        <p className="relative mt-4 inline-flex items-center gap-1.5 text-xs text-stone-400">
          <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
          This is a read-only view of your record. Your information is encrypted and private to your care team.
        </p>
      </Card>

      {/* Quick stats */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <StatTile
          icon={CalendarClock}
          label="Next appointment"
          value={upcoming[0] ? fmtDateTime(upcoming[0].start) : 'None scheduled'}
          sub={upcoming[0] ? `${MODE[upcoming[0].mode].label}${upcoming[0].reason ? ` · ${upcoming[0].reason}` : ''}` : 'You’re all set'}
          tone="sky"
        />
        <StatTile
          icon={PillIcon}
          label="Active medications"
          value={`${activeRx.length} active`}
          sub={activeRx.map((p) => p.drug).join(', ') || 'None on record'}
          tone="violet"
        />
        <StatTile icon={Stethoscope} label="Visit notes" value={`${encounters.length} recorded`} sub={encounters[0] ? `Last on ${fmtDate(encounters[0].date)}` : 'No visits yet'} tone="emerald" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: medications + visit notes */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <SectionCard title="My medications" icon={PillIcon}>
            {prescriptions.length === 0 ? (
              <EmptyState icon={PillIcon} text="No medications on record." />
            ) : (
              <ul className="space-y-2.5">
                {prescriptions.map((p) => (
                  <li key={p.id} className="flex items-start gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--hairline)' }}>
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                      <PillIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-stone-900">{p.drug}</span>
                        <Pill tone={RX_TONE[p.status]}>{title(p.status)}</Pill>
                      </div>
                      {(p.dose || p.frequency || p.duration) && (
                        <p className="mt-0.5 text-sm text-stone-600">{[p.dose, p.frequency, p.duration].filter(Boolean).join(' · ')}</p>
                      )}
                      {p.instructions && <p className="mt-0.5 text-xs text-stone-500">{p.instructions}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="My visit notes" icon={Stethoscope}>
            {encounters.length === 0 ? (
              <EmptyState icon={FileText} text="No visit notes yet." />
            ) : (
              <ol className="space-y-3">
                {encounters.map((e) => (
                  <li key={e.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--hairline)' }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-sky-500" />
                      <span className="text-sm font-semibold text-stone-700">{fmtDate(e.date)}</span>
                      <Pill tone="sky">{title(e.kind)}</Pill>
                    </div>
                    <dl className="mt-2.5 space-y-1.5">
                      {([['subjective', 'Subjective'], ['objective', 'Objective'], ['assessment', 'Assessment'], ['plan', 'Plan']] as const)
                        .filter(([k]) => e[k])
                        .map(([k, lbl]) => (
                          <div key={k} className="text-sm">
                            <dt className="text-[0.66rem] font-bold uppercase tracking-wide text-stone-400">{lbl}</dt>
                            <dd className="whitespace-pre-wrap text-stone-700">{e[k]}</dd>
                          </div>
                        ))}
                    </dl>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>

        {/* Right: record + appointments */}
        <div className="min-w-0 space-y-5">
          {recordFields.length > 0 && (
            <SectionCard title="My record" icon={HeartPulse}>
              <dl className="space-y-3">
                {recordFields.map((f) => (
                  <div key={f.key}>
                    <dt className="text-[0.66rem] font-bold uppercase tracking-wide text-stone-400">{f.label}</dt>
                    <dd className="whitespace-pre-wrap text-sm text-stone-800">{String(me.record?.fields[f.key])}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
          )}

          <SectionCard title="My appointments" icon={CalendarClock}>
            {appointments.length === 0 ? (
              <EmptyState icon={CalendarClock} text="No appointments scheduled." />
            ) : (
              <ul className="space-y-2.5">
                {sortedAppts.map((a) => {
                  const M = MODE[a.mode].icon;
                  return (
                    <li key={a.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--hairline)' }}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-stone-800">{fmtDateTime(a.start)}</span>
                        <Pill tone={APPT_TONE[a.status]} className="ml-auto">
                          {title(a.status)}
                        </Pill>
                      </div>
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-stone-500">
                        <M className="h-3 w-3" />
                        {MODE[a.mode].label} · {a.durationMin}m
                      </p>
                      {a.reason && <p className="mt-1 text-sm text-stone-600">{a.reason}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pb-2 text-xs text-stone-400">
        <HeartPulse className="h-3.5 w-3.5" />
        Questions about your care? Contact your doctor.
      </div>
    </div>
  );
}
