import { useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Banknote, CreditCard, Landmark, QrCode, Wallet, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { InvoicePaymentMethod } from '../../../api/doctorBilling';
import { cn } from '../../../lib/cn';

const METHODS: { value: InvoicePaymentMethod; label: string; icon: LucideIcon }[] = [
  { value: 'upi', label: 'UPI / QR', icon: QrCode },
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'bank', label: 'Net Banking', icon: Landmark },
  { value: 'other', label: 'Other', icon: Wallet },
];

/** ₹ with two decimals + Indian grouping (kept local so the modal is self-contained). */
function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Build a standard UPI deep-link (spec #8). Any UPI app scanning this QR pre-fills
 * the clinic's VPA, the amount and the invoice number as the note. No money flows
 * through the app — the doctor confirms receipt and marks the invoice paid.
 */
function upiUri(vpa: string, payeeName: string, amount: number, note: string): string {
  const p = new URLSearchParams({ pa: vpa, pn: payeeName, am: amount.toFixed(2), cu: 'INR', tn: note });
  return `upi://pay?${p.toString()}`;
}

interface Props {
  invoiceNo: string;
  patientName: string;
  /** Amount to collect (the balance due, or the total for a fresh invoice). */
  amount: number;
  clinicName: string;
  /** The clinic's UPI VPA; when empty the QR is replaced with a set-up hint. */
  clinicUpiVpa: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (method: InvoicePaymentMethod, reference: string) => void;
}

/** Records how an invoice was paid and, for UPI, shows a scannable QR. */
export function CollectPaymentModal({ invoiceNo, patientName, amount, clinicName, clinicUpiVpa, busy, onClose, onConfirm }: Props) {
  const [method, setMethod] = useState<InvoicePaymentMethod>(clinicUpiVpa ? 'upi' : 'cash');
  const [reference, setReference] = useState('');

  const showQr = method === 'upi' && !!clinicUpiVpa;
  const uri = showQr ? upiUri(clinicUpiVpa, clinicName || 'Clinic', amount, invoiceNo) : '';

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="collect-title">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-[#0F172A]/45" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[18px] bg-white shadow-2xl sm:rounded-[18px]">
        <div className="flex items-center gap-3 border-b border-[#ECEEF4] px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#EEF2FF]"><Wallet className="h-[18px] w-[18px] text-[#3B4FE0]" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="collect-title" className="font-display text-[16px] font-extrabold leading-tight text-[#0F172A]">Record Payment</h2>
            <p className="truncate text-[12px] font-medium text-[#64748B]">{invoiceNo} · {patientName}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[8px] text-[#64748B] hover:bg-[#F1F3F9]"><X className="h-[18px] w-[18px]" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-baseline justify-between rounded-[12px] bg-[#F7F9FF] px-4 py-3">
            <span className="text-[12.5px] font-semibold text-[#475569]">Amount to collect</span>
            <span className="font-display text-[20px] font-extrabold text-[#0F172A] tabular-nums">{inr(amount)}</span>
          </div>

          <fieldset className="mt-4">
            <legend className="text-[12.5px] font-bold text-[#334155]">Payment method</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {METHODS.map((m) => {
                const active = method === m.value;
                return (
                  <button key={m.value} type="button" onClick={() => setMethod(m.value)}
                    aria-pressed={active}
                    className={cn(
                      'flex items-center gap-2 rounded-[10px] border px-3 py-2.5 text-[13px] font-semibold transition-colors',
                      active ? 'border-[#3B4FE0] bg-[#EEF2FF] text-[#3B4FE0]' : 'border-[#E2E6F0] bg-white text-[#334155] hover:bg-[#F7F8FC]',
                    )}>
                    <m.icon className="h-[17px] w-[17px]" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {method === 'upi' && (
            showQr ? (
              <div className="mt-4 flex flex-col items-center rounded-[12px] border border-[#E2E6F0] bg-white px-4 py-5">
                <p className="mb-3 text-[12.5px] font-semibold text-[#475569]">Scan to pay by any UPI app</p>
                <div className="rounded-[12px] border border-[#ECEEF4] bg-white p-3">
                  <QRCodeSVG value={uri} size={188} level="M" marginSize={0} />
                </div>
                <p className="mt-3 text-center text-[12px] font-bold text-[#0F172A]">{clinicUpiVpa}</p>
                <p className="mt-0.5 text-center text-[11.5px] font-medium text-[#94A3B8]">Confirm the payment in your UPI app, then mark it received below.</p>
              </div>
            ) : (
              <p className="mt-4 rounded-[10px] border border-[#F8E3C2] bg-[#FEF9EF] px-4 py-3 text-[12.5px] font-medium text-[#92610A]">
                Add your clinic's UPI ID under Locations to show a scannable QR here. You can still record a UPI payment.
              </p>
            )
          )}

          <div className="mt-4">
            <label htmlFor="pay-ref" className="text-[12.5px] font-bold text-[#334155]">Reference / txn ID <span className="font-medium text-[#94A3B8]">(optional)</span></label>
            <input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120}
              placeholder="e.g. UPI ref, cheque no."
              className="mt-1.5 h-11 w-full rounded-[10px] border border-[#E4E8F1] bg-white px-3.5 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none" />
          </div>
        </div>

        <div className="flex gap-3 border-t border-[#ECEEF4] px-5 py-4">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-[10px] border border-[#E2E6F0] bg-white text-[13px] font-bold text-[#334155] hover:bg-[#F7F8FC]">Cancel</button>
          <button type="button" disabled={busy} onClick={() => onConfirm(method, reference.trim())}
            className="h-11 flex-1 rounded-[10px] text-[13px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] transition-[filter] hover:brightness-105 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
            {busy ? 'Saving…' : 'Mark as Paid'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
