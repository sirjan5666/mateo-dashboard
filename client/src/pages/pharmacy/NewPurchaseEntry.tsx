import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft, Calendar, Check, FileText, Loader2, Plus, Search, Trash2, X,
} from 'lucide-react';
import {
  createDistributor, createPurchase, getDistributorLedger, listDistributors, listInventory,
} from '../../api/pharmacy';
import type {
  DistributorDto, LedgerResponse, MedicineDto, PaymentMode, PurchaseLineInput,
} from '../../api/pharmacy';
import { ApiError } from '../../api/client';
import {
  CARD, Chip, GHOST_BTN, H2, INPUT, LABEL, OUTLINE_BTN, PH_ICONS, PRIMARY_BG, PRIMARY_BTN,
  QtyStepper, Tile,
} from '../../components/doctor/v2/pharmacy/shared';
import { cn } from '../../lib/cn';

const amt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round(n * 100) / 100;

const MODES: { id: PaymentMode; label: string; icon: string; color: string }[] = [
  { id: 'cash', label: 'Cash', icon: 'Banknote', color: '#12A150' },
  { id: 'upi', label: 'UPI', icon: 'Smartphone', color: '#4F46E5' },
  { id: 'credit', label: 'Credit', icon: 'CreditCard', color: '#F59E0B' },
];

