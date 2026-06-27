import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, Clock, ShieldCheck, Syringe } from 'lucide-react';
import { ApiError } from '../../api/client';
import { getVaccineSchedule } from '../../api/doctorVaccines';
import type { DoseStatus, ScheduleDose, VaxScheduleResult } from '../../api/doctorVaccines';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import type { SegmentOption } from '../../components/ui/SegmentedControl';
import type { Tone } from '../../components/ui/tones';
import { Kpi, EmptyState, SectionCard } from '../../components/panel/kit';
import { cn } from '../../lib/cn';
import { useEntrance } from '../../lib/gsap';
import { formatAge, formatDateIST, todayInputValueIST, toDateInputValueIST } from '../../lib/age';

type Sex = 'male' | 'female';
type Filter = 'all' | 'overdue' | 'due' | 'upcoming' | 'given';

const SEX_OPTIONS: SegmentOption<Sex>[] = [
  { value: 'male', label: 'Boy' },
  { value: 'female', label: 'Girl' },
];

const STATUS_META: Record<DoseStatus, { label: string; tone: Tone }> = {
  done: { label: 'Given', tone: 'emerald' },
  due: { label: 'Due now', tone: 'amber' },
  overdue: { label: 'Overdue', tone: 'rose' },
  upcoming: { label: 'Upcoming', tone: 'stone' },
};

const inputClass =
  'w-full rounded-xl border border-stone-200 bg-[var(--input-background)] px-3 py-2 text-sm text-stone-800 focus:border-emerald-400';

