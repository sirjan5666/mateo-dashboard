import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A known allergy for a baby. Used to warn in the Food/Feeds trackers and to give
// the AI + the consulting doctor context. We only record it — never diagnose.
export type AllergySeverity = 'mild' | 'moderate' | 'severe';
export const ALLERGY_SEVERITIES: AllergySeverity[] = ['mild', 'moderate', 'severe'];

export interface IAllergy {
  babyId: Types.ObjectId;
  name: string; // the allergen, e.g. "Peanut", "Cow's milk", "Egg"
  severity: AllergySeverity;
  reaction?: string; // e.g. "hives", "vomiting"
  notes?: string;
  createdAt: Date;
}

const allergySchema = new Schema<IAllergy>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    severity: { type: String, enum: ALLERGY_SEVERITIES, default: 'mild' },
    reaction: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Allergy = model<IAllergy>('Allergy', allergySchema);
