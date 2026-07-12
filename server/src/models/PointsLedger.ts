import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// Mateo Sitare — the append-only ledger that is the SOURCE OF TRUTH for the
// loyalty balance. We use a FIFO "lot" model: every earn is a lot with its own
// expiry (createdAt + 12 months) and a mutable `remaining`; redemptions consume
// the oldest non-expired lots first. A single `sitareBalance` number on User
// could not express per-lot expiry or reserve→confirm→release holds, so it's
// only a denormalised cache — this collection is authoritative.
//
// Rows are never mutated destructively except `remaining` (lot consumption) and
// `status` (reservation lifecycle). Reversals/expiries are NEW rows, so history
// is complete and auditable.

export type PointsEntryType =
  | 'earn' // + credit lot
  | 'redeem' // - debit, settled (points spent)
  | 'reserve' // - debit, held for an in-flight order (not yet settled)
  | 'release' // + credit, a reservation that was let go (payment failed/cancelled)
  | 'reverse' // +/- clawback of a prior row (e.g. community post deleted)
  | 'expire' // - debit, a lot's leftover ★ that aged out
  | 'adjust'; // +/- manual admin correction

export type PointsSource =
  | 'shop_purchase'
  | 'product_review'
  | 'tracker_entry'
  | 'community_contribution'
  | 'consultation_completed'
  | 'referral_referrer'
  | 'referral_referee'
  | 'shop_redemption'
  | 'consultation_redemption'
  | 'expiry'
  | 'reversal'
  | 'admin_adjust';

export type PointsStatus = 'settled' | 'reserved' | 'released' | 'reversed' | 'expired';

export type PointsRefType =
  | 'order'
  | 'consultation'
  | 'review'
  | 'community_post'
  | 'community_reply'
  | 'growth_log'
  | 'skin_log'
  | 'food_log'
  | 'sleep_log'
  | 'milestone'
  | 'vaccine_dose'
  | 'user';

export interface IPointsLedger {
  userId: Types.ObjectId;
  entryType: PointsEntryType;
  source: PointsSource;
  /** Signed ★. + credits the wallet, - debits it. */
  amount: number;
  status: PointsStatus;
  // FIFO lot accounting — only meaningful on entryType 'earn', status 'settled'.
  remaining?: number; // unspent ★ left in this lot; starts equal to `amount`
  expiresAt?: Date; // earn lots only: createdAt + EXPIRY_MONTHS
  // Where this row came from (for history labels + clawback lookups).
  refType?: PointsRefType;
  refId?: string;
  /** Unique-sparse idempotency guard, e.g. 'earn:order:<id>'. Duplicate insert => no-op. */
  dedupeKey?: string;
  /** 'YYYY-MM-DD' IST bucket, set on capped sources so daily caps can be summed. */
  dayIST?: string;
  /** Groups reserve→release/confirm rows for one order. */
  reservationId?: string;
  /** The ledger row this row reverses/expires (audit trail). */
  reversalOf?: Types.ObjectId;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const pointsLedgerSchema = new Schema<IPointsLedger>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entryType: {
      type: String,
      enum: ['earn', 'redeem', 'reserve', 'release', 'reverse', 'expire', 'adjust'],
      required: true,
    },
    source: {
      type: String,
      enum: [
        'shop_purchase',
        'product_review',
        'tracker_entry',
        'community_contribution',
        'consultation_completed',
        'referral_referrer',
        'referral_referee',
        'shop_redemption',
        'consultation_redemption',
        'expiry',
        'reversal',
        'admin_adjust',
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['settled', 'reserved', 'released', 'reversed', 'expired'],
      required: true,
      default: 'settled',
    },
    remaining: { type: Number, min: 0 },
    expiresAt: { type: Date },
    refType: { type: String },
    refId: { type: String },
    dedupeKey: { type: String },
    dayIST: { type: String },
    reservationId: { type: String },
    reversalOf: { type: Schema.Types.ObjectId, ref: 'PointsLedger' },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

pointsLedgerSchema.index({ userId: 1, createdAt: -1 }); // history pagination
pointsLedgerSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true }); // double-award guard
pointsLedgerSchema.index({ userId: 1, source: 1, dayIST: 1 }); // daily-cap sums
pointsLedgerSchema.index({ userId: 1, entryType: 1, status: 1, expiresAt: 1 }); // balance + expiring-soon
pointsLedgerSchema.index({ reservationId: 1 }); // reservation lifecycle

export const PointsLedger = model<IPointsLedger>('PointsLedger', pointsLedgerSchema);
