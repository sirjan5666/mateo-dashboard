import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  FileText, Info, Loader2, Percent, Printer, Search, Trash2, X,
} from 'lucide-react';
import { createBill, listInventory } from '../../api/pharmacy';
import type { BillLineInput, MedicineDto, PaymentMode } from '../../api/pharmacy';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { ApiError } from '../../api/client';
import { InvoiceDocument } from '../../components/doctor/v2/pharmacy/InvoiceDocument';
import {
  CARD, GHOST_BTN, H2, INPUT, LABEL, PH_ICONS, PRIMARY_BG, PRIMARY_BTN, QtyStepper, Tile,
} from '../../components/doctor/v2/pharmacy/shared';
import { cn } from '../../lib/cn';

const amt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round(n * 100) / 100;

const MODES: { id: PaymentMode; label: string; icon: string; color: string }[] = [
  { id: 'upi', label: 'UPI', icon: 'Smartphone', color: '#4F46E5' },
  { id: 'cash', label: 'Cash', icon: 'Banknote', color: '#12A150' },
  { id: 'card', label: 'Card', icon: 'CreditCard', color: '#2B6FF0' },
  { id: 'cheque', label: 'Cheque', icon: 'FileText', color: '#334155' },
  { id: 'credit', label: 'Credit', icon: 'CreditCard', color: '#F59E0B' },
];

/** A line on the bill being built: the stock row plus how much of it is going out. */
interface Line {
  med: MedicineDto;
  qty: number;
  discPct: number;
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle}
      className={cn('relative h-[23px] w-[42px] shrink-0 rounded-full transition-colors', on ? 'bg-[#4F46E5]' : 'bg-[#E2E6F0]')}>
      <span aria-hidden="true"
        className={cn('absolute top-[3px] h-[17px] w-[17px] rounded-full bg-white shadow transition-[left]', on ? 'left-[22px]' : 'left-[3px]')} />
    </button>
  );
}

function SummaryRow({ label, value, symbol = true }: { label: string; value: string; symbol?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="text-[12.5px] font-medium text-[#475569]">{label}</dt>
      <dd className="ml-auto text-[12.5px] font-semibold text-[#0F172A]">
        <span aria-hidden="true">{symbol ? `₹${value}` : value}</span>
        <span className="sr-only">{value.replace('– ', '')} rupees</span>
      </dd>
    </div>
  );
}

