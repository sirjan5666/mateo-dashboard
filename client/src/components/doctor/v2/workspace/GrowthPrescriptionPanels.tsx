import { useMemo, useState } from 'react';
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  AlertCircle, ArrowLeft, Bell, ChevronDown, ChevronRight, CircleCheck, Download,
  Info, Lightbulb, Mail, Printer, Target, TrendingUp,
} from 'lucide-react';
import {
  GROWTH_RECORDS, GROWTH_SUMMARY_ROWS, GROWTH_TIPS, MILESTONES, PRESCRIPTION,
  WS_CURVES, WS_CURVE_META, WS_GROWTH_MONTHS, WS_GROWTH_SERIES,
} from '../../../../data/workspaceTabs';
import type { WsMetric } from '../../../../data/workspaceTabs';
import { RowMenu } from '../RowMenu';
import { CARD, Dash, FooterLink, H2, SELECT, Tile } from './shared';
import { cn } from '../../../../lib/cn';

const METRICS: WsMetric[] = ['Weight', 'Height', 'BMI', 'Head Circumference'];

const CHART_H = 300;
const X_AXIS_H = 30;
const CHART_MARGIN = { top: 10, right: 66, bottom: 4, left: -14 };
/** Plot box the y-scale actually spans, once the axis and margins are removed. */
const PLOT_TOP = CHART_MARGIN.top;
const PLOT_H = CHART_H - CHART_MARGIN.top - CHART_MARGIN.bottom - X_AXIS_H;
const LAST = WS_GROWTH_MONTHS.length - 1;

/** 15.0 must not print as "15" in a column where its neighbours carry a decimal. */
const d1 = (v: number) => v.toFixed(1);

// ── 18 · Growth Charts ───────────────────────────────────────────────────────

