import { Mail, MapPin, Phone } from 'lucide-react';
import { amt } from '../../../../data/pharmacy';
import { rupeesToWords } from '../../../../lib/rupeesToWords';
import { useBillingClinic } from './shared';

/** One printed line. Amount is derived here so the preview and the saved bill agree. */
export interface InvoiceLine {
  sku: string;
  name: string;
  batch: string;
  qty: number;
  mrp: number;
  disc: number;
  gstPct: number;
}

const lineAmount = (i: InvoiceLine) => Math.round(i.qty * i.mrp * (1 - i.disc / 100) * 100) / 100;

interface Totals {
  count: number;
  subtotal: number;
  discount: number;
  taxable: number;
  gst: number;
  payable: number;
  received: number;
  change: number;
}

const NAVY = '#1E3A6E';
const money = (n: number) => `₹ ${amt(n)}`;

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex gap-2 text-[11px] leading-[1.5]">
      <span className="w-[72px] shrink-0 font-semibold text-[#475569]">{label}</span>
      <span className="shrink-0 text-[#94A3B8]">:</span>
      <span className="font-semibold text-[#0F172A]" style={accent ? { color: NAVY, fontWeight: 700 } : undefined}>{value}</span>
    </div>
  );
}

function TotalRow({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex justify-between text-[11.5px]">
      <dt className={dim ? 'font-medium text-[#64748B]' : 'font-medium text-[#475569]'}>{label}</dt>
      <dd className="font-semibold text-[#0F172A] tabular-nums">
        <span aria-hidden="true">{value}</span>
        <span className="sr-only">{value.replace('₹', '')} rupees</span>
      </dd>
    </div>
  );
}

/**
 * The pharmacy TAX INVOICE, live beside the billing form — restyled to the same
 * letterhead format as the printable clinic invoice so the two read as one
 * document family. Every figure is passed in, so editing a quantity re-renders
 * it in place.
 *
 * Unlike the doctor invoice this one genuinely carries GST (extracted from the
 * MRP under Legal Metrology — tax-inclusive, never added on top). Intra-state
 * GST is always CGST + SGST split equally, so showing that split is honest; the
 * payable is the subtotal, not the subtotal plus the tax.
 */
