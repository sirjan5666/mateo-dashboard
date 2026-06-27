import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type FoodTexture = 'puree' | 'mashed' | 'finger' | 'family';
export type FoodAmount = 'tasted' | 'some' | 'full';
export type FoodReaction = 'none' | 'mild' | 'concerning';

export interface IFoodLog {
  babyId: Types.ObjectId;
  loggedAt: Date;
  mealType: MealType;
  // Generic, brand-neutral descriptors only (e.g. "mashed banana") — never a
  // formula / milk-substitute / baby-food brand name (IMS Act 1992, CLAUDE.md rule 4).
  foodName: string;
  foodGroups: string[];
  texture: FoodTexture;
  amount: FoodAmount;
  reaction: FoodReaction;
  // First time this food is offered — prompts a few days of allergy watching.
  isNewFood: boolean;
  notes?: string;
  createdAt: Date;
}

const foodLogSchema = new Schema<IFoodLog>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    loggedAt: { type: Date, required: true },
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], required: true },
    foodName: { type: String, required: true, trim: true },
    foodGroups: { type: [String], default: [] },
    texture: { type: String, enum: ['puree', 'mashed', 'finger', 'family'], required: true },
    amount: { type: String, enum: ['tasted', 'some', 'full'], required: true },
    reaction: { type: String, enum: ['none', 'mild', 'concerning'], required: true },
    isNewFood: { type: Boolean, required: true, default: false },
    notes: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const FoodLog = model<IFoodLog>('FoodLog', foodLogSchema);
