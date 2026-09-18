import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ArrowDown, ArrowUp, Loader2, BarChart3, Building2, CalendarDays, ChevronRight, Copy,
  Download, FileClock, FileText, IndianRupee, Receipt, Stethoscope, UserRound, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { analyticsFromReport, fullDayLabel, inr0, moneyTick } from '../../data/analytics';
import { getReport, getSavedReport, listSavedReports, saveReport } from '../../api/doctorAnalytics';
import type { DoctorReport, SavedReport } from '../../api/doctorAnalytics';
import { RangeSelector, rangeForPreset } from '../../components/doctor/v2/RangeSelector';
import type { DateRange, RangePreset } from '../../components/doctor/v2/RangeSelector';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const H2 = 'font-display text-[15.5px] font-bold tracking-[-0.01em] text-[#0F172A]';

const ICONS: Record<string, LucideIcon> = {
  CalendarDays, Stethoscope, UserRound, IndianRupee, FileText, Users, FileClock, Receipt, Building2,
};

/** Every card that can legitimately come back with nothing in it says so. */
function Empty({ children }: { children: string }) {
  return <p className="py-6 text-center text-[12.5px] font-medium text-[#94A3B8]">{children}</p>;
}

/**
 * A period-on-period change. `null` means the previous window was empty, so
 * there is no percentage to show — the caller prints the range label alone
 * rather than a fabricated figure.
 */
function Delta({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) return <span className="text-[11.5px] font-medium text-[#94A3B8]">{label}</span>;
  const up = pct >= 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <>
      <Arrow aria-hidden="true" className={cn('h-3 w-3', up ? 'text-[#12A150]' : 'text-[#EF4444]')} />
      <span className={cn('text-xs font-bold', up ? 'text-[#12A150]' : 'text-[#EF4444]')}>{Math.abs(pct)}%</span>
      <span className="text-[11.5px] font-medium text-[#94A3B8]">{label}</span>
    </>
  );
}

function DonutCard({ title, total, totalLabel, data, empty }: {
  title: string; total: string; totalLabel: string; empty: string;
  data: { label: string; color: string; share: number; count: number }[];
}) {
  return (
    <section className={`${CARD} px-5 pb-4 pt-[18px]`}>
      <h2 className={H2}>{title}</h2>
      {data.length === 0 ? <Empty>{empty}</Empty> : (
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
      )}
    </section>
  );
}