export function InvoiceDocument({
  items,
  totals,
  customer,
  meta,
}: {
  items: InvoiceLine[];
  totals: Totals;
  customer: string;
  /** Absent while the bill is still a draft — the server issues these on save. */
  meta?: { invoiceNo: string; date: string; time: string; cashier: string; pid?: string; phone?: string };
}) {
  const clinic = useBillingClinic();
  const half = Math.round((totals.gst / 2) * 100) / 100;

  return (
    <div className="rounded-[12px] border border-[#E6EAF2] bg-white px-6 pb-6 pt-5 text-[#0F172A]">
      {/* ── Letterhead ── */}
      <div className="flex items-start justify-between gap-5">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[12px] text-[22px] font-black text-white"
            style={{ background: `linear-gradient(135deg, #2F6FEB 0%, ${NAVY} 100%)` }}>
            M
          </span>
          <div>
            <p className="font-display text-[19px] font-extrabold leading-none tracking-[-0.01em]" style={{ color: NAVY }}>Mateo</p>
            <p className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#2F6FEB]">Child Care Clinic</p>
            <p className="mt-1 text-[9.5px] font-medium italic text-[#64748B]">Caring for Little Lives</p>
          </div>
        </div>

        <div className="min-w-0 space-y-[4px] text-[10px] font-medium text-[#475569]">
          <p className="text-[11px] font-bold text-[#0F172A]">{clinic.name}</p>
          {clinic.address && <p className="flex items-start gap-1.5"><MapPin className="mt-[1px] h-2.5 w-2.5 shrink-0" style={{ color: NAVY }} />{clinic.address}</p>}
          {clinic.phone && <p className="flex items-center gap-1.5"><Phone className="h-2.5 w-2.5 shrink-0" style={{ color: NAVY }} />{clinic.phone}</p>}
          {clinic.email && <p className="flex items-center gap-1.5"><Mail className="h-2.5 w-2.5 shrink-0" style={{ color: NAVY }} />{clinic.email}</p>}
          {clinic.licence && <p>Pharmacy Licence: {clinic.licence}</p>}
          {clinic.gstin && <p>GSTIN: {clinic.gstin}</p>}
        </div>

        <div className="shrink-0 text-right">
          <p className="font-display text-[22px] font-black leading-none tracking-[-0.02em]" style={{ color: NAVY }}>TAX INVOICE</p>
          <p className="mt-2 inline-block rounded-[6px] px-3 py-1 text-[11px] font-bold text-white" style={{ background: meta ? NAVY : '#94A3B8' }}>
            {meta?.invoiceNo ?? 'DRAFT'}
          </p>
        </div>
      </div>

      <div className="mt-4 h-[3px] rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, #2F6FEB)` }} />

      {/* ── Bill To / Invoice details ── */}
      <div className="mt-4 grid grid-cols-2 gap-5">
        <section className="rounded-[10px] border border-[#E6EAF2] p-3.5">
          <p className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em]" style={{ color: NAVY }}>Bill To</p>
          <div className="space-y-[4px]">
            <Field label="Customer" value={customer} accent />
            {meta?.pid && <Field label="Patient ID" value={meta.pid} />}
            {meta?.phone && <Field label="Phone" value={meta.phone} />}
          </div>
        </section>

        <section className="rounded-[10px] border border-[#E6EAF2] p-3.5">
          <p className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[0.06em]" style={{ color: NAVY }}>Invoice Details</p>
          <div className="space-y-[4px]">
            <Field label="Invoice No." value={meta?.invoiceNo ?? 'Not issued yet'} />
            <Field label="Date" value={meta?.date ?? '—'} />
            <Field label="Time" value={meta?.time ?? '—'} />
            <Field label="Cashier" value={meta?.cashier ?? '—'} />
          </div>
        </section>
      </div>

      {/* ── Items ── */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[460px] border-separate border-spacing-0">
          <caption className="sr-only">Invoice line items</caption>
          <thead>
            <tr>
              {['#', 'Medicine / SKU', 'Batch', 'Qty', 'MRP (₹)', 'Disc', 'GST', 'Amount (₹)'].map((h, i, a) => (
                <th key={h} scope="col"
                  className={`h-[32px] px-2.5 text-[9.5px] font-bold uppercase tracking-[0.03em] text-white ${i === 0 ? 'rounded-tl-[7px]' : ''} ${i === a.length - 1 ? 'rounded-tr-[7px] text-right' : ''} ${i >= 3 && i < a.length - 1 ? 'text-right' : 'text-left'}`}
                  style={{ background: NAVY }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.sku} className={i % 2 ? 'bg-[#F7F9FD]' : undefined}>
                <td className="h-[32px] border-b border-[#EDF1F8] px-2.5 text-[10.5px] text-[#334155]">{i + 1}</td>
                <th scope="row" className="border-b border-[#EDF1F8] px-2.5 text-left text-[10.5px] font-semibold" style={{ color: NAVY }}>{it.name}</th>
                <td className="border-b border-[#EDF1F8] px-2.5 text-[10.5px] text-[#334155]">{it.batch}</td>
                <td className="border-b border-[#EDF1F8] px-2.5 text-right text-[10.5px] text-[#334155] tabular-nums">{it.qty}</td>
                <td className="border-b border-[#EDF1F8] px-2.5 text-right text-[10.5px] text-[#334155] tabular-nums">{amt(it.mrp)}</td>
                <td className="border-b border-[#EDF1F8] px-2.5 text-right text-[10.5px] text-[#334155] tabular-nums">{it.disc}%</td>
                <td className="border-b border-[#EDF1F8] px-2.5 text-right text-[10.5px] text-[#334155] tabular-nums">{it.gstPct}%</td>
                <td className="border-b border-[#EDF1F8] px-2.5 text-right text-[10.5px] font-semibold text-[#0F172A] tabular-nums">{amt(lineAmount(it))}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="border-b border-[#EDF1F8] px-2.5 py-4 text-center text-[10.5px] text-[#94A3B8]">
                  Add a medicine to start the bill.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Amount in words + totals ── */}
      <div className="mt-4 grid grid-cols-2 items-start gap-5">
        <section className="rounded-[10px] border border-[#E6EAF2] p-3.5">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]" style={{ color: NAVY }}>Amount in Words</p>
          <p className="mt-1.5 text-[11px] font-semibold text-[#334155]">{rupeesToWords(totals.payable)}</p>
          <p className="mt-2.5 text-[10px] text-[#94A3B8]">GST is included in the MRP under Legal Metrology — it is not added on top.</p>
        </section>

        <section className="rounded-[10px] border border-[#E6EAF2] p-3.5">
          <dl className="space-y-1.5">
            <TotalRow label="Sub Total (incl. GST)" value={money(totals.subtotal)} />
            {totals.discount > 0 && <TotalRow label="Discount" value={`– ${money(totals.discount)}`} />}
            <TotalRow label="Taxable Value" value={money(totals.taxable)} dim />
            <TotalRow label="CGST (incl.)" value={money(half)} dim />
            <TotalRow label="SGST (incl.)" value={money(totals.gst - half)} dim />
            <div className="mt-1 flex justify-between rounded-[7px] px-2.5 py-2" style={{ background: NAVY }}>
              <dt className="text-[12px] font-extrabold text-white">Total Amount</dt>
              <dd className="text-[12px] font-extrabold text-white tabular-nums">{money(totals.payable)}</dd>
            </div>
            <div className="flex justify-between rounded-[7px] bg-[#ECFAF1] px-2.5 py-2">
              <dt className="text-[11.5px] font-bold text-[#0F7A46]">Amount Received</dt>
              <dd className="text-[11.5px] font-bold text-[#0F7A46] tabular-nums">{money(totals.received)}</dd>
            </div>
            <div className="flex justify-between rounded-[7px] px-2.5 py-2" style={{ background: totals.change > 0 ? '#FEF6E7' : '#F1F5F9' }}>
              <dt className="text-[11.5px] font-bold" style={{ color: totals.change > 0 ? '#B45309' : '#475569' }}>Change to Return</dt>
              <dd className="text-[11.5px] font-bold tabular-nums" style={{ color: totals.change > 0 ? '#B45309' : '#475569' }}>{money(totals.change)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* ── UPI Payment ── */}
      {clinic.upiVpa && (
        <div className="mt-4 flex items-center gap-4 rounded-[10px] border border-[#E6EAF2] px-4 py-3">
          <div className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-[8px] border border-[#E2E6F0] bg-[#F7F9FD]">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="3" height="3" />
              <line x1="21" y1="14" x2="21" y2="14.01" />
              <line x1="21" y1="21" x2="21" y2="21.01" />
              <line x1="17" y1="18" x2="21" y2="18" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]" style={{ color: NAVY }}>Pay via UPI</p>
            <p className="mt-1 text-[12px] font-bold text-[#0F172A]">{clinic.upiVpa}</p>
            <p className="mt-0.5 text-[10px] text-[#64748B]">Scan or enter this UPI ID in any payment app</p>
          </div>
          {totals.payable > 0 && (
            <div className="ml-auto shrink-0 text-right">
              <p className="text-[10px] font-medium text-[#64748B]">Amount</p>
              <p className="text-[14px] font-extrabold" style={{ color: NAVY }}>{money(totals.payable)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Note ── */}
      <div className="mt-4 rounded-[8px] bg-[#F7F9FD] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#64748B]">Note:</p>
        <ul className="mt-1 space-y-0.5 text-[10.5px] text-[#64748B]">
          <li>• This is a computer generated invoice.</li>
          <li>• No signature is required.</li>
        </ul>
      </div>

      {/* ── Footer ── */}
      <div className="mt-4 border-t border-[#E6EAF2] pt-3.5 text-center">
        <p className="text-[12px] font-bold italic" style={{ color: NAVY }}>We wish your child a speedy recovery!</p>
        <p className="mt-1 text-[10.5px] text-[#64748B]">Thank you for choosing {clinic.name}.</p>
        {clinic.phone && <p className="mt-1 text-[10.5px] font-semibold text-[#334155]">In case of emergency, call {clinic.phone}</p>}
      </div>
    </div>
  );
}
