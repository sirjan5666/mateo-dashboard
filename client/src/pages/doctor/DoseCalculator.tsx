import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, AlertTriangle, CheckCircle2, Droplets, Gauge, Info, Pill as PillIcon, Scale } from 'lucide-react';
import { ApiError } from '../../api/client';
import { getDosingCatalog, checkDose } from '../../api/dosing';
import type { DosingDrug, DoseCheckResponse, DoseLevel } from '../../api/dosing';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { Card } from '../../components/ui/Card';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import type { SegmentOption } from '../../components/ui/SegmentedControl';
import { SectionCard } from '../../components/panel/kit';
import { cn } from '../../lib/cn';
import { useEntrance } from '../../lib/gsap';
import { ageInMonths } from '../../lib/age';

type Tab = 'drug' | 'fluid';

const TABS: SegmentOption<Tab>[] = [
  { value: 'drug', label: 'Drug dose' },
  { value: 'fluid', label: 'IV fluids' },
];

const LEVEL_UI: Record<DoseLevel, { box: string; icon: LucideIcon; iconColor: string; label: string }> = {
  ok: { box: 'border-green-200 bg-green-50 text-green-800', icon: CheckCircle2, iconColor: 'text-green-600', label: 'In range' },
  info: { box: 'border-stone-200 bg-stone-50 text-stone-700', icon: Info, iconColor: 'text-stone-500', label: 'Note' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle, iconColor: 'text-amber-600', label: 'Caution' },
  danger: { box: 'border-rose-200 bg-rose-50 text-rose-700', icon: AlertCircle, iconColor: 'text-rose-600', label: 'Check' },
};

const inputClass =
  'w-full rounded-xl border border-stone-200 bg-[var(--input-background)] px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400';
const labelClass = 'mb-1 block text-[0.66rem] font-bold uppercase tracking-wide text-stone-400';

// ── Holliday-Segar maintenance fluids (deterministic, textbook) ───────────────
function maintenancePerDayMl(wt: number): number {
  if (wt <= 0) return 0;
  if (wt <= 10) return wt * 100;
  if (wt <= 20) return 1000 + (wt - 10) * 50;
  return 1500 + (wt - 20) * 20;
}
function maintenancePerHourMl(wt: number): number {
  if (wt <= 0) return 0;
  if (wt <= 10) return wt * 4;
  if (wt <= 20) return 40 + (wt - 10) * 2;
  return 60 + (wt - 20) * 1;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export default function DoseCalculator() {
  const rootRef = useEntrance<HTMLDivElement>([]);

  const [tab, setTab] = useState<Tab>('drug');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);

  const weightKg = parseFloat(weight);
  const ageMonths = parseFloat(age);
  const hasWeight = weightKg > 0;
  const hasAge = age !== '' && ageMonths >= 0 && !Number.isNaN(ageMonths);

  useEffect(() => {
    listPatients()
      .then((d) => setPatients(d.patients.filter((p) => !p.archivedAt && p.dob)))
      .catch(() => undefined);
  }, []);

  function selectPatient(id: string) {
    const p = patients.find((x) => x.id === id);
    if (p?.dob) setAge(String(ageInMonths(p.dob)));
  }

  return (
    <div ref={rootRef} className="space-y-5">
      <Card data-entrance="hero" className="hero-aurora relative overflow-hidden p-6 sm:p-7">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-600">
              <Gauge className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">Weight &amp; age based · pediatric reference</p>
              <h1 className="mt-0.5 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-[1.75rem]">Dose calculator</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelClass}>Weight (kg)</label>
              <input type="number" inputMode="decimal" min={0} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 9.5" className={cn(inputClass, 'w-28')} />
            </div>
            <div>
              <label className={labelClass}>Age (months)</label>
              <input type="number" inputMode="decimal" min={0} step={1} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 12" className={cn(inputClass, 'w-28')} />
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

        <div className="-mb-1 mt-5 overflow-x-auto pb-1">
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </div>
      </Card>

      {tab === 'drug' ? <DrugDose weightKg={hasWeight ? weightKg : undefined} ageMonths={hasAge ? ageMonths : undefined} /> : <Fluids weightKg={hasWeight ? weightKg : undefined} />}

      <p className="px-1 text-xs leading-relaxed text-stone-400">
        Decision-support only. Drug doses use a <span className="font-semibold">draft</span> reference database (pending clinical sign-off); IV-fluid figures use the Holliday-Segar maintenance, deficit and drip-rate formulas shown. Always verify against current references and the child’s full clinical picture — you remain responsible for every prescription.
      </p>
    </div>
  );
}

