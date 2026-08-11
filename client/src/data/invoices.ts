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
  tint: string;
  fg: string;
}

export const INVOICES: Invoice[] = [
  { id: '', no: 'INV-2025-1248', patient: 'Aarav Mehta', patientId: 'PT-0002486', age: '4y 2m', phone: '+91 98765 43210', date: '12 May 2025', amount: 2450, paid: 2450, due: 0, status: 'Paid', mode: 'UPI', tint: '#EEF2FF', fg: '#3B4FE0' },
  { id: '', no: 'INV-2025-1247', patient: 'Myra Kapoor', patientId: 'PT-0002485', age: '2y 11m', phone: '+91 91234 56789', date: '12 May 2025', amount: 1850, paid: 1850, due: 0, status: 'Paid', mode: 'Card', tint: '#F5F0FF', fg: '#8B5CF6' },
  { id: '', no: 'INV-2025-1246', patient: 'Kabir Singh', patientId: 'PT-0002484', age: '6y 5m', phone: '+91 99887 77665', date: '12 May 2025', amount: 1200, paid: 0, due: 1200, status: 'Pending', mode: null, tint: '#ECFDF5', fg: '#16A34A' },
  { id: '', no: 'INV-2025-1245', patient: 'Siya Verma', patientId: 'PT-0002483', age: '3y 4m', phone: '+91 90123 44556', date: '12 May 2025', amount: 950, paid: 950, due: 0, status: 'Paid', mode: 'Cash', tint: '#FFF7ED', fg: '#B45309' },
  { id: '', no: 'INV-2025-1244', patient: 'Ishaan Gupta', patientId: 'PT-0002482', age: '5y 0m', phone: '+91 98712 33445', date: '11 May 2025', amount: 2300, paid: 1800, due: 500, status: 'Partially Paid', mode: 'UPI', tint: '#EFF6FF', fg: '#2563EB' },
  { id: '', no: 'INV-2025-1243', patient: 'Anaya Reddy', patientId: 'PT-0002481', age: '1y 8m', phone: '+91 88990 11223', date: '11 May 2025', amount: 1600, paid: 0, due: 1600, status: 'Overdue', mode: null, tint: '#FCDCE4', fg: '#BE123C' },
  { id: '', no: 'INV-2025-1242', patient: 'Vivaan Patel', patientId: 'PT-0002480', age: '7y 3m', phone: '+91 93211 55667', date: '10 May 2025', amount: 2750, paid: 2750, due: 0, status: 'Paid', mode: 'Card', tint: '#D7F5EE', fg: '#0E9F8F' },
  { id: '', no: 'INV-2025-1241', patient: 'Avni Sharma', patientId: 'PT-0002479', age: '4y 3m', phone: '+91 98123 77889', date: '10 May 2025', amount: 1050, paid: 0, due: 1050, status: 'Pending', mode: 'Net Banking', tint: '#EDE9FE', fg: '#6D5AE0' },
  { id: '', no: 'INV-2025-1240', patient: 'Rohan Malhotra', patientId: 'PT-0002478', age: '3y 1m', phone: '+91 97654 32101', date: '09 May 2025', amount: 850, paid: 850, due: 0, status: 'Paid', mode: 'UPI', tint: '#E0F5EA', fg: '#12A150' },
  { id: '', no: 'INV-2025-1239', patient: 'Meera Iyer', patientId: 'PT-0002477', age: '6y 6m', phone: '+91 96543 21098', date: '09 May 2025', amount: 1400, paid: 0, due: 1400, status: 'Overdue', mode: null, tint: '#FDE8CF', fg: '#F59E0B' },
];

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
    mode: null,
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
