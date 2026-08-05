/**
 * Pharmacy point-of-sale — Clinic OS specs 27 (New Bill) and 28 (success state).
 * Both screens render the SAME transaction, so every figure lives here once.
 *
 * ⚠ PLACEHOLDER DATA — not wired to the API yet.
 *
 * Deliberate inconsistency preserved from the reference, stored not derived:
 *   • SPLIT_BALANCE is 138.70 in the mockup. The correct derivation is
 *     max(0, payable − received) = max(0, 384.83 − 500) = 0, and the page's own
 *     "Change to Return" strip already shows the ₹115.17 that follows from it.
 *     Reproduced as shown; delete the constant to make the tile self-consistent.
 */

export const BILL_PATIENT = {
  name: 'Aarav Mehta',
  /** The pharmacy issues its own PID- series, separate from the clinical PT-. */
  pid: 'PID-2419',
  age: '3y 4m',
  gender: 'Male',
  phone: '+91 98765 43210',
  initials: 'AM',
};

export const BILL_META = {
  invoiceNo: 'INV-2025-1248',
  date: '12 May 2025',
  time: '11:45 AM',
  cashier: 'Priya Sharma',
  /** One minute after the invoice — kept distinct, per the reference. */
  paidAt: '12 May 2025, 11:46 AM',
  upiId: 'mateoclinic@upi',
  transactionId: 'UPI-4587962138',
  mode: 'UPI',
};

export interface BillItem {
  sku: string;
  name: string;
  batch: string;
  expiry: string;
  qty: number;
  mrp: number;
  /** Per-line discount percentage; 0 for most rows. */
  disc: number;
  gstPct: number;
  tint: string;
  fg: string;
  icon: string;
}

export const BILL_ITEMS: BillItem[] = [
  { sku: 'PAR250SYP', name: 'Paracetamol 250mg Syrup', batch: 'PB2417', expiry: '09/2027', qty: 2, mrp: 65, disc: 0, gstPct: 12, tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Pill' },
  { sku: 'DOLO650', name: 'Dolo 650 Tablet', batch: 'DL2409', expiry: '08/2026', qty: 1, mrp: 3.2, disc: 0, gstPct: 12, tint: '#FDECD3', fg: '#F59E0B', icon: 'Pill' },
  { sku: 'SALB100INH', name: 'Salbutamol Inhaler 100mcg', batch: 'SB2403', expiry: '01/2026', qty: 1, mrp: 130, disc: 5, gstPct: 12, tint: '#FDE2E2', fg: '#EF4444', icon: 'Wind' },
  { sku: 'VITD3D15', name: 'Vitamin D3 Drops 15ml', batch: 'VD2405', expiry: '03/2026', qty: 1, mrp: 105, disc: 0, gstPct: 12, tint: '#DCF7E6', fg: '#12A150', icon: 'Droplet' },
];

/** Line amount after its own discount — 130 × 1 × 0.95 = 123.50. */
export const billLine = (i: BillItem) => i.qty * i.mrp * (1 - i.disc / 100);

export const BILL_GST_PCT = 12;
/** Bill-level discount, on top of the per-line ones. 361.70 − 343.60 = 18.10. */
export const BILL_DISCOUNT = 18.1;
export const AMOUNT_RECEIVED = 500;

/** Every summary figure derives from the items, so a qty change moves them all. */
export function billTotals(items: BillItem[] = BILL_ITEMS, discount = BILL_DISCOUNT, received = AMOUNT_RECEIVED) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const subtotal = round2(items.reduce((t, i) => t + billLine(i), 0));
  const taxable = round2(subtotal - discount);
  const gst = round2((taxable * BILL_GST_PCT) / 100);
  const payable = round2(taxable + gst);
  return { count: items.length, subtotal, discount, taxable, gst, payable, received, change: round2(Math.max(0, received - payable)) };
}

/** See the file header — kept only so screen 27's tile matches the mockup. */
export const SPLIT_BALANCE = 138.7;

export const BILL_PAYMENT_MODES = [
  { id: 'upi', label: 'UPI', icon: 'Smartphone', color: '#4F46E5' },
  { id: 'cash', label: 'Cash', icon: 'Banknote', color: '#12A150' },
  { id: 'card', label: 'Card', icon: 'CreditCard', color: '#2B6FF0' },
  { id: 'cheque', label: 'Cheque', icon: 'FileText', color: '#334155' },
  { id: 'credit', label: 'Credit', icon: 'CreditCard', color: '#F59E0B' },
];

export const RECEIPT_ACTIONS = [
  { icon: 'Download', label: 'Download PDF', color: '#334155' },
  { icon: 'Printer', label: 'Print', color: '#334155' },
  { icon: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
  { icon: 'Mail', label: 'Email', color: '#334155' },
];
