import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Check, CircleCheck, Download, Loader2, Mail, Maximize2, Plus, Printer, X } from 'lucide-react';
import { PHARMACY_LOCATION, amt } from '../../data/pharmacy';
import { getBill } from '../../api/pharmacy';
import type { BillResult } from '../../api/pharmacy';
import {
  CARD, ChangeStrip, GHOST_BTN, H2, MateoMark, MetaRow, OUTLINE_BTN, PRIMARY_BG, PRIMARY_BTN,
  Tile, WhatsAppIcon,
} from '../../components/doctor/v2/pharmacy/shared';
import { cn } from '../../lib/cn';

/** The saved bill, plus the patient block the detail endpoint resolves. */
type Bill = BillResult & {
  patient: { id: string; name: string; dob: string | null; sex: string; phone: string | null } | null;
  paymentReference?: string | null;
  notes?: string | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function SummaryRow({ label, value, symbol = true, valueClass = 'text-[#0F172A]' }: {
  label: string; value: string; symbol?: boolean; valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <dt className="text-[12.5px] font-medium text-[#475569]">{label}</dt>
      <dd className={cn('ml-auto text-[12.5px] font-semibold', valueClass)}>
        <span aria-hidden="true">{symbol ? `₹${value}` : value}</span>
        <span className="sr-only">{value.replace('– ', '')} rupees</span>
      </dd>
    </div>
  );
}

/** Shared by the inline preview and the fullscreen dialog. */
function ReceiptDocument({ bill }: { bill: Bill }) {
  const date = fmtDate(bill.createdAt);
  const time = fmtTime(bill.createdAt);
  return (
    <div className="rounded-[12px] border border-[#ECEEF4] bg-white px-[22px] pb-[22px] pt-5">
      <div className="flex flex-wrap items-start gap-5">
        <MateoMark />
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-[#0F172A]">{PHARMACY_LOCATION.name}</p>
          <p className="text-[11px] text-[#64748B]">{PHARMACY_LOCATION.address}</p>
          <p className="text-[11px] text-[#64748B]">Pharmacy Licence No.: {PHARMACY_LOCATION.licenceCompact}</p>
          <p className="text-[11px] text-[#64748B]">GSTIN: {PHARMACY_LOCATION.gstin}</p>
        </div>
      </div>

      <div className="my-3.5 h-px bg-[#ECEEF4]" />
      <p className="text-center text-[13px] font-extrabold uppercase tracking-[0.06em] text-[#0F172A]">Tax Invoice / Receipt</p>
      <div className="my-3 h-px bg-[#ECEEF4]" />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <dl className="min-w-0 space-y-[3px]">
          <MetaRow label="Invoice No." value={bill.number} />
          <MetaRow label="Invoice Date" value={date} />
          <MetaRow label="Time" value={time} />
          <MetaRow label="Payment" value={bill.paymentMode.toUpperCase()} />
        </dl>
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#94A3B8]">Bill To</p>
          <p className="mt-1 text-[12.5px] font-bold text-[#0F172A]">{bill.customer}</p>
          {bill.patient?.sex && <p className="text-[11px] font-medium text-[#64748B]">{bill.patient.sex}</p>}
          {bill.patient?.phone && <p className="text-[11px] font-medium text-[#64748B]">Phone: {bill.patient.phone}</p>}
        </div>
      </div>

      <div className="mt-3.5 overflow-x-auto">
        <table className="w-full min-w-[320px] border-separate border-spacing-0">
          <caption className="sr-only">Receipt line items</caption>
          <thead>
            <tr>
              {['#', 'Item', 'Batch', 'Qty', 'Amount (₹)'].map((h, i) => (
                <th key={h} scope="col"
                  className={cn('h-[30px] bg-[#F7F8FC] text-left text-[9.5px] font-bold uppercase tracking-[0.03em] text-[#64748B]',
                    i === 0 && 'pl-2.5', i >= 3 && 'text-right', i === 4 && 'pr-2.5')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bill.items.map((it, i) => (
              <tr key={`${it.sku}-${it.batch}`}>
                <td className="h-7 border-b border-[#F1F3F9] pl-2.5 pr-2 text-[10.5px] text-[#334155]">{i + 1}</td>
                <th scope="row" className="border-b border-[#F1F3F9] pr-2 text-left text-[10.5px] font-medium text-[#334155]">{it.name}</th>
                <td className="border-b border-[#F1F3F9] pr-2 text-[10.5px] text-[#334155]">{it.batch}</td>
                <td className="border-b border-[#F1F3F9] pr-2 text-right text-[10.5px] text-[#334155]">{it.qty}</td>
                <td className="border-b border-[#F1F3F9] pr-2.5 text-right text-[10.5px] font-semibold text-[#0F172A]">{amt(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto mt-3.5 max-w-[260px]">
        {([
          [`Subtotal (${bill.items.length} item${bill.items.length === 1 ? '' : 's'})`, `₹${amt(bill.subtotal)}`],
          ['Discount', `– ₹${amt(bill.discount)}`],
          ['Taxable Value', `₹${amt(bill.taxable)}`],
          ['GST (included)', `₹${amt(bill.gstAmount)}`],
        ] as const).map(([l, v]) => (
          <div key={l} className="mt-2 flex items-center gap-4 first:mt-0">
            <dt className="text-[11px] font-medium text-[#475569]">{l}</dt>
            <dd className="ml-auto text-[11px] font-semibold text-[#0F172A]">
              <span aria-hidden="true">{v}</span>
              <span className="sr-only">{v.replace(/[₹–\s]/g, '')} rupees</span>
            </dd>
          </div>
        ))}
        <div className="my-3 border-t border-dashed border-[#E4E8F1]" />
        <div className="flex items-center gap-4">
          <dt className="text-xs font-extrabold uppercase text-[#3B4FE0]">Payable Amount</dt>
          <dd className="ml-auto text-[15px] font-extrabold text-[#3B4FE0]">
            <span aria-hidden="true">₹ {amt(bill.payable)}</span>
            <span className="sr-only">{amt(bill.payable)} rupees</span>
          </dd>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <dt className="text-[11px] font-medium text-[#475569]">Amount Received</dt>
          <dd className="ml-auto text-[11px] font-bold text-[#0F172A]">
            <span aria-hidden="true">₹ {amt(bill.amountReceived)}</span>
            <span className="sr-only">{amt(bill.amountReceived)} rupees</span>
          </dd>
        </div>
        <div className="mt-2.5"><ChangeStrip value={amt(bill.changeReturned)} size="sm" /></div>
      </dl>

      <div className="mt-3.5 flex flex-wrap items-start gap-4 border-t border-[#ECEEF4] pt-3.5">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold text-[#334155]">Paid via {bill.paymentMode.toUpperCase()}</p>
        </div>
        {bill.paymentReference && (
          <div className="ml-auto text-right">
            <p className="text-[10.5px] text-[#94A3B8]">Reference</p>
            <p className="text-[10.5px] font-semibold text-[#334155]">{bill.paymentReference}</p>
          </div>
        )}
      </div>

      <p className="mt-3.5 text-center text-[10.5px] font-medium text-[#475569]">Thank you for visiting Mateo Clinic Pharmacy.</p>
      <p aria-hidden="true" className="mt-3 text-center font-display text-[22px] italic text-[#3B3FD8]">Thank You!</p>
    </div>
  );
}

export default function BillSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const billId = params.get('bill') ?? '';
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // A missing id is decided during render, not in the effect, so nothing is set
  // synchronously from inside it.
  const missingId = !billId;

  useEffect(() => {
    if (missingId) return;
    let cancelled = false;
    void getBill(billId)
      .then((r) => {
        if (!cancelled) setBill(r.bill as Bill);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load this invoice');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [billId, missingId]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [full]);

  if (missingId) {
    return (
      <div className={`${CARD} mx-auto max-w-md px-6 py-14 text-center`}>
        <h1 className="font-display text-lg font-bold text-[#0F172A]">No invoice selected</h1>
        <p className="mt-2 text-sm text-[#64748B]">Open an invoice from Billing to see its receipt.</p>
        <Link to="/doctor/pharmacy/billing"
          className="mx-auto mt-5 flex h-11 w-fit items-center gap-2 rounded-[10px] px-5 text-[13.5px] font-bold text-white"
          style={{ background: PRIMARY_BG }}>
          Go to Billing
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-[#64748B]">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading invoice…
      </p>
    );
  }

  if (error || !bill) {
    return (
      <div className={`${CARD} mx-auto max-w-md px-6 py-14 text-center`}>
        <h1 className="font-display text-lg font-bold text-[#0F172A]">Invoice not found</h1>
        <p className="mt-2 text-sm text-[#64748B]">{error ?? 'This invoice may have been removed.'}</p>
        <Link to="/doctor/pharmacy/billing"
          className="mx-auto mt-5 flex h-11 w-fit items-center gap-2 rounded-[10px] px-5 text-[13.5px] font-bold text-white"
          style={{ background: PRIMARY_BG }}>
          Back to Billing
        </Link>
      </div>
    );
  }

  const paid = bill.status === 'paid';

  return (
    <div className="grid grid-cols-1 items-start gap-5 2xl:grid-cols-[1fr_520px]">
      <div className="flex min-w-0 flex-col">
        <h1 className="font-display text-[23px] font-extrabold tracking-[-0.02em] text-[#0F172A]">Pharmacy Billing</h1>
        <p className="mt-1 text-[13px] font-medium text-[#64748B]">Invoice Generated Successfully</p>

        <p role="status" className="mt-3.5 flex items-center gap-[13px] rounded-[12px] border border-[#C8EDD8] bg-[#ECFAF1] px-5 py-[15px]">
          <span aria-hidden="true" className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#12A150]">
            <Check className="h-[13px] w-[13px] text-white" strokeWidth={3} />
          </span>
          <span className="text-[13.5px] font-semibold text-[#0F7A46]">
            Invoice {bill.number} saved and stock updated.
          </span>
        </p>

        {/* Transaction summary */}
        <section className={cn(CARD, 'mt-4 py-[18px]')}>
          <div className="grid grid-cols-1 divide-y divide-[#ECEEF4] sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-y-0">
            <div className="px-[22px] py-3 xl:py-0">
              <h2 className="text-[12.5px] font-bold text-[#0F172A]">Customer</h2>
              <p className="mt-3 truncate text-[13.5px] font-bold text-[#0F172A]">{bill.customer}</p>
              {bill.patient?.phone && <p className="truncate text-[11.5px] font-medium text-[#334155]">{bill.patient.phone}</p>}
              {!bill.patient && <p className="text-[11.5px] font-medium text-[#64748B]">Walk-in — no patient record linked</p>}
            </div>

            <div className="px-[22px] py-3 xl:py-0">
              <h2 className="text-[12.5px] font-bold text-[#0F172A]">Invoice Details</h2>
              <dl className="mt-3 space-y-2.5">
                <div>
                  <dt className="text-[11.5px] font-medium text-[#64748B]">Invoice No.</dt>
                  <dd className="text-[13px] font-bold text-[#3B4FE0]">{bill.number}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] font-medium text-[#64748B]">Issued</dt>
                  <dd className="text-[12.5px] font-semibold text-[#0F172A]">{fmtDate(bill.createdAt)}, {fmtTime(bill.createdAt)}</dd>
                </div>
              </dl>
            </div>

            <div className="px-[22px] py-3 xl:py-0">
              <h2 className="text-[12.5px] font-bold text-[#0F172A]">Payment Status</h2>
              <div className="mt-3">
                <span className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-[13px] py-[5px] text-[11.5px] font-bold',
                  paid ? 'bg-[#DCF7E6] text-[#12A150]' : 'bg-[#FDECD3] text-[#E8890B]')}>
                  <CircleCheck aria-hidden="true" className="h-[13px] w-[13px]" />
                  {paid ? 'Paid' : 'Partial'}
                </span>
                <p className="mt-2.5 text-xs">
                  <span className="font-medium text-[#64748B]">Paid via </span>
                  <span className="font-bold text-[#0F172A]">{bill.paymentMode.toUpperCase()}</span>
                </p>
                {bill.paymentReference && <p className="mt-1 text-xs font-medium text-[#64748B]">{bill.paymentReference}</p>}
              </div>
            </div>

            <div className="px-[22px] py-3 xl:py-0">
              <h2 className="text-[12.5px] font-bold text-[#0F172A]">Amount Summary</h2>
              <dl className="mt-3 space-y-2">
                <div className="flex items-center gap-3">
                  <dt className="text-xs font-medium text-[#64748B]">Payable</dt>
                  <dd className="ml-auto text-[12.5px] font-bold text-[#0F172A]">₹ {amt(bill.payable)}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <dt className="text-xs font-medium text-[#64748B]">Received</dt>
                  <dd className="ml-auto text-[12.5px] font-bold text-[#0F172A]">₹ {amt(bill.amountReceived)}</dd>
                </div>
              </dl>
              <div className="mt-2">
                <p className="flex items-center gap-2 rounded-[8px] bg-[#ECFAF1] px-[11px] py-2">
                  <span className="text-[11.5px] font-semibold text-[#0F7A46]">Change to Return</span>
                  <span className="ml-auto text-[13px] font-extrabold text-[#12A150]">₹ {amt(bill.changeReturned)}</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Items */}
        <section className={cn(CARD, 'mt-4 pb-2 pt-[18px]')}>
          <h2 className={cn(H2, 'px-5 !text-[15px]')}>Items ({bill.items.length})</h2>
          <div className="mt-3.5 overflow-x-auto">
            <table className="w-full min-w-[840px] border-separate border-spacing-0">
              <caption className="sr-only">Items purchased</caption>
              <thead>
                <tr>
                  {['#', 'Medicine / SKU', 'Batch', 'Qty', 'MRP (₹)', 'Disc (%)', 'GST (%)', 'Amount (₹)'].map((h, i) => (
                    <th key={h} scope="col"
                      className={cn('h-10 border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]',
                        i === 0 && 'pl-5', i >= 3 && 'text-right', i === 7 && 'pr-5')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bill.items.map((it, i) => (
                  <tr key={`${it.sku}-${it.batch}`}>
                    <td className="h-[62px] border-b border-[#F1F3F9] pl-5 pr-3 text-[12.5px] font-semibold text-[#94A3B8]">{i + 1}</td>
                    <th scope="row" className="border-b border-[#F1F3F9] pr-3 text-left font-normal">
                      <span className="flex items-center gap-[11px]">
                        <Tile icon="Pill" tint="#E4EBFD" fg="#2B6FF0" />
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-bold text-[#0F172A]">{it.name}</span>
                          <span className="block text-[11px] text-[#94A3B8]">SKU: {it.sku}</span>
                        </span>
                      </span>
                    </th>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{it.batch}</td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-right text-[12.5px] font-semibold text-[#0F172A]">{it.qty}</td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-right text-[12.5px] font-semibold text-[#0F172A]">{amt(it.mrp)}</td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-right text-[12.5px] font-semibold text-[#0F172A]">{it.discPct}%</td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-right text-[12.5px] font-semibold text-[#0F172A]">{it.gstPct}%</td>
                    <td className="border-b border-[#F1F3F9] pr-5 text-right text-[12.5px] font-bold text-[#0F172A]">{amt(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bottom row */}
        <div className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          <section className={cn(CARD, 'px-5 pb-5 pt-[18px]')}>
            <h2 className="font-display text-[14.5px] font-bold text-[#0F172A]">Bill Summary</h2>
            <dl className="mt-3.5 space-y-3">
              <SummaryRow label={`Subtotal (${bill.items.length} item${bill.items.length === 1 ? '' : 's'})`} value={amt(bill.subtotal)} />
              <SummaryRow label="Discount" value={`– ${amt(bill.discount)}`} symbol={false} />
              <SummaryRow label="Taxable Value" value={amt(bill.taxable)} />
              <SummaryRow label="GST (included)" value={amt(bill.gstAmount)} />
            </dl>
            <div className="my-3 border-t border-dashed border-[#E4E8F1]" />
            <p className="flex items-center gap-3">
              <span className="text-[12.5px] font-extrabold uppercase text-[#4F46E5]">Payable Amount</span>
              <span className="ml-auto text-[18px] font-extrabold text-[#4F46E5]">₹ {amt(bill.payable)}</span>
            </p>
            <p className="mt-3 flex items-center gap-3">
              <span className="text-[12.5px] font-medium text-[#475569]">Amount Received</span>
              <span className="ml-auto text-[12.5px] font-bold text-[#12A150]">₹ {amt(bill.amountReceived)}</span>
            </p>
            <div className="mt-3"><ChangeStrip value={amt(bill.changeReturned)} /></div>
          </section>

          <section className={cn(CARD, 'px-5 pb-5 pt-[18px]')}>
            <h2 className="font-display text-[14.5px] font-bold text-[#0F172A]">Notes</h2>
            <p className="mt-3 rounded-[10px] bg-[#FEF8EC] px-[15px] py-3.5 text-[12.5px] font-medium leading-5 text-[#8A5A0B]">
              {bill.notes || 'Thank you for visiting Mateo Clinic Pharmacy.'}
            </p>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {[
                { icon: <Printer className="h-4 w-4 text-[#334155]" />, label: 'Print Receipt', act: () => window.print() },
                { icon: <WhatsAppIcon />, label: 'Send on WhatsApp', act: () => console.log('[Clinic OS] WhatsApp', bill.number) },
                { icon: <Mail className="h-4 w-4 text-[#334155]" />, label: 'Email Receipt', act: () => console.log('[Clinic OS] Email', bill.number) },
              ].map((b) => (
                <button key={b.label} type="button" onClick={b.act}
                  aria-label={`${b.label} for invoice ${bill.number}`}
                  className="flex h-[46px] w-full items-center gap-3 rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 transition-colors hover:bg-[#F7F8FC]">
                  {b.icon}
                  <span className="text-[13px] font-bold text-[#1E2A5A]">{b.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer bar */}
        <div className="mt-[18px] flex flex-wrap items-center gap-3">
          <Link to="/doctor/pharmacy" className={cn(OUTLINE_BTN, 'h-12 px-6')}>
            <ArrowLeft className="h-4 w-4" />
            <span className="text-[13.5px] font-bold">Back to Inventory</span>
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => navigate('/doctor/pharmacy/billing')}
              className={cn(PRIMARY_BTN, 'h-12 px-[26px]')} style={{ background: PRIMARY_BG }}>
              <Plus className="h-[17px] w-[17px]" />
              <span className="text-[13.5px] font-bold">Start Next Sale</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Receipt ── */}
      <section className={cn(CARD, 'min-w-0 px-5 pb-5 pt-[18px]')}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#0F172A]">Payment Receipt</h2>
            <p className="text-[12.5px] font-medium text-[#64748B]">Preview</p>
          </div>
          <button type="button" onClick={() => setFull(true)} className={cn(GHOST_BTN, 'ml-auto h-10 px-4')}>
            <Maximize2 className="h-[15px] w-[15px] text-[#334155]" />
            <span className="text-[12.5px] font-bold text-[#1E2A5A]">Fullscreen</span>
          </button>
        </div>

        <div className="mt-3.5"><ReceiptDocument bill={bill} /></div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => window.print()} aria-label={`Download PDF for invoice ${bill.number}`}
            className={cn(GHOST_BTN, 'h-12')}>
            <Download className="h-4 w-4 text-[#334155]" />
            <span className="text-[13.5px] font-bold text-[#1E2A5A]">Download PDF</span>
          </button>
          <button type="button" onClick={() => window.print()} aria-label={`Print receipt for invoice ${bill.number}`}
            className={cn(GHOST_BTN, 'h-12')}>
            <Printer className="h-4 w-4 text-[#334155]" />
            <span className="text-[13.5px] font-bold text-[#1E2A5A]">Print Receipt</span>
          </button>
        </div>
      </section>

      {full && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(10,27,77,.5)] p-4">
          <button type="button" aria-label="Close receipt" className="absolute inset-0 cursor-default" onClick={() => setFull(false)} />
          <div role="dialog" aria-modal="true" aria-label={`Receipt for invoice ${bill.number}`}
            className="relative max-h-full w-full max-w-[560px] overflow-y-auto rounded-[14px] bg-white p-4 shadow-lift">
            <button ref={closeRef} type="button" autoFocus onClick={() => setFull(false)} aria-label="Close receipt"
              className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-[10px] text-[#64748B] hover:bg-[#F1F3F9]">
              <X className="h-4 w-4" />
            </button>
            <ReceiptDocument bill={bill} />
          </div>
        </div>
      )}
    </div>
  );
}
