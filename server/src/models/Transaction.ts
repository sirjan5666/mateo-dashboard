import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A money-movement ledger entry for a doctor's practice — tenant-scoped like every
// EHR document (doctorUserId is the tenant boundary). One row is written whenever an
// invoice's collected amount changes (payment = credit, reversal/cancel = debit), so
// the ledger is an append-only history of collections rather than money implied by
// invoice status. Amount/type/date are money metadata (NOT PHI) and stay plain so
// the ledger + reports can aggregate in the DB. `description` must never carry a
// patient name — only the invoice number / reason (which are not PHI).
export type TransactionType = 'credit' | 'debit';
export const TRANSACTION_TYPES: TransactionType[] = ['credit', 'debit'];

export interface ITransaction {
  doctorUserId: Types.ObjectId; // TENANT
  amount: number; // plain ₹ (always positive; direction is `type`)
  type: TransactionType;
  date: Date;
  description: string; // non-PHI: invoice number / reason only
  relatedInvoiceId?: Types.ObjectId;
  relatedConsultationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    date: { type: Date, required: true, default: Date.now },
    description: { type: String, default: '' },
    relatedInvoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    relatedConsultationId: { type: Schema.Types.ObjectId, ref: 'Consultation' },
  },
  { timestamps: true },
);

// Tenant-scoped ledger index (doctorUserId always leads).
transactionSchema.index({ doctorUserId: 1, date: -1 });

export const Transaction = model<ITransaction>('Transaction', transactionSchema);
