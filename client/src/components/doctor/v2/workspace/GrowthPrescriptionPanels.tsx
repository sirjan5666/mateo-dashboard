import { useMemo, useState } from 'react';
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  AlertCircle, AlertTriangle, ChevronRight, CircleCheck, Info, Plus, Printer, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../../../auth/context';
import { createPrescription, listPrescriptions, updatePrescription } from '../../../../api/doctorPrescriptions';
import type { Prescription } from '../../../../api/doctorPrescriptions';
import { plotGrowth } from '../../../../api/doctorGrowth';
import type { BandPoint, Indicator, PlotResult } from '../../../../api/doctorGrowth';
import { createGrowthRecord, deleteGrowthRecord, listGrowthRecords } from '../../../../api/doctorPatientClinical';
import type { GrowthRecord } from '../../../../api/doctorPatientClinical';
import { RowMenu } from '../RowMenu';
import { CARD, Dash, H2, PanelState, Tile, swatch, useLoad, wsDate } from './shared';
import type { WorkspacePanelProps } from './shared';
import { cn } from '../../../../lib/cn';

const CHART_H = 300;
const X_AXIS_H = 30;
const CHART_MARGIN = { top: 10, right: 24, bottom: 4, left: -14 };

const CURVE_META: { key: keyof Omit<BandPoint, 'month'>; label: string; color: string }[] = [
  { key: 'p97', label: '97th percentile', color: '#12A150' },
  { key: 'p85', label: '85th percentile', color: '#12A150' },
  { key: 'p50', label: '50th percentile', color: '#2B6FF0' },
  { key: 'p15', label: '15th percentile', color: '#F59E0B' },
  { key: 'p3', label: '3rd percentile', color: '#EF4444' },
];

/** 15.0 must not print as "15" in a column where its neighbours carry a decimal. */
const d1 = (v: number | null | undefined) => (v == null ? null : v.toFixed(1));

type Metric = 'Weight' | 'Height' | 'BMI' | 'Head Circumference';

const METRICS: Metric[] = ['Weight', 'Height', 'BMI', 'Head Circumference'];

/** Which WHO indicator backs each metric. BMI has no WHO band in this dataset. */
const INDICATOR: Record<Metric, Indicator | null> = {
  Weight: 'weight',
  Height: 'length',
  BMI: null,
  'Head Circumference': 'head',
};

const UNIT: Record<Metric, string> = { Weight: 'kg', Height: 'cm', BMI: '', 'Head Circumference': 'cm' };

const valueOf = (r: GrowthRecord, m: Metric): number | null => {
  if (m === 'Weight') return r.weightKg;
  if (m === 'Height') return r.heightCm;
  if (m === 'BMI') return r.bmi;
  return r.headCircumferenceCm;
};

/** Whole months between two dates — WHO tables are indexed by completed months. */
function monthsBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO);
  const b = new Date(toISO);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

function ageLabel(dob: string | null | undefined, at: string): string {
  if (!dob) return '—';
  const m = monthsBetween(dob, at);
  return `${Math.floor(m / 12)}y ${m % 12}m`;
}

/**
 * The band row for a given age, or null when the age is outside the WHO table
 * this app carries (0–24 months).
 *
 * The server CLAMPS out-of-range ages to the last tabulated month, so drawing
 * that row for an older child would put a percentile line on the chart that is
 * simply wrong for their age. Better to draw no band than a misleading one.
 */
function bandAt(rows: BandPoint[], month: number): BandPoint | null {
  if (!rows.length) return null;
  const last = rows[rows.length - 1].month;
  if (month < rows[0].month || month > last) return null;
  return rows.reduce((best, r) => (Math.abs(r.month - month) < Math.abs(best.month - month) ? r : best), rows[0]);
}

// ── 18 · Growth Charts ───────────────────────────────────────────────────────

