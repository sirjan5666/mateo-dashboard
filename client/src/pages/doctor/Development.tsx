import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, AlertTriangle, CalendarClock, Check, Footprints, MessageCircle, Smile, Sparkles } from 'lucide-react';
import { ApiError } from '../../api/client';
import { assessDevelopment } from '../../api/doctorDevelopment';
import type { DevMilestone, MilestoneDomain, MilestoneStatus } from '../../api/doctorDevelopment';
import { useSearchParams } from 'react-router';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import type { SegmentOption } from '../../components/ui/SegmentedControl';
import { toneBadge } from '../../components/ui/tones';
import type { Tone } from '../../components/ui/tones';
import { Kpi, EmptyState, SectionCard } from '../../components/panel/kit';
import { cn } from '../../lib/cn';
import { useEntrance } from '../../lib/gsap';
import { ageInMonths } from '../../lib/age';
import type { ToolPatient } from '../../components/doctor/tools/types';

type Filter = 'all' | 'watch' | 'inwindow' | 'upcoming' | 'achieved';

const DOMAINS: { key: MilestoneDomain; label: string; icon: LucideIcon; tone: Tone }[] = [
  { key: 'motor', label: 'Motor & physical', icon: Footprints, tone: 'sky' },
  { key: 'language', label: 'Language & communication', icon: MessageCircle, tone: 'violet' },
  { key: 'social', label: 'Social & emotional', icon: Smile, tone: 'amber' },
];

const STATUS_META: Record<MilestoneStatus, { label: string; tone: Tone }> = {
  achieved: { label: 'Achieved', tone: 'emerald' },
  inwindow: { label: 'In window', tone: 'sky' },
  upcoming: { label: 'Upcoming', tone: 'stone' },
  watch: { label: 'Review', tone: 'rose' },
};

// Non-diagnostic red-flag copy per domain (CLAUDE.md hard rule 1).
const FLAG_COPY: Record<MilestoneDomain, (n: number) => string> = {
  language: (n) => `${n} language & communication milestone${n > 1 ? 's' : ''} past the typical window — consider a speech & language review.`,
  social: (n) => `${n} social & emotional milestone${n > 1 ? 's' : ''} past the typical window — consider a developmental review.`,
  motor: (n) => `${n} motor milestone${n > 1 ? 's' : ''} past the typical window — consider a developmental review.`,
};

const inputClass =
  'w-full rounded-xl border border-stone-200 bg-[var(--input-background)] px-3 py-2 text-sm text-stone-800 focus:border-emerald-400';
const labelClass = 'mb-1 block text-[0.66rem] font-bold uppercase tracking-wide text-stone-400';

function windowLabel(m: DevMilestone): string {
  return m.windowStartMonth === m.windowEndMonth ? `${m.windowStartMonth} mo` : `${m.windowStartMonth}–${m.windowEndMonth} mo`;
}

// Friendly age label from months only — pure, so it stays out of the render
// purity rule (no Date.now needed).
function ageLabel(m: number): string {
  if (m < 1) return 'newborn';
  if (m < 24) return `${Math.round(m)} month${Math.round(m) === 1 ? '' : 's'}`;
  const y = Math.floor(m / 12);
  const rem = Math.round(m % 12);
  return rem ? `${y}y ${rem}m` : `${y} year${y === 1 ? '' : 's'}`;
}

