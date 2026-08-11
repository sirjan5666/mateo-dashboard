import { api } from './client';

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';
export type PaymentMode = 'cash' | 'upi' | 'card' | 'cheque' | 'credit';

export const MEDICINE_CATEGORIES = [
  'Antibiotics', 'Analgesics', 'Vitamins', 'Respiratory', 'Topicals', 'Others',
] as const;
export type MedicineCategory = (typeof MEDICINE_CATEGORIES)[number];

export interface MedicineDto {
  id: string;
  sku: string;
  name: string;
  form: string | null;
  category: MedicineCategory;
  batch: string;
  distributorId: string | null;
  distributorName: string | null;
  expiry: string | null;
  purchaseRate: number;
  mrp: number;
  gstPct: number;
  qtyInStock: number;
  capacity: number;
  reorderLevel: number;
  /** Server-computed percentage for the stock-level bar. */
  level: number;
  status: StockStatus;
  active: boolean;
}

export interface InventorySummary {
  kpis: { stockValue: number; totalSkus: number; lowStock: number; outOfStock: number; expiringSoon: number };
  categories: { label: string; count: number; pct: number; color: string }[];
  fastMovers: { name: string; units: number; color: string }[];
}

export interface DistributorDto {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  addressLine?: string | null;
}

export interface MedicineInput {
  sku: string;
  name: string;
  form?: string;
  category?: MedicineCategory;
  batch: string;
  distributorId?: string;
  expiry?: string;
  purchaseRate: number;
  mrp: number;
  gstPct?: number;
  qtyInStock?: number;
  capacity?: number;
  reorderLevel?: number;
}

// ── Inventory ──

export function listInventory(params: { q?: string; category?: string; status?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category && params.category !== 'All Categories') qs.set('category', params.category);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs}` : '';
  return api<{ items: MedicineDto[]; total: number }>(`/pharmacy/inventory${suffix}`);
}

export function getInventorySummary() {
  return api<InventorySummary>('/pharmacy/inventory/summary');
}

export function createMedicine(body: MedicineInput) {
  return api<{ item: MedicineDto }>('/pharmacy/medicines', { method: 'POST', body: JSON.stringify(body) });
}

export function updateMedicine(id: string, body: Partial<MedicineInput> & { active?: boolean }) {
  return api<{ item: MedicineDto }>(`/pharmacy/medicines/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

/** The +/− buttons. Rejected with 409 rather than driving stock negative. */
export function adjustStock(id: string, delta: number, note?: string) {
  return api<{ item: MedicineDto }>(`/pharmacy/medicines/${id}/adjust`, {
    method: 'POST',
    body: JSON.stringify({ delta, note }),
  });
}

/**
 * Set stock to a counted figure. The SERVER works out the movement from its own
 * current number — a delta computed here would land on the wrong total if
 * someone sold at the counter while this page sat open.
 */
export function setStock(id: string, qty: number, note?: string) {
  return api<{ item: MedicineDto }>(`/pharmacy/medicines/${id}/adjust`, {
    method: 'POST',
    body: JSON.stringify({ set: qty, note }),
  });
}

export function importInventory(rows: MedicineInput[]) {
  return api<{ created: number; updated: number; failed: number; errors: { sku: string; message: string }[] }>(
    '/pharmacy/inventory/import',
    { method: 'POST', body: JSON.stringify({ rows }) },
  );
}

/** CSV is streamed, not JSON — bypasses `api()` so the browser saves the file. */
export async function downloadInventoryCsv(): Promise<void> {
  const res = await fetch('/api/pharmacy/inventory/export', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Could not export inventory');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ?? 'inventory.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface MovementDto {
  id: string;
  medicineId: string;
  medicineName: string;
  delta: number;
  balanceAfter: number;
  reason: 'purchase' | 'sale' | 'adjustment' | 'expiry' | 'return';
  note: string | null;
  createdAt: string;
}

export function listMovements(medicineId?: string) {
  return api<{ movements: MovementDto[] }>(`/pharmacy/movements${medicineId ? `?medicineId=${medicineId}` : ''}`);
}

// ── Distributors ──

export function listDistributors() {
  return api<{ distributors: DistributorDto[] }>('/pharmacy/distributors');
}

export function createDistributor(body: { name: string; contactPerson?: string; phone?: string; email?: string; gstin?: string; addressLine?: string }) {
  return api<{ distributor: { id: string; name: string } }>('/pharmacy/distributors', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface LedgerResponse {
  distributor: { id: string; name: string };
  kpis: { totalPurchased: number; totalPaid: number; outstanding: number };
  transactions: { id: string; date: string; reference: string; debit: number; credit: number; balance: number; status: string }[];
}

export function getDistributorLedger(id: string) {
  return api<LedgerResponse>(`/pharmacy/distributors/${id}/ledger`);
}

// ── Purchases ──

export interface PurchaseLineInput {
  sku: string;
  name: string;
  batch: string;
  expiry?: string;
  qty: number;
  rate: number;
  mrp: number;
  gstPct: number;
}

export interface PurchaseInput {
  distributorId: string;
  invoiceNo: string;
  invoiceDate: string;
  items: PurchaseLineInput[];
  discount?: number;
  amountPaid?: number;
  paymentMode?: PaymentMode;
  paymentReference?: string;
  dueDate?: string;
}

export interface PurchaseResult {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  distributorName: string;
  subtotal: number;
  gstAmount: number;
  discount: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  status: 'paid' | 'partial' | 'unpaid';
  items: number;
}

export function listPurchases() {
  return api<{ purchases: { id: string; invoiceNo: string; invoiceDate: string; distributorName: string; itemCount: number; grandTotal: number; amountPaid: number; status: string }[] }>(
    '/pharmacy/purchases',
  );
}

export function createPurchase(body: PurchaseInput) {
  return api<{ purchase: PurchaseResult }>('/pharmacy/purchases', { method: 'POST', body: JSON.stringify(body) });
}

// ── Bills ──

export interface BillLineInput {
  medicineId: string;
  qty: number;
  discPct?: number;
}

export interface BillInput {
  patientId?: string;
  walkInName?: string;
  items: BillLineInput[];
  discount?: number;
  amountReceived?: number;
  paymentMode?: PaymentMode;
  paymentReference?: string;
  notes?: string;
}

export interface BillLine {
  medicineId: string;
  sku: string;
  name: string;
  batch: string;
  qty: number;
  mrp: number;
  discPct: number;
  gstPct: number;
  amount: number;
}

export interface BillResult {
  id: string;
  number: string;
  customer: string;
  items: BillLine[];
  subtotal: number;
  discount: number;
  taxable: number;
  gstAmount: number;
  payable: number;
  amountReceived: number;
  changeReturned: number;
  status: 'paid' | 'partial' | 'draft';
  paymentMode: PaymentMode;
  createdAt: string;
}

export function listBills() {
  return api<{ bills: { id: string; number: string; customer: string; itemCount: number; payable: number; amountReceived: number; paymentMode: PaymentMode; status: string; createdAt: string }[] }>(
    '/pharmacy/bills',
  );
}

export function getBill(id: string) {
  return api<{ bill: BillResult & { patient: { id: string; name: string; dob: string | null; sex: string; phone: string | null } | null } }>(
    `/pharmacy/bills/${id}`,
  );
}

export function createBill(body: BillInput) {
  return api<{ bill: BillResult }>('/pharmacy/bills', { method: 'POST', body: JSON.stringify(body) });
}
