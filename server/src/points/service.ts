// Mateo Sitare — the points service. The ONLY module that mutates the ledger.
// Everything is idempotent (dedupeKey), server-authoritative (client point
// amounts are always re-clamped here), and can never drive a balance negative
// (lot consumption uses conditional $inc). Redemption follows a reserve → confirm
// → release lifecycle so points and money can't diverge across the Razorpay gap.

import { Types } from 'mongoose';
import { PointsLedger } from '../models/PointsLedger.js';
import type { PointsSource, PointsRefType } from '../models/PointsLedger.js';
import { User } from '../models/User.js';
import { remainingDailyCap, dayBucket } from './caps.js';
import {
  SITARE,
  expiryFrom,
  pointsToInr,
  inrToPoints,
  maxRedeemInr,
} from './economics.js';

const CONV = SITARE.CONVERSION_POINTS_PER_INR;
const oid = (id: string | Types.ObjectId) => (typeof id === 'string' ? new Types.ObjectId(id) : id);

interface ConsumedLot {
  lotId: string;
  qty: number;
}

// ── Balance reads ────────────────────────────────────────────────────────────

/** Spendable ★ right now: Σ remaining over non-expired settled earn lots. */
export async function availableBalance(userId: string, now: Date = new Date()): Promise<number> {
  const rows = await PointsLedger.aggregate<{ total: number }>([
    { $match: { userId: oid(userId), entryType: 'earn', status: 'settled', expiresAt: { $gt: now } } },
    { $group: { _id: null, total: { $sum: '$remaining' } } },
  ]);
  return rows[0]?.total ?? 0;
}

