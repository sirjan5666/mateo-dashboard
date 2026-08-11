import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * The in-clinic pharmacy: catalogue, distributors, purchases, sales and the
 * stock-movement ledger that ties them together. All doctor-owned and
 * tenant-scoped (doctorUserId), same boundary as the EHR documents.
 *
 * NOT PHI in itself (medicines and money, not diagnoses), so nothing here is
 * field-encrypted. A bill CAN name a patient, but it stores only `patientId` —
 * the name is resolved through the tenant-scoped Patient collection at read
 * time, so PHI never lands in the pharmacy collections.
 *
 * STOCK IS NEVER EDITED DIRECTLY. `Medicine.qtyInStock` is a cached running
 * total; every change is written as a StockMovement in the same operation, so
 * the ledger and the balance always agree and the trail is auditable.
 */

// ── Distributor ──────────────────────────────────────────────────────────────

export interface IDistributor {
  doctorUserId: Types.ObjectId; // TENANT
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  addressLine?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const distributorSchema = new Schema<IDistributor>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    contactPerson: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 24 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    gstin: { type: String, trim: true, uppercase: true, maxlength: 20 },
    addressLine: { type: String, trim: true, maxlength: 240 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
distributorSchema.index({ doctorUserId: 1, name: 1 }, { unique: true });

export const Distributor = model<IDistributor>('Distributor', distributorSchema);

// ── Medicine / SKU ───────────────────────────────────────────────────────────

export const MEDICINE_CATEGORIES = [
  'Antibiotics', 'Analgesics', 'Vitamins', 'Respiratory', 'Topicals', 'Others',
] as const;
export type MedicineCategory = (typeof MEDICINE_CATEGORIES)[number];

export interface IMedicine {
  doctorUserId: Types.ObjectId; // TENANT
  sku: string;
  name: string;
  /** Form / pack size shown under the name ("Syrup", "50 pcs"). */
  form?: string;
  category: MedicineCategory;
  batch: string;
  distributorId?: Types.ObjectId;
  /** null for non-expiring goods (masks, devices). */
  expiry?: Date;
  purchaseRate: number;
  mrp: number;
  gstPct: number;
  /** Cached running total — only ever moved together with a StockMovement. */
  qtyInStock: number;
  /** Full-shelf quantity; the stock-level bar is qtyInStock/capacity. */
  capacity: number;
  /** At or below this the item counts as Low Stock. */
  reorderLevel: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const medicineSchema = new Schema<IMedicine>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    form: { type: String, trim: true, maxlength: 60 },
    category: { type: String, enum: MEDICINE_CATEGORIES, default: 'Others' },
    batch: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    distributorId: { type: Schema.Types.ObjectId, ref: 'Distributor' },
    expiry: { type: Date },
    purchaseRate: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    gstPct: { type: Number, default: 12, min: 0, max: 28 },
    qtyInStock: { type: Number, required: true, default: 0, min: 0 },
    capacity: { type: Number, required: true, default: 100, min: 1 },
    reorderLevel: { type: Number, default: 10, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

medicineSchema.index({ doctorUserId: 1, active: 1 });
medicineSchema.index({ doctorUserId: 1, category: 1 });
medicineSchema.index({ doctorUserId: 1, expiry: 1 });
// One row per SKU+batch: the same medicine in two batches is two stock lines.
medicineSchema.index({ doctorUserId: 1, sku: 1, batch: 1 }, { unique: true });

export const Medicine = model<IMedicine>('Medicine', medicineSchema);

// ── Stock movement ledger ────────────────────────────────────────────────────

export const MOVEMENT_REASONS = ['purchase', 'sale', 'adjustment', 'expiry', 'return'] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export interface IStockMovement {
  doctorUserId: Types.ObjectId; // TENANT
  medicineId: Types.ObjectId;
  /** Signed: +in, −out. Sums to the medicine's qtyInStock. */
  delta: number;
  balanceAfter: number;
  reason: MovementReason;
  refType?: 'purchase' | 'bill' | 'manual';
  refId?: Types.ObjectId;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true, index: true },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, enum: MOVEMENT_REASONS, required: true },
    refType: { type: String, enum: ['purchase', 'bill', 'manual'] },
    refId: { type: Schema.Types.ObjectId },
    note: { type: String, trim: true, maxlength: 240 },
  },
  { timestamps: true },
);
stockMovementSchema.index({ doctorUserId: 1, createdAt: -1 });
stockMovementSchema.index({ doctorUserId: 1, medicineId: 1, createdAt: -1 });

export const StockMovement = model<IStockMovement>('StockMovement', stockMovementSchema);

// ── Purchase (stock in, from a distributor) ──────────────────────────────────

export type PaymentMode = 'cash' | 'upi' | 'card' | 'cheque' | 'credit';
export const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'card', 'cheque', 'credit'];

