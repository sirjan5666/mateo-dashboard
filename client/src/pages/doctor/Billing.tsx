import { useEffect, useMemo, useState } from 'react';
import { Ban, CircleCheck, Clock, Plus, ReceiptText, TrendingUp, Wallet, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ApiError } from '../../api/client';
import { createInvoice, getBillingSummary, listInvoices, updateInvoice } from '../../api/doctorBilling';
import type { BillingSummary, InvoiceListItem, InvoiceStatus } from '../../api/doctorBilling';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { useT } from '../../i18n/context';
import { Card } from '../../components/ui/Card';
import { StatusPill } from '../../components/ui/StatusPill';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import type { SegmentOption } from '../../components/ui/SegmentedControl';
import type { Tone } from '../../components/ui/tones';
import { buttonClass } from '../../components/ui/buttonStyles';
import { BarTrend, EmptyState, Kpi, SectionCard, SkeletonChart, SkeletonKpi, SkeletonRows } from '../../components/panel/kit';
import { cn } from '../../lib/cn';
import { useEntrance } from '../../lib/gsap';
import { formatDateIST } from '../../lib/age';

type Filter = 'all' | 'unpaid' | 'paid' | 'cancelled';

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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

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
  }

  useEffect(() => {
    refresh();
    listPatients()
      .then((d) => setPatients(d.patients.filter((p) => !p.archivedAt)))
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
    if (!invoices) return [];
    if (filter === 'all') return invoices;
    if (filter === 'unpaid') return invoices.filter((i) => i.status === 'unpaid' || i.status === 'partial');
    return invoices.filter((i) => i.status === filter);
  }, [invoices, filter]);

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
          <div className="space-y-2">
            {filtered.map((inv) => {
              const meta = STATUS_META[inv.status];
              const outstanding = inv.total - inv.amountPaid;
              return (
                <div key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border p-3" style={{ borderColor: 'var(--hairline)' }}>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold text-stone-800">
                      <span className="truncate">{inv.patientName}</span>
                      <span className="font-display text-xs font-bold tabular-nums text-stone-400">{inv.number}</span>
                    </p>
                    <p className="text-xs tabular-nums text-stone-400">{formatDateIST(inv.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-extrabold tabular-nums text-stone-900">{inr(inv.total)}</p>
                    {inv.status !== 'paid' && inv.status !== 'cancelled' && outstanding > 0 && (
                      <p className="text-[0.7rem] tabular-nums text-rose-600">{t('doctor.billing.due', { amount: inr(outstanding) })}</p>
                    )}
                  </div>
                  <StatusPill label={t(meta.labelKey)} tone={meta.tone} icon={meta.icon} />
                  <div className="flex gap-1.5">
                    {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                      <button type="button" onClick={() => void setStatus(inv.id, 'paid')} className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100">
                        {t('doctor.billing.markPaid')}
                      </button>
                    )}
                    {inv.status === 'paid' && (
                      <button type="button" onClick={() => void setStatus(inv.id, 'unpaid')} className="rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200">
                        {t('doctor.billing.undo')}
                      </button>
                    )}
                    {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                      <button type="button" onClick={() => void setStatus(inv.id, 'cancelled')} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-400 hover:bg-stone-100 hover:text-stone-600">
                        {t('doctor.billing.cancel')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <p className="px-1 text-xs leading-relaxed text-stone-400">{t('doctor.billing.disclaimer')}</p>
    </div>
  );
}