export default function Vaccinations() {
  const rootRef = useEntrance<HTMLDivElement>([]);

  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [result, setResult] = useState<VaxScheduleResult | null>(null);
  const [given, setGiven] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPatients()
      .then((d) => setPatients(d.patients.filter((p) => !p.archivedAt && p.dob)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!dob) return;
    let cancelled = false;
    getVaccineSchedule({ dob, sex })
      .then((r) => !cancelled && setResult(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not build the schedule'));
    return () => {
      cancelled = true;
    };
  }, [dob, sex]);

  function selectPatient(id: string) {
    const p = patients.find((x) => x.id === id);
    if (!p) return;
    const s = (p.sex || '').toLowerCase();
    if (s.startsWith('m')) setSex('male');
    else if (s.startsWith('f')) setSex('female');
    if (p.dob) setDob(toDateInputValueIST(p.dob));
    setGiven(new Set());
    setResult(null);
    setError(null);
  }

  function toggleGiven(id: string) {
    setGiven((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const effStatus = (d: ScheduleDose): DoseStatus => (given.has(d.id) ? 'done' : d.status);

  const counts = useMemo(() => {
    const c = { all: 0, overdue: 0, due: 0, upcoming: 0, given: 0 };
    if (!result) return c;
    c.all = result.doses.length;
    for (const d of result.doses) {
      const s = effStatus(d);
      if (s === 'done') c.given += 1;
      else if (s === 'due') c.due += 1;
      else if (s === 'overdue') c.overdue += 1;
      else c.upcoming += 1;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, given]);

  const groups = useMemo(() => {
    if (!result) return [];
    const filtered = result.doses.filter((d) => {
      const s = effStatus(d);
      if (filter === 'all') return true;
      if (filter === 'given') return s === 'done';
      return s === filter;
    });
    const out: { ageLabel: string; doses: ScheduleDose[] }[] = [];
    for (const d of filtered) {
      const last = out[out.length - 1];
      if (last && last.ageLabel === d.ageLabel) last.doses.push(d);
      else out.push({ ageLabel: d.ageLabel, doses: [d] });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, filter, given]);

  const FILTER_OPTIONS: SegmentOption<Filter>[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'overdue', label: 'Overdue', count: counts.overdue },
    { value: 'due', label: 'Due now', count: counts.due },
    { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { value: 'given', label: 'Given', count: counts.given },
  ];

  return (
    <div ref={rootRef} className="space-y-5">
      {/* header */}
      <Card data-entrance="hero" className="hero-aurora relative overflow-hidden p-6 sm:p-7">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
              <Syringe className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">IAP-aligned immunization schedule</p>
              <h1 className="mt-0.5 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-[1.75rem]">Vaccinations</h1>
              {dob && <p className="mt-0.5 text-sm text-stone-500">{formatAge(dob)} · born {formatDateIST(dob)}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="mb-1 block text-[0.66rem] font-bold uppercase tracking-wide text-stone-400">Date of birth</label>
              <input type="date" max={todayInputValueIST()} value={dob} onChange={(e) => { setDob(e.target.value); setGiven(new Set()); setResult(null); setError(null); }} className={cn(inputClass, 'cursor-pointer')} />
            </div>
            <div>
              <label className="mb-1 block text-[0.66rem] font-bold uppercase tracking-wide text-stone-400">Sex</label>
              <SegmentedControl options={SEX_OPTIONS} value={sex} onChange={setSex} />
            </div>
            {patients.length > 0 && (
              <div>
                <label className="mb-1 block text-[0.66rem] font-bold uppercase tracking-wide text-stone-400">Patient</label>
                <select aria-label="Prefill from patient" className={cn(inputClass, 'w-auto cursor-pointer font-semibold')} value="" onChange={(e) => e.target.value && selectPatient(e.target.value)}>
                  <option value="">Prefill…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {error && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {!dob || !result ? (
        <Card data-entrance="card" className="p-10">
          <EmptyState icon={CalendarClock} text="Enter a date of birth (or pick a patient) to generate the immunization schedule." />
        </Card>
      ) : (
        <>
          {/* summary */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <Kpi icon={AlertTriangle} label="Overdue" value={counts.overdue} sub="past window" tone="rose" />
            <Kpi icon={Clock} label="Due now" value={counts.due} sub="window open" tone="amber" />
            <Kpi icon={CalendarClock} label="Upcoming" value={counts.upcoming} sub="scheduled ahead" tone="sky" />
            <Kpi icon={ShieldCheck} label="Given" value={counts.given} sub="ticked off" tone="emerald" />
          </div>

          <SectionCard title="Immunization schedule" icon={Syringe} eyebrow="Grouped by recommended age">
            <div className="-mt-1 mb-4 overflow-x-auto pb-1">
              <SegmentedControl options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
            </div>

            {groups.length === 0 ? (
              <EmptyState icon={Check} text="Nothing in this filter." />
            ) : (
              <div className="space-y-5">
                {groups.map((g) => (
                  <div key={g.ageLabel}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="font-display text-sm font-extrabold text-stone-800">{g.ageLabel}</span>
                      <span className="h-px flex-1" style={{ background: 'var(--hairline)' }} />
                    </div>
                    <div className="space-y-2">
                      {g.doses.map((d) => {
                        const s = effStatus(d);
                        const meta = STATUS_META[s];
                        const isGiven = s === 'done';
                        return (
                          <div key={d.id} className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--hairline)' }}>
                            <button
                              type="button"
                              onClick={() => toggleGiven(d.id)}
                              aria-label={isGiven ? 'Mark not given' : 'Mark given'}
                              aria-pressed={isGiven}
                              className={cn(
                                'grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors',
                                isGiven ? 'border-green-600 bg-green-600 text-white' : 'border-stone-300 text-transparent hover:border-stone-400',
                              )}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className={cn('truncate font-semibold', isGiven ? 'text-stone-400 line-through' : 'text-stone-800')}>
                                {d.vaccine} <span className="font-medium text-stone-400">· {d.doseLabel}</span>
                              </p>
                              <p className="truncate text-xs text-stone-400">
                                {d.protectsAgainst} · due {formatDateIST(d.dueDate)}
                              </p>
                            </div>
                            <Pill tone={meta.tone}>{meta.label}</Pill>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <p className="px-1 text-xs leading-relaxed text-stone-400">
            Schedule is IAP-aligned (draft, pending pediatrician sign-off) and computed from the date of birth — due dates and overdue flags are relative to today. Ticking “given” is a session worksheet to see what’s outstanding; it is <span className="font-semibold">not saved</span>. Confirm brand-specific dosing and contraindications against the child’s record.
          </p>
        </>
      )}
    </div>
  );
}