/** Recompute the denormalised cache on User from the authoritative ledger. */
export async function recomputeUserCache(userId: string, now: Date = new Date()): Promise<void> {
  const uid = oid(userId);
  const [availRows, reservedRows, lifeRows] = await Promise.all([
    PointsLedger.aggregate<{ total: number }>([
      { $match: { userId: uid, entryType: 'earn', status: 'settled', expiresAt: { $gt: now } } },
      { $group: { _id: null, total: { $sum: '$remaining' } } },
    ]),
    PointsLedger.aggregate<{ total: number }>([
      { $match: { userId: uid, entryType: 'reserve', status: 'reserved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }, // amounts are negative
    ]),
    PointsLedger.aggregate<{ total: number }>([
      { $match: { userId: uid, entryType: 'earn', status: { $in: ['settled', 'expired'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  const balance = availRows[0]?.total ?? 0;
  const reserved = -(reservedRows[0]?.total ?? 0);
  const lifetime = lifeRows[0]?.total ?? 0;
  await User.updateOne(
    { _id: uid },
    { $set: { sitareBalance: balance, sitareReserved: reserved, sitareLifetime: lifetime } },
  );
}

// ── Earning ──────────────────────────────────────────────────────────────────

export interface AwardOpts {
  userId: string;
  source: PointsSource;
  amount: number;
  refType?: PointsRefType;
  refId?: string;
  /** Unique idempotency key. A repeat insert is a silent no-op. */
  dedupeKey: string;
  /** Clamp the award to today's remaining headroom for a capped source. */
  dailyCap?: { source: PointsSource; cap: number };
  meta?: Record<string, unknown>;
}

export interface AwardResult {
  awarded: number;
  ledgerId?: string;
  deduped: boolean;
  cappedOut?: boolean;
}

/** Credit ★ to a user as a new earn lot (12-month expiry). Idempotent + capped. */
export async function award(opts: AwardOpts, now: Date = new Date()): Promise<AwardResult> {
  let amount = Math.floor(opts.amount);
  if (amount <= 0) return { awarded: 0, deduped: false };

  if (opts.dailyCap) {
    const headroom = await remainingDailyCap(opts.userId, opts.dailyCap.source, opts.dailyCap.cap, now);
    amount = Math.min(amount, headroom);
    if (amount <= 0) return { awarded: 0, deduped: false, cappedOut: true };
  }

  try {
    const row = await PointsLedger.create({
      userId: oid(opts.userId),
      entryType: 'earn',
      source: opts.source,
      amount,
      status: 'settled',
      remaining: amount,
      expiresAt: expiryFrom(now),
      refType: opts.refType,
      refId: opts.refId,
      dedupeKey: opts.dedupeKey,
      dayIST: opts.dailyCap ? dayBucket(now) : undefined,
      meta: opts.meta,
    });
    await recomputeUserCache(opts.userId, now);
    return { awarded: amount, ledgerId: row.id, deduped: false };
  } catch (err: unknown) {
    if (isDuplicateKey(err)) return { awarded: 0, deduped: true };
    throw err;
  }
}

/**
 * Reward a meaningful tracker/journey entry (★5, capped ★20/IST-day across ALL
 * trackers combined). Idempotent per entry via dedupeKey, so re-saving or
 * re-marking never double-awards. Best-effort — a points failure never blocks a
 * health log from being saved (callers .catch()).
 */
export function awardTrackerEntry(userId: string, refType: PointsRefType, refId: string, dedupeKey: string): Promise<AwardResult> {
  return award({
    userId,
    source: 'tracker_entry',
    amount: SITARE.TRACKER_PER_ENTRY,
    refType,
    refId,
    dedupeKey,
    dailyCap: { source: 'tracker_entry', cap: SITARE.TRACKER_DAILY_CAP },
  });
}

/** Claw back the UNSPENT remainder of a prior earn (e.g. a deleted community post). */
export async function reverse(opts: { dedupeKey: string; reason: string }, now: Date = new Date()): Promise<void> {
  const row = await PointsLedger.findOne({ dedupeKey: opts.dedupeKey, entryType: 'earn', status: 'settled' });
  if (!row) return;
  const clawback = Math.max(0, row.remaining ?? 0);
  const alreadySpent = row.amount - clawback;
  row.status = 'reversed';
  row.remaining = 0;
  await row.save();
  await PointsLedger.create({
    userId: row.userId,
    entryType: 'reverse',
    source: 'reversal',
    amount: -clawback,
    status: 'reversed',
    refType: row.refType,
    refId: row.refId,
    reversalOf: row._id,
    meta: { reason: opts.reason, originalAmount: row.amount, alreadySpent },
  });
  await recomputeUserCache(row.userId.toString(), now);
}

// ── Redemption ───────────────────────────────────────────────────────────────

/** Clamp a requested redemption to balance, the 20% cap, and whole-rupee steps. */
function clampRedeem(requestedPoints: number, balance: number, eligibleInr: number): number {
  const maxByInr = inrToPoints(maxRedeemInr(eligibleInr));
  const capped = Math.min(Math.max(0, Math.floor(requestedPoints)), balance, maxByInr);
  return Math.floor(capped / CONV) * CONV; // whole-rupee multiples only
}

/** Consume `points` from the oldest non-expired lots. Returns null if it can't be satisfied. */
async function consumeLots(userId: string, points: number, now: Date): Promise<ConsumedLot[] | null> {
  if (points <= 0) return [];
  const lots = await PointsLedger.find({
    userId: oid(userId),
    entryType: 'earn',
    status: 'settled',
    remaining: { $gt: 0 },
    expiresAt: { $gt: now },
  }).sort({ createdAt: 1, _id: 1 });

  const consumed: ConsumedLot[] = [];
  let need = points;
  for (const lot of lots) {
    if (need <= 0) break;
    const take = Math.min(lot.remaining ?? 0, need);
    if (take <= 0) continue;
    // Conditional decrement — a concurrent redemption can never push remaining negative.
    const upd = await PointsLedger.updateOne({ _id: lot._id, remaining: { $gte: take } }, { $inc: { remaining: -take } });
    if (upd.modifiedCount === 1) {
      consumed.push({ lotId: lot.id, qty: take });
      need -= take;
    }
  }
  if (need > 0) {
    // Lost a race — roll back everything we took so nothing is silently held.
    for (const c of consumed) await PointsLedger.updateOne({ _id: c.lotId }, { $inc: { remaining: c.qty } });
    return null;
  }
  return consumed;
}

export interface ReserveResult {
  reservationId: string;
  reservedPoints: number;
  discountInr: number;
}

/**
 * Hold points for an in-flight shop order. The reservationId is the order id.
 * Points are removed from their lots now and either confirmed (payment succeeds)
 * or released (payment fails / order cancelled). Returns a 0 hold if nothing is
 * redeemable — the caller simply charges full price.
 */
export async function reserveForOrder(
  opts: { userId: string; orderId: string; requestedPoints: number; eligibleSubtotalInr: number },
  now: Date = new Date(),
): Promise<ReserveResult> {
  const reservationId = opts.orderId;
  if (opts.requestedPoints <= 0) return { reservationId, reservedPoints: 0, discountInr: 0 };

  const balance = await availableBalance(opts.userId, now);
  const points = clampRedeem(opts.requestedPoints, balance, opts.eligibleSubtotalInr);
  if (points <= 0) return { reservationId, reservedPoints: 0, discountInr: 0 };

  const consumed = await consumeLots(opts.userId, points, now);
  if (!consumed) return { reservationId, reservedPoints: 0, discountInr: 0 };

  const discountInr = pointsToInr(points);
  await PointsLedger.create({
    userId: oid(opts.userId),
    entryType: 'reserve',
    source: 'shop_redemption',
    amount: -points,
    status: 'reserved',
    reservationId,
    refType: 'order',
    refId: opts.orderId,
    meta: { consumedLots: consumed, discountInr, eligibleSubtotalInr: opts.eligibleSubtotalInr },
  });
  await recomputeUserCache(opts.userId, now);
  return { reservationId, reservedPoints: points, discountInr };
}

/** Settle a held reservation once payment is confirmed. */
export async function confirmReservation(reservationId: string, now: Date = new Date()): Promise<void> {
  const row = await PointsLedger.findOne({ reservationId, entryType: 'reserve', status: 'reserved' });
  if (!row) return; // already confirmed/released, or never held
  row.entryType = 'redeem';
  row.status = 'settled';
  await row.save();
  await recomputeUserCache(row.userId.toString(), now);
}

/** Give back a held reservation (payment failed / order cancelled). Restores lots. */
export async function releaseReservation(reservationId: string, now: Date = new Date()): Promise<void> {
  const row = await PointsLedger.findOne({ reservationId, entryType: 'reserve', status: 'reserved' });
  if (!row) return; // already confirmed/released — idempotent
  const consumed = (row.meta?.consumedLots as ConsumedLot[] | undefined) ?? [];
  for (const c of consumed) {
    await PointsLedger.updateOne({ _id: c.lotId }, { $inc: { remaining: c.qty } });
  }
  row.status = 'released';
  await row.save();
  await recomputeUserCache(row.userId.toString(), now);
}

/**
 * Immediate redemption (no async gap) — used for consultation booking where the
 * mock payment settles in the same request. Consumes lots and writes a settled
 * redeem row. Returns the applied points + rupee discount (0 if none redeemable).
 */
export async function redeemImmediate(
  opts: {
    userId: string;
    requestedPoints: number;
    eligibleInr: number;
    source: PointsSource;
    refType: PointsRefType;
    refId: string;
  },
  now: Date = new Date(),
): Promise<{ appliedPoints: number; discountInr: number }> {
  if (opts.requestedPoints <= 0) return { appliedPoints: 0, discountInr: 0 };
  const balance = await availableBalance(opts.userId, now);
  const points = clampRedeem(opts.requestedPoints, balance, opts.eligibleInr);
  if (points <= 0) return { appliedPoints: 0, discountInr: 0 };
  const consumed = await consumeLots(opts.userId, points, now);
  if (!consumed) return { appliedPoints: 0, discountInr: 0 };
  const discountInr = pointsToInr(points);
  await PointsLedger.create({
    userId: oid(opts.userId),
    entryType: 'redeem',
    source: opts.source,
    amount: -points,
    status: 'settled',
    refType: opts.refType,
    refId: opts.refId,
    meta: { consumedLots: consumed, discountInr, eligibleInr: opts.eligibleInr },
  });
  await recomputeUserCache(opts.userId, now);
  return { appliedPoints: points, discountInr };
}

/** Read-only preview of applying points (no mutation) — for the client's Apply-Sitare UI. */
export async function previewRedeem(
  opts: { userId: string; eligibleInr: number; requestedPoints?: number },
  now: Date = new Date(),
): Promise<{
  eligibleSubtotalInr: number;
  maxRedeemablePoints: number;
  maxRedeemableInr: number;
  appliedPoints: number;
  discountInr: number;
  payableReductionInr: number;
}> {
  const balance = await availableBalance(opts.userId, now);
  const maxByInr = inrToPoints(maxRedeemInr(opts.eligibleInr));
  const maxRedeemablePoints = Math.floor(Math.min(balance, maxByInr) / CONV) * CONV;
  const requested = opts.requestedPoints == null ? maxRedeemablePoints : opts.requestedPoints;
  const appliedPoints = clampRedeem(requested, balance, opts.eligibleInr);
  const discountInr = pointsToInr(appliedPoints);
  return {
    eligibleSubtotalInr: opts.eligibleInr,
    maxRedeemablePoints,
    maxRedeemableInr: pointsToInr(maxRedeemablePoints),
    appliedPoints,
    discountInr,
    payableReductionInr: discountInr,
  };
}

// ── Expiry ───────────────────────────────────────────────────────────────────

/** Age out lots past their expiry, writing an `expire` row for the lost remainder. */
export async function expireDueLots(now: Date = new Date()): Promise<{ usersTouched: number; expiredPoints: number }> {
  const lots = await PointsLedger.find({
    entryType: 'earn',
    status: 'settled',
    expiresAt: { $lte: now },
    remaining: { $gt: 0 },
  }).limit(1000);
  const touched = new Set<string>();
  let expiredPoints = 0;
  for (const lot of lots) {
    const rem = lot.remaining ?? 0;
    lot.status = 'expired';
    lot.remaining = 0;
    await lot.save();
    await PointsLedger.create({
      userId: lot.userId,
      entryType: 'expire',
      source: 'expiry',
      amount: -rem,
      status: 'expired',
      refType: lot.refType,
      refId: lot.refId,
      reversalOf: lot._id,
      meta: { reason: 'lot_expired' },
    });
    expiredPoints += rem;
    touched.add(lot.userId.toString());
  }
  for (const uid of touched) await recomputeUserCache(uid, now);
  return { usersTouched: touched.size, expiredPoints };
}

/** ★ expiring within the next 30 days (for the wallet "expiring soon" nudge). */
export async function expiringSoon(
  userId: string,
  now: Date = new Date(),
): Promise<{ points: number; before: Date }> {
  const before = new Date(now);
  before.setDate(before.getDate() + 30);
  const rows = await PointsLedger.aggregate<{ total: number }>([
    {
      $match: {
        userId: oid(userId),
        entryType: 'earn',
        status: 'settled',
        expiresAt: { $gt: now, $lte: before },
      },
    },
    { $group: { _id: null, total: { $sum: '$remaining' } } },
  ]);
  return { points: rows[0]?.total ?? 0, before };
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}
