import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowDownLeft, ArrowLeftRight, ArrowUp, ArrowUpRight, Ban, CircleCheck, Clock, Download, Eye, Plus, Printer, ReceiptText, TrendingUp, Wallet, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ApiError } from '../../api/client';
import { createInvoice, getBillingSummary, getInvoice, listInvoices, listTransactions, updateInvoice } from '../../api/doctorBilling';
import type { BillingSummary, InvoiceFull, InvoiceListItem, InvoiceStatus, LedgerResponse } from '../../api/doctorBilling';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { getMyDoctorProfile } from '../../api/doctors';
import type { DoctorProfile } from '../../api/doctors';
import { useT } from '../../i18n/context';
import { Card } from '../../components/ui/Card';
import { StatusPill } from '../../components/ui/StatusPill';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import type { SegmentOption } from '../../components/ui/SegmentedControl';
import { Modal } from '../../components/ui/Modal';
import { Table, TBody, TD, TH, THead, TR } from '../../components/ui/Table';
import { DropdownMenu } from '../../components/ui/DropdownMenu';
import type { DropdownEntry } from '../../components/ui/DropdownMenu';
import { Pagination } from '../../components/ui/Pagination';
import { Avatar } from '../../components/ui/Avatar';
import type { Tone } from '../../components/ui/tones';
import { buttonClass } from '../../components/ui/buttonStyles';
import { BarTrend, EmptyState, Kpi, SectionCard, SkeletonChart, SkeletonKpi, SkeletonRows } from '../../components/panel/kit';
import { cn } from '../../lib/cn';
import { useEntrance } from '../../lib/gsap';
import { formatDateIST } from '../../lib/age';

type Filter = 'all' | 'unpaid' | 'paid' | 'cancelled';
type InvSort = { key: 'date' | 'amount'; dir: 'asc' | 'desc' };
const PAGE_SIZE = 10;

const STATUS_META: Record<InvoiceStatus, { labelKey: string; tone: Tone; icon: LucideIcon }> = {
  unpaid: { labelKey: 'doctor.billing.stUnpaid', tone: 'amber', icon: Clock },
  partial: { labelKey: 'doctor.billing.stPartial', tone: 'amber', icon: Clock },
  paid: { labelKey: 'doctor.billing.stPaid', tone: 'emerald', icon: CircleCheck },
  cancelled: { labelKey: 'doctor.billing.stCancelled', tone: 'stone', icon: Ban },
};

const inputClass =
  'w-full rounded-xl border border-stone-200 bg-[var(--input-background)] px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400';
const labelClass = 'mb-1 block text-[0.66rem] font-bold uppercase tracking-wide text-stone-400';

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

interface LineRow {
  description: string;
  amount: string;
}