export default function NewBill() {
  const navigate = useNavigate();
  const [stock, setStock] = useState<MedicineDto[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const [lines, setLines] = useState<Line[]>([]);
  const [patientId, setPatientId] = useState('');
  const [walkIn, setWalkIn] = useState(true);
  const [walkInName, setWalkInName] = useState('Walk-in customer');
  const [mode, setMode] = useState<PaymentMode>('upi');
  const [reference, setReference] = useState('');
  const [discount, setDiscount] = useState('0');
  const [received, setReceived] = useState('0');
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listInventory(), listPatients()])
      .then(([inv, pat]) => {
        if (cancelled) return;
        setStock(inv.items);
        setPatients(pat.patients);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the counter');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadStock = useCallback(async () => {
    const inv = await listInventory();
    setStock(inv.items);
  }, []);

  /** Search hits stock the counter can actually sell — in stock and not on the bill. */
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const onBill = new Set(lines.map((l) => l.med.id));
    return stock
      .filter((m) => m.qtyInStock > 0 && !onBill.has(m.id))
      .filter((m) => m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q) || m.batch.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, stock, lines]);

  /**
   * Preview totals, mirroring the server's arithmetic. The SERVER is
   * authoritative — these exist so the counter sees the figure before it
   * commits, and the response replaces them.
   */
  const totals = useMemo(() => {
    // MRP is tax-inclusive, so GST is EXTRACTED from what the customer pays,
    // never added on top — see the note in server/src/routes/pharmacy.ts.
    // This mirrors the server exactly so the preview cannot promise a different
    // figure from the one that gets billed.
    const gross = round2(lines.reduce((t, l) => t + l.qty * l.med.mrp * (1 - l.discPct / 100), 0));
    const disc = round2(Math.min(Number(discount) || 0, gross));
    const payable = round2(gross - disc);
    const factor = gross > 0 ? payable / gross : 0;
    const taxable = round2(
      lines.reduce((t, l) => {
        const lineAmt = l.qty * l.med.mrp * (1 - l.discPct / 100);
        return t + (lineAmt * factor) / (1 + l.med.gstPct / 100);
      }, 0),
    );
    const gst = round2(payable - taxable);
    const rec = round2(Number(received) || 0);
    return { count: lines.length, subtotal: gross, discount: disc, taxable, gst, payable, received: rec, change: round2(Math.max(0, rec - payable)) };
  }, [lines, discount, received]);

  const addLine = (med: MedicineDto) => {
    setLines((ls) => [...ls, { med, qty: 1, discPct: 0 }]);
    setQuery('');
  };
  const setQty = (id: string, qty: number) =>
    setLines((ls) => ls.map((l) => (l.med.id === id ? { ...l, qty: Math.min(qty, l.med.qtyInStock) } : l)));
  const setDisc = (id: string, d: number) =>
    setLines((ls) => ls.map((l) => (l.med.id === id ? { ...l, discPct: Math.max(0, Math.min(100, d)) } : l)));
  const remove = (id: string) => setLines((ls) => ls.filter((l) => l.med.id !== id));

  async function generate() {
    if (!lines.length) {
      setError('Add at least one medicine to the bill.');
      return;
    }
    if (!walkIn && !patientId) {
      setError('Choose a patient, or switch on Walk-in Customer.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const items: BillLineInput[] = lines.map((l) => ({ medicineId: l.med.id, qty: l.qty, discPct: l.discPct }));
      const { bill } = await createBill({
        patientId: walkIn ? undefined : patientId,
        walkInName: walkIn ? walkInName.trim() || 'Walk-in customer' : undefined,
        items,
        discount: Number(discount) || 0,
        amountReceived: Number(received) || 0,
        paymentMode: mode,
        paymentReference: reference || undefined,
        notes: notes || undefined,
      });
      navigate(`/doctor/pharmacy/billing/success?bill=${bill.id}`);
    } catch (e) {
      // A 409 means someone else sold the stock first — refresh so the counter
      // sees the real quantities before retrying.
      if (e instanceof ApiError && e.status === 409) await reloadStock().catch(() => {});
      setError(e instanceof Error ? e.message : 'Could not generate this invoice');
      setSaving(false);
    }
  }

  // The preview document wants the persisted item shape.
  const previewItems = lines.map((l) => ({
    sku: l.med.sku, name: l.med.name, batch: l.med.batch, expiry: l.med.expiry ?? '',
    qty: l.qty, mrp: l.med.mrp, disc: l.discPct, gstPct: l.med.gstPct,
    tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Pill',
  }));

  const selectedPatient = patients.find((p) => p.id === patientId);

  return (
    <div className="grid grid-cols-1 items-start gap-5 2xl:grid-cols-[1fr_520px]">
      <div className="flex min-w-0 flex-col">
        <h1 className="font-display text-[23px] font-extrabold tracking-[-0.02em] text-[#0F172A]">Pharmacy Billing</h1>
        <p className="mt-1 text-[13px] font-medium text-[#64748B]">Billing / New Bill</p>

        {/* Customer */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1 sm:max-w-[320px]">
            <label htmlFor="b-patient" className={LABEL}>Patient</label>
            <select id="b-patient" value={patientId} disabled={walkIn}
              onChange={(e) => setPatientId(e.target.value)}
              className={cn(INPUT, 'h-[46px]', walkIn && 'cursor-not-allowed bg-[#F7F8FC] text-[#94A3B8]')}>
              <option value="">— Select a patient —</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </div>

          <div className="min-w-0 flex-1 sm:max-w-[260px]">
            <label htmlFor="b-walkin-name" className={LABEL}>Walk-in Name</label>
            <input id="b-walkin-name" value={walkInName} disabled={!walkIn}
              onChange={(e) => setWalkInName(e.target.value)}
              className={cn(INPUT, 'h-[46px]', !walkIn && 'cursor-not-allowed bg-[#F7F8FC] text-[#94A3B8]')} />
          </div>

          <span className="flex items-center gap-[11px] pt-6">
            <Switch on={walkIn} onToggle={() => setWalkIn((v) => !v)} label="Walk-in customer" />
            <span className="text-[13px] font-semibold text-[#334155]">Walk-in Customer</span>
            <Info aria-hidden="true" className="h-[15px] w-[15px] text-[#94A3B8]" />
            <span className="sr-only">Bill without linking a patient record</span>
          </span>
        </div>

        {/* Search + discount */}
        <div className="mt-3.5 flex flex-wrap items-start gap-3.5">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="b-scan" className="sr-only">Search medicine to add</label>
            <input id="b-scan" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Scan barcode or search medicine…" autoComplete="off"
              className="h-12 w-full rounded-[10px] border border-[#E4E8F1] bg-white pl-4 pr-[46px] text-[13.5px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none" />
            <Search aria-hidden="true" className="pointer-events-none absolute right-4 top-[15px] h-[18px] w-[18px] text-[#94A3B8]" />

            {suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-[52px] z-30 overflow-hidden rounded-[11px] border border-[#ECEEF4] bg-white shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]">
                {suggestions.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => addLine(m)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F6F7FB]">
                      <Tile icon="Pill" tint="#E4EBFD" fg="#2B6FF0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-[#0F172A]">{m.name}</span>
                        <span className="block text-[11.5px] text-[#64748B]">{m.sku} · {m.batch} · {m.qtyInStock} in stock</span>
                      </span>
                      <span className="shrink-0 text-[12.5px] font-semibold text-[#0F172A]">₹{amt(m.mrp)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && suggestions.length === 0 && !loading && (
              <p className="absolute left-0 right-0 top-[52px] z-30 rounded-[11px] border border-[#ECEEF4] bg-white px-4 py-3 text-[12.5px] text-[#64748B] shadow-lg">
                Nothing in stock matches “{query.trim()}”.
              </p>
            )}
          </div>

          <div className="w-[160px]">
            <label htmlFor="b-disc" className={LABEL}>Bill Discount ₹</label>
            <div className="relative">
              <Percent aria-hidden="true" className="pointer-events-none absolute left-3.5 top-[15px] h-4 w-4 text-[#94A3B8]" />
              <input id="b-disc" type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)}
                className={cn(INPUT, 'h-12 pl-9')} />
            </div>
          </div>
        </div>

        {/* Items */}
        <section className={cn(CARD, 'mt-3.5 overflow-hidden pb-4')}>
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-[#64748B]">
              <Loader2 aria-hidden="true" className="mr-2 inline h-4 w-4 animate-spin" />Loading counter…
            </p>
          ) : lines.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-[#64748B]">
              Search above to add medicines to this bill.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-separate border-spacing-0">
                <caption className="sr-only">Bill line items</caption>
                <thead>
                  <tr>
                    {['#', 'Medicine / SKU', 'Batch', 'Expiry', 'Qty', 'MRP (₹)', 'Disc (%)', 'Amount (₹)', 'Actions'].map((h, i) => (
                      <th key={h} scope="col"
                        className={cn('h-[42px] border-b border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]',
                          i === 0 && 'pl-5', i >= 5 && i <= 7 && 'text-right', i === 8 && 'pr-5')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.med.id}>
                      <td className="h-[62px] border-b border-[#F1F3F9] pl-5 pr-3 text-[12.5px] font-semibold text-[#94A3B8]">{i + 1}</td>
                      <th scope="row" className="border-b border-[#F1F3F9] pr-3 text-left font-normal">
                        <span className="flex items-center gap-[11px]">
                          <Tile icon="Pill" tint="#E4EBFD" fg="#2B6FF0" />
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] font-bold text-[#0F172A]">{l.med.name}</span>
                            <span className="block text-[11px] text-[#94A3B8]">SKU: {l.med.sku} · {l.med.qtyInStock} in stock</span>
                          </span>
                        </span>
                      </th>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{l.med.batch}</td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{l.med.expiry ?? '—'}</td>
                      <td className="border-b border-[#F1F3F9] pr-3">
                        <QtyStepper value={l.qty} name={l.med.name} onChange={(q) => setQty(l.med.id, q)} />
                        {l.qty >= l.med.qtyInStock && (
                          <span className="mt-1 block text-[10.5px] font-medium text-[#E8890B]">All remaining stock</span>
                        )}
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-right text-[12.5px] font-semibold text-[#0F172A]">{amt(l.med.mrp)}</td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-right">
                        <label className="sr-only" htmlFor={`disc-${l.med.id}`}>Discount % on {l.med.name}</label>
                        <input id={`disc-${l.med.id}`} type="number" min={0} max={100} value={l.discPct}
                          onChange={(e) => setDisc(l.med.id, Number(e.target.value) || 0)}
                          className="h-8 w-16 rounded-[7px] border border-[#E2E6F0] px-2 text-right text-[12.5px] font-semibold text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-right text-[12.5px] font-bold text-[#0F172A]">
                        {amt(round2(l.qty * l.med.mrp * (1 - l.discPct / 100)))}
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-5">
                        <button type="button" aria-label={`Remove ${l.med.name}`} onClick={() => remove(l.med.id)}
                          className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-[#FDF0F0] hover:bg-[#FBE0E0]">
                          <Trash2 className="h-4 w-4 text-[#EF4444]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Payment + summary */}
        <div className="mt-[18px] grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[1fr_300px]">
          <section className={cn(CARD, 'min-w-0 px-5 pb-5 pt-[18px]')}>
            <h2 className={H2}>Payment Details</h2>

            <div className="mt-3">
              <p className={LABEL}>Payment Mode</p>
              <div role="radiogroup" aria-label="Payment mode" className="flex flex-wrap gap-2.5">
                {MODES.map((m) => {
                  const Icon = PH_ICONS[m.icon] ?? FileText;
                  const on = mode === m.id;
                  return (
                    <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => setMode(m.id)}
                      className={cn('flex h-[42px] items-center gap-2 rounded-[10px] px-4 text-[13px] transition-colors',
                        on ? 'border-[1.5px] border-[#6366F1] bg-[#F0EFFE] font-bold text-[#3B4FE0]'
                           : 'border border-[#E4E8F1] bg-white font-semibold text-[#334155] hover:bg-[#F7F8FC]')}>
                      <Icon className="h-[15px] w-[15px]" style={{ color: on ? '#3B4FE0' : m.color }} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="b-received" className={LABEL}>
                  Amount Received <span aria-hidden="true" className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <span aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13.5px] text-[#64748B]">₹</span>
                  <input id="b-received" type="number" step="0.01" min={0} value={received}
                    onChange={(e) => setReceived(e.target.value)} className={cn(INPUT, 'h-[46px] pl-8')} />
                </div>
                <button type="button" onClick={() => setReceived(String(totals.payable))}
                  className="mt-1.5 text-[11.5px] font-bold text-[#3B4FE0] hover:underline">
                  Exact amount (₹{amt(totals.payable)})
                </button>
              </div>
              {mode !== 'cash' && (
                <div>
                  <label htmlFor="b-ref" className={LABEL}>Payment Reference</label>
                  <input id="b-ref" value={reference} onChange={(e) => setReference(e.target.value)}
                    placeholder="UPI ID / Txn ID / Cheque No." className={cn(INPUT, 'h-[46px]')} />
                </div>
              )}
            </div>

            <div className="mt-4">
              <label htmlFor="b-notes" className={LABEL}>Notes (Optional)</label>
              <textarea id="b-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note for this bill…"
                className="min-h-[80px] w-full rounded-[10px] border border-[#E4E8F1] bg-white px-3.5 py-3 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none" />
            </div>

            {error && (
              <p role="alert" className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
                <X aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button type="button" className={cn(GHOST_BTN, 'h-12 px-7 text-[13.5px] font-bold text-[#1E2A5A]')}
                onClick={() => { setLines([]); setDiscount('0'); setReceived('0'); setNotes(''); }}>
                Clear Bill
              </button>
              <button type="button" onClick={() => void generate()} disabled={saving || lines.length === 0}
                className={cn(PRIMARY_BTN, 'h-12 px-[26px] text-[13.5px] font-bold disabled:opacity-60')} style={{ background: PRIMARY_BG }}>
                {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                {saving ? 'Generating…' : 'Generate Invoice & Print'}
              </button>
            </div>
          </section>

          <section className={cn(CARD, 'min-w-0 px-[18px] pb-[18px] pt-4')}>
            <h2 className="font-display text-[14.5px] font-bold text-[#0F172A]">Bill Summary</h2>
            <dl className="mt-3 space-y-3">
              <SummaryRow label={`Subtotal incl. GST (${totals.count} item${totals.count === 1 ? '' : 's'})`} value={amt(totals.subtotal)} />
              <SummaryRow label="Discount" value={`– ${amt(totals.discount)}`} symbol={false} />
              <SummaryRow label="Taxable Value" value={amt(totals.taxable)} />
              <SummaryRow label="GST (included)" value={amt(totals.gst)} />
            </dl>
            <div className="my-3 border-t border-dashed border-[#E4E8F1]" />
            <p className="flex items-center gap-3">
              <span className="text-[12.5px] font-extrabold uppercase text-[#4F46E5]">Payable Amount</span>
              <span className="ml-auto text-[18px] font-extrabold text-[#4F46E5]">
                <span aria-hidden="true">₹ {amt(totals.payable)}</span>
                <span className="sr-only">{amt(totals.payable)} rupees</span>
              </span>
            </p>
            <p className="mt-3 flex items-center gap-3">
              <span className="text-[12.5px] font-medium text-[#475569]">Amount Received</span>
              <span className="ml-auto text-[12.5px] font-bold text-[#12A150]">₹ {amt(totals.received)}</span>
            </p>
            <div className="mt-3">
              <p className="flex items-center gap-2 rounded-[9px] bg-[#ECFAF1] px-[13px] py-[11px]">
                <span className="text-[11.5px] font-bold uppercase text-[#0F7A46]">Change to Return</span>
                <span className="ml-auto text-[15px] font-extrabold text-[#12A150]">₹ {amt(totals.change)}</span>
              </p>
            </div>
            {totals.received > 0 && totals.received < totals.payable && (
              <p className="mt-2.5 rounded-[9px] bg-[#FEF8EC] px-[13px] py-2.5 text-[11.5px] font-semibold text-[#8A5A0B]">
                Short by ₹{amt(round2(totals.payable - totals.received))} — the bill will be saved as partial.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* ── Live invoice preview ── */}
      <section className={cn(CARD, 'min-w-0 px-5 pb-5 pt-[18px]')} aria-live="polite">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#0F172A]">Invoice Preview</h2>
          <span className="rounded-[8px] bg-[#E9ECFE] px-3 py-1.5 text-xs font-bold text-[#3B4FE0]">Draft</span>
          <button type="button" onClick={() => window.print()} className={cn(GHOST_BTN, 'ml-auto h-9 px-[13px]')}>
            <Printer className="h-[15px] w-[15px] text-[#334155]" />
            <span className="text-xs font-semibold text-[#334155]">Print</span>
          </button>
        </div>
        <p className="mt-1 text-[12.5px] text-[#64748B]">
          The invoice number is issued by the server when you generate it.
        </p>
        <div className="mt-3.5">
          <InvoiceDocument
            items={previewItems}
            totals={totals}
            customer={walkIn ? walkInName || 'Walk-in customer' : selectedPatient?.displayName ?? '—'}
          />
        </div>
      </section>
    </div>
  );
}
