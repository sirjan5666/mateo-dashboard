import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, ExternalLink, Info, X } from 'lucide-react';
import {
  AGE_TICKS,
  CURVES,
  CURVE_COLORS,
  MEASUREMENTS,
  METRICS,
  RANGES,
  fmtMeasure,
  ordinal,
} from '../../../../data/growth';
import type { MetricKey } from '../../../../data/growth';
import type { Patient } from '../../../../data/patients';
import { cn } from '../../../../lib/cn';
import { PatientSummaryStrip } from './PatientSummaryStrip';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

function Segmented<T extends string>({
  options, value, onChange, label, activeSolid,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  activeSolid?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            role="radio"
            type="button"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            className={cn(
              'h-[38px] rounded-[10px] px-[18px] text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2',
              active
                ? activeSolid
                  ? 'bg-[#5B5BF0] font-bold text-white'
                  : 'border-[1.5px] border-[#6366F1] bg-[#F0EFFE] font-bold text-[#3B4FE0]'
                : 'border border-[#E2E6F0] bg-white font-semibold text-[#334155] hover:bg-[#F7F8FC]',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function GrowthChartModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [metric, setMetric] = useState<MetricKey>('height');
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('All');
  const [tab, setTab] = useState<'chart' | 'history'>('chart');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes?.length) return;
      const list = [...nodes].filter((n) => n.tabIndex !== -1);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const m = METRICS.find((x) => x.key === metric)!;
  const maxMonths = RANGES.find((r) => r.key === range)!.months;
  const latest = MEASUREMENTS[0];

  // One row per 6-month sample: the five WHO curves plus the patient's series,
  // which stops at their current age rather than running to 5y.
  const chartData = useMemo(() => {
    const c = CURVES[metric];
    return AGE_TICKS.map((t, i) => {
      const point = MEASUREMENTS.find((x) => x.ageMonths === t.months);
      return {
        months: t.months,
        label: t.label,
        p3: c.p3[i],
        p15: c.p15[i],
        p50: c.p50[i],
        p85: c.p85[i],
        p97: c.p97[i],
        patient: point ? point[metric] : undefined,
        date: point?.date,
        ageLabel: point?.ageLabel,
        percentile: point?.percentile[metric],
      };
    }).filter((r) => r.months <= maxMonths);
  }, [metric, maxMonths]);

  const legend = [
    { kind: 'dot', color: CURVE_COLORS.patient, label: `${patient.name.split(' ')[0]}'s ${m.label}` },
    { kind: 'line', color: CURVE_COLORS.p50, label: '50th Percentile' },
    { kind: 'line', color: CURVE_COLORS.p15, label: '15th/85th Percentile' },
    { kind: 'line', color: CURVE_COLORS.p3, label: '3rd/97th Percentile' },
  ];

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-[60] motion-safe:animate-[fadeIn_160ms_ease-out]"
      style={{ background: 'rgba(15,23,42,0.22)', backdropFilter: 'blur(1.5px)' }}
      onClick={onClose}
    >
      <div className="flex h-full items-end justify-center md:items-start md:px-6 md:pt-[84px]">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="growth-title"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex w-full min-w-0 flex-col overflow-hidden bg-white',
            'h-[94vh] rounded-t-[20px] md:h-auto md:max-h-[850px] md:w-[880px] md:rounded-[16px]',
            'shadow-[0_24px_64px_-12px_rgba(15,23,42,.30),0_8px_24px_-8px_rgba(15,23,42,.12)]',
            'motion-safe:animate-[modalIn_200ms_cubic-bezier(.16,1,.3,1)]',
          )}
        >
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-[#D9DFEC] md:hidden" />

          {/* Header */}
          <div className="flex shrink-0 items-center gap-4 px-5 pb-[18px] pt-[22px] sm:px-[26px]">
            <h2 id="growth-title" className="font-display text-xl font-extrabold tracking-[-0.02em] text-[#0F172A]">
              Growth Chart
            </h2>
            <button
              type="button"
              autoFocus
              aria-label="Close"
              onClick={onClose}
              className="ml-auto grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#F1F3F9] text-[#334155] transition-colors hover:bg-[#E4E8F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
            >
              <X className="h-[17px] w-[17px]" />
            </button>
          </div>

          {/* Patient strip + summary */}
          <div className="shrink-0 border-b border-[#ECEEF4]">
            <PatientSummaryStrip patient={patient}>
              <div className="min-w-0 flex-1 rounded-[12px] bg-[#F7F8FC] px-1 pb-4 pt-3.5">
                <h4 className="px-4 text-[13.5px] font-bold text-[#334155]">Growth Summary (WHO Standards)</h4>
                <dl className="mt-3.5 grid grid-cols-2 lg:grid-cols-4">
                  {METRICS.map((x, i) => (
                    <div key={x.key} className={cn('px-[18px]', i < METRICS.length - 1 && 'lg:border-r lg:border-[#E4E8F1]')}>
                      <dt className="text-xs font-medium text-[#64748B]">{x.summaryLabel}</dt>
                      <dd>
                        <span className="mt-2 block font-display text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[#0F172A] tabular-nums">
                          {x.percentile}
                          <span className="text-[13px] font-bold">{ordinal(x.percentile).replace(String(x.percentile), '')}</span>
                        </span>
                        <span className="mt-0.5 block text-xs font-medium text-[#64748B]">Percentile</span>
                        <span className="mt-2.5 inline-block rounded-[7px] bg-[#DCF7E6] px-[11px] py-1 text-[11.5px] font-semibold text-[#12A150]">
                          Normal
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </PatientSummaryStrip>
          </div>

          {/* Control bar */}
          <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-[#ECEEF4] px-5 pt-4 sm:px-[26px]">
            <div role="tablist" aria-label="Growth view" className="flex gap-[30px]">
              {([['chart', 'Growth Chart'], ['history', 'Measurements History']] as const).map(([k, label]) => (
                <button
                  key={k}
                  role="tab"
                  type="button"
                  aria-selected={tab === k}
                  tabIndex={tab === k ? 0 : -1}
                  onClick={() => setTab(k)}
                  className={cn(
                    'shrink-0 whitespace-nowrap border-b-[2.5px] pb-[13px] text-sm transition-colors',
                    tab === k ? 'border-[#3B4FE0] font-bold text-[#1E2A5A]' : 'border-transparent font-medium text-[#64748B] hover:text-[#334155]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mb-2.5 flex flex-wrap items-center gap-3">
              <Segmented label="Metric" value={metric} onChange={setMetric} options={METRICS.map((x) => ({ key: x.key, label: x.label }))} />
            </div>

            <div className="mb-2.5 ml-auto">
              <Segmented label="Range" value={range} onChange={setRange} activeSolid options={RANGES.map((r) => ({ key: r.key, label: r.key }))} />
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-auto">
            {tab === 'chart' ? (
              <div className="grid grid-cols-1 gap-5 px-5 pb-[18px] pt-5 sm:px-[26px] lg:grid-cols-[1fr_300px]">
                {/* Chart */}
                <div className="min-w-0">
                  <h3 className="mb-3 text-[14.5px] font-bold text-[#0F172A]">{m.title}</h3>
                  <div
                    role="img"
                    aria-label={`${m.title} for ${patient.name}, plotted against WHO percentile curves. Latest ${latest[metric]} ${m.unit} at ${latest.ageLabel}, ${ordinal(m.percentile)} percentile.`}
                    style={{ height: 350 }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 8, right: 34, bottom: 22, left: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#64748B' }}
                          tickLine={false}
                          axisLine={false}
                          label={{ value: 'Age (Years)', position: 'insideBottom', offset: -14, fontSize: 11.5, fill: '#64748B' }}
                        />
                        <YAxis
                          domain={[m.ticks[0], m.ticks[m.ticks.length - 1]]}
                          ticks={m.ticks}
                          tick={{ fontSize: 11, fill: '#64748B' }}
                          tickLine={false}
                          axisLine={false}
                          width={46}
                          label={{ value: m.axisLabel, angle: -90, position: 'insideLeft', fontSize: 11.5, fill: '#64748B', style: { textAnchor: 'middle' } }}
                        />
                        {(['p97', 'p85', 'p50', 'p15', 'p3'] as const).map((k) => (
                          <Line
                            key={k}
                            type="monotone"
                            dataKey={k}
                            stroke={CURVE_COLORS[k]}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            name={k}
                          />
                        ))}
                        <Line
                          type="monotone"
                          dataKey="patient"
                          stroke={CURVE_COLORS.patient}
                          strokeWidth={2.5}
                          connectNulls
                          dot={{ r: 4, fill: CURVE_COLORS.patient, stroke: '#FFFFFF', strokeWidth: 1.5 }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={false}
                          name="patient"
                        />
                        <Tooltip
                          cursor={{ stroke: '#CBD5E1', strokeDasharray: '3 3' }}
                          content={({ active, payload }) => {
                            const row = payload?.[0]?.payload as (typeof chartData)[number] | undefined;
                            if (!active || !row?.patient) return null;
                            return (
                              <div className="rounded-[9px] border border-[#ECEEF4] bg-white px-[13px] py-2.5 shadow-[0_8px_20px_-8px_rgba(15,23,42,.22)]">
                                <p className="text-xs font-bold text-[#0F172A]">{row.ageLabel} ({row.date})</p>
                                <p className="mt-1.5 text-xs font-medium text-[#334155]">{m.label}: {row.patient} {m.unit}</p>
                                <p className="mt-[3px] text-xs font-medium text-[#334155]">Percentile: {ordinal(row.percentile ?? 0)}</p>
                              </div>
                            );
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Screen-reader data table */}
                  <table className="sr-only">
                    <caption>{m.title} measurements</caption>
                    <thead><tr><th>Age</th><th>{m.column}</th><th>Percentile</th></tr></thead>
                    <tbody>
                      {MEASUREMENTS.map((x) => (
                        <tr key={x.date}><td>{x.ageLabel}</td><td>{x[metric]} {m.unit}</td><td>{ordinal(x.percentile[metric])}</td></tr>
                      ))}
                    </tbody>
                  </table>

                  <ul className="mt-3.5 flex flex-wrap gap-x-[26px] gap-y-2">
                    {legend.map((l) => (
                      <li key={l.label} className="flex items-center gap-2 text-xs font-medium text-[#334155]">
                        {l.kind === 'dot' ? (
                          <span aria-hidden="true" className="h-[9px] w-[9px] rounded-full" style={{ background: l.color }} />
                        ) : (
                          <span aria-hidden="true" className="h-[2.5px] w-[18px] rounded-full" style={{ background: l.color }} />
                        )}
                        {l.label}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recent measurements */}
                <div className="min-w-0 overflow-hidden rounded-[12px] border border-[#ECEEF4] bg-white">
                  <h3 className="px-4 py-3.5 text-sm font-bold text-[#0F172A]">Recent Measurements</h3>
                  <table className="w-full border-separate border-spacing-0">
                    <caption className="sr-only">Recent {m.label.toLowerCase()} measurements</caption>
                    <thead>
                      <tr>
                        {['Date', 'Age', m.column, 'Percentile'].map((h, i) => (
                          <th key={h} scope="col" className={cn('h-9 bg-[#F7F8FC] text-left text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B]', i === 0 && 'pl-4')}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MEASUREMENTS.map((x) => (
                        <tr key={x.date} className="hover:bg-[#FAFBFF]">
                          <td className="h-[39px] border-b border-[#F1F3F9] pl-4 text-[12.5px] font-medium text-[#334155]">{x.date}</td>
                          <td className="border-b border-[#F1F3F9] text-[12.5px] font-medium text-[#334155]">{x.ageLabel}</td>
                          <td className="border-b border-[#F1F3F9] text-[12.5px] font-semibold text-[#0F172A]">
                            {fmtMeasure(x[metric])}
                            {m.unit ? ` ${m.unit}` : ''}
                          </td>
                          <td className="border-b border-[#F1F3F9] pr-3">
                            <span className="flex items-center gap-2">
                              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#12A150]" />
                              <span className="text-[12.5px] font-semibold text-[#0F172A]">{ordinal(x.percentile[metric])}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-4">
                    <button
                      type="button"
                      aria-label="View full measurement history"
                      onClick={() => console.log('[Clinic OS] View Full History', patient.id)}
                      className="flex h-[42px] w-full items-center justify-center gap-2.5 rounded-[10px] border border-[#DDE3F5] bg-white text-[13px] font-bold text-[#3B4FE0] transition-colors hover:bg-[#F5F7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
                    >
                      View Full History
                      <ExternalLink className="h-[15px] w-[15px]" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Measurements History — every metric, one row per visit */
              <div className="px-5 py-5 sm:px-[26px]">
                <table className="w-full border-separate border-spacing-0">
                  <caption className="sr-only">All recorded measurements</caption>
                  <thead>
                    <tr>
                      {['Date', 'Age', 'Height', 'Weight', 'BMI', 'Head Circ.'].map((h, i) => (
                        <th key={h} scope="col" className={cn('h-10 bg-[#F7F8FC] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]', i === 0 && 'pl-4')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MEASUREMENTS.map((x) => (
                      <tr key={x.date} className="hover:bg-[#FAFBFF]">
                        <td className="h-[44px] border-b border-[#F1F3F9] pl-4 text-[13px] font-medium text-[#334155]">{x.date}</td>
                        <td className="border-b border-[#F1F3F9] text-[13px] font-medium text-[#334155]">{x.ageLabel}</td>
                        <td className="border-b border-[#F1F3F9] text-[13px] font-semibold text-[#0F172A]">{fmtMeasure(x.height)} cm</td>
                        <td className="border-b border-[#F1F3F9] text-[13px] font-semibold text-[#0F172A]">{fmtMeasure(x.weight)} kg</td>
                        <td className="border-b border-[#F1F3F9] text-[13px] font-semibold text-[#0F172A]">{fmtMeasure(x.bmi)}</td>
                        <td className="border-b border-[#F1F3F9] text-[13px] font-semibold text-[#0F172A]">{fmtMeasure(x.head)} cm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-[#ECEEF4] px-5 pb-5 pt-3.5 sm:px-[26px]">
            <p className="flex items-center gap-3 text-[13px] font-medium text-[#334155]">
              <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#2563EB]">
                <Info className="h-[13px] w-[13px] text-white" />
              </span>
              WHO Child Growth Standards (Boys 0–5 years)
            </p>
            <button
              type="button"
              aria-label="Download growth chart"
              onClick={() => console.log('[Clinic OS] Download Chart', patient.id)}
              className="ml-auto flex h-11 items-center gap-2.5 rounded-[10px] border border-[#E2E6F0] bg-white px-5 shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-colors hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
            >
              <Download className="h-[17px] w-[17px] text-[#334155]" />
              <span className="text-[13.5px] font-bold text-[#1E2A5A]">Download Chart</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
