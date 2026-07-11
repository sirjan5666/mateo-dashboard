import { api } from './client';

export interface TimelineEntry {
  day: number;
  ageLabel: string;
  period: string;
  domain: string;
  theme: string;
  description: string;
  visionMilestone: string;
  cognitiveMilestone: string;
  growthSnapshot: string;
  parentTip: string;
  doctorFlag: string;
  notificationText: string;
  isMilestoneCheck: boolean;
}

export interface JourneyToday {
  contentType: string;
  text: string;
}

export interface Journey {
  day: number;
  rawDay: number;
  totalDays: number;
  graduated: boolean;
  ageLabel: string;
  current: TimelineEntry;
  next: TimelineEntry | null;
  milestoneCheck: { current: TimelineEntry | null; next: TimelineEntry | null };
  today: JourneyToday | null;
}

export type JourneyLanguage = 'en' | 'hi' | 'hi-en';

export function getJourney(babyId: string, lang?: JourneyLanguage) {
  const q = lang ? `?lang=${encodeURIComponent(lang)}` : '';
  return api<Journey>(`/babies/${babyId}/journey${q}`);
}