export interface IPurchaseItem {
  medicineId?: Types.ObjectId;
  sku: string;
  name: string;
  batch: string;
  expiry?: Date;
  qty: number;
  rate: number;
  mrp: number;
  gstPct: number;
}

export interface IPharmacyPurchase {
  doctorUserId: Types.ObjectId; // TENANT
  distributorId: Types.ObjectId;
  invoiceNo: string;
  invoiceDate: Date;
  items: IPurchaseItem[];
  /** All derived on the server from `items` — the client never sets them. */
  subtotal: number;
  gstAmount: number;
  discount: number;
  grandTotal: number;
  amountPaid: number;
  paymentMode: PaymentMode;
  paymentReference?: string;
  dueDate?: Date;
  status: 'paid' | 'partial' | 'unpaid';
  createdAt: Date;
  updatedAt: Date;
}

const purchaseItemSchema = new Schema<IPurchaseItem>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine' },
    sku: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true, uppercase: true },
    expiry: { type: Date },
    qty: { type: Number, required: true, min: 1 },
    rate: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    gstPct: { type: Number, required: true, min: 0, max: 28 },
  },
  { _id: false },
);

const pharmacyPurchaseSchema = new Schema<IPharmacyPurchase>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    distributorId: { type: Schema.Types.ObjectId, ref: 'Distributor', required: true, index: true },
    invoiceNo: { type: String, required: true, trim: true, maxlength: 60 },
    invoiceDate: { type: Date, required: true },
    items: { type: [purchaseItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    paymentMode: { type: String, enum: PAYMENT_MODES, default: 'cash' },
    paymentReference: { type: String, trim: true, maxlength: 120 },
    dueDate: { type: Date },
    status: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'unpaid' },
  },
  { timestamps: true },
);
pharmacyPurchaseSchema.index({ doctorUserId: 1, invoiceDate: -1 });
// A distributor's invoice number is unique per practice — a double-submit
// fails loudly (E11000) instead of adding the same stock twice.
pharmacyPurchaseSchema.index({ doctorUserId: 1, distributorId: 1, invoiceNo: 1 }, { unique: true });

export const PharmacyPurchase = model<IPharmacyPurchase>('PharmacyPurchase', pharmacyPurchaseSchema);

// ── Bill (stock out, sale to a patient or walk-in) ───────────────────────────

export interface IBillItem {
  medicineId: Types.ObjectId;
  sku: string;
  name: string;
  batch: string;
  qty: number;
  mrp: number;
  discPct: number;
  gstPct: number;
  /** qty × mrp × (1 − discPct/100), rounded to paise. Derived server-side. */
  amount: number;
}

export interface IPharmacyBill {
  doctorUserId: Types.ObjectId; // TENANT
  number: string;
  /** Absent for a walk-in customer. */
  patientId?: Types.ObjectId;
  walkInName?: string;
  items: IBillItem[];
  subtotal: number;
  discount: number;
  taxable: number;
  gstAmount: number;
  payable: number;
  amountReceived: number;
  changeReturned: number;
  paymentMode: PaymentMode;
  paymentReference?: string;
  notes?: string;
  cashierName?: string;
  status: 'paid' | 'partial' | 'draft';
  createdAt: Date;
  updatedAt: Date;
}

const billItemSchema = new Schema<IBillItem>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true, uppercase: true },
    qty: { type: Number, required: true, min: 1 },
    mrp: { type: Number, required: true, min: 0 },
    discPct: { type: Number, required: true, default: 0, min: 0, max: 100 },
    gstPct: { type: Number, required: true, min: 0, max: 28 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const pharmacyBillSchema = new Schema<IPharmacyBill>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    number: { type: String, required: true, trim: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    walkInName: { type: String, trim: true, maxlength: 120 },
    items: { type: [billItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, default: 0, min: 0 },
    taxable: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
    payable: { type: Number, required: true, min: 0 },
    amountReceived: { type: Number, required: true, default: 0, min: 0 },
    changeReturned: { type: Number, required: true, default: 0, min: 0 },
    paymentMode: { type: String, enum: PAYMENT_MODES, default: 'cash' },
    paymentReference: { type: String, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 1000 },
    cashierName: { type: String, trim: true, maxlength: 120 },
    status: { type: String, enum: ['paid', 'partial', 'draft'], default: 'paid' },
  },
  { timestamps: true },
);
pharmacyBillSchema.index({ doctorUserId: 1, createdAt: -1 });
pharmacyBillSchema.index({ doctorUserId: 1, number: 1 }, { unique: true });

export const PharmacyBill = model<IPharmacyBill>('PharmacyBill', pharmacyBillSchema);
