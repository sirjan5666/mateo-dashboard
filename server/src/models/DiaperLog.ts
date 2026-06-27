import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A diaper change. Wet/dirty counts are a useful signal of hydration + feeding
// adequacy, especially for newborns. We only LOG — never diagnose; a few stool
// colours get a gentle "mention to your pediatrician" hint (computed at read
// time), consistent with the caution-first red-flag philosophy.
export type DiaperKind = 'wet' | 'dirty' | 'mixed' | 'dry';
export const DIAPER_KINDS: DiaperKind[] = ['wet', 'dirty', 'mixed', 'dry'];
export type StoolConsistency = 'soft' | 'normal' | 'firm' | 'watery';
export const STOOL_CONSISTENCIES: StoolConsistency[] = ['soft', 'normal', 'firm', 'watery'];
export type StoolColor = 'yellow' | 'brown' | 'green' | 'black' | 'red' | 'pale';
export const STOOL_COLORS: StoolColor[] = ['yellow', 'brown', 'green', 'black', 'red', 'pale'];
// Colours worth flagging to a doctor (e.g. GI bleeding, biliary issues).
export const CONCERNING_COLORS: StoolColor[] = ['black', 'red', 'pale'];

export interface IDiaperLog {
  babyId: Types.ObjectId;
  loggedAt: Date;
  kind: DiaperKind;
  consistency?: StoolConsistency; // dirty / mixed
  color?: StoolColor; // dirty / mixed
  notes?: string;
  createdAt: Date;
}

const diaperLogSchema = new Schema<IDiaperLog>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    loggedAt: { type: Date, required: true },
    kind: { type: String, enum: DIAPER_KINDS, required: true },
    consistency: { type: String, enum: STOOL_CONSISTENCIES },
    color: { type: String, enum: STOOL_COLORS },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const DiaperLog = model<IDiaperLog>('DiaperLog', diaperLogSchema);
