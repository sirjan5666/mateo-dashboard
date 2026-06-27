import { randomInt } from 'node:crypto';

// Readable, unambiguous charset (no 0/O/1/l/I) for one-time passwords that an
// admin will copy and hand to a parent or doctor.
const CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A crypto-random one-time password. */
export function generatePassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CHARS[randomInt(CHARS.length)];
  return out;
}
