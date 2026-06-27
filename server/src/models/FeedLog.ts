import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A milk feed for the 0-6 month stage (complements the Food tracker, which is
// complementary feeding from 6 months). Brand-neutral by design — the app never
// records or recommends a formula/brand (IMS Act); 'expressed' = expressed breast
// milk. Solids belong in the Food tracker.
export type FeedKind = 'breast' | 'expressed' | 'water' | 'other';
export const FEED_KINDS: FeedKind[] = ['breast', 'expressed', 'water', 'other'];
export type FeedSide = 'left' | 'right' | 'both';
export const FEED_SIDES: FeedSide[] = ['left', 'right', 'both'];

export interface IFeedLog {
  babyId: Types.ObjectId;
  loggedAt: Date;
  kind: FeedKind;
  side?: FeedSide; // breast only
  durationMin?: number; // breast only
  amountMl?: number; // expressed / water
  notes?: string;
  createdAt: Date;
}

const feedLogSchema = new Schema<IFeedLog>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    loggedAt: { type: Date, required: true },
    kind: { type: String, enum: FEED_KINDS, required: true },
    side: { type: String, enum: FEED_SIDES },
    durationMin: { type: Number, min: 1, max: 240 },
    amountMl: { type: Number, min: 1, max: 1000 },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const FeedLog = model<IFeedLog>('FeedLog', feedLogSchema);
