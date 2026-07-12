// Daily earning caps (anti-farming). Some sources — tracker entries, community
// contributions — reward the *act*, so they need a per-day ceiling or they'd be
// trivially farmed. Caps are bucketed by IST calendar day (lib/ist.ts), not UTC,
// so "today" matches the user's day.

import { Types } from 'mongoose';
import { istDateString } from '../lib/ist.js';
import { PointsLedger } from '../models/PointsLedger.js';
import type { PointsSource } from '../models/PointsLedger.js';

/** The IST day bucket string for an instant (default now). */
export function dayBucket(now: Date = new Date()): string {
  return istDateString(now);
}

/**
 * How many ★ this user may still earn today from `source`, given a daily `cap`.
 * Sums the ★ already awarded today (settled earn rows for that source) and
 * returns the remaining headroom (never negative).
 */
export async function remainingDailyCap(
  userId: string,
  source: PointsSource,
  cap: number,
  now: Date = new Date(),
): Promise<number> {
  const dayIST = dayBucket(now);
  const rows = await PointsLedger.aggregate<{ used: number }>([
    { $match: { userId: toObjectId(userId), source, dayIST, entryType: 'earn' } },
    { $group: { _id: null, used: { $sum: '$amount' } } },
  ]);
  const used = rows[0]?.used ?? 0;
  return Math.max(0, cap - used);
}

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}
