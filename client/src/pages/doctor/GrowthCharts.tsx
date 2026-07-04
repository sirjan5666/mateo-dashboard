import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Baby, LineChart as LineChartIcon, Plus, TrendingUp, X } from 'lucide-react';
import { ApiError } from '../../api/client';
import { plotGrowth } from '../../api/doctorGrowth';
import type { Indicator, PlotInputPoint, PlotResult } from '../../api/doctorGrowth';
import { useSearchParams } from 'react-router';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import type { SegmentOption } from '../../components/ui/SegmentedControl';
import { buttonClass } from '../../components/ui/buttonStyles';
import { SectionCard, useChartTheme } from '../../components/panel/kit';
import type { ChartTheme } from '../../components/panel/kit';
import { cn } from '../../lib/cn';
import { useEntrance } from '../../lib/gsap';
import { ageInMonths } from '../../lib/age';
import { toolSex, type ToolPatient } from '../../components/doctor/tools/types';

type Sex = 'male' | 'female';

const MAX_MONTHS = 24; // WHO Child Growth Standards tables cover 0–24 months
const UNIT: Record<Indicator, string> = { weight: 'kg', length: 'cm', head: 'cm' };
const INDICATOR_LABEL: Record<Indicator, string> = { weight: 'Weight-for-age', length: 'Length-for-age', head: 'Head circ.-for-age' };

const SEX_OPTIONS: SegmentOption<Sex>[] = [
  { value: 'male', label: 'Boy' },
  { value: 'female', label: 'Girl' },
];
const INDICATOR_OPTIONS: SegmentOption<Indicator>[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'length', label: 'Length' },
  { value: 'head', label: 'Head circ.' },
];

const inputClass =
  'w-full rounded-xl border border-stone-200 bg-[var(--input-background)] px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400';

function bandLabel(p: number): string {
  if (p < 3) return 'Below 3rd';
  if (p < 15) return '3rd–15th';
  if (p < 50) return '15th–50th';
  if (p < 85) return '50th–85th';
  if (p < 97) return '85th–97th';
  return 'Above 97th';
}

function zoneTone(p: number): 'rose' | 'amber' | 'emerald' {
  if (p < 3 || p > 97) return 'rose';
  if (p < 15 || p > 85) return 'amber';
  return 'emerald';
}

// Most recent point that has the selected indicator (kept out of render's manual
// memo so the React Compiler can optimize the component on its own).
function findLatest(result: PlotResult | null, indicator: Indicator) {
  const list = result?.points ?? [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const m = list[i].metrics[indicator];
    if (m) return { ageMonths: list[i].ageMonths, ...m };
  }
  return null;
}

// ── WHO percentile chart (pro-themed) ────────────────────────────────────────
interface ChartRow {
  month: number;
  p3?: number;
  p15?: number;
  p50?: number;
  p85?: number;
  p97?: number;
  measured?: number;
}

function ChartTip({ active, payload, theme, unit }: { active?: boolean; payload?: { dataKey?: string | number; value?: number; payload?: ChartRow }[]; theme: ChartTheme; unit: string }) {
  if (!active || !payload) return null;
  const hit = payload.find((p) => p.dataKey === 'measured');
  if (!hit || hit.value == null) return null;
  const row = hit.payload ?? { month: 0 };
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-card" style={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, color: theme.tooltipText }}>
      <p className="font-bold">
        {hit.value} {unit}
      </p>
      <p style={{ opacity: 0.7 }}>{Math.round((row.month ?? 0) * 10) / 10} months</p>
    </div>
  );
}