export function GrowthChartsPanel() {
  const [metric, setMetric] = useState<WsMetric>('Weight');
  const s = WS_GROWTH_SERIES[metric];
  const curves = WS_CURVES[metric];
  const lo = s.ticks[0];
  const hi = s.ticks[s.ticks.length - 1];
  /** Inverse of the y-axis scale: a value in domain units → a pixel offset. */
  const yFor = (v: number) => PLOT_TOP + (1 - (v - lo) / (hi - lo)) * PLOT_H;

  const data = useMemo(
    () => WS_GROWTH_MONTHS.map((m, i) => ({
      month: m, patient: s.patient[i],
      p97: curves.p97[i], p85: curves.p85[i], p50: curves.p50[i], p15: curves.p15[i], p3: curves.p3[i],
    })),
    [s, curves],
  );

  const unitSuffix = s.unit ? ` (${s.unit})` : '';

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <div className="flex min-w-0 flex-col gap-5">
        <section className={`${CARD} px-[22px] pb-[18px] pt-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className={H2}>Growth Charts</h2>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <div className="relative">
                <label htmlFor="g-std" className="sr-only">Reference standard</label>
                <select id="g-std" className={cn(SELECT, 'w-[172px]')}>
                  {['WHO Standards', 'IAP Standards', 'CDC Standards'].map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              </div>
              <div className="relative">
                <label htmlFor="g-range" className="sr-only">Range</label>
                <select id="g-range" className={cn(SELECT, 'w-[168px]')} defaultValue="Last 12 Months">
                  {['Last 6 Months', 'Last 12 Months', 'Last 2 Years', 'All Time'].map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              </div>
              <button type="button" aria-label="Export growth chart" className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#E4E8F1] bg-white px-[18px] hover:bg-[#F7F8FC]">
                <Download className="h-4 w-4 text-[#334155]" />
                <span className="text-[13px] font-bold text-[#1E2A5A]">Export</span>
              </button>
            </div>
          </div>

          <div role="radiogroup" aria-label="Growth metric" className="mt-4 flex flex-wrap gap-1.5">
            {METRICS.map((m) => (
              <button key={m} role="radio" type="button" aria-checked={metric === m} onClick={() => setMetric(m)}
                className={cn('h-10 rounded-[10px] px-[22px] text-[13.5px] transition-colors',
                  metric === m ? 'border-[1.5px] border-[#6366F1] bg-[#F0EFFE] font-bold text-[#3B4FE0]' : 'border border-[#E2E6F0] bg-white font-semibold text-[#334155] hover:bg-[#F7F8FC]')}>
                {m}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-[22px] gap-y-2">
            <span className="text-[12.5px] font-semibold text-[#334155]">{metric}{unitSuffix}</span>
            <span className="flex items-center gap-2 text-xs font-medium text-[#475569]">
              <span aria-hidden="true" className="h-[2.5px] w-[18px] rounded-full bg-[#4F46E5]" />
              Myra ({s.badge})
            </span>
            {WS_CURVE_META.map((c) => (
              <span key={c.key} className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                <span aria-hidden="true" className="h-0 w-[18px] border-t-2 border-dashed" style={{ borderColor: c.color }} />
                {c.label}
              </span>
            ))}
          </div>

          <div className="relative mt-3.5" style={{ height: CHART_H }}>
            <div role="img" aria-label={`${metric} over the last 12 months for Myra Kapoor, latest ${s.badge}`} className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={CHART_MARGIN}>
                  <defs>
                    <linearGradient id="gws" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                  <XAxis dataKey="month" height={X_AXIS_H} tick={{ fontSize: 10.5, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis domain={[lo, hi]} ticks={s.ticks} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                  {WS_CURVE_META.map((c) => (
                    <Line key={c.key} type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={false} />
                  ))}
                  <Area type="monotone" dataKey="patient" stroke="#4F46E5" strokeWidth={2.5} fill="url(#gws)"
                    dot={{ r: 4, fill: '#4F46E5', stroke: '#FFFFFF', strokeWidth: 1.5 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/*
              End-of-curve labels. Recharts has no right-edge label slot, so each
              is placed against the same domain the YAxis uses — `yFor` is the
              inverse of the axis scale, so a label can never drift from its line.
              Purely decorative: the same numbers are in the legend and the table.
            */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block">
              {WS_CURVE_META.map((c) => (
                <span key={c.key} className="absolute text-[11.5px] font-semibold leading-none"
                  style={{ color: c.color, right: 2, top: yFor(curves[c.key][LAST]) - 6 }}>
                  {s.ends[c.key]}
                </span>
              ))}
              {/*
                Sits just inside the plot, left of the last dot — the percentile
                labels own the right gutter and the two collide otherwise (the
                patient's value is by definition close to one of the bands).
              */}
              <span className="absolute rounded-[7px] bg-[#4F46E5] px-2 py-[5px] text-[11px] font-bold leading-none text-white"
                style={{ right: CHART_MARGIN.right + 8, top: yFor(s.patient[LAST]) - 11 }}>
                {s.badge}
              </span>
            </div>
          </div>

          <table className="sr-only">
            <caption>{metric} by month with percentile bands</caption>
            <thead><tr><th>Month</th><th>Myra</th><th>50th percentile</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.month}><td>{d.month}</td><td>{d.patient}</td><td>{d.p50}</td></tr>)}</tbody>
          </table>

          <p className="mt-3.5 flex items-start gap-2.5 text-xs text-[#64748B]">
            <Info aria-hidden="true" className="mt-px h-[15px] w-[15px] shrink-0 text-[#94A3B8]" />
            Growth charts are based on WHO Child Growth Standards for girls (0–5 years).
          </p>
        </section>

        {/* Growth Records */}
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
                {GROWTH_RECORDS.map((r, i) => (
                  <tr key={r.date} className="hover:bg-[#FAFBFF]">
                    <th scope="row" className="h-[42px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left text-[12.5px] font-medium text-[#334155]">{r.date}</th>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{r.age}</td>
                    <td className={cn('border-b border-[#F1F3F9] pr-3 text-[12.5px]', i === 0 && metric === 'Weight' ? 'font-bold text-[#3B4FE0]' : 'font-semibold text-[#0F172A]')}>{d1(r.weight)}</td>
                    <td className={cn('border-b border-[#F1F3F9] pr-3 text-[12.5px]', i === 0 && metric === 'Height' ? 'font-bold text-[#3B4FE0]' : 'font-semibold text-[#0F172A]')}>{r.height}</td>
                    <td className={cn('border-b border-[#F1F3F9] pr-3 text-[12.5px]', i === 0 && metric === 'BMI' ? 'font-bold text-[#3B4FE0]' : 'font-semibold text-[#0F172A]')}>{d1(r.bmi)}</td>
                    <td className={cn('border-b border-[#F1F3F9] pr-3 text-[12.5px]', i === 0 && metric === 'Head Circumference' ? 'font-bold text-[#3B4FE0]' : 'font-semibold text-[#0F172A]')}>{d1(r.head)}</td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{r.by}</td>
                    <td className="border-b border-[#F1F3F9] pr-[22px]">
                      <RowMenu label={`Actions for record on ${r.date}`} size={30}
                        items={['Edit Record', 'Add Note', 'Delete Record'].map((l) => ({ label: l, danger: l === 'Delete Record', onSelect: () => console.log('[Clinic OS]', l, r.date) }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-[22px]"><FooterLink label="View All Records" /></div>
        </section>
      </div>

      {/* ── Right rail ── */}
      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <TrendingUp aria-hidden="true" className="h-[17px] w-[17px] text-[#12A150]" />
            <h2 className={H2}>Growth Summary</h2>
          </div>
          <p className="mt-3 text-[13.5px] font-bold text-[#12A150]">On Track</p>
          <p className="mt-1 text-[12.5px] text-[#64748B]">Myra&rsquo;s growth is within normal range.</p>
          <div className="my-3.5 h-px bg-[#F1F3F9]" />
          <dl className="flex flex-col gap-4">
            {GROWTH_SUMMARY_ROWS.map((r) => (
              <div key={r.metric} className="flex items-center gap-3">
                <Tile icon={r.icon} tint={r.tint} fg={r.fg} size={28} glyph={15} radius={8} />
                <div className="min-w-0 flex-1">
                  <dt className="text-[12.5px] font-bold text-[#0F172A]">{r.metric}</dt>
                  <dd className="text-[11.5px] text-[#64748B]">{r.detail}</dd>
                </div>
                <span className="shrink-0 text-[11.5px] font-bold text-[#12A150]">On Track</span>
              </div>
            ))}
          </dl>
          <FooterLink label="View Full Growth Report" />
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex flex-wrap items-center gap-2.5">
            <Target aria-hidden="true" className="h-[17px] w-[17px] text-[#12A150]" />
            <h2 className={H2}>Milestones</h2>
            <span className="ml-auto text-xs font-medium text-[#64748B]">Age: 2y 11m</span>
          </div>
          <ul className="mt-3.5 flex flex-col gap-[15px]">
            {MILESTONES.map((m) => (
              <li key={m.text} className="flex items-start gap-3">
                <CircleCheck aria-hidden="true" className="mt-px h-[18px] w-[18px] shrink-0 text-[#12A150]" />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold text-[#0F172A]">{m.text}</span>
                  <span className="block text-[11.5px] text-[#64748B]">{m.on}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <Lightbulb aria-hidden="true" className="h-[17px] w-[17px] text-[#F59E0B]" />
            <h2 className={H2}>Growth Tips for Parents</h2>
          </div>
          <ul className="mt-3.5 flex flex-col gap-3">
            {GROWTH_TIPS.map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#F59E0B]" />
                <span className="text-[12.5px] leading-5 text-[#475569]">{t}</span>
              </li>
            ))}
          </ul>
          <FooterLink label="View All Tips" />
        </section>
      </div>
    </div>
  );
}

// ── 20 · Prescription Details ────────────────────────────────────────────────

export function PrescriptionsPanel() {
  const p = PRESCRIPTION;
  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <section className={`${CARD} min-w-0 px-[22px] pb-[22px] pt-[18px]`}>
        <button type="button" onClick={() => console.log('[Clinic OS] Back to Prescriptions')} className="flex items-center gap-2 text-[13px] font-semibold text-[#3B4FE0] hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Prescriptions
        </button>

        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <Tile icon="FileText" tint="#EEF1FE" fg="#4F46E5" size={34} glyph={17} radius={9} />
          <h2 className="font-display text-[17px] font-extrabold tracking-[-0.02em] text-[#0F172A]">Prescription Details</h2>
          <div className="ml-auto flex flex-wrap items-center gap-[11px]">
            <button type="button" onClick={() => window.print()} className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
              <Printer className="h-4 w-4 text-[#334155]" />
              <span className="text-[13px] font-bold text-[#1E2A5A]">Print</span>
            </button>
            <button type="button" aria-label="Download prescription" className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
              <Download className="h-4 w-4 text-[#334155]" />
              <span className="text-[13px] font-bold text-[#1E2A5A]">Download</span>
            </button>
          </div>
        </div>

        {/* Meta strip */}
        <dl className="mt-4 grid grid-cols-1 gap-6 rounded-[12px] bg-[#F7F8FC] px-[22px] py-[18px] sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-[11.5px] font-medium text-[#64748B]">Prescription ID</dt>
            <dd className="mt-[7px] text-sm font-bold text-[#0F172A]">{p.id}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] font-medium text-[#64748B]">Visit Date</dt>
            <dd className="mt-[7px] text-sm font-bold text-[#0F172A]">{p.visitDate}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] font-medium text-[#64748B]">Doctor</dt>
            <dd className="mt-[7px] flex items-center gap-2.5">
              <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EDE9FE] text-[11px] font-bold text-[#6D5AE0]">AS</span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-bold text-[#0F172A]">{p.doctor}</span>
                <span className="block text-[11.5px] text-[#64748B]">{p.role}</span>
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[11.5px] font-medium text-[#64748B]">Diagnosis</dt>
            <dd className="mt-[7px]">
              <span className="block text-[13.5px] font-bold text-[#0F172A]">{p.diagnosis}</span>
              <span className="block text-[12.5px] text-[#64748B]">{p.diagnosisSub}</span>
            </dd>
          </div>
        </dl>

        <h3 className={cn(H2, 'mt-[22px]')}>Medications</h3>
        <div className="mt-3.5 overflow-x-auto rounded-[11px] border border-[#ECEEF4]">
          <table className="w-full min-w-[720px] border-separate border-spacing-0">
            <caption className="sr-only">Prescribed medications</caption>
            <thead>
              <tr>
                {['Medicine', 'Strength', 'Dosage', 'Frequency', 'Duration', 'Instructions'].map((h, i) => (
                  <th key={h} scope="col" className={cn('h-10 bg-[#F7F8FC] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]', i === 0 && 'pl-[18px]')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.medications.map((m) => (
                <tr key={m.name}>
                  <th scope="row" className="h-[59px] border-t border-[#F1F3F9] pl-[18px] pr-3 text-left font-normal">
                    <span className="flex items-center gap-3">
                      <Tile icon="Pill" tint={m.tint} fg={m.fg} size={30} glyph={15} radius={8} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold text-[#0F172A]">{m.name}</span>
                        <span className="block text-[11.5px] text-[#94A3B8]">{m.code}</span>
                      </span>
                    </span>
                  </th>
                  <td className="border-t border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">
                    {m.strength ?? <Dash say="No strength specified" />}
                  </td>
                  <td className="border-t border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.dosage}</td>
                  <td className="border-t border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.frequency}</td>
                  <td className="border-t border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.duration}</td>
                  <td className="border-t border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.instructions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-[18px] flex items-start gap-3 rounded-[11px] bg-[#F7F8FC] px-[18px] py-4">
          <Tile icon="FileText" tint="#EEF1FE" fg="#4F46E5" size={30} glyph={15} radius={8} />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[#0F172A]">Notes</p>
            <p className="mt-1 text-[12.5px] text-[#475569]">{p.notes}</p>
          </div>
        </div>

        <p role="note" className="mt-3.5 flex items-center gap-3 rounded-[11px] border border-[#F8E3B8] bg-[#FEF7E6] px-[18px] py-3.5 text-[12.5px] text-[#8A5A0B]">
          <AlertCircle aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[#E8890B]" />
          <span><span className="font-bold">Disclaimer:</span> This is a system generated prescription and does not require a physical signature.</span>
        </p>
      </section>

      {/* ── Right rail ── */}
      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <h2 className={H2}>Prescription Summary</h2>
          <dl className="mt-3.5 grid grid-cols-2 gap-3">
            <div className="rounded-[11px] bg-[#F3F0FE] px-[15px] py-4">
              <dd className="text-2xl font-extrabold text-[#0F172A]">{p.medicineCount}</dd>
              <dt className="mt-1 text-[11.5px] font-medium text-[#64748B]">Medicines</dt>
            </div>
            <div className="rounded-[11px] bg-[#ECFAF1] px-[15px] py-4">
              <dd className="text-2xl font-extrabold text-[#0F172A]">{p.totalDays}</dd>
              <dt className="mt-1 text-[11.5px] font-medium text-[#64748B]">Total Days</dt>
            </div>
          </dl>
          <div className="my-4 h-px bg-[#F1F3F9]" />
          <p className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-[#334155]">Prescription Status</span>
            <span className="ml-auto rounded-[7px] bg-[#DCF7E6] px-3 py-1 text-[11.5px] font-bold text-[#12A150]">Active</span>
          </p>
          <p className="mt-2.5 text-xs font-medium text-[#64748B]">{p.createdOn}</p>
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <Bell aria-hidden="true" className="h-[17px] w-[17px] text-[#F59E0B]" />
            <h2 className={H2}>Next Dose Reminder</h2>
          </div>
          <ul className="mt-3.5 flex flex-col gap-[15px]">
            {p.reminders.map((r, i) => (
              <li key={`${r.name}-${i}`} className="flex items-center gap-3">
                <Tile icon="Pill" tint={r.tint} fg={r.fg} size={30} glyph={15} radius={8} />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-bold text-[#0F172A]">{r.name}</span>
                  <span className="block text-[11.5px] text-[#64748B]">{r.when}</span>
                </span>
              </li>
            ))}
          </ul>
          <FooterLink label="Set Reminders" />
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <h2 className={H2}>Share Prescription</h2>
          <p className="mt-1 text-[12.5px] text-[#64748B]">Share this prescription with patient or parent.</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {([
              ['Mail', '#4F46E5', 'Email', 'Share prescription by email'],
              ['whatsapp', '#25D366', 'WhatsApp', 'Share prescription on WhatsApp'],
              ['Download', '#4F46E5', 'Download', 'Download prescription'],
            ] as const).map(([icon, color, label, aria]) => (
              <button key={label} type="button" aria-label={aria} onClick={() => console.log('[Clinic OS]', label)}
                className="flex h-[72px] flex-col items-center justify-center gap-2 rounded-[11px] border border-[#E4E8F1] bg-white transition-colors hover:border-[#C7CEDB] hover:bg-[#F7F8FC]">
                {icon === 'whatsapp' ? (
                  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill={color} aria-hidden="true">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.22-8.24 8.22z" />
                  </svg>
                ) : icon === 'Mail' ? (
                  <Mail aria-hidden="true" className="h-[22px] w-[22px]" style={{ color }} />
                ) : (
                  <Download aria-hidden="true" className="h-[22px] w-[22px]" style={{ color }} />
                )}
                <span className="text-[11.5px] font-semibold text-[#334155]">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center">
            <h2 className={H2}>Prescription History</h2>
            <button type="button" className="ml-auto text-[12.5px] font-bold text-[#3B4FE0] hover:underline">View All</button>
          </div>
          <ul className="mt-3.5">
            {p.history.map((h, i) => (
              <li key={h.date}>
                <button type="button" aria-label={`${h.date}, ${h.reason}`} onClick={() => console.log('[Clinic OS] Open prescription', h.date)}
                  className={cn('flex h-[62px] w-full items-center gap-3 text-left transition-colors hover:bg-[#FAFBFF]', i > 0 && 'border-t border-[#F1F3F9]')}>
                  <Tile icon="FileText" tint="#EEF1FE" fg="#4F46E5" size={30} glyph={15} radius={8} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-[#64748B]">{h.date}</span>
                    <span className="block truncate text-[13px] font-bold text-[#0F172A]">{h.reason}</span>
                    <span className="block truncate text-[11.5px] text-[#94A3B8]">By Dr. Ananya Sharma</span>
                  </span>
                  <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#94A3B8]" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