/** RFC-4180 enough for Excel: quote everything, double the inner quotes. */
const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const toCsv = (rows: string[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

/** Hands the browser a file without leaving the page. */
function download(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const RECENT_REPORTS_PAGE = 8;

export default function ReportsAnalytics() {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Default to the last 30 days — the same window the endpoint used before.
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('30d'));
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [savedLimit, setSavedLimit] = useState(RECENT_REPORTS_PAGE);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const refreshSaved = useCallback((limit: number) => {
    void listSavedReports(limit)
      .then((r) => setSaved(r.reports))
      // A failing history must not take the whole page down — the figures above
      // it are the point of the screen.
      .catch(() => setSaved([]));
  }, []);

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

  useEffect(() => refreshSaved(savedLimit), [refreshSaved, savedLimit]);

  /**
   * Exports exactly the figures on screen and records the export, so the
   * Recent Reports table below is a real history. The CSV that is stored IS the
   * one downloaded — re-running the range later would give different numbers.
   */
  async function exportCsv() {
    if (!report || exporting) return;
    setExporting(true);
    setExportError(null);
    const a = analyticsFromReport(report);
    const rows: string[][] = [
      ['Mateo clinic report'],
      ['Period', a.rangeLabel],
      ['Compared with', `${fullDayLabel(report.previous.from)} – ${fullDayLabel(report.previous.to)}`],
      [],
      ['Metric', 'Value', 'Change vs previous period'],
    ];
    for (const k of a.kpis) rows.push([k.label, k.value, k.delta === null ? 'n/a' : `${k.delta}%`]);
    rows.push([], ['Date', 'Revenue collected (INR)', 'Appointments', 'Consultations']);
    const apptByDate = new Map(a.apptSeries.map((d) => [d.date, d]));
    for (const m of a.revenueBars) {
      const d = apptByDate.get(m.date);
      rows.push([m.date, String(m.value), String(d?.appointments ?? 0), String(d?.consultations ?? 0)]);
    }
    if (a.topServices.length) {
      rows.push([], ['Service', 'Times billed', 'Amount (INR)', 'Share']);
      for (const s of a.topServices) rows.push([s.name, String(s.count), String(s.amount), `${s.share}%`]);
    }
    if (a.demographics.length) {
      rows.push([], ['Age group (new patients)', 'Count', 'Share']);
      for (const d of a.demographics) rows.push([d.label, String(d.count), `${d.share}%`]);
    }
    if (a.apptStatusSplit.length) {
      rows.push([], ['Appointment status', 'Count', 'Share']);
      for (const d of a.apptStatusSplit) rows.push([d.label, String(d.count), `${d.share}%`]);
    }
    if (a.topLocations.length) {
      rows.push([], ['Clinic location', 'Appointments']);
      for (const l of a.topLocations) rows.push([l.name, String(l.count)]);
    }
    const csv = toCsv(rows);
    const name = `Practice summary · ${a.rangeLabel}`;
    download(`mateo-report-${report.range.from}-to-${report.range.to}.csv`, csv);
    try {
      await saveReport({ name, type: 'summary', from: report.range.from, to: report.range.to, csv });
      refreshSaved(savedLimit);
    } catch (e: unknown) {
      // The doctor already has their file; only the history entry failed.
      setExportError(e instanceof Error ? e.message : 'The report downloaded but could not be saved to history');
    } finally {
      setExporting(false);
    }
  }

  /** Re-downloads the stored snapshot, not a fresh run of the same range. */
  async function downloadSaved(row: SavedReport) {
    try {
      const full = await getSavedReport(row.id);
      download(`mateo-report-${full.from}-to-${full.to}.csv`, full.csv);
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : 'Could not download that report');
    }
  }

  /** "Duplicate" = look at that report's window again, live. */
  function openRange(row: SavedReport) {
    setLoading(true);
    setPreset('custom');
    setRange({ from: row.from, to: row.to });
  }

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
  const apptPeak = Math.max(...a.apptSeries.map((d) => Math.max(d.appointments, d.consultations)), 0);

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
            <p className="mt-1.5 text-sm text-[#64748B] sm:pl-[59px]">
              Every figure below covers {a.rangeLabel}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {loading && <Loader2 aria-label="Updating" className="h-4 w-4 animate-spin text-[#94A3B8]" />}
            <RangeSelector preset={preset} range={range} onChange={(p, r) => { setLoading(true); setPreset(p); setRange(r); }} />
            <button
              type="button"
              aria-label="Export report"
              onClick={() => void exportCsv()}
              disabled={exporting}
              className="flex h-[46px] items-center gap-2 rounded-[11px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC] disabled:opacity-60"
            >
              {exporting
                ? <Loader2 aria-hidden="true" className="h-[17px] w-[17px] animate-spin text-[#334155]" />
                : <Download className="h-[17px] w-[17px] text-[#334155]" />}
              <span className="text-[13.5px] font-bold text-[#1E2A5A]">Export Report</span>
            </button>
          </div>
        </div>

        {exportError && (
          <p role="alert" className="rounded-[10px] border border-[#FDE6C8] bg-[#FEF7EC] px-4 py-2.5 text-[12.5px] font-medium text-[#95541A]">
            {exportError}
          </p>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {a.kpis.map((k) => {
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
                <p className="mt-[7px] flex items-center gap-1">
                  <Delta pct={k.delta} label={a.comparison} />
                </p>
              </div>
            );
          })}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className={`${CARD} px-5 pb-4 pt-[18px]`}>
            <h2 className={H2}>Appointments Overview</h2>
            <ul className="mb-1 mt-3 flex flex-wrap gap-x-[22px] gap-y-1">
              {[['#4F46E5', 'Appointments'], ['#16A34A', 'Consultations']].map(([c, l]) => (
                <li key={l} className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                  <span aria-hidden="true" className="h-[2.5px] w-[18px] rounded-full" style={{ background: c }} />
                  {l}
                </li>
              ))}
            </ul>
            {a.apptSeries.length === 0 ? <Empty>No appointments or consultations in this period.</Empty> : (
              <div
                role="img"
                aria-label={`Appointments and consultations per day, ${a.rangeLabel}. ${report.appointments.total} appointments and ${report.consultations.total} consultations in total.`}
                style={{ height: 230 }}
                className="mt-2"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={a.apptSeries} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                    <defs>
                      <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F46E5" stopOpacity={0.16} /><stop offset="100%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16A34A" stopOpacity={0.14} /><stop offset="100%" stopColor="#16A34A" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10.5, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={22} />
                    {/* Scales to the data. A fixed 0–200 axis flattened a real
                        clinic's ten-a-day line onto the floor. */}
                    <YAxis allowDecimals={false} domain={[0, apptPeak <= 4 ? 4 : 'auto']} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => active && payload?.length ? (
                        <div className="rounded-[9px] border border-[#ECEEF4] bg-white px-[13px] py-2.5 shadow-[0_8px_20px_-8px_rgba(15,23,42,.22)]">
                          <p className="text-xs font-bold text-[#0F172A]">{label}</p>
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
            )}
          </section>

          <section className={`${CARD} px-5 pb-4 pt-[18px]`}>
            <h2 className={H2}>Revenue Overview</h2>
            <p className="mt-2.5 font-display text-[23px] font-extrabold leading-none tracking-[-0.02em] text-[#0F172A] tabular-nums">{inr0(a.revenueTotal)}</p>
            <p className="mt-0.5 text-xs font-medium text-[#64748B]">
              Collected in this period{report.revenue.collectionRate !== null && ` · ${report.revenue.collectionRate}% of what was invoiced`}
            </p>
            <p className="mt-1.5 flex items-center gap-1">
              <Delta pct={a.revenueDelta} label={a.comparison} />
            </p>
            {a.revenueBars.length === 0 ? <Empty>No payments recorded in this period.</Empty> : (
              <div role="img" aria-label={`Revenue collected per day, ${a.rangeLabel}, totalling ${inr0(a.revenueTotal)}`} style={{ height: 150 }} className="mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.revenueBars} margin={{ top: 6, right: 34, bottom: 0, left: -6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 10.5, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={22} />
                    {/* Amounts are RUPEES. The axis formats itself (k / L / Cr) —
                        it used to be a fixed 0–20 "lakh" scale. */}
                    <YAxis tickFormatter={moneyTick} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => active && payload?.length ? (
                        <div className="rounded-[9px] border border-[#ECEEF4] bg-white px-[13px] py-2.5 shadow-[0_8px_20px_-8px_rgba(15,23,42,.22)]">
                          <p className="text-xs font-bold text-[#0F172A]">{label}</p>
                          <p className="mt-1 text-[11.5px] font-bold text-[#0F172A]">{inr0(Number(payload[0].value ?? 0))}</p>
                        </div>
                      ) : null}
                    />
                    {a.revenueAvg > 0 && (
                      // The mean across EVERY day in the window, quiet days
                      // included — a daily run-rate, not the average of the bars
                      // that happen to be non-zero.
                      <ReferenceLine y={a.revenueAvg} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: `Avg/day ${moneyTick(a.revenueAvg)}`, position: 'right', fontSize: 10.5, fill: '#64748B' }} />
                    )}
                    <Bar dataKey="value" maxBarSize={30} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      {a.revenueBars.map((b) => <Cell key={b.date} fill={b.value >= a.revenueAvg && b.value > 0 ? '#4F46E5' : '#C7C2F7'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <DonutCard
            title="Patient Demographics"
            total={a.totalPatients.toLocaleString('en-IN')}
            totalLabel="Patients on roster"
            data={a.demographics}
            empty="No new patients registered in this period."
          />
          <DonutCard
            title="Appointment Status"
            total={report.appointments.total.toLocaleString('en-IN')}
            totalLabel="Appointments"
            data={a.apptStatusSplit}
            empty="No appointments in this period."
          />

          <section className={`${CARD} px-5 pb-4 pt-[18px]`}>
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className={H2}>Top Services</h2>
              <span className="text-xs font-medium text-[#64748B]">(as billed)</span>
            </div>
            {a.topServices.length === 0 ? <Empty>No invoices raised in this period.</Empty> : (
              <ul className="mt-3.5 flex flex-col gap-[15px]">
                {a.topServices.map((s) => (
                  <li key={s.name}>
                    <div className="flex items-baseline gap-2">
                      <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#334155]">{s.name}</p>
                      <p className="shrink-0 text-[11.5px] font-medium text-[#64748B] tabular-nums">{inr0(s.amount)}</p>
                    </div>
                    <div className="mt-[7px] flex items-center gap-3">
                      <span role="progressbar" aria-label={s.name} aria-valuenow={s.share} aria-valuemin={0} aria-valuemax={100}
                        className="relative h-[7px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#EEF0F8]">
                        <span className="absolute inset-y-0 left-0 rounded-full bg-[#4F46E5]" style={{ width: `${s.solid}%` }} />
                      </span>
                      <span className="shrink-0 text-[12.5px] font-bold text-[#0F172A] tabular-nums">{s.count}</span>
                      <span className="shrink-0 text-[11.5px] font-medium text-[#94A3B8]">({s.share}%)</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Recent reports */}
        <section className={`${CARD} pb-4 pt-[18px]`}>
          <h2 className={cn(H2, 'px-5')}>Recent Reports</h2>
          {saved.length === 0 ? (
            <p className="px-5 py-6 text-[12.5px] font-medium text-[#94A3B8]">
              No reports yet. Use Export Report above and it will be saved here, with the figures it was generated from.
            </p>
          ) : (
            <>
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
                    {saved.map((r) => (
                      <tr key={r.id} className="hover:bg-[#FAFBFF]">
                        <th scope="row" className="h-[42px] border-b border-[#F1F3F9] pl-5 pr-3 text-left text-[12.5px] font-semibold text-[#0F172A]">{r.name}</th>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium capitalize text-[#334155]">{r.type}</td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{fullDayLabel(r.from)} – {fullDayLabel(r.to)}</td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">
                          {new Date(r.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{r.generatedBy}</td>
                        <td className="border-b border-[#F1F3F9] pr-5">
                          <span className="flex items-center gap-3.5">
                            <button type="button" aria-label={`Download ${r.name}`} title="Download this snapshot" onClick={() => void downloadSaved(r)}>
                              <Download className="h-4 w-4 text-[#3B4FE0]" />
                            </button>
                            <button type="button" aria-label={`View ${r.name} range again`} title="Look at this period again" onClick={() => openRange(r)}>
                              <Copy className="h-4 w-4 text-[#64748B]" />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {saved.length >= savedLimit && (
                <button type="button" onClick={() => setSavedLimit((n) => n + RECENT_REPORTS_PAGE * 2)}
                  className="mt-3.5 flex items-center gap-2 px-5 text-[13px] font-bold text-[#3B4FE0] hover:underline">
                  View All Reports
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </section>
      </div>

      {/* Recent Activity + Appointments by location sit at the BOTTOM now, side
          by side — they are reference reading, not something to keep in the
          corner of the eye while the charts are being read. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={`${CARD} px-[18px] pb-4 pt-[18px]`}>
          <div className="flex items-center">
            <h2 className={H2}>Recent Activity</h2>
            <Link to="/doctor/audit" className="ml-auto text-[12.5px] font-bold text-[#3B4FE0] hover:underline">View All</Link>
          </div>
          {a.activity.length === 0 ? <Empty>Nothing recorded yet. Bookings, invoices and patient changes show up here.</Empty> : (
            <ul className="mt-3.5 flex flex-col gap-4">
              {a.activity.map((row) => {
                const Icon = ICONS[row.icon] ?? CalendarDays;
                return (
                  <li key={row.id} className="flex items-start gap-3">
                    <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px]" style={{ background: row.tint }}>
                      <Icon className="h-[15px] w-[15px]" style={{ color: row.fg }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-bold text-[#0F172A]">{row.title}</span>
                      {row.subtitle && <span className="block text-[11.5px] text-[#64748B]">{row.subtitle}</span>}
                    </span>
                    <time dateTime={row.datetime} className="shrink-0 text-[11px] font-medium text-[#94A3B8]">{row.elapsed}</time>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${CARD} px-[18px] pb-4 pt-[18px]`}>
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className={H2}>Appointments by Location</h2>
            <Link to="/doctor/locations" className="ml-auto text-[12.5px] font-bold text-[#3B4FE0] hover:underline">Manage</Link>
          </div>
          {a.topLocations.length === 0 ? <Empty>No appointments in this period.</Empty> : (
            <ul className="mt-3.5">
              {a.topLocations.map((p, i) => (
                <li key={p.name} className={cn('flex h-[46px] items-center gap-3', i > 0 && 'border-t border-[#F1F3F9]')}>
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full" style={{ background: p.tint }}>
                    <Building2 className="h-[16px] w-[16px]" style={{ color: p.fg }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#0F172A]">{p.name}</span>
                  <span className="text-[13.5px] font-bold text-[#0F172A] tabular-nums">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
