import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarRange, Download, IndianRupee, Printer, Stethoscope, Users } from 'lucide-react';
import { ApiError } from '../../api/client';
import { getReport } from '../../api/doctorAnalytics';
import type { DoctorReport, LabelCount } from '../../api/doctorAnalytics';
import { Card } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import type { TabItem } from '../../components/ui/Tabs';
import { BarTrend, Donut, EmptyState, Kpi, SectionCard, SkeletonKpi, SkeletonRows } from '../../components/panel/kit';
import { buttonClass } from '../../components/ui/buttonStyles';
import { inputCls } from '../../components/ui/field';
import { cn } from '../../lib/cn';
import { useEntrance } from '../../lib/gsap';
import { formatDateIST, todayInputValueIST } from '../../lib/age';

type ReportTab = 'revenue' | 'patients' | 'appointments' | 'consultations';

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
// Chart order per the design: navy · teal · green · amber · violet · rose · slate.
const CHART = ['#1e3a8a', '#0d9488', '#059669', '#f59e0b', '#8b5cf6', '#ef4444', '#94a3b8'];
const toDonut = (rows: LabelCount[]) => rows.map((r, i) => ({ label: r.label, value: r.count, color: CHART[i % CHART.length] }));
const isoDaysAgo = (n: number) => {
  const d = new Date(Date.now() - n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// A small breakdown table (label + count + % of total).
function Breakdown({ rows, empty }: { rows: LabelCount[]; empty: string }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (rows.length === 0) return <EmptyState icon={BarChart3} text={empty} />;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm capitalize text-stone-600">{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full" style={{ width: `${total ? (r.count / total) * 100 : 0}%`, background: 'var(--primary)' }} />
          </div>
          <span className="w-10 shrink-0 text-right font-display text-sm font-bold tabular-nums text-stone-800">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const rootRef = useEntrance<HTMLDivElement>([]);
  const [from, setFrom] = useState(isoDaysAgo(29));
  const [to, setTo] = useState(todayInputValueIST());
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ReportTab>('revenue');

  // No synchronous setState here (loading starts true) so the mount effect below
  // stays clean; the Apply button flips `loading` in its own handler.
  const load = useCallback(() => {
    getReport({ from, to })
      .then((r) => {
        setReport(r);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Could not load the report'))
      .finally(() => setLoading(false));
  }, [from, to]);

  function applyRange() {
    setLoading(true);
    load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs = useMemo<TabItem<ReportTab>[]>(
    () => [
      { value: 'revenue', label: 'Revenue' },
      { value: 'patients', label: 'Patients' },
      { value: 'appointments', label: 'Appointments' },
      { value: 'consultations', label: 'Consultations' },
    ],
    [],
  );

  function exportCsv() {
    if (!report) return;
    const rows: string[][] = [
      ['Mateo — Practice report', `${report.range.from} to ${report.range.to}`],
      [],
      ['Revenue'],
      ['Total collected', String(report.revenue.total)],
      ['Paid invoices', String(report.revenue.paidInvoices)],
      ['Collection rate %', report.revenue.collectionRate == null ? '—' : String(report.revenue.collectionRate)],
      [],
      ['Date', 'Collected (₹)'],
      ...report.revenue.byDay.map((d) => [d.date, String(d.amount)]),
      [],
      ['Patients — new', String(report.patients.newCount)],
      ['By gender', ...report.patients.byGender.map((g) => `${g.label}: ${g.count}`)],
      ['By age', ...report.patients.byAge.map((a) => `${a.label}: ${a.count}`)],
      ['By source', ...report.patients.bySource.map((s) => `${s.label}: ${s.count}`)],
      [],
      ['Appointments — total', String(report.appointments.total)],
      ['Avg duration (min)', String(report.appointments.avgDurationMin)],
      ['By status', ...report.appointments.byStatus.map((s) => `${s.label}: ${s.count}`)],
      ['By mode', ...report.appointments.byMode.map((m) => `${m.label}: ${m.count}`)],
      [],
      ['Consultations — total', String(report.consultations.total)],
      ['By kind', ...report.consultations.byKind.map((k) => `${k.label}: ${k.count}`)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mateo-report-${report.range.from}_${report.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    if (!report) return;
    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) return;
    const section = (title: string, rows: LabelCount[]) =>
      `<h3>${title}</h3><table>${rows.map((r) => `<tr><td>${r.label}</td><td class="n">${r.count}</td></tr>`).join('') || '<tr><td>No data</td></tr>'}</table>`;
    win.document.write(`<!doctype html><html><head><title>Practice report</title><style>
      body{font-family:Inter,system-ui,sans-serif;color:#1f2937;padding:32px;max-width:760px;margin:0 auto}
      h1{font-size:22px;margin:0 0 4px} .sub{color:#6b7280;margin:0 0 24px;font-size:13px}
      h2{font-size:15px;border-bottom:2px solid #1e3a8a;padding-bottom:4px;margin-top:28px}
      h3{font-size:13px;color:#6b7280;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.04em}
      table{width:100%;border-collapse:collapse;font-size:13px} td{padding:4px 0;border-bottom:1px solid #eee} .n{text-align:right;font-weight:700}
      .kpis{display:flex;gap:16px;margin:8px 0 4px} .kpi{flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:12px}
      .kpi b{display:block;font-size:20px;color:#059669} .kpi span{font-size:11px;color:#6b7280;text-transform:uppercase}
    </style></head><body>
      <h1>Practice report</h1><p class="sub">${report.range.from} — ${report.range.to} · generated ${new Date().toLocaleDateString('en-IN')}</p>
      <h2>Revenue</h2>
      <div class="kpis">
        <div class="kpi"><b>${inr(report.revenue.total)}</b><span>Collected</span></div>
        <div class="kpi"><b>${report.revenue.paidInvoices}</b><span>Paid invoices</span></div>
        <div class="kpi"><b>${report.revenue.collectionRate == null ? '—' : report.revenue.collectionRate + '%'}</b><span>Collection rate</span></div>
      </div>
      <h3>Top days</h3><table>${report.revenue.topDays.map((d) => `<tr><td>${d.date}</td><td class="n">${inr(d.amount)}</td></tr>`).join('') || '<tr><td>No collections</td></tr>'}</table>
      <h2>Patients</h2><div class="kpis"><div class="kpi"><b>${report.patients.newCount}</b><span>New in range</span></div></div>
      ${section('By gender', report.patients.byGender)}${section('By age', report.patients.byAge)}${section('By source', report.patients.bySource)}
      <h2>Appointments</h2><div class="kpis"><div class="kpi"><b>${report.appointments.total}</b><span>Total</span></div><div class="kpi"><b>${report.appointments.avgDurationMin}m</b><span>Avg duration</span></div></div>
      ${section('By status', report.appointments.byStatus)}${section('By mode', report.appointments.byMode)}
      <h2>Consultations</h2><div class="kpis"><div class="kpi"><b>${report.consultations.total}</b><span>Visit notes</span></div></div>
      ${section('By kind', report.consultations.byKind)}
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  return (
    <div ref={rootRef} className="space-y-5">
      <Card data-entrance="hero" className="hero-aurora relative overflow-hidden p-6 sm:p-7">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-600">
              <BarChart3 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">Date-range practice reports</p>
              <h1 className="mt-0.5 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-[1.75rem]">Reports</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={printReport} disabled={!report} className={buttonClass('secondary', 'sm', 'disabled:opacity-50')}>
              <Printer className="h-4 w-4" /> Print / PDF
            </button>
            <button type="button" onClick={exportCsv} disabled={!report} className={buttonClass('secondary', 'sm', 'disabled:opacity-50')}>
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>

        {/* Date range */}
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t pt-4" style={{ borderColor: 'var(--hairline)' }}>
          <div>
            <label className="mb-1 block text-[0.66rem] font-bold uppercase tracking-wide text-stone-400">From</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={cn(inputCls, 'w-auto cursor-pointer')} />
          </div>
          <div>
            <label className="mb-1 block text-[0.66rem] font-bold uppercase tracking-wide text-stone-400">To</label>
            <input type="date" value={to} min={from} max={todayInputValueIST()} onChange={(e) => setTo(e.target.value)} className={cn(inputCls, 'w-auto cursor-pointer')} />
          </div>
          <button type="button" onClick={applyRange} className={buttonClass('primary', 'sm')}>
            <CalendarRange className="h-4 w-4" /> Apply
          </button>
        </div>
      </Card>

      {error && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      <div className="overflow-x-auto pb-1">
        <Tabs<ReportTab> items={tabs} value={tab} onChange={setTab} />
      </div>

      {loading || !report ? (
        <>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonKpi key={i} />
            ))}
          </div>
          <Card className="p-5">
            <SkeletonRows n={5} />
          </Card>
        </>
      ) : (
        <>
          {tab === 'revenue' && (
            <>
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                <Kpi icon={IndianRupee} label="Collected" value={report.revenue.total} prefix="₹" tone="emerald" sub="in range" />
                <Kpi icon={IndianRupee} label="Invoiced" value={report.revenue.invoiced} prefix="₹" tone="sky" sub="billed in range" />
                <Kpi icon={BarChart3} label="Collection rate" value={report.revenue.collectionRate ?? 0} suffix="%" tone="violet" sub={report.revenue.collectionRate == null ? 'no invoices' : 'collected / invoiced'} />
                <Kpi icon={IndianRupee} label="Paid invoices" value={report.revenue.paidInvoices} tone="amber" sub="in range" />
              </div>
              <SectionCard title="Daily collections" icon={BarChart3} eyebrow="Paid invoices by day">
                {report.revenue.byDay.some((d) => d.amount > 0) ? (
                  <BarTrend data={report.revenue.byDay} xKey="date" barKey="amount" height={220} unit="" />
                ) : (
                  <EmptyState icon={IndianRupee} text="No collections in this range." />
                )}
              </SectionCard>
              <SectionCard title="Top earning days" icon={IndianRupee}>
                {report.revenue.topDays.length === 0 ? (
                  <EmptyState icon={IndianRupee} text="No collections in this range." />
                ) : (
                  <div className="space-y-2">
                    {report.revenue.topDays.map((d) => (
                      <div key={d.date} className="flex items-center justify-between rounded-xl border p-2.5" style={{ borderColor: 'var(--hairline)' }}>
                        <span className="text-sm text-stone-700">{formatDateIST(d.date)}</span>
                        <span className="font-display font-bold tabular-nums text-stone-900">{inr(d.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {tab === 'patients' && (
            <>
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2">
                <Kpi icon={Users} label="New patients" value={report.patients.newCount} tone="violet" sub="joined in range" />
                <Kpi icon={Users} label="Age groups" value={report.patients.byAge.length} tone="sky" sub="represented" />
              </div>
              <SectionCard title="By gender" icon={Users} eyebrow="New patients in range">
                <Breakdown rows={report.patients.byGender} empty="No new patients in this range." />
              </SectionCard>
              <SectionCard title="Age distribution" icon={Users} eyebrow="New patients in range">
                {report.patients.byAge.length === 0 ? (
                  <EmptyState icon={Users} text="No new patients in this range." />
                ) : (
                  <Donut data={toDonut(report.patients.byAge)} centerValue={report.patients.byAge.reduce((s, r) => s + r.count, 0)} centerLabel="patients" />
                )}
              </SectionCard>
              <SectionCard title="Active roster by status" icon={Users}>
                <Breakdown rows={report.patients.byStatus} empty="No patients yet." />
              </SectionCard>
              <SectionCard title="By source" icon={Users} eyebrow="How families joined">
                <Breakdown rows={report.patients.bySource} empty="No patients yet." />
              </SectionCard>
            </>
          )}

          {tab === 'appointments' && (
            <>
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2">
                <Kpi icon={CalendarRange} label="Appointments" value={report.appointments.total} tone="sky" sub="in range" />
                <Kpi icon={CalendarRange} label="Avg duration" value={report.appointments.avgDurationMin} suffix=" min" tone="emerald" sub="per appointment" />
              </div>
              <SectionCard title="By status" icon={CalendarRange} eyebrow="Completed / cancelled / no-show">
                {report.appointments.byStatus.length === 0 ? (
                  <EmptyState icon={CalendarRange} text="No appointments in this range." />
                ) : (
                  <Donut data={toDonut(report.appointments.byStatus)} centerValue={report.appointments.total} centerLabel="appts" />
                )}
              </SectionCard>
              <SectionCard title="By mode" icon={CalendarRange} eyebrow="In-person / phone / video">
                <Breakdown rows={report.appointments.byMode} empty="No appointments in this range." />
              </SectionCard>
            </>
          )}

          {tab === 'consultations' && (
            <>
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2">
                <Kpi icon={Stethoscope} label="Visit notes" value={report.consultations.total} tone="emerald" sub="in range" />
                <Kpi icon={Stethoscope} label="Types" value={report.consultations.byKind.length} tone="violet" sub="recorded" />
              </div>
              <SectionCard title="By kind" icon={Stethoscope} eyebrow="Visit / follow-up / phone / procedure / note">
                <Breakdown rows={report.consultations.byKind} empty="No visit notes in this range." />
              </SectionCard>
            </>
          )}

          <p className="px-1 text-xs leading-relaxed text-stone-400">
            Figures are computed from your own tenant-scoped invoices, patients, appointments and visit notes for the selected range
            (IST). Revenue counts collected payments; the collection rate compares collected against invoiced in the range.
          </p>
        </>
      )}
    </div>
  );
}
