import { api } from './client';

export interface ReferralInfo {
  code: string;
  credits: number; // ₹ earned so far
  referredCount: number; // how many parents joined with this code
  rewardPerReferral: number; // ₹ per successful referral (placeholder pricing)
}

export function getMyReferral() {
  return api<ReferralInfo>('/referrals/me');
}
