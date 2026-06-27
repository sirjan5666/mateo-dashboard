import { api } from './client';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type FoodTexture = 'puree' | 'mashed' | 'finger' | 'family';
export type FoodAmount = 'tasted' | 'some' | 'full';
export type FoodReaction = 'none' | 'mild' | 'concerning';

export interface FoodLog {
  id: string;
  loggedAt: string;
  mealType: MealType;
  foodName: string;
  foodGroups: string[];
  texture: FoodTexture;
  amount: FoodAmount;
  reaction: FoodReaction;
  isNewFood: boolean;
  notes: string | null;
  createdAt: string;
}

export interface FoodInput {
  loggedAt: string;
  mealType: MealType;
  foodName: string;
  foodGroups: string[];
  texture: FoodTexture;
  amount: FoodAmount;
  reaction: FoodReaction;
  isNewFood: boolean;
  notes?: string;
}

export interface FeedingStage {
  id: string;
  label: string;
  ageStartMonth: number;
  ageEndMonth: number;
  texture: string;
  frequency: string;
  amount: string;
  ideas: Record<string, string[]>;
  tips: string[];
}

export interface FeedingGuidance {
  ageMonths: number;
  underSix: boolean;
  underSixMonths: {
    headline: string;
    guidance: string;
    ifNotBreastfeeding: string;
    readiness: string[];
    readinessNote: string;
  };
  stage: FeedingStage | null;
  neverFeed: { item: string; why: string }[];
  safety: string[];
  principles: string[];
  feedingNote: string;
}

export interface FoodResponse {
  logs: FoodLog[];
  guidance: FeedingGuidance;
}

export function listFood(babyId: string) {
  return api<FoodResponse>(`/babies/${babyId}/food`);
}

export function addFood(babyId: string, input: FoodInput) {
  return api<{ log: FoodLog }>(`/babies/${babyId}/food`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteFood(babyId: string, logId: string) {
  return api<{ ok: true }>(`/babies/${babyId}/food/${logId}`, { method: 'DELETE' });
}