export function GrowthChartsPanel({ patientId, patientName, dob, sex }: WorkspacePanelProps) {
  const [metric, setMetric] = useState<Metric>('Weight');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ takenAt: new Date().toISOString().slice(0, 10), weightKg: '', heightCm: '', headCircumferenceCm: '' });
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const plottable = (sex === 'male' || sex === 'female') && !!dob;

  const { data, loading, error, reload } = useLoad(
    async () => {
      const { records } = await listGrowthRecords(patientId);
      // Newest first from the server; the chart reads oldest → newest.
      const chrono = [...records].sort((a, b) => a.takenAt.localeCompare(b.takenAt));

      // WHO percentiles come from the server's own LMS tables (hard rule 3) and
      // are computed, never stored. The plotter only covers 0–60 months, so
      // out-of-range points are charted without a band rather than dropped.
      let plot: PlotResult | null = null;
      if (plottable) {
        const points = chrono
          .map((r) => ({ r, ageMonths: monthsBetween(dob as string, r.takenAt) }))
          .filter(({ r, ageMonths }) => ageMonths <= 60 && (r.weightKg != null || r.heightCm != null || r.headCircumferenceCm != null))
          .slice(-40)
          .map(({ r, ageMonths }) => ({
            ageMonths,
            weightG: r.weightKg != null ? Math.round(r.weightKg * 1000) : undefined,
            lengthCm: r.heightCm ?? undefined,
            headCircCm: r.headCircumferenceCm ?? undefined,
          }));
        if (points.length) {
          try {
            plot = await plotGrowth({ sex: sex as 'male' | 'female', points });
          } catch {
            // A measurement outside the WHO table's range 400s. The records and
            // the chart still render — only the percentile bands are missing.
            plot = null;
          }
        }
      }
      return { records, chrono, plot };
    },
    [patientId, dob, sex, plottable],
  );

  const records = useMemo(() => data?.records ?? [], [data]);
  const chrono = useMemo(() => data?.chrono ?? [], [data]);
  const plot = data?.plot ?? null;

  const indicator = INDICATOR[metric];
  const bands = indicator && plot ? plot.bands[indicator] : null;

  const chartRows = useMemo(
    () => chrono
      .map((r) => {
        const v = valueOf(r, metric);
        if (v == null) return null;
        const month = dob ? monthsBetween(dob, r.takenAt) : 0;
        const b = bands ? bandAt(bands, month) : null;
        return {
          label: wsDate(r.takenAt),
          patient: v,
          p97: b?.p97, p85: b?.p85, p50: b?.p50, p15: b?.p15, p3: b?.p3,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null),
    [chrono, metric, bands, dob],
  );

  /** True only when at least one point actually landed inside the WHO table. */
  const hasBands = useMemo(
    () => chartRows.some((r) => typeof r.p50 === 'number'),
    [chartRows],
  );

  const domain = useMemo(() => {
    const vals: number[] = [];
    for (const r of chartRows) {
      vals.push(r.patient);
      for (const c of CURVE_META) {
        const v = r[c.key];
        if (typeof v === 'number') vals.push(v);
      }
    }
    if (!vals.length) return null;
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max(0.5, (hi - lo) * 0.1);
    return [Math.floor(lo - pad), Math.ceil(hi + pad)] as [number, number];
  }, [chartRows]);

  const latest = records[0] ?? null;

  /** Percentile + z for the newest point, straight from the WHO plotter. */
  const latestMetrics = useMemo(() => {
    if (!plot?.points.length) return null;
    return plot.points[plot.points.length - 1].metrics;
  }, [plot]);

  /**
   * The plotter CLAMPS ages past the end of the WHO 0–24 month table, so a flag
   * computed from a clamped point is arithmetic about a 24-month-old, not about
   * this child. Only in-range flags are surfaced.
   */
  const flags = useMemo(() => {
    if (!plot) return { alerts: [] as PlotResult['alerts'], insights: [] as PlotResult['insights'] };
    const inRange = (ind: Indicator) => {
      const m = latestMetrics?.[ind];
      return !!m && !m.outOfRange;
    };
    return {
      alerts: plot.alerts.filter((a) => inRange(a.indicator)),
      insights: plot.insights.filter((i) => inRange(i.indicator)),
    };
  }, [plot, latestMetrics]);

  async function save() {
    const w = form.weightKg.trim() ? Number(form.weightKg) : undefined;
    const h = form.heightCm.trim() ? Number(form.heightCm) : undefined;
    const hc = form.headCircumferenceCm.trim() ? Number(form.headCircumferenceCm) : undefined;
    if (w === undefined && h === undefined && hc === undefined) {
      setWriteError('Enter at least one measurement');
      return;
    }
    setSaving(true);
    setWriteError(null);
    try {
      await createGrowthRecord(patientId, {
        takenAt: new Date(`${form.takenAt}T00:00:00`).toISOString(),
        weightKg: w, heightCm: h, headCircumferenceCm: hc,
      });
      setForm({ takenAt: new Date().toISOString().slice(0, 10), weightKg: '', heightCm: '', headCircumferenceCm: '' });
      setAdding(false);
      reload();
    } catch (e: unknown) {
      setWriteError(e instanceof Error ? e.message : 'Could not save the measurement');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setWriteError(null);
    try {
      await deleteGrowthRecord(patientId, id);
      reload();
    } catch (e: unknown) {
      setWriteError(e instanceof Error ? e.message : 'Could not delete the measurement');
    }
  }

  const summaryRows: { metric: Metric; value: number | null; indicator: Indicator | null }[] = METRICS.map((m) => ({
    metric: m,
    value: latest ? valueOf(latest, m) : null,
    indicator: INDICATOR[m],
  }));

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <div className="flex min-w-0 flex-col gap-5">
        <section className={`${CARD} px-[22px] pb-[18px] pt-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className={H2}>Growth Charts</h2>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setAdding((v) => !v)}
                className="flex h-[42px] items-center gap-2 rounded-[10px] px-5 text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
                style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
                <Plus className="h-[17px] w-[17px]" />
                <span className="text-[13px] font-bold">Add Measurement</span>
              </button>
            </div>
          </div>

          {adding && (
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-[12px] border border-[#E4E8F1] bg-[#FAFBFD] p-4 sm:grid-cols-4">
              {([
                ['takenAt', 'Date', 'date'],
                ['weightKg', 'Weight (kg)', 'number'],
                ['heightCm', 'Height (cm)', 'number'],
                ['headCircumferenceCm', 'Head circ. (cm)', 'number'],
              ] as const).map(([key, label, type]) => (
                <div key={key}>
                  <label htmlFor={`g-${key}`} className="block text-[11.5px] font-semibold text-[#64748B]">{label}</label>
                  <input id={`g-${key}`} type={type} step="0.1" value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1.5 h-10 w-full rounded-[10px] border border-[#E4E8F1] bg-white px-3 text-[13px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
                </div>
              ))}
              <div className="col-span-2 flex items-center gap-3 sm:col-span-4">
                <button type="button" disabled={saving} onClick={() => void save()}
                  className="h-10 rounded-[10px] px-5 text-[13px] font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
                  {saving ? 'Saving…' : 'Save Measurement'}
                </button>
                <button type="button" onClick={() => setAdding(false)}
                  className="h-10 rounded-[10px] border border-[#E2E6F0] bg-white px-5 text-[13px] font-bold text-[#1E2A5A]">
                  Cancel
                </button>
                <p className="text-[11.5px] text-[#64748B]">BMI is calculated from weight and height.</p>
              </div>
            </div>
          )}

          {writeError && (
            <p role="alert" className="mt-3 rounded-[10px] border border-[#F5C2C2] bg-[#FDF2F2] px-4 py-2.5 text-[12.5px] font-medium text-[#B42318]">
              {writeError}
            </p>
          )}

          <div role="radiogroup" aria-label="Growth metric" className="mt-4 flex flex-wrap gap-1.5">
            {METRICS.map((m) => (
              <button key={m} role="radio" type="button" aria-checked={metric === m} onClick={() => setMetric(m)}
                className={cn('h-10 rounded-[10px] px-[22px] text-[13.5px] transition-colors',
                  metric === m ? 'border-[1.5px] border-[#6366F1] bg-[#F0EFFE] font-bold text-[#3B4FE0]' : 'border border-[#E2E6F0] bg-white font-semibold text-[#334155] hover:bg-[#F7F8FC]')}>
                {m}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <PanelState loading={loading} error={error} empty={!chartRows.length}
              emptyText={records.length ? `No ${metric.toLowerCase()} recorded yet.` : 'No measurements recorded — add the first one.'} />
          </div>

          {chartRows.length > 0 && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-x-[22px] gap-y-2">
                <span className="text-[12.5px] font-semibold text-[#334155]">
                  {metric}{UNIT[metric] ? ` (${UNIT[metric]})` : ''}
                </span>
                <span className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                  <span aria-hidden="true" className="h-[2.5px] w-[18px] rounded-full bg-[#4F46E5]" />
                  {patientName}
                </span>
                {hasBands && CURVE_META.map((c) => (
                  <span key={c.key} className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                    <span aria-hidden="true" className="h-0 w-[18px] border-t-2 border-dashed" style={{ borderColor: c.color }} />
                    {c.label}
                  </span>
                ))}
              </div>

              <div className="mt-3.5" style={{ height: CHART_H }}>
                <div role="img" aria-label={`${metric} over time for ${patientName}`} className="h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartRows} margin={CHART_MARGIN}>
                      <defs>
                        <linearGradient id="gws" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.08} />
                          <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                      <XAxis dataKey="label" height={X_AXIS_H} tick={{ fontSize: 10.5, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis domain={domain ?? ['auto', 'auto']} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                      {hasBands && CURVE_META.map((c) => (
                        <Line key={c.key} type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={false} connectNulls />
                      ))}
                      <Area type="monotone" dataKey="patient" stroke="#4F46E5" strokeWidth={2.5} fill="url(#gws)"
                        dot={{ r: 4, fill: '#4F46E5', stroke: '#FFFFFF', strokeWidth: 1.5 }} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <table className="sr-only">
                <caption>{metric} by date with percentile bands</caption>
                <thead><tr><th>Date</th><th>{patientName}</th><th>50th percentile</th></tr></thead>
                <tbody>{chartRows.map((d) => <tr key={d.label}><td>{d.label}</td><td>{d.patient}</td><td>{d.p50 == null ? '—' : d1(d.p50)}</td></tr>)}</tbody>
              </table>

              <p className="mt-3.5 flex items-start gap-2.5 text-xs text-[#64748B]">
                <Info aria-hidden="true" className="mt-px h-[15px] w-[15px] shrink-0 text-[#94A3B8]" />
                {hasBands
                  ? 'Percentile bands are WHO Child Growth Standards, computed server-side from the recorded measurements.'
                  : metric === 'BMI'
                    ? 'BMI is charted as measured — this app carries no WHO BMI-for-age band.'
                    : 'No percentile band shown: this app carries the WHO tables for ages 0–24 months, and needs a recorded sex and date of birth.'}
              </p>
            </>
          )}
        </section>

        {/* Growth Records */}
        {records.length > 0 && (
          <section className={`${CARD} pb-4 pt-5`}>
            <h2 className={cn(H2, 'px-[22px]')}>Growth Records</h2>
            <div className="mt-3.5 overflow-x-auto">
              <table className="w-full min-w-[840px] border-separate border-spacing-0">
                <caption className="sr-only">Growth measurement records</caption>
                <thead>
                  <tr>
                    {['Date', 'Age', 'Weight (kg)', 'Height (cm)', <>BMI (kg/m<sup>2</sup>)</>, 'Head Circumference (cm)', 'Recorded By', ''].map((h, i) => (
                      <th key={i} scope="col" className={cn('h-[38px] border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]', i === 0 && 'pl-[22px]')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r.id} className="hover:bg-[#FAFBFF]">
                      <th scope="row" className="h-[42px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left text-[12.5px] font-medium text-[#334155]">{wsDate(r.takenAt)}</th>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{ageLabel(dob, r.takenAt)}</td>
                      {(['Weight', 'Height', 'BMI', 'Head Circumference'] as Metric[]).map((m) => {
                        const v = d1(valueOf(r, m));
                        return (
                          <td key={m} className={cn('border-b border-[#F1F3F9] pr-3 text-[12.5px]', i === 0 && metric === m ? 'font-bold text-[#3B4FE0]' : 'font-semibold text-[#0F172A]')}>
                            {v ?? <Dash say="Not measured" />}
                          </td>
                        );
                      })}
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{r.recordedBy ?? '—'}</td>
                      <td className="border-b border-[#F1F3F9] pr-[22px]">
                        <RowMenu label={`Actions for record on ${wsDate(r.takenAt)}`} size={30}
                          items={[{ label: 'Delete Record', danger: true, onSelect: () => void remove(r.id) }]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* ── Right rail ── */}
      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <TrendingUp aria-hidden="true" className="h-[17px] w-[17px] text-[#12A150]" />
            <h2 className={H2}>Latest Measurements</h2>
          </div>
          {latest ? (
            <>
              <p className="mt-3 text-[12.5px] text-[#64748B]">Recorded {wsDate(latest.takenAt)}</p>
              <div className="my-3.5 h-px bg-[#F1F3F9]" />
              <dl className="flex flex-col gap-4">
                {summaryRows.map((r) => {
                  // `outOfRange` means the server clamped the age to the end of
                  // the WHO 0–24 month table. That percentile is not this
                  // child's percentile, so it is not shown at all.
                  const raw = r.indicator && latestMetrics ? latestMetrics[r.indicator] : undefined;
                  const pm = raw && !raw.outOfRange ? raw : undefined;
                  const sw = swatch(r.metric);
                  return (
                    <div key={r.metric} className="flex items-center gap-3">
                      <Tile icon={r.metric === 'Weight' ? 'Scale' : r.metric === 'Height' ? 'Ruler' : 'FileText'} tint={sw.tint} fg={sw.fg} size={28} glyph={15} radius={8} />
                      <div className="min-w-0 flex-1">
                        <dt className="text-[12.5px] font-bold text-[#0F172A]">{r.metric}</dt>
                        <dd className="text-[11.5px] text-[#64748B]">
                          {r.value != null ? `${d1(r.value)}${UNIT[r.metric] ? ` ${UNIT[r.metric]}` : ''}` : 'Not measured'}
                          {pm ? ` • ${Math.round(pm.percentile)}th percentile` : ''}
                        </dd>
                      </div>
                      {pm && <span className="shrink-0 text-[11.5px] font-bold text-[#64748B]">z {pm.z > 0 ? '+' : ''}{pm.z}</span>}
                    </div>
                  );
                })}
              </dl>
            </>
          ) : (
            <p className="mt-3.5 rounded-[11px] bg-[#F7F8FC] px-4 py-6 text-center text-[12.5px] font-medium text-[#64748B]">
              No measurements recorded.
            </p>
          )}
        </section>

        {/*
          WHO growth-alert zones and percentile-crossing insights, both computed
          server-side. Hard rule 3: these flag crossings and band position — they
          never state a target weight.
        */}
        {plot && (flags.alerts.length > 0 || flags.insights.length > 0) && (
          <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
            <div className="flex items-center gap-2.5">
              <AlertTriangle aria-hidden="true" className="h-[17px] w-[17px] text-[#E8890B]" />
              <h2 className={H2}>Growth Flags</h2>
            </div>
            <ul className="mt-3.5 flex flex-col gap-2.5">
              {flags.alerts.map((a) => (
                <li key={`${a.indicator}-${a.level}`} className="flex items-start gap-2.5 rounded-[11px] bg-[#FDF2F2] px-4 py-3">
                  <AlertTriangle aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-[#EF4444]" />
                  <span className="text-[12.5px] leading-5 text-[#475569]">{a.label} ({a.percentile}th)</span>
                </li>
              ))}
              {flags.insights.map((ins) => (
                <li key={`${ins.indicator}-${ins.kind}`} className="flex items-start gap-2.5 rounded-[11px] bg-[#FEF7E6] px-4 py-3">
                  <Info aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-[#E8890B]" />
                  <span className="text-[12.5px] leading-5 text-[#475569]">{ins.message}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {plot && flags.alerts.length === 0 && flags.insights.length === 0 && (
          <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
            <div className="flex items-center gap-2.5">
              {hasBands
                ? <CircleCheck aria-hidden="true" className="h-[17px] w-[17px] text-[#12A150]" />
                : <Info aria-hidden="true" className="h-[17px] w-[17px] text-[#94A3B8]" />}
              <h2 className={H2}>Growth Flags</h2>
            </div>
            {/*
              "No flags" and "cannot compute flags" are different statements. A
              child past 24 months has no WHO reference here, so claiming a clean
              screen would be a clinical assertion this app cannot make.
            */}
            <p className="mt-3 text-[12.5px] leading-5 text-[#475569]">
              {hasBands
                ? 'No WHO alert zones or percentile crossings in the recorded measurements.'
                : 'Not assessed — the WHO reference in this app covers ages 0–24 months.'}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

// ── 20 · Prescriptions ───────────────────────────────────────────────────────

/** One prescription = every medication the doctor wrote on the same date. */
interface RxGroup {
  date: string;
  items: Prescription[];
}

function groupByDate(rows: Prescription[]): RxGroup[] {
  const map = new Map<string, Prescription[]>();
  for (const r of rows) {
    const key = r.date.slice(0, 10);
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return [...map.entries()]
    .map(([date, items]) => ({ date, items }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

const BLANK_MED = { drug: '', dose: '', frequency: '', duration: '', instructions: '' };

export function PrescriptionsPanel({ patientId, patientName }: WorkspacePanelProps) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [med, setMed] = useState(BLANK_MED);
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const { data, loading, error, reload } = useLoad(() => listPrescriptions(patientId), [patientId]);
  const groups = useMemo(() => groupByDate(data?.prescriptions ?? []), [data]);
  const current = groups.find((g) => g.date === selected) ?? groups[0] ?? null;

  const doctorName = user?.name ?? 'Doctor';
  const doctorInitials = doctorName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  async function save() {
    if (!med.drug.trim()) {
      setWriteError('Medicine name is required');
      return;
    }
    setSaving(true);
    setWriteError(null);
    try {
      await createPrescription(patientId, {
        drug: med.drug.trim(),
        dose: med.dose.trim() || undefined,
        frequency: med.frequency.trim() || undefined,
        duration: med.duration.trim() || undefined,
        instructions: med.instructions.trim() || undefined,
      });
      setMed(BLANK_MED);
      setAdding(false);
      setSelected(null);
      reload();
    } catch (e: unknown) {
      setWriteError(e instanceof Error ? e.message : 'Could not save the medication');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: 'active' | 'completed' | 'stopped') {
    setWriteError(null);
    try {
      await updatePrescription(id, { status });
      reload();
    } catch (e: unknown) {
      setWriteError(e instanceof Error ? e.message : 'Could not update the medication');
    }
  }

  const activeCount = (data?.prescriptions ?? []).filter((p) => p.status === 'active').length;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <section className={`${CARD} min-w-0 px-[22px] pb-[22px] pt-[18px]`}>
        <div className="flex flex-wrap items-center gap-3">
          <Tile icon="FileText" tint="#EEF1FE" fg="#4F46E5" size={34} glyph={17} radius={9} />
          <h2 className="font-display text-[17px] font-extrabold tracking-[-0.02em] text-[#0F172A]">Prescriptions</h2>
          <div className="ml-auto flex flex-wrap items-center gap-[11px]">
            <button type="button" onClick={() => window.print()} className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
              <Printer className="h-4 w-4 text-[#334155]" />
              <span className="text-[13px] font-bold text-[#1E2A5A]">Print</span>
            </button>
            <button type="button" onClick={() => setAdding((v) => !v)}
              className="flex h-[42px] items-center gap-2 rounded-[10px] px-5 text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
              <Plus className="h-[17px] w-[17px]" />
              <span className="text-[13px] font-bold">Add Medication</span>
            </button>
          </div>
        </div>

        {adding && (
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-[12px] border border-[#E4E8F1] bg-[#FAFBFD] p-4 sm:grid-cols-2 lg:grid-cols-5">
            {([
              ['drug', 'Medicine'],
              ['dose', 'Dose'],
              ['frequency', 'Frequency'],
              ['duration', 'Duration'],
              ['instructions', 'Instructions'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`rx-${key}`} className="block text-[11.5px] font-semibold text-[#64748B]">{label}</label>
                <input id={`rx-${key}`} value={med[key]} onChange={(e) => setMed((m) => ({ ...m, [key]: e.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-[10px] border border-[#E4E8F1] bg-white px-3 text-[13px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
              </div>
            ))}
            <div className="flex items-center gap-3 lg:col-span-5">
              <button type="button" disabled={saving} onClick={() => void save()}
                className="h-10 rounded-[10px] px-5 text-[13px] font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
                {saving ? 'Saving…' : 'Save Medication'}
              </button>
              <button type="button" onClick={() => setAdding(false)}
                className="h-10 rounded-[10px] border border-[#E2E6F0] bg-white px-5 text-[13px] font-bold text-[#1E2A5A]">
                Cancel
              </button>
            </div>
          </div>
        )}

        {writeError && (
          <p role="alert" className="mt-3 rounded-[10px] border border-[#F5C2C2] bg-[#FDF2F2] px-4 py-2.5 text-[12.5px] font-medium text-[#B42318]">
            {writeError}
          </p>
        )}

        <div className="mt-4">
          <PanelState loading={loading} error={error} empty={!current}
            emptyText={`No prescriptions written for ${patientName} yet.`} />
        </div>

        {current && (
          <>
            <dl className="mt-4 grid grid-cols-1 gap-6 rounded-[12px] bg-[#F7F8FC] px-[22px] py-[18px] sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="text-[11.5px] font-medium text-[#64748B]">Prescription Date</dt>
                <dd className="mt-[7px] text-sm font-bold text-[#0F172A]">{wsDate(current.items[0].date)}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-medium text-[#64748B]">Medicines</dt>
                <dd className="mt-[7px] text-sm font-bold text-[#0F172A]">{current.items.length}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-medium text-[#64748B]">Prescribed By</dt>
                <dd className="mt-[7px] flex items-center gap-2.5">
                  <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EDE9FE] text-[11px] font-bold text-[#6D5AE0]">{doctorInitials}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-bold text-[#0F172A]">{doctorName}</span>
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-medium text-[#64748B]">Still Active</dt>
                <dd className="mt-[7px] text-sm font-bold text-[#0F172A]">
                  {current.items.filter((i) => i.status === 'active').length} of {current.items.length}
                </dd>
              </div>
            </dl>

            <h3 className={cn(H2, 'mt-[22px]')}>Medications</h3>
            <div className="mt-3.5 overflow-x-auto rounded-[11px] border border-[#ECEEF4]">
              <table className="w-full min-w-[760px] border-separate border-spacing-0">
                <caption className="sr-only">Prescribed medications</caption>
                <thead>
                  <tr>
                    {['Medicine', 'Dose', 'Frequency', 'Duration', 'Instructions', 'Status', ''].map((h, i) => (
                      <th key={h} scope="col" className={cn('h-10 bg-[#F7F8FC] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]', i === 0 && 'pl-[18px]')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.items.map((m) => {
                    const sw = swatch(m.drug);
                    const st = m.status === 'active'
                      ? { bg: '#DCF7E6', fg: '#12A150' }
                      : m.status === 'completed'
                        ? { bg: '#EAF0FE', fg: '#2B6FF0' }
                        : { bg: '#F1F5F9', fg: '#64748B' };
                    return (
                      <tr key={m.id}>
                        <th scope="row" className="h-[59px] border-t border-[#F1F3F9] pl-[18px] pr-3 text-left font-normal">
                          <span className="flex items-center gap-3">
                            <Tile icon="Pill" tint={sw.tint} fg={sw.fg} size={30} glyph={15} radius={8} />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-bold text-[#0F172A]">{m.drug}</span>
                            </span>
                          </span>
                        </th>
                        <td className="border-t border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.dose ?? <Dash say="No dose specified" />}</td>
                        <td className="border-t border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.frequency ?? <Dash say="No frequency specified" />}</td>
                        <td className="border-t border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.duration ?? <Dash say="No duration specified" />}</td>
                        <td className="border-t border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.instructions ?? <Dash say="No instructions" />}</td>
                        <td className="border-t border-[#F1F3F9] pr-3">
                          <span className="inline-block rounded-[7px] px-[11px] py-[5px] text-[11.5px] font-bold" style={{ background: st.bg, color: st.fg }}>
                            {m.status}
                          </span>
                        </td>
                        <td className="border-t border-[#F1F3F9] pr-3">
                          <RowMenu label={`Actions for ${m.drug}`} size={30}
                            items={[
                              { label: 'Mark completed', onSelect: () => void setStatus(m.id, 'completed') },
                              { label: 'Stop medication', danger: true, onSelect: () => void setStatus(m.id, 'stopped') },
                            ]} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p role="note" className="mt-3.5 flex items-center gap-3 rounded-[11px] border border-[#F8E3B8] bg-[#FEF7E6] px-[18px] py-3.5 text-[12.5px] text-[#8A5A0B]">
              <AlertCircle aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[#E8890B]" />
              <span><span className="font-bold">Disclaimer:</span> This is a system generated prescription and does not require a physical signature.</span>
            </p>
          </>
        )}
      </section>

      {/* ── Right rail ── */}
      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <h2 className={H2}>Prescription Summary</h2>
          <dl className="mt-3.5 grid grid-cols-2 gap-3">
            <div className="rounded-[11px] bg-[#F3F0FE] px-[15px] py-4">
              <dd className="text-2xl font-extrabold text-[#0F172A]">{data?.prescriptions.length ?? 0}</dd>
              <dt className="mt-1 text-[11.5px] font-medium text-[#64748B]">Medicines</dt>
            </div>
            <div className="rounded-[11px] bg-[#ECFAF1] px-[15px] py-4">
              <dd className="text-2xl font-extrabold text-[#0F172A]">{activeCount}</dd>
              <dt className="mt-1 text-[11.5px] font-medium text-[#64748B]">Still Active</dt>
            </div>
          </dl>
        </section>

        {groups.length > 1 && (
          <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
            <div className="flex items-center">
              <h2 className={H2}>Prescription History</h2>
            </div>
            <ul className="mt-3.5">
              {groups.map((g, i) => (
                <li key={g.date}>
                  <button type="button" aria-label={`${wsDate(g.date)}, ${g.items.length} medicines`}
                    aria-current={current?.date === g.date ? 'true' : undefined}
                    onClick={() => setSelected(g.date)}
                    className={cn('flex h-[62px] w-full items-center gap-3 text-left transition-colors hover:bg-[#FAFBFF]',
                      i > 0 && 'border-t border-[#F1F3F9]',
                      current?.date === g.date && 'bg-[#F5F7FF]')}>
                    <Tile icon="FileText" tint="#EEF1FE" fg="#4F46E5" size={30} glyph={15} radius={8} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-[#64748B]">{wsDate(g.date)}</span>
                      <span className="block truncate text-[13px] font-bold text-[#0F172A]">
                        {g.items.map((m) => m.drug).join(', ')}
                      </span>
                      <span className="block truncate text-[11.5px] text-[#94A3B8]">{g.items.length} medicine{g.items.length > 1 ? 's' : ''}</span>
                    </span>
                    <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#94A3B8]" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <h2 className={H2}>Dosing Check</h2>
          <p className="mt-1 text-[12.5px] text-[#64748B]">
            Paediatric dose checking lives in the dosing tool — it needs the child&rsquo;s current weight.
          </p>
          <button type="button" onClick={() => setAdding(true)}
            className="mt-3.5 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white text-[13px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
            <Plus className="h-4 w-4" />
            Add Medication
          </button>
        </section>
      </div>
    </div>
  );
}