// `patient` present → embedded in the patient workspace (age from the patient's
// DOB, header/picker hidden). No prop → standalone page.
export default function Development({ patient }: { patient?: ToolPatient } = {}) {
  const embedded = !!patient;
  const rootRef = useEntrance<HTMLDivElement>([]);
  const [params] = useSearchParams();

  const [age, setAge] = useState(() => (patient?.dob ? String(ageInMonths(patient.dob)) : ''));
  const [milestones, setMilestones] = useState<DevMilestone[] | null>(null);
  const [achieved, setAchieved] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ageMonths = parseFloat(age);
  const hasAge = age !== '' && ageMonths >= 0 && !Number.isNaN(ageMonths);

  useEffect(() => {
    if (embedded) return; // age seeded from the patient prop
    listPatients()
      .then((d) => {
        const list = d.patients.filter((p) => !p.archivedAt && p.dob);
        setPatients(list);
        const pid = params.get('patient');
        const preset = pid ? list.find((p) => p.id === pid) : undefined;
        if (preset?.dob) setAge(String(ageInMonths(preset.dob)));
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasAge) return;
    let cancelled = false;
    assessDevelopment({ ageMonths })
      .then((r) => !cancelled && setMilestones(r.milestones))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load milestones'));
    return () => {
      cancelled = true;
    };
  }, [ageMonths, hasAge]);

  function selectPatient(id: string) {
    const p = patients.find((x) => x.id === id);
    if (p?.dob) setAge(String(ageInMonths(p.dob)));
    setMilestones(null);
    setAchieved(new Set());
    setError(null);
  }

  function toggleAchieved(id: string) {
    setAchieved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const effStatus = (m: DevMilestone): MilestoneStatus => (achieved.has(m.id) ? 'achieved' : m.status);

  const counts = useMemo(() => {
    const c = { all: 0, achieved: 0, inwindow: 0, upcoming: 0, watch: 0 };
    if (!milestones) return c;
    c.all = milestones.length;
    for (const m of milestones) c[effStatus(m)] += 1;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones, achieved]);

  const flags = useMemo(() => {
    const watch: Record<MilestoneDomain, number> = { motor: 0, language: 0, social: 0 };
    if (milestones) for (const m of milestones) if (effStatus(m) === 'watch') watch[m.domain] += 1;
    return (['language', 'social', 'motor'] as MilestoneDomain[]).filter((d) => watch[d] > 0).map((d) => ({ domain: d, n: watch[d], text: FLAG_COPY[d](watch[d]) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones, achieved]);

  const FILTERS: SegmentOption<Filter>[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'watch', label: 'Review', count: counts.watch },
    { value: 'inwindow', label: 'In window', count: counts.inwindow },
    { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { value: 'achieved', label: 'Achieved', count: counts.achieved },
  ];

  return (
    <div ref={rootRef} className="space-y-5">
      {!embedded && (
      <Card data-entrance="hero" className="hero-aurora relative overflow-hidden p-6 sm:p-7">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-600">
              <Activity className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">WHO + general milestones · screening aid</p>
              <h1 className="mt-0.5 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-[1.75rem]">Development assessment</h1>
              {hasAge && <p className="mt-0.5 text-sm text-stone-500">{ageLabel(ageMonths)} reference window</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelClass}>Age (months)</label>
              <input type="number" inputMode="decimal" min={0} max={72} step={1} value={age} onChange={(e) => { setAge(e.target.value); setMilestones(null); setAchieved(new Set()); setError(null); }} placeholder="e.g. 9" className={cn(inputClass, 'w-28')} />
            </div>
            {patients.length > 0 && (
              <div>
                <label className={labelClass}>Patient</label>
                <select aria-label="Prefill age from patient" className={cn(inputClass, 'w-auto cursor-pointer font-semibold')} value="" onChange={(e) => e.target.value && selectPatient(e.target.value)}>
                  <option value="">Prefill age…</option>
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
      )}

      {error && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {!hasAge || !milestones ? (
        <Card data-entrance="card" className="p-10">
          <EmptyState icon={CalendarClock} text={embedded ? 'Add a date of birth to this patient’s record to load the milestone screen.' : 'Enter the child’s age (or pick a patient) to load the milestone screen.'} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <Kpi icon={AlertTriangle} label="Needs review" value={counts.watch} sub="past window" tone="rose" />
            <Kpi icon={Activity} label="In window" value={counts.inwindow} sub="emerging now" tone="sky" />
            <Kpi icon={CalendarClock} label="Upcoming" value={counts.upcoming} sub="ahead" tone="stone" />
            <Kpi icon={Check} label="Achieved" value={counts.achieved} sub="ticked off" tone="emerald" />
          </div>

          {/* red flags */}
          {flags.length > 0 ? (
            <SectionCard title="Red flags to review" icon={AlertTriangle} eyebrow="Screening prompts — not a diagnosis">
              <div className="space-y-2">
                {flags.map((f) => (
                  <div key={f.domain} className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{f.text}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <Sparkles className="h-4 w-4 shrink-0" />
              No milestones past their window for this age (with current ticks). Continue routine surveillance.
            </div>
          )}

          <SectionCard title="Milestones" icon={Activity} eyebrow="Tick what the child can already do">
            <div className="-mt-1 mb-4 overflow-x-auto pb-1">
              <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
            </div>

            <div className="space-y-6">
              {DOMAINS.map((dom) => {
                const items = milestones.filter((m) => m.domain === dom.key && (filter === 'all' || effStatus(m) === filter));
                if (items.length === 0) return null;
                return (
                  <div key={dom.key}>
                    <div className="mb-2.5 flex items-center gap-2">
                      <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', toneBadge[dom.tone])}>
                        <dom.icon className="h-4 w-4" />
                      </span>
                      <span className="font-display text-sm font-extrabold text-stone-800">{dom.label}</span>
                      <span className="h-px flex-1" style={{ background: 'var(--hairline)' }} />
                    </div>
                    <div className="space-y-2">
                      {items.map((m) => {
                        const s = effStatus(m);
                        const meta = STATUS_META[s];
                        const isAchieved = s === 'achieved';
                        return (
                          <div key={m.id} className="flex items-start gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--hairline)' }}>
                            <button
                              type="button"
                              onClick={() => toggleAchieved(m.id)}
                              aria-label={isAchieved ? 'Mark not achieved' : 'Mark achieved'}
                              aria-pressed={isAchieved}
                              className={cn(
                                'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors',
                                isAchieved ? 'border-green-600 bg-green-600 text-white' : 'border-stone-300 text-transparent hover:border-stone-400',
                              )}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p className={cn('font-semibold', isAchieved ? 'text-stone-400 line-through' : 'text-stone-800')}>{m.label}</p>
                                <span className="text-[0.66rem] font-bold uppercase tracking-wide text-stone-400">{windowLabel(m)}</span>
                                {m.source === 'WHO' && <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide text-stone-400">WHO</span>}
                              </div>
                              <p className="mt-0.5 text-xs text-stone-400">{m.description}</p>
                            </div>
                            <Pill tone={meta.tone}>{meta.label}</Pill>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <p className="px-1 text-xs leading-relaxed text-stone-400">
            A surveillance & screening aid using WHO and general developmental windows — <span className="font-semibold">not a diagnostic tool</span>. “Review” flags a milestone past its typical window; many healthy children vary. For any concern, use a validated tool (e.g. ASQ / M-CHAT-R) and refer to a developmental pediatrician. Ticking “achieved” is a session worksheet and is not saved.
          </p>
        </>
      )}
    </div>
  );
}
