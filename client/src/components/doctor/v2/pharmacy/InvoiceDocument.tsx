import { PHARMACY_LOCATION, amt } from '../../../../data/pharmacy';
import { rupeesToWords } from '../../../../lib/rupeesToWords';
import { ChangeStrip, MateoMark, MetaRow } from './shared';

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

function TotalRow({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <dt className={`text-[11px] ${dim ? 'font-medium text-[#64748B]' : 'font-medium text-[#475569]'}`}>{label}</dt>
      <dd className="ml-auto text-[11px] font-semibold text-[#0F172A]">
        <span aria-hidden="true">{value}</span>
        <span className="sr-only">{value.replace('₹', '')} rupees</span>
      </dd>
    </div>
  );
}

/**
 * The TAX INVOICE rendered live beside the billing form (spec 27 §3). Every
 * figure is passed in, so editing a quantity re-renders the document in place.
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
  return (
    <div className="rounded-[12px] border border-[#ECEEF4] bg-white px-[22px] pb-[22px] pt-5">
      {/* Letterhead */}
      <div className="flex flex-wrap items-start gap-5">
        <MateoMark />
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-[#0F172A]">{PHARMACY_LOCATION.name}</p>
          <p className="text-[11px] text-[#64748B]">{PHARMACY_LOCATION.address}</p>
          <p className="text-[11px] text-[#64748B]">Pharmacy Licence No.: {PHARMACY_LOCATION.licence}</p>
        </div>
        <p className="ml-auto shrink-0 text-[13px] font-extrabold uppercase tracking-[0.04em] text-[#3B4FE0]">Tax Invoice</p>
      </div>

      <div className="my-3.5 h-px bg-[#ECEEF4]" />

      {/* Bill to / meta */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#94A3B8]">Bill To</p>
          <p className="mt-1 text-[13px] font-bold text-[#0F172A]">{customer}</p>
          {meta?.pid && <p className="text-[11px] font-medium text-[#64748B]">{meta.pid}</p>}
          {meta?.phone && <p className="text-[11px] font-medium text-[#64748B]">Phone: {meta.phone}</p>}
        </div>
        <dl className="min-w-0 space-y-[3px]">
          <MetaRow label="Invoice No." value={meta?.invoiceNo ?? 'Not issued yet'} />
          <MetaRow label="Invoice Date" value={meta?.date ?? '—'} />
          <MetaRow label="Time" value={meta?.time ?? '—'} />
          <MetaRow label="Cashier" value={meta?.cashier ?? '—'} />
        </dl>
      </div>

      {/* Items */}
      <div className="mt-3.5 overflow-x-auto">
        <table className="w-full min-w-[440px] border-separate border-spacing-0">
          <caption className="sr-only">Invoice line items</caption>
          <thead>
            <tr>
              {['#', 'Medicine / SKU', 'Batch', 'Qty', 'MRP (₹)', 'Disc', 'GST', 'Amount (₹)'].map((h, i, a) => (
                <th key={h} scope="col"
                  className={`h-[30px] bg-[#3B4FE0] text-left text-[9.5px] font-bold uppercase tracking-[0.03em] text-white ${i === 0 ? 'rounded-tl-[6px] pl-2.5' : ''} ${i === a.length - 1 ? 'rounded-tr-[6px] pr-2.5 text-right' : ''} ${i >= 3 && i < a.length - 1 ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.sku} className={i % 2 ? 'bg-[#FAFBFD]' : undefined}>
                <td className="h-[30px] border-b border-[#F1F3F9] pl-2.5 pr-2 text-[10.5px] text-[#334155]">{i + 1}</td>
                <th scope="row" className="border-b border-[#F1F3F9] pr-2 text-left text-[10.5px] font-medium text-[#334155]">{it.name}</th>
                <td className="border-b border-[#F1F3F9] pr-2 text-[10.5px] text-[#334155]">{it.batch}</td>
                <td className="border-b border-[#F1F3F9] pr-2 text-right text-[10.5px] text-[#334155]">{it.qty}</td>
                <td className="border-b border-[#F1F3F9] pr-2 text-right text-[10.5px] text-[#334155]">{amt(it.mrp)}</td>
                <td className="border-b border-[#F1F3F9] pr-2 text-right text-[10.5px] text-[#334155]">{it.disc}%</td>
                <td className="border-b border-[#F1F3F9] pr-2 text-right text-[10.5px] text-[#334155]">{it.gstPct}%</td>
                <td className="border-b border-[#F1F3F9] pr-2.5 text-right text-[10.5px] font-semibold text-[#0F172A]">{amt(lineAmount(it))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <dl className="ml-auto mt-3.5 max-w-[260px]">
        <TotalRow label="Subtotal" value={`₹${amt(totals.subtotal)}`} />
        <div className="mt-2"><TotalRow label="Discount" value={`– ₹${amt(totals.discount)}`} /></div>
        <div className="mt-2"><TotalRow label="Taxable Amount" value={`₹${amt(totals.taxable)}`} /></div>
        <div className="mt-2"><TotalRow label="GST (12%)" value={`₹${amt(totals.gst)}`} /></div>
        <div className="my-3 border-t border-dashed border-[#E4E8F1]" />
        <div className="flex items-center gap-4">
          <dt className="text-xs font-extrabold uppercase tracking-[0.02em] text-[#3B4FE0]">Payable Amount</dt>
          <dd className="ml-auto text-[15px] font-extrabold text-[#3B4FE0]">
            <span aria-hidden="true">₹ {amt(totals.payable)}</span>
            <span className="sr-only">{amt(totals.payable)} rupees</span>
          </dd>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <dt className="text-[11px] font-medium text-[#475569]">Amount Received</dt>
          <dd className="ml-auto text-[11px] font-bold text-[#0F172A]">
            <span aria-hidden="true">₹ {amt(totals.received)}</span>
            <span className="sr-only">{amt(totals.received)} rupees</span>
          </dd>
        </div>
        <div className="mt-2.5">
          <ChangeStrip value={amt(totals.change)} size="sm" />
        </div>
      </dl>

      {/* Footer */}
      <p aria-hidden="true" className="mt-3.5 text-[10.5px] font-medium text-[#475569]">
        Amount in words: {rupeesToWords(totals.payable)}
      </p>
      <p className="mt-1.5 text-[10.5px] text-[#64748B]">Thank you for choosing Mateo Clinic Pharmacy.</p>

      <div className="mt-[18px] flex justify-end">
        <div className="w-[168px] text-center">
          <svg viewBox="0 0 150 34" className="mx-auto h-8 w-full" aria-hidden="true">
            <path d="M8 26c8-14 13-19 17-19s2 12 6 12 7-15 12-15 3 20 8 20 8-16 13-16 4 14 9 14 8-9 12-13 10-5 14-3"
              fill="none" stroke="#1E2A5A" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <div className="mt-1 border-t border-[#94A3B8] pt-1.5">
            <p className="text-[10px] font-semibold text-[#334155]">Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