function WhoChart({ result, indicator, theme }: { result: PlotResult | null; indicator: Indicator; theme: ChartTheme }) {
  const rows = useMemo<ChartRow[]>(() => {
    if (!result) return [];
    const bandRows: ChartRow[] = result.bands[indicator].map((b) => ({ month: b.month, p3: b.p3, p15: b.p15, p50: b.p50, p85: b.p85, p97: b.p97 }));
    const measured: ChartRow[] = result.points
      .filter((p) => p.metrics[indicator])
      .map((p) => ({ month: p.ageMonths, measured: p.metrics[indicator]!.value }));
    return [...bandRows, ...measured].sort((a, b) => a.month - b.month);
  }, [result, indicator]);

  const bandLine = (key: keyof ChartRow, width: number, dash?: string) => (
    <Line type="monotone" dataKey={key} stroke={theme.axis} strokeOpacity={key === 'p50' ? 0.9 : 0.45} strokeWidth={width} strokeDasharray={dash} dot={false} connectNulls isAnimationActive={false} />
  );

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis dataKey="month" type="number" domain={[0, MAX_MONTHS]} ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]} tick={{ fontSize: 11, fill: theme.axis }} tickLine={false} axisLine={{ stroke: theme.grid }} unit="m" />
        <YAxis tick={{ fontSize: 11, fill: theme.axis }} tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} unit={` ${UNIT[indicator]}`} />
        <Tooltip content={(props) => <ChartTip active={props.active} payload={props.payload as unknown as { dataKey?: string | number; value?: number; payload?: ChartRow }[]} theme={theme} unit={UNIT[indicator]} />} cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }} />
        {bandLine('p97', 1, '5 4')}
        {bandLine('p85', 1)}
        {bandLine('p50', 1.5)}
        {bandLine('p15', 1)}
        {bandLine('p3', 1, '5 4')}
        <Line type="monotone" dataKey="measured" stroke={theme.brand} strokeWidth={2.75} connectNulls isAnimationActive={false} dot={{ r: 4, fill: theme.brand, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
// `patient` present → embedded (sex + first-point age seeded from the patient;
// measurements are still typed — no stored growth series). No prop → standalone.
export default function GrowthCharts({ patient }: { patient?: ToolPatient } = {}) {
  const embedded = !!patient;
  const theme = useChartTheme();
  const rootRef = useEntrance<HTMLDivElement>([]);
  const [params] = useSearchParams();

  const [sex, setSex] = useState<Sex>(() => (patient ? toolSex(patient.sex) : 'male'));
  const [indicator, setIndicator] = useState<Indicator>('weight');
  const [points, setPoints] = useState<PlotInputPoint[]>([]);
  const [result, setResult] = useState<PlotResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);

  // entry fields
  const [ageM, setAgeM] = useState(() => (patient?.dob ? String(Math.min(MAX_MONTHS, ageInMonths(patient.dob))) : ''));
  const [weightKg, setWeightKg] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [headCm, setHeadCm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (embedded) return; // sex + first-point age seeded from the patient prop
    listPatients()
      .then((d) => {
        const list = d.patients.filter((p) => !p.archivedAt);
        setPatients(list);
        const pid = params.get('patient');
        const preset = pid ? list.find((p) => p.id === pid) : undefined;
        if (preset) {
          const s = (preset.sex || '').toLowerCase();
          if (s.startsWith('m')) setSex('male');
          else if (s.startsWith('f')) setSex('female');
          if (preset.dob) setAgeM(String(Math.min(MAX_MONTHS, ageInMonths(preset.dob))));
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute whenever the sex or the set of measurements changes. With zero
  // points this just returns the WHO reference bands, so the chart is never empty.
  useEffect(() => {
    let cancelled = false;
    plotGrowth({ sex, points })
      .then((r) => !cancelled && setResult(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not compute growth percentiles'));
    return () => {
      cancelled = true;
    };
  }, [sex, points]);

  function addPoint() {
    const age = Number(ageM);
    if (!ageM || Number.isNaN(age) || age < 0 || age > MAX_MONTHS) {
      setFormError('Enter an age between 0 and 24 months.');
      return;
    }
    const w = weightKg ? Number(weightKg) : undefined;
    const l = lengthCm ? Number(lengthCm) : undefined;
    const h = headCm ? Number(headCm) : undefined;
    if (w == null && l == null && h == null) {
      setFormError('Add at least one measurement.');
      return;
    }
    const point: PlotInputPoint = { ageMonths: age };
    if (w != null && !Number.isNaN(w)) point.weightG = Math.round(w * 1000);
    if (l != null && !Number.isNaN(l)) point.lengthCm = l;
    if (h != null && !Number.isNaN(h)) point.headCircCm = h;
    setPoints((prev) => [...prev, point]);
    setWeightKg('');
    setLengthCm('');
    setHeadCm('');
    setFormError(null);
  }

  function removePoint(i: number) {
    setPoints((prev) => prev.filter((_, idx) => idx !== i));
  }

  function selectPatient(id: string) {
    const p = patients.find((x) => x.id === id);
    if (!p) return;
    const s = (p.sex || '').toLowerCase();
    if (s.startsWith('m')) setSex('male');
    else if (s.startsWith('f')) setSex('female');
    if (p.dob) setAgeM(String(Math.min(MAX_MONTHS, ageInMonths(p.dob))));
  }

  const latest = findLatest(result, indicator);

  return (
    <div ref={rootRef} className="space-y-5">
      {/* header */}
      <Card data-entrance="card" className={cn('relative overflow-hidden', embedded ? 'p-3.5 sm:p-4' : 'hero-aurora p-6 sm:p-7')}>
        {!embedded && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {!embedded && (
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <TrendingUp className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">WHO Child Growth Standards · 0–24 mo</p>
              <h1 className="mt-0.5 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-[1.75rem]">Growth charts</h1>
            </div>
          </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {embedded && <span className="text-[0.66rem] font-bold uppercase tracking-wide text-stone-400">WHO 0–24 mo · sex</span>}
            <SegmentedControl options={SEX_OPTIONS} value={sex} onChange={setSex} />
            {patients.length > 0 && (
              <select aria-label="Prefill from patient" className={cn(inputClass, 'w-auto cursor-pointer font-semibold')} defaultValue="" onChange={(e) => e.target.value && selectPatient(e.target.value)}>
                <option value="">Prefill from patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Card>

      {error && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* entry column */}
        <div className="min-w-0 space-y-5">
          <SectionCard title="Add measurement" icon={Plus} eyebrow="Plot a point on the curve">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-500">Age (months)</label>
                <input type="number" inputMode="decimal" min={0} max={MAX_MONTHS} step={0.5} value={ageM} onChange={(e) => setAgeM(e.target.value)} placeholder="e.g. 12" className={inputClass} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-500">Weight (kg)</label>
                  <input type="number" inputMode="decimal" min={0} step={0.01} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="9.6" className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-500">Length (cm)</label>
                  <input type="number" inputMode="decimal" min={0} step={0.1} value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} placeholder="75" className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-500">Head (cm)</label>
                  <input type="number" inputMode="decimal" min={0} step={0.1} value={headCm} onChange={(e) => setHeadCm(e.target.value)} placeholder="46" className={inputClass} />
                </div>
              </div>
              {formError && <p className="text-xs font-medium text-rose-600">{formError}</p>}
              <button type="button" onClick={addPoint} className={buttonClass('primary', 'md', 'w-full justify-center')}>
                <Plus className="h-4 w-4" />
                Add measurement
              </button>
            </div>

            {points.length > 0 && (
              <div className="mt-4 space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
                {points.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-sm">
                    <span className="font-display font-bold tabular-nums text-stone-700">{p.ageMonths}m</span>
                    <span className="min-w-0 flex-1 truncate text-stone-500">
                      {[p.weightG != null ? `${(p.weightG / 1000).toFixed(2)}kg` : null, p.lengthCm != null ? `${p.lengthCm}cm` : null, p.headCircCm != null ? `HC ${p.headCircCm}` : null].filter(Boolean).join(' · ')}
                    </span>
                    <button type="button" onClick={() => removePoint(i)} aria-label="Remove" className="grid h-6 w-6 place-items-center rounded-lg text-stone-400 hover:bg-stone-200 hover:text-stone-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* current reading */}
          {latest && (
            <SectionCard title="Latest reading" icon={Baby} eyebrow={INDICATOR_LABEL[indicator]}>
              <div className="flex items-end gap-3">
                <span className="font-display text-4xl font-extrabold leading-none text-stone-900 tabular-nums">{Math.round(latest.percentile)}</span>
                <div className="pb-1">
                  <p className="text-sm font-bold text-stone-700">th percentile</p>
                  <p className="text-xs text-stone-400">z = {latest.z.toFixed(2)} · {latest.value} {UNIT[indicator]} at {latest.ageMonths}m</p>
                </div>
                <Pill tone={zoneTone(latest.percentile)} className="ml-auto">
                  {bandLabel(latest.percentile)}
                </Pill>
              </div>
              {latest.outOfRange && <p className="mt-2 text-xs text-amber-600">Age is outside the WHO 0–24 month tables — percentile is clamped.</p>}
            </SectionCard>
          )}
        </div>

        {/* chart column */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <SectionCard title="Percentile curves" icon={LineChartIcon}>
            <div className="-mt-1 mb-3 overflow-x-auto pb-1">
              <SegmentedControl options={INDICATOR_OPTIONS} value={indicator} onChange={setIndicator} />
            </div>
            <WhoChart result={result} indicator={indicator} theme={theme} />
            <p className="mt-2 text-center text-[0.7rem] text-stone-400">Reference bands: 3rd · 15th · 50th · 85th · 97th percentile (WHO). Your measurements are the bold line.</p>
          </SectionCard>

          {/* alerts */}
          {result && result.alerts.length > 0 && (
            <SectionCard title="Growth alerts" icon={AlertTriangle} eyebrow="WHO percentile zones">
              <div className="flex flex-wrap gap-2">
                {result.alerts.map((a, i) => (
                  <span key={i} className={cn('inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold', a.level === 'low' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700')}>
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {a.label} ({Math.round(a.percentile)}th)
                  </span>
                ))}
              </div>
            </SectionCard>
          )}

          {/* insights */}
          {result && result.insights.length > 0 && (
            <div className="space-y-2">
              {result.insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{ins.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="px-1 text-xs leading-relaxed text-stone-400">
        Based on the WHO Child Growth Standards (0–24 months, LMS method). This is a plotting and assessment aid for clinical interpretation — it reports percentile bands, crossings and zones, and does <span className="font-semibold">not</span> store measurements or prescribe target values. Clinical judgement remains the doctor’s.
      </p>
    </div>
  );
}
