/**
 * Billing & Invoices (Clinic OS spec 13). ⚠ PLACEHOLDER DATA.
 *
 * Note: Avni Sharma is listed here as 4y 3m. Spec 13 says explicitly not to
 * reconcile that with the Patients roster, so this screen carries its own
 * `age` string rather than deriving it from a date of birth.
 */

export type InvoiceStatus = 'Paid' | 'Pending' | 'Partially Paid' | 'Overdue' | 'Cancelled';
export type PaymentMode = 'UPI' | 'Card' | 'Cash' | 'Net Banking' | null;

export interface Invoice {
  /** Server id. Empty on the mock rows below, which are layout fixtures only. */
  id: string;
  no: string;
  patient: string;
  patientId: string;
  age: string;
  phone: string;
  date: string;
  amount: number;
  paid: number;
  due: number;
  status: InvoiceStatus;
  mode: PaymentMode;
  /** Payment reference / txn id when recorded, else ''. */
  reference: string;
  tint: string;
  fg: string;
}

// (Removed the unused INVOICES placeholder fixture — the screen renders the real
// roster via invoiceFromApi; the fixture was dead layout-only sample data.)

export const BILLING_KPIS = [
  { id: 'total', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'FileText', label: 'Total Invoices', value: '1,248', delta: '18%', deltaFg: '#12A150' },
  { id: 'amount', tint: '#DCF7E6', fg: '#12A150', icon: 'IndianRupee', label: 'Total Amount', value: '₹18,74,560', delta: '22%', deltaFg: '#12A150' },
  { id: 'paid', tint: '#DCF7E6', fg: '#12A150', icon: 'CircleCheck', label: 'Paid Amount', value: '₹16,23,410', delta: '20%', deltaFg: '#12A150' },
  { id: 'pending', tint: '#FDECD3', fg: '#F59E0B', icon: 'Clock', label: 'Pending Amount', value: '₹2,51,150', delta: '8%', deltaFg: '#E8890B' },
  { id: 'overdue', tint: '#FDE2E2', fg: '#EF4444', icon: 'AlertCircle', label: 'Overdue Amount', value: '₹48,230', delta: '12%', deltaFg: '#E03131' },
];

export const STATUS_STYLE: Record<InvoiceStatus, { bg: string; fg: string }> = {
  Cancelled: { bg: '#F1F3F9', fg: '#64748B' },
  Paid: { bg: '#DCF7E6', fg: '#12A150' },
  Pending: { bg: '#FDECD3', fg: '#E8890B' },
  'Partially Paid': { bg: '#DCE9FE', fg: '#2B6FF0' },
  Overdue: { bg: '#FDE2E2', fg: '#E03131' },
};

/** Detail lines for INV-2025-1248 — the reference's selected invoice. */
export const INVOICE_DETAIL = {
  no: 'INV-2025-1248',
  issuedAt: '12 May 2025, 10:30 AM',
  lines: [
    { label: 'Consultation Fee', value: '₹1,200.00', fg: '#0F172A' },
    { label: 'Vaccination (BCG)', value: '₹900.00', fg: '#0F172A' },
    { label: 'Follow-up Charges', value: '₹200.00', fg: '#0F172A' },
    { label: 'Discount', value: '- ₹50.00', fg: '#12A150' },
    { label: 'Tax (GST 5%)', value: '₹200.00', fg: '#0F172A' },
  ],
  totals: {
    total: '₹2,450.00',
    paid: '₹2,450.00',
    due: '₹0.00',
  },
  payment: [
    { label: 'Payment Mode', value: 'UPI' },
    { label: 'Transaction ID', value: 'UPI512345678901' },
    { label: 'Paid On', value: '12 May 2025, 10:35 AM' },
  ],
};

/** ₹2,450.00 — two decimals always, Indian grouping. */
export function money(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Live wiring ──────────────────────────────────────────────────────────────

import type { InvoiceListItem, BillingSummary } from '../api/doctorBilling';

const INV_TINTS = [
  { tint: '#EEF2FF', fg: '#3B4FE0' }, { tint: '#F5F0FF', fg: '#8B5CF6' },
  { tint: '#ECFDF5', fg: '#16A34A' }, { tint: '#FFF7ED', fg: '#B45309' },
  { tint: '#EFF6FF', fg: '#2563EB' }, { tint: '#D7F5EE', fg: '#0E9F8F' },
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Server payment-method code → the label this screen renders (spec #8). */
const MODE_LABEL: Record<string, PaymentMode> = {
  upi: 'UPI', card: 'Card', cash: 'Cash', bank: 'Net Banking',
};
function modeFromApi(m: string | null | undefined): PaymentMode {
  return m ? MODE_LABEL[m] ?? null : null;
}

/**
 * Server invoice → the shape this screen already renders.
 *
 * The server's four statuses map onto the screen's labels; "Overdue" is derived
 * here from an unpaid invoice older than 30 days, because the server does not
 * store an overdue flag. `age` and `phone` have no home on an invoice, so they
 * come back empty and render as em dashes rather than being invented.
 */
export function invoiceFromApi(i: InvoiceListItem, idx = 0): Invoice {
  const c = INV_TINTS[idx % INV_TINTS.length];
  const due = Math.max(0, i.total - i.amountPaid);
  const d = new Date(i.date);
  const overdue = due > 0 && Date.now() - d.getTime() > 30 * 86_400_000;
  const status: InvoiceStatus =
    i.status === 'paid' ? 'Paid'
    : i.status === 'cancelled' ? 'Cancelled'
    : i.amountPaid > 0 ? 'Partially Paid'
    : overdue ? 'Overdue'
    : 'Pending';
  return {
    id: i.id,
    no: i.number,
    patient: i.patientName,
    patientId: i.patientId,
    age: '',
    phone: '',
    date: Number.isNaN(d.getTime())
      ? '—'
      : `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`,
    amount: i.total,
    paid: i.amountPaid,
    due,
    status,
    mode: modeFromApi(i.paymentMethod),
    reference: i.paymentReference ?? '',
    tint: c.tint,
    fg: c.fg,
  };
}

/** KPI strip from the real roster — every figure summed from the invoices shown. */
export function billingKpisFrom(list: Invoice[], summary: BillingSummary | null) {
  const total = list.reduce((t, i) => t + i.amount, 0);
  const paid = list.reduce((t, i) => t + i.paid, 0);
  const pending = list.filter((i) => i.status === 'Pending' || i.status === 'Partially Paid').reduce((t, i) => t + i.due, 0);
  const overdue = list.filter((i) => i.status === 'Overdue').reduce((t, i) => t + i.due, 0);
  return [
    { id: 'total', tint: '#E4EBFD', fg: '#2B6FF0', icon: 'FileText', label: 'Total Invoices', value: String(summary?.totalInvoices ?? list.length) },
    { id: 'amount', tint: '#DCF7E6', fg: '#12A150', icon: 'IndianRupee', label: 'Total Amount', value: money(total) },
    { id: 'paid', tint: '#DCF7E6', fg: '#12A150', icon: 'CircleCheck', label: 'Paid Amount', value: money(paid) },
    { id: 'pending', tint: '#FDECD3', fg: '#F59E0B', icon: 'Clock', label: 'Pending Amount', value: money(pending) },
    { id: 'overdue', tint: '#FDE2E2', fg: '#EF4444', icon: 'AlertCircle', label: 'Overdue Amount', value: money(overdue) },
  ];
}
