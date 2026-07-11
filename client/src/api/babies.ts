import { api } from './client';

export interface Baby {
  id: string;
  name: string;
  dob: string;
  sex: 'male' | 'female';
  birthWeightG?: number;
  birthLengthCm?: number;
  birthHeadCircCm?: number;
  solidsStartedOn?: string;
  createdAt: string;
}

export interface BabyInput {
  name: string;
  dob: string;
  sex: 'male' | 'female';
  birthWeightG?: number;
  birthLengthCm?: number;
  birthHeadCircCm?: number;
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
