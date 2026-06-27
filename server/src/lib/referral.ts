import crypto from 'node:crypto';
import { User } from '../models/User.js';

// Refer & Earn reward. Pricing isn't finalised yet (owner's call), so this is a
// placeholder amount in whole INR credited to the referrer per successful referral.
export const REWARD_PER_REFERRAL = 100;

// Unambiguous alphabet (no 0/O/1/I) for human-shareable codes.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function suffix(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

// A short, collision-checked code like "PRIY8K2M" — derived from the name plus
// random chars so it's recognisable yet unique.
export async function generateUniqueReferralCode(name: string): Promise<string> {
  const base = (name || 'MATEO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'MATEO';
  for (let i = 0; i < 8; i++) {
    const code = `${base}${suffix(4)}`;
    if (!(await User.findOne({ referralCode: code }).select('_id'))) return code;
  }
  return `MATEO${suffix(6)}`;
}