/** A line being purchased. New SKUs are typed in; existing ones prefill from stock. */
interface Line extends PurchaseLineInput {
  key: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function NewPurchaseEntry() {
  const [distributors, setDistributors] = useState<DistributorDto[]>([]);
  const [stock, setStock] = useState<MedicineDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [distributorId, setDistributorId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayISO);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState('0');
  const [paidNow, setPaidNow] = useState('0');
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [reference, setReference] = useState('');
  const [dueDate, setDueDate] = useState(() => plusDays(todayISO(), 10));
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [newDistName, setNewDistName] = useState('');
  const [newDistPhone, setNewDistPhone] = useState('');
  const [newDistGstin, setNewDistGstin] = useState('');
  const [newDistAddress, setNewDistAddress] = useState('');
  const [addingDist, setAddingDist] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listDistributors(), listInventory()])
      .then(([d, inv]) => {
        if (cancelled) return;
        setDistributors(d.distributors);
        setStock(inv.items);
        if (d.distributors[0]) setDistributorId(d.distributors[0].id);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the purchase desk');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The ledger follows whichever distributor is selected. Nothing is set
  // synchronously here — an unselected distributor simply never fetches, and
  // `ledger` is already null until one resolves.
  useEffect(() => {
    if (!distributorId) return;
    let cancelled = false;
    void getDistributorLedger(distributorId)
      .then((l) => {
        if (!cancelled) setLedger(l);
      })
      .catch(() => {
        if (!cancelled) setLedger(null);
      });
    return () => {
      cancelled = true;
    };
  }, [distributorId, saved]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return stock
      .filter((m) => m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, stock]);

  /** Money is previewed here and recomputed authoritatively by the server. */
  const totals = useMemo(() => {
    const subtotal = round2(lines.reduce((t, l) => t + l.qty * l.rate, 0));
    const gst = round2(lines.reduce((t, l) => t + (l.qty * l.rate * l.gstPct) / 100, 0));
    const disc = round2(Math.min(Number(discount) || 0, subtotal + gst));
    const grand = round2(subtotal + gst - disc);
    const paid = round2(Math.min(Number(paidNow) || 0, grand));
    return { subtotal, gst, discount: disc, grand, paid, balance: round2(grand - paid) };
  }, [lines, discount, paidNow]);

  const addFromStock = (m: MedicineDto) => {
    setLines((ls) => [...ls, {
      key: `${m.sku}-${Date.now()}`, sku: m.sku, name: m.name, batch: m.batch,
      expiry: m.expiry ?? '', qty: 1, rate: m.purchaseRate, mrp: m.mrp, gstPct: m.gstPct,
    }]);
    setQuery('');
  };
  const addBlank = () =>
    setLines((ls) => [...ls, {
      key: `new-${Date.now()}`, sku: '', name: '', batch: '', expiry: '', qty: 1, rate: 0, mrp: 0, gstPct: 12,
    }]);
  const patch = (key: string, p: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const remove = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  async function addDistributor() {
    const name = newDistName.trim();
    const phone = newDistPhone.trim();
    const gstin = newDistGstin.trim();
    const addressLine = newDistAddress.trim();
    if (name.length < 2) { setError('Distributor name is required (min 2 chars).'); return; }
    if (!phone) { setError('Distributor phone number is required.'); return; }
    if (!gstin) { setError('Distributor GST number is required.'); return; }
    if (!addressLine) { setError('Distributor address is required.'); return; }
    setError(null);
    try {
      const { distributor } = await createDistributor({ name, phone, gstin, addressLine });
      const fresh = await listDistributors();
      setDistributors(fresh.distributors);
      setDistributorId(distributor.id);
      setNewDistName(''); setNewDistPhone(''); setNewDistGstin(''); setNewDistAddress('');
      setAddingDist(false);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? 'That distributor already exists.' : 'Could not add the distributor');
    }
  }

  const reloadStock = useCallback(async () => {
    const inv = await listInventory();
    setStock(inv.items);
  }, []);

  async function save() {
    if (!distributorId) { setError('Choose a distributor.'); return; }
    if (!invoiceNo.trim()) { setError('Enter the distributor’s invoice number.'); return; }
    if (!lines.length) { setError('Add at least one item.'); return; }
    const bad = lines.find((l) => !l.sku.trim() || !l.name.trim() || !l.batch.trim());
    if (bad) { setError('Every line needs an SKU, a name and a batch number.'); return; }

    setSaving(true);
    setError(null);
    try {
      const { purchase } = await createPurchase({
        distributorId,
        invoiceNo: invoiceNo.trim(),
        invoiceDate,
        items: lines.map(({ key, ...rest }) => { void key; return { ...rest, expiry: rest.expiry || undefined }; }),
        discount: Number(discount) || 0,
        amountPaid: Number(paidNow) || 0,
        paymentMode: mode,
        paymentReference: reference || undefined,
        dueDate: dueDate || undefined,
      });
      setSaved(`${purchase.invoiceNo} saved — ${purchase.items} item${purchase.items === 1 ? '' : 's'} added to stock.`);
      setLines([]);
      setInvoiceNo('');
      setDiscount('0');
      setPaidNow('0');
      await reloadStock();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'This invoice number is already recorded for that distributor — stock was not added twice.'
          : e instanceof Error ? e.message : 'Could not save this purchase',
      );
    } finally {
      setSaving(false);
    }
  }

  // A ledger from a previously selected distributor must never be shown under
  // the new one’s name.
  const shownLedger = ledger && ledger.distributor.id === distributorId ? ledger : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
        <div>
          <Link to="/doctor/pharmacy" className="flex w-fit items-center gap-2 text-[13px] font-semibold text-[#3B4FE0] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Link>
          <h1 className="mt-2.5 font-display text-[23px] font-extrabold tracking-[-0.02em] text-[#0F172A]">New Purchase Entry</h1>
          <p className="mt-1 text-[13px] font-medium text-[#64748B]">Record a distributor bill — the items go straight into stock.</p>
        </div>

        {saved && (
          <p role="status" className="flex items-center gap-2.5 rounded-[10px] border border-[#C8EDD8] bg-[#ECFAF1] px-4 py-3 text-[13px] font-medium text-[#0F7A46]">
            <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
            {saved}
          </p>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
            <X aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {/* ── Distributor ledger ── */}
        <section className={cn(CARD, 'min-w-0 px-5 pb-5 pt-[18px]')}>
          <h2 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#0F172A]">Distributor Ledger</h2>
          <p className="mt-[3px] text-[13px] font-medium text-[#64748B]">
            {shownLedger?.distributor.name ?? (loading ? 'Loading…' : 'Select a distributor')}
          </p>

          {shownLedger && (
            <>
              <dl className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { bg: '#F3F4FE', tint: '#E0E3FD', fg: '#4F46E5', icon: 'ShoppingCart', label: 'Total Purchased', value: shownLedger.kpis.totalPurchased },
                  { bg: '#EDFAF2', tint: '#DCF7E6', fg: '#12A150', icon: 'ClipboardCheck', label: 'Total Paid', value: shownLedger.kpis.totalPaid },
                  { bg: '#FEF8EC', tint: '#FDECD3', fg: '#F59E0B', icon: 'Wallet', label: 'Outstanding', value: shownLedger.kpis.outstanding },
                ].map((k) => {
                  const Icon = PH_ICONS[k.icon] ?? FileText;
                  return (
                    <div key={k.label} className="rounded-[11px] px-3.5 pb-4 pt-3.5" style={{ background: k.bg }}>
                      <span aria-hidden="true" className="grid h-[30px] w-[30px] place-items-center rounded-[8px]" style={{ background: k.tint }}>
                        <Icon className="h-[15px] w-[15px]" style={{ color: k.fg }} />
                      </span>
                      <dt className="mt-2.5 text-[11.5px] font-medium text-[#64748B]">{k.label}</dt>
                      <dd className="mt-[5px] text-[17px] font-extrabold text-[#0F172A]">₹{k.value.toLocaleString('en-IN')}</dd>
                    </div>
                  );
                })}
              </dl>

              <h3 className="mt-4 text-[13px] font-bold text-[#0F172A]">Purchases</h3>
              {shownLedger.transactions.length === 0 ? (
                <p className="mt-2 text-[12.5px] text-[#64748B]">No purchases recorded from this distributor yet.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[420px] border-separate border-spacing-0">
                    <caption className="sr-only">Distributor purchases</caption>
                    <thead>
                      <tr>
                        {['Date', 'Reference', 'Billed (₹)', 'Paid (₹)', 'Due (₹)', 'Status'].map((h, i) => (
                          <th key={h} scope="col"
                            className={cn('h-[34px] text-left text-[10px] font-bold uppercase tracking-[0.05em] text-[#64748B]', i >= 2 && i <= 4 && 'text-right')}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shownLedger.transactions.map((t) => (
                        <tr key={t.id}>
                          <th scope="row" className="h-10 border-t border-[#F1F3F9] pr-3 text-left text-[11.5px] font-medium text-[#334155]">
                            {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </th>
                          <td className="border-t border-[#F1F3F9] pr-3 text-[11.5px] font-medium text-[#334155]">{t.reference}</td>
                          <td className="border-t border-[#F1F3F9] pr-3 text-right text-[11.5px] font-semibold text-[#0F172A]">{amt(t.debit)}</td>
                          <td className="border-t border-[#F1F3F9] pr-3 text-right text-[11.5px] font-semibold text-[#0F172A]">{amt(t.credit)}</td>
                          <td className="border-t border-[#F1F3F9] pr-3 text-right text-[11.5px] font-semibold text-[#0F172A]">{amt(t.balance)}</td>
                          <td className="border-t border-[#F1F3F9]">
                            <Chip label={t.status === 'paid' ? 'Paid' : t.status === 'partial' ? 'Partial' : 'Unpaid'}
                              bg={t.status === 'paid' ? '#DCF7E6' : '#FDECD3'}
                              fg={t.status === 'paid' ? '#12A150' : '#E8890B'}
                              className="!rounded-[6px] !px-[9px] !py-[3px] !text-[10.5px]" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3.5 rounded-[10px] bg-[#FAFBFD] px-3.5 py-3 text-[11.5px] font-medium text-[#64748B]">
                Every figure here is summed from this distributor’s own purchase records.
              </p>
            </>
          )}
        </section>

        {/* Header card */}
        <section className={cn(CARD, 'px-5 py-[18px]')}>
          <div className="grid grid-cols-1 items-end gap-[18px] md:grid-cols-3">
            <div>
              <label htmlFor="p-dist" className={LABEL}>
                Distributor <span aria-hidden="true" className="text-[#EF4444]">*</span>
              </label>
              {distributors.length === 0 && !loading ? (
                <p className="text-[12.5px] text-[#64748B]">No distributors yet — add one below.</p>
              ) : (
                <select id="p-dist" value={distributorId} onChange={(e) => setDistributorId(e.target.value)} className={INPUT}>
                  {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
              {addingDist ? (
                <div className="mt-2 space-y-2">
                  <input value={newDistName} onChange={(e) => setNewDistName(e.target.value)}
                    placeholder="Distributor name *" aria-label="New distributor name"
                    className="h-9 w-full rounded-[8px] border border-[#E4E8F1] px-3 text-[12.5px] focus:border-[#3B4FE0] focus:outline-none" />
                  <input value={newDistPhone} onChange={(e) => setNewDistPhone(e.target.value)}
                    placeholder="Phone number *" aria-label="Distributor phone number"
                    className="h-9 w-full rounded-[8px] border border-[#E4E8F1] px-3 text-[12.5px] focus:border-[#3B4FE0] focus:outline-none" />
                  <input value={newDistGstin} onChange={(e) => setNewDistGstin(e.target.value)}
                    placeholder="GST number *" aria-label="Distributor GST number"
                    className="h-9 w-full rounded-[8px] border border-[#E4E8F1] px-3 text-[12.5px] uppercase focus:border-[#3B4FE0] focus:outline-none" />
                  <input value={newDistAddress} onChange={(e) => setNewDistAddress(e.target.value)}
                    placeholder="Address *" aria-label="Distributor address"
                    className="h-9 w-full rounded-[8px] border border-[#E4E8F1] px-3 text-[12.5px] focus:border-[#3B4FE0] focus:outline-none" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void addDistributor()}
                      className="h-9 shrink-0 rounded-[8px] bg-[#3B4FE0] px-3 text-[12px] font-bold text-white">Add</button>
                    <button type="button" onClick={() => setAddingDist(false)}
                      className="h-9 shrink-0 rounded-[8px] border border-[#E2E6F0] px-3 text-[12px] font-bold text-[#334155]">Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingDist(true)}
                  className="mt-2 text-[12px] font-bold text-[#3B4FE0] hover:underline">+ Add distributor</button>
              )}
            </div>
            <div>
              <label htmlFor="p-inv" className={LABEL}>
                Invoice No. <span aria-hidden="true" className="text-[#EF4444]">*</span>
              </label>
              <input id="p-inv" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="RD/INV/2025/0542" className={INPUT} />
            </div>
            <div>
              <label htmlFor="p-date" className={LABEL}>
                Invoice Date <span aria-hidden="true" className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <input id="p-date" type="date" value={invoiceDate}
                  onChange={(e) => { setInvoiceDate(e.target.value); setDueDate(plusDays(e.target.value, 10)); }}
                  className={cn(INPUT, 'pr-10')} />
                <Calendar aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#64748B]" />
              </div>
            </div>
          </div>
        </section>

        {/* Items */}
        <section className={cn(CARD, 'pb-4 pt-[18px]')}>
          <div className="flex flex-wrap items-center gap-3 px-5">
            <h2 className={H2}>Items</h2>
            <div className="relative ml-auto min-w-0 flex-1 sm:max-w-[280px]">
              <label htmlFor="p-search" className="sr-only">Search an existing SKU</label>
              <input id="p-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search an existing SKU…" autoComplete="off"
                className="h-[42px] w-full rounded-[10px] border border-[#E4E8F1] bg-white pl-3.5 pr-10 text-[13px] focus:border-[#3B4FE0] focus:outline-none" />
              <Search aria-hidden="true" className="pointer-events-none absolute right-3.5 top-[13px] h-[17px] w-[17px] text-[#94A3B8]" />
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-[46px] z-30 overflow-hidden rounded-[11px] border border-[#ECEEF4] bg-white shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]">
                  {suggestions.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => addFromStock(m)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F6F7FB]">
                        <Tile icon="Pill" tint="#E4EBFD" fg="#2B6FF0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-[#0F172A]">{m.name}</span>
                          <span className="block text-[11.5px] text-[#64748B]">{m.sku} · {m.batch}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" onClick={addBlank} className={cn(OUTLINE_BTN, 'h-[42px] shrink-0 px-[18px]')}>
              <Plus className="h-4 w-4" />
              <span className="text-[13px] font-bold">New Item</span>
            </button>
          </div>

          {lines.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-[#64748B]">
              Search an existing SKU, or add a brand-new item.
            </p>
          ) : (
            <div className="mt-3.5 overflow-x-auto">
              <table className="w-full min-w-[1040px] border-separate border-spacing-0">
                <caption className="sr-only">Purchase line items</caption>
                <thead>
                  <tr>
                    {['#', 'Medicine', 'SKU', 'Batch', 'Expiry', 'Qty', 'Rate (₹)', 'MRP (₹)', 'GST %', 'Total (₹)', ''].map((h, i) => (
                      <th key={h + i} scope="col"
                        className={cn('h-12 border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10px] font-bold uppercase tracking-[0.05em] text-[#64748B]',
                          i === 0 && 'pl-5', i >= 6 && i <= 9 && 'text-right', i === 10 && 'pr-5')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const lineTotal = round2(l.qty * l.rate * (1 + l.gstPct / 100));
                    const cell = 'h-9 w-full rounded-[7px] border border-[#E2E6F0] px-2 text-[12.5px] focus:border-[#3B4FE0] focus:outline-none';
                    return (
                      <tr key={l.key}>
                        <td className="h-[62px] border-b border-[#F1F3F9] pl-5 pr-3 text-[12.5px] font-semibold text-[#94A3B8]">{i + 1}</td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <input aria-label={`Name for line ${i + 1}`} value={l.name} onChange={(e) => patch(l.key, { name: e.target.value })}
                            placeholder="Medicine name" className={cn(cell, 'min-w-[150px]')} />
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <input aria-label={`SKU for line ${i + 1}`} value={l.sku} onChange={(e) => patch(l.key, { sku: e.target.value })}
                            placeholder="SKU" className={cn(cell, 'w-[110px]')} />
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <input aria-label={`Batch for line ${i + 1}`} value={l.batch} onChange={(e) => patch(l.key, { batch: e.target.value })}
                            placeholder="Batch" className={cn(cell, 'w-[92px]')} />
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <input type="date" aria-label={`Expiry for line ${i + 1}`} value={l.expiry ?? ''}
                            onChange={(e) => patch(l.key, { expiry: e.target.value })} className={cn(cell, 'w-[138px]')} />
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <QtyStepper value={l.qty} name={l.name || `line ${i + 1}`} onChange={(q) => patch(l.key, { qty: q })} />
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <input type="number" step="0.01" min={0} aria-label={`Rate for line ${i + 1}`} value={l.rate}
                            onChange={(e) => patch(l.key, { rate: Number(e.target.value) || 0 })} className={cn(cell, 'w-[86px] text-right')} />
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <input type="number" step="0.01" min={0} aria-label={`MRP for line ${i + 1}`} value={l.mrp}
                            onChange={(e) => patch(l.key, { mrp: Number(e.target.value) || 0 })} className={cn(cell, 'w-[86px] text-right')} />
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <input type="number" min={0} max={28} aria-label={`GST for line ${i + 1}`} value={l.gstPct}
                            onChange={(e) => patch(l.key, { gstPct: Number(e.target.value) || 0 })} className={cn(cell, 'w-[64px] text-right')} />
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-right text-[12.5px] font-bold text-[#0F172A]">{amt(lineTotal)}</td>
                        <td className="border-b border-[#F1F3F9] pr-5">
                          <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => remove(l.key)}
                            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-[#FDF0F0] hover:bg-[#FBE0E0]">
                            <Trash2 className="h-4 w-4 text-[#EF4444]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {lines.length > 0 && (
            <div className="mt-3.5 flex justify-end px-5">
              <dl className="w-full max-w-[340px] rounded-[11px] border border-[#ECEEF4] bg-[#FAFBFD] px-[18px] py-3.5">
                <div className="flex items-center gap-3">
                  <dt className="text-[12.5px] font-medium text-[#475569]">Subtotal (before GST)</dt>
                  <dd className="ml-auto text-[12.5px] font-semibold text-[#0F172A]">₹{amt(totals.subtotal)}</dd>
                </div>
                <div className="mt-[11px] flex items-center gap-3">
                  <dt className="text-[12.5px] font-medium text-[#475569]">Total GST</dt>
                  <dd className="ml-auto text-[12.5px] font-semibold text-[#0F172A]">₹{amt(totals.gst)}</dd>
                </div>
                <div className="mt-[11px] flex items-center gap-3">
                  <dt className="text-[12.5px] font-medium text-[#475569]">Discount</dt>
                  <dd className="ml-auto">
                    <label className="sr-only" htmlFor="p-disc">Discount in rupees</label>
                    <input id="p-disc" type="number" step="0.01" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)}
                      className="h-8 w-24 rounded-[7px] border border-[#E2E6F0] px-2 text-right text-[12.5px] font-semibold focus:border-[#3B4FE0] focus:outline-none" />
                  </dd>
                </div>
                <div className="my-2.5 h-px bg-[#E4E8F1]" />
                <div className="flex items-center gap-3">
                  <dt className="text-[13.5px] font-extrabold text-[#0F172A]">Grand Total</dt>
                  <dd className="ml-auto text-[17px] font-extrabold text-[#F59E0B]">₹ {amt(totals.grand)}</dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        {/* Payment */}
        <section className={cn(CARD, 'px-5 pb-5 pt-[18px]')}>
          <h2 className={H2}>Payment</h2>

          <div className="mt-3.5">
            <p className={LABEL}>Payment Mode</p>
            <div role="radiogroup" aria-label="Payment mode" className="flex flex-wrap gap-2.5">
              {MODES.map((m) => {
                const Icon = PH_ICONS[m.icon] ?? FileText;
                const on = mode === m.id;
                return (
                  <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => setMode(m.id)}
                    className={cn('flex h-[42px] items-center gap-2 rounded-[10px] px-[18px] text-[13px] transition-colors',
                      on ? 'border-[1.5px] border-[#6366F1] bg-[#F0EFFE] font-bold text-[#3B4FE0]'
                         : 'border border-[#E4E8F1] bg-white font-semibold text-[#334155] hover:bg-[#F7F8FC]')}>
                    <Icon className="h-[15px] w-[15px]" style={{ color: on ? '#3B4FE0' : m.color }} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-[18px] lg:grid-cols-3">
            <div>
              <label htmlFor="p-paid" className={LABEL}>Amount Paid Now</label>
              <div className="relative">
                <span aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13.5px] text-[#64748B]">₹</span>
                <input id="p-paid" type="number" step="0.01" min={0} max={totals.grand} value={paidNow}
                  onChange={(e) => setPaidNow(e.target.value)} className={cn(INPUT, 'pl-8')} />
              </div>
              <button type="button" onClick={() => setPaidNow(String(totals.grand))}
                className="mt-1.5 text-[11.5px] font-bold text-[#3B4FE0] hover:underline">Pay in full (₹{amt(totals.grand)})</button>
            </div>
            {mode !== 'cash' && (
              <div>
                <label htmlFor="p-ref" className={LABEL}>Payment Reference</label>
                <input id="p-ref" value={reference} onChange={(e) => setReference(e.target.value)}
                  placeholder="UPI ID / Txn ID" className={INPUT} />
              </div>
            )}
            <div className={cn('flex items-center gap-3 rounded-[11px] border px-4 py-3.5',
              totals.balance === 0 ? 'border-[#C8EDD8] bg-[#ECFAF1]' : 'border-[#F8E3B8] bg-[#FEF8EC]')}>
              <div className="min-w-0">
                <p className={cn('text-xs font-medium', totals.balance === 0 ? 'text-[#0F7A46]' : 'text-[#8A5A0B]')}>Balance Due</p>
                <p className={cn('mt-[5px] text-[19px] font-extrabold', totals.balance === 0 ? 'text-[#12A150]' : 'text-[#E8890B]')}>
                  ₹ {amt(totals.balance)}
                </p>
              </div>
              <Chip label={totals.balance === 0 ? 'Paid' : 'Pending'}
                bg={totals.balance === 0 ? '#DCF7E6' : '#FDECD3'}
                fg={totals.balance === 0 ? '#12A150' : '#E8890B'} className="ml-auto" />
            </div>
          </div>

          {totals.balance > 0 && (
            <div className="mt-4 sm:w-1/3">
              <label htmlFor="p-due" className={LABEL}>Due Date</label>
              <input id="p-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={INPUT} />
            </div>
          )}

          <div className="mt-[18px] flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={() => { setLines([]); setDiscount('0'); setPaidNow('0'); setSaved(null); }}
              className={cn(GHOST_BTN, 'h-[46px] px-[30px] text-[13.5px] font-bold text-[#1E2A5A]')}>
              Clear
            </button>
            <button type="button" onClick={() => void save()} disabled={saving || lines.length === 0}
              className={cn(PRIMARY_BTN, 'h-[46px] px-6 text-[13.5px] font-bold disabled:opacity-60')} style={{ background: PRIMARY_BG }}>
              {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save Purchase & Add Stock'}
            </button>
          </div>
        </section>
    </div>
  );
}