// ── drug dose ─────────────────────────────────────────────────────────────────
function DrugDose({ weightKg, ageMonths }: { weightKg?: number; ageMonths?: number }) {
  const [drugs, setDrugs] = useState<DosingDrug[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [drugId, setDrugId] = useState('');
  const [doseMg, setDoseMg] = useState('');
  const [perDay, setPerDay] = useState('');
  const [resp, setResp] = useState<DoseCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDosingCatalog()
      .then((d) => setDrugs(d.drugs))
      .catch(() => setCatalogError(true));
  }, []);

  const doseMgNum = parseFloat(doseMg);
  const perDayNum = parseInt(perDay, 10);

  useEffect(() => {
    if (!drugId || ageMonths == null) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      checkDose({ drugId, weightKg, ageMonths, doseMg: doseMgNum > 0 ? doseMgNum : undefined, dosesPerDay: perDayNum > 0 ? perDayNum : undefined })
        .then((r) => !cancelled && (setResp(r), setError(null)))
        .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not check the dose.'));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [drugId, weightKg, ageMonths, doseMgNum, perDayNum]);

  const drug = useMemo(() => drugs.find((d) => d.id === drugId), [drugs, drugId]);
  // Hide a stale result if the age was cleared (the effect won't refetch without it).
  const result = ageMonths != null ? resp?.result : undefined;
  const ui = result ? LEVEL_UI[result.level] : null;

  return (
    <SectionCard title="Drug dose" icon={PillIcon} eyebrow="Weight- & age-based recommendation">
      {catalogError ? (
        <p className="text-sm text-stone-500">Drug reference is unavailable right now.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={labelClass}>Medicine</span>
              <select value={drugId} onChange={(e) => { setDrugId(e.target.value); setResp(null); setError(null); }} className={cn(inputClass, 'cursor-pointer')}>
                <option value="">Select a medicine…</option>
                {drugs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.aka ? ` (${d.aka})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Planned dose (mg) — optional</span>
              <input value={doseMg} onChange={(e) => setDoseMg(e.target.value)} inputMode="decimal" placeholder="to validate" className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Times per day — optional</span>
              <input value={perDay} onChange={(e) => setPerDay(e.target.value)} inputMode="numeric" placeholder="e.g. 3" className={inputClass} />
            </label>
          </div>

          {drugId && ageMonths == null && <p className="mt-3 text-sm text-amber-600">Enter the child’s age (months) above to calculate.</p>}
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

          {result && ui && (
            <div className={cn('mt-4 rounded-2xl border p-4', ui.box)}>
              <div className="flex items-start gap-2.5">
                <ui.icon className={cn('mt-0.5 h-5 w-5 shrink-0', ui.iconColor)} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-bold">
                    {ui.label}
                    <span className="font-medium opacity-70">
                      {' · '}
                      {resp?.resolved.weightKg != null ? `${resp.resolved.weightKg} kg` : 'weight not entered'} · {resp?.resolved.ageMonths} mo
                    </span>
                  </p>
                  {result.recommendedSingleMg && (
                    <p className="mt-1 text-stone-700">
                      Usual single dose <span className="font-bold text-stone-900">{result.recommendedSingleMg.min}–{result.recommendedSingleMg.max} mg</span>
                      {result.usualFrequency ? `, ${result.usualFrequency}` : ''}
                      {result.recommendedDailyMaxMg != null ? ` · max ${result.recommendedDailyMaxMg} mg/day` : ''}
                    </p>
                  )}
                  {result.perKgPerDose && (
                    <p className="mt-0.5 text-xs text-stone-500">
                      {result.perKgPerDose.min}–{result.perKgPerDose.max} mg/kg/dose{!result.needsWeight && weightKg ? ` · for ${weightKg} kg` : ''}
                    </p>
                  )}
                  {result.messages.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {result.messages.map((m, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                          <span>{m.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {result && (result.contraindications.length > 0 || result.cautions.length > 0) && (
            <div className="mt-3 rounded-2xl border p-4 text-xs" style={{ borderColor: 'var(--hairline)' }}>
              {result.contraindications.length > 0 && (
                <>
                  <p className="font-bold text-stone-700">Check before prescribing</p>
                  <ul className="mt-1 space-y-0.5 text-stone-600">
                    {result.contraindications.map((c) => (
                      <li key={c} className="flex items-start gap-1.5">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" /> {c}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {result.cautions.length > 0 && <p className="mt-2 leading-relaxed text-stone-400">{result.cautions.join(' · ')}</p>}
            </div>
          )}

          {drug && (
            <p className="mt-3 text-[0.7rem] text-stone-400">
              Source: {drug.source} · {drug.reviewStatus === 'reviewed' ? 'clinically reviewed' : 'draft — verify'}
            </p>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ── IV fluids ────────────────────────────────────────────────────────────────
function Fluids({ weightKg }: { weightKg?: number }) {
  const [dehydration, setDehydration] = useState('5');
  const [dripVol, setDripVol] = useState('');
  const [dripHrs, setDripHrs] = useState('');
  const [dropFactor, setDropFactor] = useState('60');

  if (weightKg == null) {
    return (
      <SectionCard title="IV fluids" icon={Droplets}>
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <Scale className="h-4 w-4 shrink-0" />
          Enter the child’s weight above to calculate maintenance fluids.
        </div>
      </SectionCard>
    );
  }

  const perDay = maintenancePerDayMl(weightKg);
  const perHour = maintenancePerHourMl(weightKg);
  const pct = parseFloat(dehydration);
  const deficit = pct > 0 ? weightKg * pct * 10 : 0;
  const vol = parseFloat(dripVol);
  const hrs = parseFloat(dripHrs);
  const factor = parseInt(dropFactor, 10);
  const dripRate = vol > 0 && hrs > 0 ? (vol * factor) / (hrs * 60) : 0;
  const dripMlHr = vol > 0 && hrs > 0 ? vol / hrs : 0;

  const breakdown =
    weightKg <= 10
      ? `100 ml/kg × ${r1(weightKg)} kg`
      : weightKg <= 20
        ? `1000 + 50 ml/kg × ${r1(weightKg - 10)} kg`
        : `1500 + 20 ml/kg × ${r1(weightKg - 20)} kg`;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SectionCard title="Maintenance" icon={Droplets} eyebrow="Holliday-Segar">
        <div className="grid grid-cols-2 gap-3">
          <FluidStat value={Math.round(perDay)} unit="ml / day" />
          <FluidStat value={r1(perHour)} unit="ml / hour" />
        </div>
        <p className="mt-3 text-xs text-stone-400">{breakdown} = {Math.round(perDay)} ml/day · 4-2-1 rule = {r1(perHour)} ml/hr</p>
      </SectionCard>

      <SectionCard title="Deficit" icon={Scale} eyebrow="Estimated dehydration">
        <label className="block">
          <span className={labelClass}>Dehydration (%)</span>
          <input value={dehydration} onChange={(e) => setDehydration(e.target.value)} inputMode="decimal" className={cn(inputClass, 'w-32')} />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <FluidStat value={Math.round(deficit)} unit="ml deficit" />
          <FluidStat value={Math.round(deficit + perDay)} unit="ml + maintenance" />
        </div>
        <p className="mt-3 text-xs text-stone-400">{r1(weightKg)} kg × {pct || 0}% × 10 = {Math.round(deficit)} ml. Replace deficit alongside maintenance over 24 h (halve over first 8 h in moderate dehydration; clinical judgement applies).</p>
      </SectionCard>

      <SectionCard title="Drip rate" icon={Gauge} eyebrow="Manual giving-set" className="lg:col-span-2">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Volume (ml)</span>
            <input value={dripVol} onChange={(e) => setDripVol(e.target.value)} inputMode="decimal" placeholder="e.g. 500" className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Over (hours)</span>
            <input value={dripHrs} onChange={(e) => setDripHrs(e.target.value)} inputMode="decimal" placeholder="e.g. 6" className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Drop factor (gtt/ml)</span>
            <select value={dropFactor} onChange={(e) => setDropFactor(e.target.value)} className={cn(inputClass, 'cursor-pointer')}>
              <option value="60">60 — microdrip (paediatric)</option>
              <option value="20">20 — macrodrip</option>
              <option value="15">15 — macrodrip</option>
            </select>
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
          <FluidStat value={dripRate > 0 ? Math.round(dripRate) : 0} unit="drops / min" />
          <FluidStat value={dripMlHr > 0 ? r1(dripMlHr) : 0} unit="ml / hour" />
        </div>
        {vol > 0 && hrs > 0 && (
          <p className="mt-3 text-xs text-stone-400">
            ({vol} ml × {factor} gtt/ml) ÷ ({hrs} h × 60 min) = {Math.round(dripRate)} drops/min
          </p>
        )}
      </SectionCard>
    </div>
  );
}

function FluidStat({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="rounded-2xl border p-3.5" style={{ borderColor: 'var(--hairline)', background: 'var(--surface-sunken)' }}>
      <p className="font-display text-2xl font-extrabold leading-none text-stone-900 tabular-nums">{value.toLocaleString('en-IN')}</p>
      <p className="mt-1 text-xs font-semibold text-stone-500">{unit}</p>
    </div>
  );
}
