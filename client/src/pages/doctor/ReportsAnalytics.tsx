import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ArrowUp, Loader2, BarChart3, CalendarDays, ChevronDown, ChevronRight, Copy,
  Download, FileClock, FileText, IndianRupee, Receipt, Stethoscope, UserRound, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { analyticsFromReport } from '../../data/analytics';
import { getReport } from '../../api/doctorAnalytics';
import type { DoctorReport } from '../../api/doctorAnalytics';
import { RangeSelector, rangeForPreset } from '../../components/doctor/v2/RangeSelector';
import type { DateRange, RangePreset } from '../../components/doctor/v2/RangeSelector';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const H2 = 'font-display text-[15.5px] font-bold tracking-[-0.01em] text-[#0F172A]';
const PILL = 'h-[34px] rounded-[9px] border border-[#E2E6F0] bg-white pl-3 pr-8 text-[12.5px] font-semibold text-[#334155] appearance-none focus:outline-none';

const ICONS: Record<string, LucideIcon> = {
  CalendarDays, Stethoscope, UserRound, IndianRupee, FileText, Users, FileClock, Receipt,
};

function PeriodPill({ id, options }: { id: string; options: string[] }) {
  return (
    <div className="relative ml-auto">
      <label htmlFor={id} className="sr-only">Period</label>
      <select id={id} className={PILL} defaultValue={options[0]}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
    </div>
  );
}