export default function Billing() {
  const t = useT();
  const rootRef = useEntrance<HTMLDivElement>([]);

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[] | null>(null);
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<InvSort>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);

  // create form
  const [patientId, setPatientId] = useState('');
  const [lines, setLines] = useState<LineRow[]>([{ description: '', amount: '' }]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function refresh() {
    listInvoices()
      .then((d) => setInvoices(d.invoices))
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : t('doctor.billing.errLoad')));
    getBillingSummary()
      .then(setSummary)
      .catch(() => undefined);
    listTransactions()
      .then(setLedger)
      .catch(() => undefined);
  }

  useEffect(() => {
    refresh();
    listPatients()
      .then((d) => setPatients(d.patients.filter((p) => !p.archivedAt)))
      .catch(() => undefined);
    getMyDoctorProfile()
      .then((d) => setProfile(d.profile))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formTotal = useMemo(() => lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0), [lines]);

  async function submitInvoice() {
    const items = lines
      .map((l) => ({ description: l.description.trim(), amount: parseFloat(l.amount) }))
      .filter((i) => i.description && Number.isFinite(i.amount) && i.amount > 0);
    if (!patientId) {
      setFormError(t('doctor.billing.errSelectPatient'));
      return;
    }
    if (items.length === 0) {
      setFormError(t('doctor.billing.errLineItem'));
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      await createInvoice({ patientId, items });
      setLines([{ description: '', amount: '' }]);
      setPatientId('');
      refresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : t('doctor.billing.errCreate'));
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: 'paid' | 'unpaid' | 'cancelled') {
    try {
      await updateInvoice(id, status);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('doctor.billing.errUpdate'));
    }
  }

  const filtered = useMemo(() => {
    let list = invoices ?? [];
    if (filter === 'unpaid') list = list.filter((i) => i.status === 'unpaid' || i.status === 'partial');
    else if (filter !== 'all') list = list.filter((i) => i.status === filter);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const [av, bv] = sort.key === 'amount' ? [a.total, b.total] : [a.date, b.date];
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [invoices, filter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function toggleSort(key: InvSort['key']) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
    setPage(1);
  }
  function rowItems(inv: InvoiceListItem): DropdownEntry[] {
    const items: DropdownEntry[] = [{ key: 'view', label: t('doctor.billing.view'), icon: Eye }];
    if (inv.status !== 'paid' && inv.status !== 'cancelled') items.push({ key: 'paid', label: t('doctor.billing.markPaid'), icon: CircleCheck });
    if (inv.status === 'paid') items.push({ key: 'unpaid', label: t('doctor.billing.undo'), icon: Clock });
    if (inv.status !== 'cancelled' && inv.status !== 'paid') items.push('separator', { key: 'cancelled', label: t('doctor.billing.cancel'), icon: Ban, danger: true });
    return items;
  }
  function onRowAction(inv: InvoiceListItem, key: string) {
    if (key === 'view') setDetailId(inv.id);
    else void setStatus(inv.id, key as 'paid' | 'unpaid' | 'cancelled');
  }
  const sortIcon = (key: InvSort['key']) => (sort.key !== key ? null : sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />);

  const FILTERS: SegmentOption<Filter>[] = [
    { value: 'all', label: t('doctor.billing.filterAll'), count: invoices?.length ?? 0 },
    { value: 'unpaid', label: t('doctor.billing.filterUnpaid'), count: invoices?.filter((i) => i.status === 'unpaid' || i.status === 'partial').length ?? 0 },
    { value: 'paid', label: t('doctor.billing.filterPaid'), count: invoices?.filter((i) => i.status === 'paid').length ?? 0 },
    { value: 'cancelled', label: t('doctor.billing.filterCancelled'), count: invoices?.filter((i) => i.status === 'cancelled').length ?? 0 },
  ];

  return (
    <div ref={rootRef} className="space-y-5">
      <Card data-entrance="hero" className="hero-aurora relative overflow-hidden p-6 sm:p-7">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Wallet className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">{t('doctor.billing.heroEyebrow')}</p>
            <h1 className="mt-0.5 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-[1.75rem]">{t('doctor.billing.title')}</h1>
          </div>
        </div>
      </Card>

      {error && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* KPIs */}
      {!summary ? (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonKpi key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <Kpi icon={Wallet} label={t('doctor.billing.kpiOutstanding')} value={summary.outstanding} prefix="₹" tone="rose" sub={t('doctor.billing.kpiUnpaid', { n: summary.unpaidCount })} />
          <Kpi icon={TrendingUp} label={t('doctor.billing.kpiCollected')} value={summary.collectedToday} prefix="₹" tone="emerald" sub={t('doctor.billing.kpiToday')} />
          <Kpi icon={TrendingUp} label={t('doctor.billing.kpiCollected')} value={summary.collectedMonth} prefix="₹" tone="sky" sub={t('doctor.billing.kpiMonth')} />
          <Kpi icon={ReceiptText} label={t('doctor.billing.kpiInvoices')} value={summary.totalInvoices} tone="violet" sub={t('doctor.billing.kpiAllTime')} />
        </div>
      )}

      {/* daily collection */}
      <SectionCard title={t('doctor.billing.dailyTitle')} eyebrow={t('doctor.billing.dailyEyebrow')} icon={TrendingUp}>
        {!summary ? (
          <SkeletonChart height={200} className="border-0 p-0 shadow-none" />
        ) : (
          <BarTrend data={summary.byDay} xKey="label" barKey="amount" height={200} unit="" highlightIndex={summary.byDay.length - 1} />
        )}
      </SectionCard>

      {/* create invoice */}
      <SectionCard title={t('doctor.billing.newTitle')} icon={Plus} eyebrow={t('doctor.billing.newEyebrow')}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>{t('doctor.billing.patient')}</span>
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className={cn(inputClass, 'cursor-pointer')}>
                <option value="">{t('doctor.billing.selectPatient')}</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={l.description}
                  onChange={(e) => setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r)))}
                  placeholder={t('doctor.billing.serviceItem')}
                  className={cn(inputClass, 'flex-1')}
                />
                <input
                  value={l.amount}
                  onChange={(e) => setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, amount: e.target.value } : r)))}
                  inputMode="decimal"
                  placeholder={t('doctor.billing.amount')}
                  className={cn(inputClass, 'w-32 text-right tabular')}
                />
                <button
                  type="button"
                  onClick={() => setLines((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows))}
                  aria-label="Remove line"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setLines((rows) => [...rows, { description: '', amount: '' }])} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              {t('doctor.billing.addLine')}
            </button>
          </div>

          {formError && <p className="text-sm text-rose-600">{formError}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
            <p className="text-sm text-stone-500">
              {t('doctor.billing.total')} <span className="font-display text-lg font-extrabold tabular-nums text-stone-900">{inr(formTotal)}</span>
            </p>
            <button type="button" onClick={() => void submitInvoice()} disabled={creating} className={buttonClass('primary', 'md', 'disabled:opacity-60')}>
              <Plus className="h-4 w-4" />
              {creating ? t('doctor.billing.creating') : t('doctor.billing.create')}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* invoice list */}
      <SectionCard title={t('doctor.billing.invoicesTitle')} icon={ReceiptText}>
        <div className="-mt-1 mb-4 overflow-x-auto pb-1">
          <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
        </div>

        {!invoices ? (
          <SkeletonRows n={5} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ReceiptText} text={t('doctor.billing.empty')} />
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>{t('doctor.billing.colInvoice')}</TH>
                    <TH>{t('doctor.billing.colPatient')}</TH>
                    <TH>
                      <button type="button" onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 font-bold text-stone-500 hover:text-stone-800">
                        {t('doctor.billing.colDate')}
                        {sortIcon('date')}
                      </button>
                    </TH>
                    <TH className="text-right">
                      <button type="button" onClick={() => toggleSort('amount')} className="inline-flex items-center gap-1 font-bold text-stone-500 hover:text-stone-800">
                        {t('doctor.billing.colAmount')}
                        {sortIcon('amount')}
                      </button>
                    </TH>
                    <TH>{t('doctor.billing.colStatus')}</TH>
                    <TH className="w-10 text-right" />
                  </TR>
                </THead>
                <TBody>
                  {pageRows.map((inv) => {
                    const meta = STATUS_META[inv.status];
                    const pct = inv.total > 0 ? Math.round((inv.amountPaid / inv.total) * 100) : 0;
                    return (
                      <TR key={inv.id} onClick={() => setDetailId(inv.id)} className="cursor-pointer">
                        <TD className="whitespace-nowrap font-mono-ds text-xs font-bold text-stone-500">{inv.number}</TD>
                        <TD>
                          <span className="flex items-center gap-2.5">
                            <Avatar name={inv.patientName} size="sm" hashColor />
                            <span className="truncate font-semibold text-stone-800">{inv.patientName}</span>
                          </span>
                        </TD>
                        <TD className="whitespace-nowrap tabular-nums text-stone-500">{formatDateIST(inv.date)}</TD>
                        <TD className="whitespace-nowrap text-right">
                          <span className="font-display font-extrabold tabular-nums text-stone-900">{inr(inv.total)}</span>
                          {inv.status === 'partial' && <span className="block text-[0.7rem] tabular-nums text-stone-400">{inr(inv.amountPaid)} {t('doctor.billing.paidLower')}</span>}
                        </TD>
                        <TD>
                          <StatusPill label={t(meta.labelKey)} tone={meta.tone} icon={meta.icon} />
                          {inv.status === 'partial' && (
                            <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-stone-200">
                              <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </TD>
                        <TD className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu items={rowItems(inv)} onSelect={(k) => onRowAction(inv, k)} label={`Invoice ${inv.number}`} />
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
            <div className="pt-1">
              <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} totalLabel={t('doctor.billing.showing', { n: pageRows.length, total: filtered.length })} />
            </div>
          </>
        )}
      </SectionCard>

      {/* Money ledger — an append-only history of collections (credit) and reversals (debit). */}
      <SectionCard
        title="Ledger"
        icon={ArrowLeftRight}
        eyebrow="Money movements"
        action={
          ledger ? (
            <p className="text-sm font-semibold tabular-nums" style={{ color: ledger.totals.net >= 0 ? '#059669' : '#e11d48' }}>
              Net {inr(ledger.totals.net)}
            </p>
          ) : undefined
        }
      >
        {!ledger ? (
          <SkeletonRows n={4} />
        ) : ledger.transactions.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} text="No money movements yet. Marking an invoice paid records a credit here." />
        ) : (
          <div className="space-y-1.5">
            {ledger.transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 rounded-xl border p-2.5" style={{ borderColor: 'var(--hairline)' }}>
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', tx.type === 'credit' ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600')}>
                  {tx.type === 'credit' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-800">{tx.description}</p>
                  <p className="text-xs tabular-nums text-stone-400">{formatDateIST(tx.date)}</p>
                </div>
                <p className={cn('font-display font-bold tabular-nums', tx.type === 'credit' ? 'text-green-700' : 'text-rose-600')}>
                  {tx.type === 'credit' ? '+' : '−'}
                  {inr(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {detailId && <InvoiceDetailModal id={detailId} profile={profile} onClose={() => setDetailId(null)} onStatus={(id, s) => void setStatus(id, s)} />}

      <p className="px-1 text-xs leading-relaxed text-stone-400">{t('doctor.billing.disclaimer')}</p>
    </div>
  );
}

// ── printable invoice document (opens a print window, letterhead + line items) ─
function printInvoiceDoc(inv: InvoiceFull, profile: DoctorProfile | null) {
  const win = window.open('', '_blank', 'width=820,height=1000');
  if (!win) return;
  const rows = inv.items.map((it) => `<tr><td>${it.description}</td><td class="n">${inr(it.amount)}</td></tr>`).join('');
  const balance = inv.total - inv.amountPaid;
  win.document.write(`<!doctype html><html><head><title>${inv.number}</title><style>
    body{font-family:Inter,system-ui,sans-serif;color:#1f2937;padding:40px;max-width:720px;margin:0 auto}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e3a8a;padding-bottom:16px}
    .clinic{font-size:20px;font-weight:800;color:#1e3a8a} .muted{color:#6b7280;font-size:13px}
    .inv{text-align:right} .inv b{font-size:22px;letter-spacing:1px;color:#111827}
    h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:24px 0 6px}
    table{width:100%;border-collapse:collapse;font-size:14px;margin-top:4px}
    td{padding:8px 0;border-bottom:1px solid #eee} .n{text-align:right;font-variant-numeric:tabular-nums}
    .tot{display:flex;justify-content:flex-end;gap:40px;margin-top:12px;font-size:14px}
    .tot .lbl{color:#6b7280;text-align:right} .tot .val{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
    .bal{color:${balance > 0 ? '#b91c1c' : '#047857'}}
    .foot{margin-top:36px;color:#9ca3af;font-size:12px;text-align:center}
  </style></head><body>
    <div class="head">
      <div><div class="clinic">${profile?.clinicName || 'Mateo Care'}</div>
      <div class="muted">${profile?.name ? 'Dr. ' + profile.name : ''}${profile?.registrationNo ? ' · Reg. ' + profile.registrationNo : ''}</div>
      <div class="muted">${profile?.clinicAddress || ''}</div></div>
      <div class="inv"><div class="muted">INVOICE</div><b>${inv.number}</b><div class="muted">${formatDateIST(inv.date)}</div></div>
    </div>
    <h2>Billed to</h2><div style="font-weight:600">${inv.patientName}</div>
    <h2>Items</h2><table>${rows}</table>
    <div class="tot"><div class="lbl">Total<br/>Paid<br/><b>Balance due</b></div>
      <div class="val">${inr(inv.total)}<br/>${inr(inv.amountPaid)}<br/><span class="bal">${inr(balance)}</span></div></div>
    ${inv.notes ? `<h2>Notes</h2><div class="muted">${inv.notes}</div>` : ''}
    <div class="foot">This is a computer-generated invoice · ${inv.number}</div>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function InvoiceDetailModal({ id, profile, onClose, onStatus }: { id: string; profile: DoctorProfile | null; onClose: () => void; onStatus: (id: string, s: 'paid' | 'unpaid' | 'cancelled') => void }) {
  const t = useT();
  const [inv, setInv] = useState<InvoiceFull | null>(null);
  useEffect(() => {
    let cancelled = false;
    getInvoice(id)
      .then((d) => !cancelled && setInv(d.invoice))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id]);
  const meta = inv ? STATUS_META[inv.status] : null;
  const balance = inv ? inv.total - inv.amountPaid : 0;
  return (
    <Modal open title={inv ? inv.number : t('doctor.billing.view')} onClose={onClose} size="lg">
      {!inv ? (
        <SkeletonRows n={5} />
      ) : (
        <div className="space-y-5">
          {/* letterhead */}
          <div className="flex items-start justify-between gap-4 rounded-2xl p-4 text-white" style={{ background: 'var(--brand-gradient)' }}>
            <div>
              <p className="font-display text-lg font-extrabold">{profile?.clinicName || 'Mateo Care'}</p>
              <p className="text-xs text-white/80">
                {profile?.name ? `Dr. ${profile.name}` : ''}
                {profile?.registrationNo ? ` · Reg. ${profile.registrationNo}` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.62rem] font-bold uppercase tracking-wide text-white/70">{t('doctor.billing.invoiceWord')}</p>
              <p className="font-mono-ds text-base font-bold">{inv.number}</p>
              <p className="text-xs text-white/80">{formatDateIST(inv.date)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-wide text-stone-400">{t('doctor.billing.billedTo')}</p>
              <p className="font-semibold text-stone-800">{inv.patientName}</p>
            </div>
            {meta && <StatusPill label={t(meta.labelKey)} tone={meta.tone} icon={meta.icon} />}
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-sunken)] text-[0.64rem] font-bold uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-3 py-2 text-left">{t('doctor.billing.description')}</th>
                  <th className="px-3 py-2 text-right">{t('doctor.billing.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it, i) => (
                  <tr key={i} className="border-t border-[var(--hairline)]">
                    <td className="px-3 py-2 text-stone-700">{it.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-800">{inr(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-500">
              <span>{t('doctor.billing.total')}</span>
              <span className="font-semibold tabular-nums text-stone-800">{inr(inv.total)}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>{t('doctor.billing.paidLabel')}</span>
              <span className="tabular-nums text-stone-800">{inr(inv.amountPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--hairline)] pt-1.5 font-bold">
              <span className="text-stone-700">{t('doctor.billing.balanceDue')}</span>
              <span className={cn('font-display tabular-nums', balance > 0 ? 'text-rose-600' : 'text-green-700')}>{inr(balance)}</span>
            </div>
          </div>

          {inv.notes && <p className="rounded-xl bg-[var(--surface-sunken)] p-3 text-xs text-stone-500">{inv.notes}</p>}

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--hairline)] pt-4">
            {inv.status !== 'paid' && inv.status !== 'cancelled' && (
              <button type="button" onClick={() => { onStatus(inv.id, 'paid'); onClose(); }} className={buttonClass('primary', 'md')}>
                <CircleCheck className="h-4 w-4" />
                {t('doctor.billing.markPaid')}
              </button>
            )}
            <button type="button" onClick={() => printInvoiceDoc(inv, profile)} className={buttonClass('secondary', 'md')}>
              <Printer className="h-4 w-4" />
              {t('doctor.billing.print')}
            </button>
            <button type="button" onClick={() => printInvoiceDoc(inv, profile)} className={buttonClass('secondary', 'md')}>
              <Download className="h-4 w-4" />
              {t('doctor.billing.downloadPdf')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
