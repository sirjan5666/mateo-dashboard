/**
 * New Purchase Entry + Distributor Ledger — Clinic OS spec 26.
 *
 * ⚠ PLACEHOLDER DATA — not wired to the API yet.
 *
 * Deliberate inconsistency preserved from the reference, stored not derived:
 *   • LEDGER[].balance does not reconcile row-to-row (6,000 → 6,500 → 11,500
 *     reading upwards). Flag to the product owner before wiring real data.
 *
 * ⚠ WHERE WE DEPART FROM THE REFERENCE — the mockup's money does not add up, and
 * a purchase form must. Every total on this screen is DERIVED from the four line
 * items, so the reference's headline figures differ:
 *   • Subtotal   reference ₹1,850.00 · derived ₹1,927.50
 *                (840 + 195 + 850 + 42.50; the reference's own Total GST of
 *                ₹231.30 is exactly 12% of 1,927.50, so 1,850 is the wrong one)
 *   • Row 2 total reference ₹223.40 · derived ₹218.40 (195.00 + 23.40)
 *   • Grand Total reference ₹2,000.00 · derived ₹2,077.50
 * Deriving is also required by the spec's own stepper behaviour — the first time
 * a quantity changes, any stored total would be replaced anyway.
 */

export const PURCHASE_HEADER = {
  distributor: 'Rahul Distributors',
  invoiceNo: 'RD/INV/2025/0542',
  invoiceDate: '2025-05-12',
  invoiceDateLabel: '12 May 2025',
};

export const DISTRIBUTORS = ['Rahul Distributors', 'MedPlus Supply', 'Apollo Pharmacy'];

export interface PurchaseItem {
  sku: string;
  name: string;
  batch: string;
  expiry: string;
  qty: number;
  rate: number;
  mrp: number;
  gstPct: number;
  tint: string;
  fg: string;
  icon: string;
}

export const PURCHASE_ITEMS: PurchaseItem[] = [
  { sku: 'PAR250SYP', name: 'Paracetamol 250mg Syrup', batch: 'PB2417', expiry: '09/2027', qty: 20, rate: 42, mrp: 65, gstPct: 12, tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Pill' },
  { sku: 'DOLO650', name: 'Dolo 650 Tablet', batch: 'DL2409', expiry: '08/2026', qty: 100, rate: 1.95, mrp: 3.2, gstPct: 12, tint: '#FDECD3', fg: '#F59E0B', icon: 'Pill' },
  { sku: 'SALB100INH', name: 'Salbutamol Inhaler 100mcg', batch: 'SB2403', expiry: '01/2026', qty: 10, rate: 85, mrp: 130, gstPct: 12, tint: '#FDE2E2', fg: '#EF4444', icon: 'Wind' },
  { sku: 'CET10TAB', name: 'Cetirizine 10mg Tablet', batch: 'CT2408', expiry: '07/2026', qty: 50, rate: 0.85, mrp: 1.5, gstPct: 12, tint: '#DCF7E6', fg: '#12A150', icon: 'Pill' },
];

/** Line GST and line total, both derived — a stepper change must move them. */
export const lineGst = (i: { qty: number; rate: number; gstPct: number }) => (i.qty * i.rate * i.gstPct) / 100;
export const lineTotal = (i: { qty: number; rate: number; gstPct: number }) => i.qty * i.rate + lineGst(i);

/** ₹81.30 — the figure the reference shows, and the one that makes 2,000.00 exact. */
export const PURCHASE_DISCOUNT = 81.3;

export const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash', icon: 'Banknote', color: '#12A150' },
  { id: 'upi', label: 'UPI', icon: 'Smartphone', color: '#4F46E5' },
  { id: 'cheque', label: 'Cheque', icon: 'FileText', color: '#334155' },
  { id: 'credit', label: 'Credit', icon: 'CreditCard', color: '#F59E0B' },
];

export const REFERENCE_PLACEHOLDER: Record<string, string> = {
  cash: '',
  upi: 'Enter UPI ID / Transaction ID / Cheque No.',
  cheque: 'Enter Cheque No.',
  credit: '',
};

export const AMOUNT_PAID_NOW = 500;
export const DUE_DATE = '2025-05-22';
export const DUE_DATE_LABEL = '22 May 2025';
/** The helper text beside Due Date; the date above is invoice date + this many days. */
export const DUE_DAYS = 10;

// ── Distributor ledger ───────────────────────────────────────────────────────

export const LEDGER_KPIS = [
  { cardBg: '#F3F4FE', tint: '#E0E3FD', fg: '#4F46E5', icon: 'ShoppingCart', label: 'Total Purchased', value: '₹1,24,000' },
  { cardBg: '#EDFAF2', tint: '#DCF7E6', fg: '#12A150', icon: 'ClipboardCheck', label: 'Total Paid', value: '₹1,16,000' },
  { cardBg: '#FEF8EC', tint: '#FDECD3', fg: '#F59E0B', icon: 'Wallet', label: 'Outstanding', value: '₹8,000' },
];

export interface LedgerRow {
  date: string;
  type: 'Purchase' | 'Payment';
  reference: string;
  debit: number | null;
  credit: number | null;
  /** Stored, never computed — see the file header. */
  balance: number;
  status: 'Partial' | 'Paid';
}

export const LEDGER: LedgerRow[] = [
  { date: '12 May 2025', type: 'Purchase', reference: 'RD/INV/2025/0542', debit: 2000, credit: null, balance: 8000, status: 'Partial' },
  { date: '10 May 2025', type: 'Payment', reference: 'UPI-4587962138', debit: null, credit: 500, balance: 6000, status: 'Partial' },
  { date: '28 Apr 2025', type: 'Payment', reference: 'NEFT-245811', debit: null, credit: 5000, balance: 6500, status: 'Partial' },
  { date: '25 Apr 2025', type: 'Purchase', reference: 'RD/INV/2025/0412', debit: 6500, credit: null, balance: 11500, status: 'Paid' },
  { date: '18 Apr 2025', type: 'Payment', reference: 'UPI-1298876123', debit: null, credit: 6000, balance: 5000, status: 'Paid' },
  { date: '10 Apr 2025', type: 'Purchase', reference: 'RD/INV/2025/0321', debit: 5000, credit: null, balance: 11000, status: 'Paid' },
  { date: '02 Apr 2025', type: 'Payment', reference: 'Cash', debit: null, credit: 11000, balance: 6000, status: 'Paid' },
];

export const LEDGER_TYPE_STYLE: Record<string, { bg: string; fg: string }> = {
  Purchase: { bg: '#E4EBFD', fg: '#2B6FF0' },
  Payment: { bg: '#DCF7E6', fg: '#12A150' },
  Partial: { bg: '#FDECD3', fg: '#E8890B' },
  Paid: { bg: '#DCF7E6', fg: '#12A150' },
};

export const LEDGER_TABS = ['All Transactions', 'Purchases', 'Payments'];
export const LEDGER_UPDATED = 'Last updated: 12 May 2025, 11:20 AM';
