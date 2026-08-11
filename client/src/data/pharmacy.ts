/**
 * Pharmacy module data — Clinic OS specs 25–28.
 *
 * ⚠ PLACEHOLDER DATA — not wired to the API yet.
 *
 * The pharmacy belongs to ONE physical clinic, so its location is a constant
 * here rather than the multi-clinic `LocationCtx` the clinical screens use.
 */

export const PHARMACY_LOCATION = {
  name: 'Tilak Nagar Clinic',
  address: 'A-1/45, Tilak Nagar, New Delhi - 110018',
  /** Screen 27's invoice renders the extra slash; screen 28's receipt does not. */
  licence: 'DL/PHARM/2024/5678',
  licenceCompact: 'DLPHARM/2024/5678',
  gstin: '07ABCDE1234F1Z5',
  /**
   * ⚠ The reference mockup for screen 27 spells the clinic "Tilak Nagar Cilinic".
   * Reproduced verbatim per the build spec; correcting it is a one-word edit here.
   */
  nameOnNewBill: 'Tilak Nagar Cilinic',
};

// ── 25 · KPI row ─────────────────────────────────────────────────────────────

export interface StockKpi {
  id: string;
  accent: string;
  wash: string;
  icon: string;
  label: string;
  value: string;
  /** Absolute counts on cards 3–5, percentages on 1–2 — per the reference. */
  delta: string;
  deltaColor: string;
  deltaDir: 'up' | 'down';
}

export const STOCK_KPIS: StockKpi[] = [
  { id: 'value', accent: '#4F46E5', wash: '#F3F4FE', icon: 'IndianRupee', label: 'Stock Value', value: '₹12,48,750', delta: '8.4%', deltaColor: '#12A150', deltaDir: 'up' },
  { id: 'skus', accent: '#6D5AE0', wash: '#F5F3FE', icon: 'Boxes', label: 'Total SKUs', value: '1,248', delta: '5.2%', deltaColor: '#12A150', deltaDir: 'up' },
  { id: 'low', accent: '#F59E0B', wash: '#FEF8EC', icon: 'AlertTriangle', label: 'Low Stock', value: '68', delta: '2', deltaColor: '#E8890B', deltaDir: 'up' },
  { id: 'out', accent: '#EF4444', wash: '#FDF0F0', icon: 'XCircle', label: 'Out of Stock', value: '14', delta: '3', deltaColor: '#E03131', deltaDir: 'up' },
  { id: 'expiring', accent: '#12A150', wash: '#EDFAF2', icon: 'CalendarDays', label: 'Expiring in 60 Days', value: '32', delta: '6', deltaColor: '#12A150', deltaDir: 'down' },
];

// ── 25 · Inventory ───────────────────────────────────────────────────────────

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export interface InventoryItem {
  id: string;
  name: string;
  /** Form / pack size on line 2 — absent for single-line products. */
  sub: string | null;
  batch: string;
  distributor: string;
  /** null renders an em dash — Screen 25 row 8 (face masks) has no expiry. */
  expiry: string | null;
  purchaseRate: number;
  mrp: number;
  qty: number;
  level: number;
  /**
   * The quantity that reads 100% on the stock-level bar. Stored rather than
   * inferred from qty/level, because the out-of-stock row has no ratio to
   * invert — without it, restocking a single inhaler would read as full.
   */
  capacity: number;
  tint: string;
  fg: string;
  icon: string;
  category: string;
}

