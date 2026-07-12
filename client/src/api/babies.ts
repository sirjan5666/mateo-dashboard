import { api } from './client';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
export type FeedingType = 'breastfed' | 'mixed';

export interface Baby {
  id: string;
  name: string;
  dob: string;
  sex: 'male' | 'female';
  avatar?: string;
  birthWeightG?: number;
  birthLengthCm?: number;
  birthHeadCircCm?: number;
  gestationalAgeWeeks?: number;
  bloodGroup?: BloodGroup;
  feedingType?: FeedingType;
  knownAllergies?: string[];
  pediatricianName?: string;
  pediatricianPhone?: string;
  solidsStartedOn?: string;
  createdAt: string;
}

export interface BabyInput {
  name: string;
  dob: string;
  sex: 'male' | 'female';
  avatar?: string;
  birthWeightG?: number;
  birthLengthCm?: number;
  birthHeadCircCm?: number;
  gestationalAgeWeeks?: number;
  bloodGroup?: BloodGroup;
  feedingType?: FeedingType;
  knownAllergies?: string[];
  pediatricianName?: string;
  pediatricianPhone?: string;
  solidsStartedOn?: string;
}

export function listBabies() {
  return api<{ babies: Baby[] }>('/babies');
}

export function createBaby(input: BabyInput) {
  return api<{ baby: Baby }>('/babies', { method: 'POST', body: JSON.stringify(input) });
}

export function getBaby(id: string) {
  return api<{ baby: Baby }>(`/babies/${id}`);
}

export function updateBaby(id: string, input: Partial<BabyInput>) {
  return api<{ baby: Baby }>(`/babies/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteBaby(id: string) {
  return api<{ ok: true }>(`/babies/${id}`, { method: 'DELETE' });
}
