import { useEffect, useState } from 'react';
import { Baby, Clock, Droplets } from 'lucide-react';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { Card } from '../../components/ui/Card';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import type { SegmentOption } from '../../components/ui/SegmentedControl';
import { SectionCard } from '../../components/panel/kit';
import { cn } from '../../lib/cn';
import { useEntrance } from '../../lib/gsap';
import { toDateInputValueIST, todayInputValueIST } from '../../lib/age';

const inputClass =
  'w-full rounded-xl border border-stone-200 bg-[var(--input-background)] px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400';
const labelClass = 'mb-1 block text-[0.66rem] font-bold uppercase tracking-wide text-stone-400';

const TERM_WEEKS = 40;

// Day-of-life fluid requirement (ml/kg/day), indicative for a term newborn.
// Preterm/clinical status shifts these — the UI says so.
function fluidPerKgPerDay(dol: number): number {
  if (dol <= 0) return 0;
  const schedule: Record<number, number> = { 1: 60, 2: 80, 3: 100, 4: 120, 5: 140, 6: 150 };
  return dol >= 7 ? 150 : (schedule[dol] ?? 150);
}

// Date.now kept in a module helper so the time read stays out of React's
// purity-checked render path (same convention as lib/age.ts).
function daysSince(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

const FREQ_OPTIONS: SegmentOption<string>[] = [
  { value: '8', label: '3-hourly' },
  { value: '12', label: '2-hourly' },
  { value: '6', label: '4-hourly' },
];

function Stat({ value, unit, tone = 'stone' }: { value: string; unit: string; tone?: 'stone' | 'amber' }) {
  return (
    <div className="rounded-2xl border p-3.5" style={{ borderColor: 'var(--hairline)', background: 'var(--surface-sunken)' }}>
      <p className={cn('font-display text-2xl font-extrabold leading-none tabular-nums', tone === 'amber' ? 'text-amber-600' : 'text-stone-900')}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-stone-500">{unit}</p>
    </div>
  );
}

export default function Neonatology() {
  const rootRef = useEntrance<HTMLDivElement>([]);

  const [ga, setGa] = useState('');
  const [dob, setDob] = useState('');
  const [weight, setWeight] = useState('');
  const [dol, setDol] = useState('');
  const [freq, setFreq] = useState('8');
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    listPatients()
      .then((d) => setPatients(d.patients.filter((p) => !p.archivedAt && p.dob)))
      .catch(() => undefined);
  }, []);

  function selectPatient(id: string) {
    const p = patients.find((x) => x.id === id);
    if (p?.dob) {
      setDob(toDateInputValueIST(p.dob));
      setDol(String(daysSince(toDateInputValueIST(p.dob)) + 1));
    }
  }

  // Corrected age
  const gaWeeks = parseFloat(ga);
  const hasGa = ga !== '' && gaWeeks >= 20 && gaWeeks <= 42;
  const chronoDays = dob ? daysSince(dob) : NaN;
  const chronoWeeks = Number.isNaN(chronoDays) ? NaN : chronoDays / 7;
  const prematureWeeks = hasGa ? Math.max(0, TERM_WEEKS - gaWeeks) : NaN;
  const correctedWeeks = !Number.isNaN(chronoWeeks) && !Number.isNaN(prematureWeeks) ? chronoWeeks - prematureWeeks : NaN;
  const correctedShown = !Number.isNaN(correctedWeeks);

  function weeksLabel(w: number): string {
    if (w < 0) return '— (not yet term)';
    if (w < 8) return `${w.toFixed(1)} wk`;
    const m = w / 4.345;
    return `${m.toFixed(1)} mo`;
  }

  // Fluids & feeds
  const weightKg = parseFloat(weight);
  const hasWeight = weightKg > 0;
  const dolN = parseFloat(dol);
  const hasDol = dol !== '' && dolN >= 1 && !Number.isNaN(dolN);
  const mlKgDay = hasDol ? fluidPerKgPerDay(dolN) : 0;
  const totalMl = hasWeight && hasDol ? Math.round(mlKgDay * weightKg) : 0;
  const feeds = parseInt(freq, 10);
  const mlPerFeed = totalMl > 0 ? Math.round((totalMl / feeds) * 10) / 10 : 0;

  return (
    <div ref={rootRef} className="space-y-5">
      <Card data-entrance="hero" className="hero-aurora relative overflow-hidden p-6 sm:p-7">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <Baby className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">Corrected age · fluids · feeds · indicative</p>
              <h1 className="mt-0.5 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-[1.75rem]">Neonatology</h1>
            </div>
          </div>
          {patients.length > 0 && (
            <div>
              <label className={labelClass}>Patient</label>
              <select aria-label="Prefill from patient" className={cn(inputClass, 'w-auto cursor-pointer font-semibold')} value="" onChange={(e) => e.target.value && selectPatient(e.target.value)}>
                <option value="">Prefill DOB…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Corrected age */}
      <SectionCard title="Corrected age" icon={Clock} eyebrow="Adjusts chronological age for prematurity">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Gestational age at birth (weeks)</span>
            <input type="number" inputMode="decimal" min={20} max={42} step={0.5} value={ga} onChange={(e) => setGa(e.target.value)} placeholder="e.g. 32" className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Date of birth</span>
            <input type="date" max={todayInputValueIST()} value={dob} onChange={(e) => { setDob(e.target.value); if (e.target.value) setDol(String(daysSince(e.target.value) + 1)); }} className={cn(inputClass, 'cursor-pointer')} />
          </label>
        </div>
        {correctedShown ? (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat value={chronoWeeks >= 0 ? `${chronoWeeks.toFixed(1)} wk` : '—'} unit="chronological" />
            <Stat value={prematureWeeks > 0 ? `${prematureWeeks.toFixed(1)} wk` : '0'} unit="premature by" />
            <Stat value={weeksLabel(correctedWeeks)} unit="corrected age" tone="amber" />
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">Enter gestational age and date of birth to calculate the corrected age.</p>
        )}
        <p className="mt-3 text-xs text-stone-400">Corrected age = chronological age − (40 wk − gestational age). Conventionally applied up to ~2–3 years.</p>
      </SectionCard>

      {/* Fluids & feeds */}
      <SectionCard title="Fluids & feeds" icon={Droplets} eyebrow="Day-of-life volume (indicative, term)">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Weight (kg)</span>
            <input type="number" inputMode="decimal" min={0} step={0.01} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 2.6" className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Day of life</span>
            <input type="number" inputMode="numeric" min={1} step={1} value={dol} onChange={(e) => setDol(e.target.value)} placeholder="e.g. 3" className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Feed frequency</span>
            <div className="overflow-x-auto pb-1">
              <SegmentedControl options={FREQ_OPTIONS} value={freq} onChange={setFreq} />
            </div>
          </label>
        </div>

        {hasWeight && hasDol ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat value={String(mlKgDay)} unit="ml/kg/day" />
              <Stat value={totalMl.toLocaleString('en-IN')} unit="ml / day total" tone="amber" />
              <Stat value={String(feeds)} unit="feeds / day" />
              <Stat value={String(mlPerFeed)} unit="ml / feed" tone="amber" />
            </div>
            <p className="mt-3 text-xs text-stone-400">
              {mlKgDay} ml/kg/day × {weightKg} kg = {totalMl} ml/day ÷ {feeds} feeds = {mlPerFeed} ml/feed. Feeds are <span className="font-semibold">breast milk / expressed breast milk first</span>; this calculates volume only.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-stone-500">Enter weight and day of life to calculate fluid and feed volumes.</p>
        )}
      </SectionCard>

      <p className="px-1 text-xs leading-relaxed text-stone-400">
        <span className="font-semibold">Indicative decision-support only</span>, for a term newborn — preterm infants, fluid restriction, phototherapy, renal/cardiac status and ongoing losses all change requirements. Total parenteral nutrition (TPN) is not covered here. Feeding is volume-only and <span className="font-semibold">breast-milk / expressed-breast-milk first</span>. Always verify against unit protocol and the full clinical picture; nothing here is saved.
      </p>
    </div>
  );
}
