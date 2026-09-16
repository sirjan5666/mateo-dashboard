import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { encryptedFields } from '../lib/crypto/mongooseEncryption.js';

// A billing invoice for a doctor's patient. Doctor-owned and tenant-scoped like
// every EHR document (doctorUserId is the tenant boundary). The line items and
// notes are field-encrypted at rest (service descriptions can reveal care
// details); the money totals/status/dates stay PLAIN so collection totals can be
// aggregated in the DB without decrypting. Decryption happens in the response
// shaper, never via getters — same convention as Encounter/Patient.
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'cancelled';
export const INVOICE_STATUSES: InvoiceStatus[] = ['unpaid', 'partial', 'paid', 'cancelled'];

// How a paid invoice was collected. 'upi' covers UPI / QR-scan payments (spec #8);
// no money moves through the app — this is a record for reconciliation.
export type InvoicePaymentMethod = 'cash' | 'upi' | 'card' | 'bank' | 'other';
export const INVOICE_PAYMENT_METHODS: InvoicePaymentMethod[] = ['cash', 'upi', 'card', 'bank', 'other'];

export interface IInvoice {
  doctorUserId: Types.ObjectId; // TENANT
  patientId: Types.ObjectId;
  number: string;
  date: Date;
  itemsEnc: string; // PHI — encrypted JSON of [{ description, amount }]
  total: number; // plain (₹) — tenant-scoped aggregation needs it un-encrypted
  amountPaid: number; // plain
  status: InvoiceStatus;
  paidAt?: Date;
  paymentMethod?: InvoicePaymentMethod; // recorded when marked paid; plain (not PHI)
  paymentReference?: string; // optional UPI/txn ref; plain
  notes?: string; // PHI — encrypted
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    number: { type: String, required: true },
    date: { type: Date, required: true },
    itemsEnc: { type: String, required: true },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    status: { type: String, enum: INVOICE_STATUSES, default: 'unpaid' },
    paidAt: { type: Date },
    paymentMethod: { type: String, enum: INVOICE_PAYMENT_METHODS },
    paymentReference: { type: String, trim: true, maxlength: 120 },
    notes: { type: String },
  },
  { timestamps: true },
);

// Tenant-scoped query indexes (doctorUserId always leads).
invoiceSchema.index({ doctorUserId: 1, date: -1 });
invoiceSchema.index({ doctorUserId: 1, status: 1 });
invoiceSchema.index({ doctorUserId: 1, paidAt: 1 });
// Per-doctor invoice numbers must be unique — makes a concurrent-create number
// collision fail loudly (E11000) so the route can retry rather than silently dup.
invoiceSchema.index({ doctorUserId: 1, number: 1 }, { unique: true });

// Encrypt the free-text line items + notes at rest (idempotent; decrypt in the shaper).
encryptedFields(invoiceSchema, ['itemsEnc', 'notes']);

export const Invoice = model<IInvoice>('Invoice', invoiceSchema);