export const INVENTORY: InventoryItem[] = [
  { id: 'PAR250SYP', name: 'Paracetamol 250mg', sub: 'Syrup', batch: 'PB2417', distributor: 'Rahul Distributors', expiry: '09/2027', purchaseRate: 42, mrp: 65, qty: 42, level: 70, capacity: 60, tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Pill', category: 'Analgesics' },
  { id: 'DOLO650', name: 'Dolo 650 Tablet', sub: null, batch: 'DL2409', distributor: 'MedPlus Supply', expiry: '08/2026', purchaseRate: 1.95, mrp: 3.2, qty: 3, level: 15, capacity: 20, tint: '#FDECD3', fg: '#F59E0B', icon: 'Pill', category: 'Analgesics' },
  { id: 'SALB100INH', name: 'Salbutamol Inhaler', sub: '100mcg', batch: 'SB2403', distributor: 'Apollo Pharmacy', expiry: '01/2026', purchaseRate: 85, mrp: 130, qty: 0, level: 0, capacity: 50, tint: '#FDE2E2', fg: '#EF4444', icon: 'Wind', category: 'Respiratory' },
  { id: 'AMOX125SUS', name: 'Amoxicillin 125mg', sub: 'Suspension', batch: 'AM2401', distributor: 'Rahul Distributors', expiry: '11/2026', purchaseRate: 40, mrp: 62.5, qty: 12, level: 24, capacity: 50, tint: '#EDE9FE', fg: '#6D28D9', icon: 'FlaskConical', category: 'Antibiotics' },
  { id: 'CET10TAB', name: 'Cetirizine 10mg', sub: 'Tablet', batch: 'CT2408', distributor: 'MedPlus Supply', expiry: '07/2026', purchaseRate: 0.85, mrp: 1.5, qty: 156, level: 78, capacity: 200, tint: '#DCF7E6', fg: '#12A150', icon: 'Pill', category: 'Analgesics' },
  { id: 'ZNOX50', name: 'Zinc Oxide Cream', sub: '50gm', batch: 'ZO2402', distributor: 'Apollo Pharmacy', expiry: '06/2027', purchaseRate: 28, mrp: 48, qty: 36, level: 60, capacity: 60, tint: '#FCE7F3', fg: '#EC4899', icon: 'Droplet', category: 'Topicals' },
  { id: 'VITD3D15', name: 'Vitamin D3 Drops', sub: '15ml', batch: 'VD2405', distributor: 'Rahul Distributors', expiry: '03/2026', purchaseRate: 65, mrp: 105, qty: 5, level: 10, capacity: 50, tint: '#FDECD3', fg: '#F59E0B', icon: 'Droplet', category: 'Vitamins' },
  { id: 'MASK50', name: 'Surgical Face Mask', sub: '(50 pcs)', batch: 'MK2407', distributor: 'MedPlus Supply', expiry: null, purchaseRate: 45, mrp: 75, qty: 220, level: 88, capacity: 250, tint: '#E4EBFD', fg: '#2B6FF0', icon: 'ShieldCheck', category: 'Others' },
];

/** 0 → Out of Stock, under 25% → Low Stock. Recomputed as +/- adjusts qty. */
export function statusFor(qty: number, level: number): StockStatus {
  if (qty === 0) return 'Out of Stock';
  return level < 25 ? 'Low Stock' : 'In Stock';
}

export const STATUS_STYLE: Record<StockStatus, { bg: string; fg: string }> = {
  'In Stock': { bg: '#DCF7E6', fg: '#12A150' },
  'Low Stock': { bg: '#FDECD3', fg: '#E8890B' },
  'Out of Stock': { bg: '#FDE2E2', fg: '#E03131' },
};

/** Bar fill: green at or above half, amber while any stock remains, empty at zero. */
export function levelColor(level: number): string | null {
  if (level === 0) return null;
  return level >= 50 ? '#12A150' : '#F59E0B';
}

export const INVENTORY_CATEGORIES = ['All Categories', 'Antibiotics', 'Analgesics', 'Vitamins', 'Respiratory', 'Topicals', 'Others'];

/** The catalogue is 248 items; only the first page is mocked. */
export const INVENTORY_TOTAL = 248;
export const INVENTORY_PAGES = 31;

export const OUT_OF_STOCK_COUNT = 14;
export const LOW_STOCK_COUNT = 68;

// ── 25 · Right rail ──────────────────────────────────────────────────────────

export const FAST_MOVERS = [
  { name: 'Paracetamol 250mg Syrup', units: 420, color: '#4F46E5' },
  { name: 'Dolo 650 Tablet', units: 380, color: '#6D5AE0' },
  { name: 'Amoxicillin 125mg Suspension', units: 250, color: '#12A150' },
  { name: 'Cetirizine 10mg Tablet', units: 210, color: '#F59E0B' },
  { name: 'Salbutamol Inhaler', units: 150, color: '#EF4444' },
];

export const STOCK_BY_CATEGORY = [
  { label: 'Antibiotics', color: '#4F46E5', pct: 28 },
  { label: 'Analgesics', color: '#2B6FF0', pct: 22 },
  { label: 'Vitamins', color: '#12A150', pct: 16 },
  { label: 'Respiratory', color: '#F59E0B', pct: 14 },
  { label: 'Topicals', color: '#EC4899', pct: 10 },
  { label: 'Others', color: '#CBD5E1', pct: 10 },
];

export const TOTAL_SKUS = '1,248';

export const PHARMACY_QUICK_ACTIONS = [
  { icon: 'Plus', label: 'Add New Medicine / SKU' },
  { icon: 'ArrowLeftRight', label: 'Stock Adjustment' },
  { icon: 'CalendarClock', label: 'Expiry Alert Report' },
  { icon: 'FileText', label: 'Stock Valuation Report' },
  { icon: 'Download', label: 'Download Inventory (Excel)' },
];

// ── shared money formatting ──────────────────────────────────────────────────

/** Two-decimal Indian grouping, no symbol — for table cells. */
export const amt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** With the ₹ symbol, for summary lines. */
export const rs = (n: number) => `₹${amt(n)}`;