function DonutCard({ title, id, total, totalLabel, data }: {
  title: string; id: string; total: string; totalLabel: string;
  data: { label: string; color: string; share: number; count: number }[];
}) {
  return (
    <section className={`${CARD} px-5 pb-4 pt-[18px]`}>
      <div className="flex items-center gap-3">
        <h2 className={H2}>{title}</h2>
        <PeriodPill id={id} options={['This Month', 'Last Month', 'This Quarter']} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-[18px]">
        <div
          role="img"
          aria-label={`${title}: ${data.map((d) => `${d.label}, ${d.share} percent, ${d.count}`).join('; ')}`}
          className="relative h-[132px] w-[132px] shrink-0"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="share" innerRadius={44} outerRadius={62} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                {data.map((d) => <Cell key={d.label} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-display text-[19px] font-extrabold leading-none text-[#0F172A] tabular-nums">{total}</p>
              <p className="mt-1 text-[10.5px] font-medium text-[#94A3B8]">{totalLabel}</p>
            </div>
          </div>
        </div>
        <ul className="min-w-0 flex-1">
          {data.map((d) => (
            <li key={d.label} className="flex h-[25px] items-center gap-2.5">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#475569]">{d.label}</span>
              <span className="text-xs font-bold text-[#0F172A] tabular-nums">{d.share}%</span>
              <span className="text-[11.5px] font-medium text-[#94A3B8] tabular-nums">({d.count})</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** RFC-4180 enough for Excel: quote everything, double the inner quotes. */
const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default function ReportsAnalytics() {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Default to the last 30 days — the same window the endpoint used before.
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('30d'));

  /**
   * Exports exactly the figures on screen, client-side. No server report
   * generator exists, and a button that silently does nothing is worse than
   * one that hands the doctor the same numbers they are looking at.
   */
  function exportCsv() {
    if (!report) return;
    const a = analyticsFromReport(report);
    const rows: string[][] = [['Metric', 'Value']];
    for (const k of a.kpis) rows.push([k.label, String(k.value)]);
    rows.push([], ['Period', 'Revenue (INR)']);
    for (const m of a.revenueBars) rows.push([m.period, String(m.value)]);
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mateo-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Re-fetch whenever the range changes; the string key avoids re-running on a
  // new-but-equal object identity.
  const rangeKey = `${preset}:${range?.from ?? ''}:${range?.to ?? ''}`;
  useEffect(() => {
    let cancelled = false;
    void getReport(range ?? undefined)
      .then((r) => {
        if (!cancelled) { setReport(r); setLoadError(null); }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load the report');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  // Full-page loader only on the FIRST load; a range change re-fetches under the
  // header (which carries the selector) so the control never vanishes.
  if (loading && !report) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-[#64748B]">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading report…
      </p>
    );
  }

  if (!report) {
    return (
      <p role="alert" className="rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
        {loadError ?? 'Could not load the report.'}
      </p>
    );
  }

  const a = analyticsFromReport(report);
  const ANALYTICS_KPIS = a.kpis;
  const REVENUE_BARS = a.revenueBars;
  const REVENUE_AVG = a.revenueAvg;
  const APPT_SERIES = a.apptSeries;
  const APPT_STATUS_SPLIT = a.apptStatusSplit;
  const DEMOGRAPHICS = a.demographics;
  const TOP_PROVIDERS = a.topProviders;
  const TOP_SERVICES = a.topServices;
  const COMPARISON = a.comparison;
  // Report history needs a saved-reports store, which does not exist yet.
  const RECENT_REPORTS: { name: string; type: string; range: string; on: string; by: string }[] = [];
  const RECENT_ACTIVITY: { tint: string; fg: string; icon: string; title: string; subtitle: string; elapsed: string; datetime: string }[] = [];
  return (
    // One column, full width. The 300px rail was squeezing both charts into
    // half of what was left, which is what crushed the axis labels together.
    <div className="flex flex-col gap-[18px]">
      <div className="flex min-w-0 flex-col gap-[18px]">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[15px]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
                <BarChart3 className="h-[22px] w-[22px] text-white" />
              </span>
              <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">Reports &amp; Analytics</h1>
            </div>
            <p className="mt-1.5 text-sm text-[#64748B] sm:pl-[59px]">Insights and analytics to help you make better decisions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {loading && <Loader2 aria-label="Updating" className="h-4 w-4 animate-spin text-[#94A3B8]" />}
            <RangeSelector preset={preset} range={range} onChange={(p, r) => { setLoading(true); setPreset(p); setRange(r); }} />
            <button type="button" aria-label="Export report" onClick={exportCsv} className="flex h-[46px] items-center gap-2 rounded-[11px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
              <Download className="h-[17px] w-[17px] text-[#334155]" />
              <span className="text-[13.5px] font-bold text-[#1E2A5A]">Export Report</span>
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {ANALYTICS_KPIS.map((k) => {
            const Icon = ICONS[k.icon] ?? CalendarDays;
            return (
              <div key={k.id} className="rounded-[13px] border border-[#ECEEF4] bg-white px-4 pb-3.5 pt-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px]" style={{ background: k.tint }}>
                    <Icon className="h-[18px] w-[18px]" style={{ color: k.fg }} />
                  </span>
                  <span className="min-w-0 text-[12.5px] font-medium text-[#64748B]">{k.label}</span>
                </div>
                <p className="mt-2.5 font-display text-2xl font-extrabold leading-none tracking-[-0.02em] text-[#0F172A] tabular-nums">{k.value}</p>
                <p className="mt-[7px] text-[11.5px] font-medium text-[#94A3B8]">{COMPARISON}</p>
              </div>
            );
          })}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className={`${CARD} px-5 pb-4 pt-[18px]`}>
            <div className="flex items-center gap-3">
              <h2 className={H2}>Appointments Overview</h2>
              <PeriodPill id="appt-period" options={['Daily', 'Weekly', 'Monthly']} />
            </div>
            <ul className="mb-1 mt-3 flex flex-wrap gap-x-[22px] gap-y-1">
              {[['#4F46E5', 'Appointments'], ['#16A34A', 'Consultations']].map(([c, l]) => (
                <li key={l} className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                  <span aria-hidden="true" className="h-[2.5px] w-[18px] rounded-full" style={{ background: c }} />
                  {l}
                </li>
              ))}
            </ul>
            <div role="img" aria-label="Appointments and consultations per day, 1 to 12 May 2025" style={{ height: 230 }} className="mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={APPT_SERIES} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F46E5" stopOpacity={0.16} /><stop offset="100%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16A34A" stopOpacity={0.14} /><stop offset="100%" stopColor="#16A34A" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10.5, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={22} />
                  <YAxis domain={[0, 200]} ticks={[0, 50, 100, 150, 200]} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="rounded-[9px] border border-[#ECEEF4] bg-white px-[13px] py-2.5 shadow-[0_8px_20px_-8px_rgba(15,23,42,.22)]">
                        <p className="text-xs font-bold text-[#0F172A]">{label} 2025</p>
                        {payload.map((p) => (
                          <p key={p.name} className="mt-1 flex items-center gap-2 text-[11.5px]">
                            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                            <span className="text-[#475569]">{p.name === 'appointments' ? 'Appointments' : 'Consultations'}</span>
                            <span className="ml-auto font-bold text-[#0F172A]">{p.value}</span>
                          </p>
                        ))}
                      </div>
                    ) : null}
                  />
                  <Area type="linear" dataKey="appointments" stroke="#4F46E5" strokeWidth={2} fill="url(#gA)" dot={{ r: 3.5, fill: '#4F46E5' }} isAnimationActive={false} />
                  <Area type="linear" dataKey="consultations" stroke="#16A34A" strokeWidth={2} fill="url(#gC)" dot={{ r: 3.5, fill: '#16A34A' }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={`${CARD} px-5 pb-4 pt-[18px]`}>
            <div className="flex items-center gap-3">
              <h2 className={H2}>Revenue Overview</h2>
              <PeriodPill id="rev-period" options={['Weekly', 'Monthly', 'Quarterly']} />
            </div>
            <p className="mt-2.5 font-display text-[23px] font-extrabold leading-none tracking-[-0.02em] text-[#0F172A] tabular-nums">₹18,74,560</p>
            <p className="mt-0.5 text-xs font-medium text-[#64748B]">Total Revenue</p>
            <p className="mt-1.5 flex items-center gap-1">
              <ArrowUp aria-hidden="true" className="h-3 w-3 text-[#12A150]" />
              <span className="text-xs font-bold text-[#12A150]">22%</span>
              <span className="text-[11.5px] font-medium text-[#94A3B8]">{COMPARISON}</span>
            </p>
            <div role="img" aria-label="Revenue by week in lakh rupees" style={{ height: 150 }} className="mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={REVENUE_BARS} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 10.5, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={22} />
                  <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tickFormatter={(v) => (v === 0 ? '0' : `${v}L`)} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                  <ReferenceLine y={REVENUE_AVG} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: `Avg: ₹${REVENUE_AVG}L`, position: 'right', fontSize: 10.5, fill: '#64748B' }} />
                  <Bar dataKey="value" barSize={30} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {REVENUE_BARS.map((b) => <Cell key={b.period} fill={b.highlight ? '#4F46E5' : '#C7C2F7'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <DonutCard title="Patient Demographics" id="demo-period" total="2,486" totalLabel="Total Patients" data={DEMOGRAPHICS} />
          <DonutCard title="Appointment Status" id="status-period" total="1,248" totalLabel="Total" data={APPT_STATUS_SPLIT} />

          <section className={`${CARD} px-5 pb-4 pt-[18px]`}>
            <div className="flex items-center gap-3">
              <h2 className={H2}>Top Services</h2>
              <PeriodPill id="svc-period" options={['This Month', 'Last Month']} />
            </div>
            <ul className="mt-3.5 flex flex-col gap-[15px]">
              {TOP_SERVICES.map((s) => (
                <li key={s.name}>
                  <p className="text-[12.5px] font-semibold text-[#334155]">{s.name}</p>
                  <div className="mt-[7px] flex items-center gap-3">
                    <span role="progressbar" aria-label={s.name} aria-valuenow={s.share} aria-valuemin={0} aria-valuemax={100}
                      className="relative h-[7px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#EEF0F8]">
                      {s.light && <span className="absolute inset-y-0 left-0 rounded-full bg-[#C7C2F7]" style={{ width: `${s.light}%` }} />}
                      <span className="absolute inset-y-0 left-0 rounded-full bg-[#4F46E5]" style={{ width: `${s.solid}%` }} />
                    </span>
                    <span className="shrink-0 text-[12.5px] font-bold text-[#0F172A] tabular-nums">{s.count}</span>
                    <span className="shrink-0 text-[11.5px] font-medium text-[#94A3B8]">({s.share}%)</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Recent reports */}
        <section className={`${CARD} pb-4 pt-[18px]`}>
          <h2 className={cn(H2, 'px-5')}>Recent Reports</h2>
          <div className="mt-3.5 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0">
              <caption className="sr-only">Recently generated reports</caption>
              <thead>
                <tr>
                  {['Report Name', 'Type', 'Date Range', 'Generated On', 'Generated By', 'Action'].map((h, i) => (
                    <th key={h} scope="col" className={cn('h-9 border-y border-[#F1F3F9] bg-white text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]', i === 0 && 'pl-5')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECENT_REPORTS.map((r) => (
                  <tr key={r.name} className="hover:bg-[#FAFBFF]">
                    <th scope="row" className="h-[42px] border-b border-[#F1F3F9] pl-5 pr-3 text-left text-[12.5px] font-semibold text-[#0F172A]">{r.name}</th>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{r.type}</td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{r.range}</td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{r.on}</td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{r.by}</td>
                    <td className="border-b border-[#F1F3F9] pr-5">
                      <span className="flex items-center gap-3.5">
                        <button type="button" aria-label={`Download ${r.name}`}><Download className="h-4 w-4 text-[#3B4FE0]" /></button>
                        <button type="button" aria-label={`Duplicate ${r.name}`}><Copy className="h-4 w-4 text-[#64748B]" /></button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="mt-3.5 flex items-center gap-2 px-5 text-[13px] font-bold text-[#3B4FE0] hover:underline">
            View All Reports
            <ChevronRight className="h-4 w-4" />
          </button>
        </section>
      </div>

      {/* Recent Activity + Top Providers sit at the BOTTOM now, side by side —
          they are reference reading, not something to keep in the corner of the
          eye while the charts are being read. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={`${CARD} px-[18px] pb-4 pt-[18px]`}>
          <div className="flex items-center">
            <h2 className={H2}>Recent Activity</h2>
            <button type="button" className="ml-auto text-[12.5px] font-bold text-[#3B4FE0] hover:underline">View All</button>
          </div>
          <ul className="mt-3.5 flex flex-col gap-4">
            {RECENT_ACTIVITY.map((a) => {
              const Icon = ICONS[a.icon] ?? CalendarDays;
              return (
                <li key={a.title} className="flex items-start gap-3">
                  <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px]" style={{ background: a.tint }}>
                    <Icon className="h-[15px] w-[15px]" style={{ color: a.fg }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-bold text-[#0F172A]">{a.title}</span>
                    <span className="block text-[11.5px] text-[#64748B]">{a.subtitle}</span>
                  </span>
                  <time dateTime={a.datetime} className="shrink-0 text-[11px] font-medium text-[#94A3B8]">{a.elapsed}</time>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={`${CARD} px-[18px] pb-4 pt-[18px]`}>
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className={H2}>Top Providers</h2>
            <span className="text-xs font-medium text-[#64748B]">(by Consultations)</span>
            <button type="button" className="ml-auto text-[12.5px] font-bold text-[#3B4FE0] hover:underline">View All</button>
          </div>
          <ul className="mt-3.5">
            {TOP_PROVIDERS.map((p, i) => (
              <li key={p.name} className={cn('flex h-[46px] items-center gap-3', i > 0 && 'border-t border-[#F1F3F9]')}>
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[12px] font-bold" style={{ background: p.tint, color: p.fg }}>
                  {p.name.replace('Dr. ', '').split(' ').map((w) => w[0]).join('')}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#0F172A]">{p.name}</span>
                <span className="text-[13.5px] font-bold text-[#0F172A] tabular-nums">{p.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
