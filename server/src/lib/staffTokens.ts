import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Opaque link/refresh tokens.
 *
 * The plain token is returned exactly once — to be emailed, or set as a cookie —
 * and only its SHA-256 is ever stored. A dump of StaffSession or StaffToken
 * therefore yields nothing usable, the same reasoning that keeps passwords
 * hashed. SHA-256 rather than bcrypt is right here: these are 256 bits of
 * randomness, not a guessable secret, so there is nothing to slow down.
 */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time compare, so a mismatch cannot be timed to leak the prefix. */
export function tokensMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * A readable device name from a user agent, for the "signed-in devices" list.
 * Deliberately coarse: enough for someone to recognise their own laptop, not a
 * fingerprint worth storing.
 */
export function describeDevice(userAgent?: string): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent.toLowerCase();
  const os = ua.includes('windows') ? 'Windows'
    : ua.includes('android') ? 'Android'
      : ua.includes('iphone') || ua.includes('ipad') ? 'iOS'
        : ua.includes('mac os') ? 'macOS'
          : ua.includes('linux') ? 'Linux' : 'Unknown OS';
  const browser = ua.includes('edg/') ? 'Edge'
    : ua.includes('chrome') ? 'Chrome'
      : ua.includes('safari') ? 'Safari'
        : ua.includes('firefox') ? 'Firefox' : 'Browser';
  return `${browser} on ${os}`;
}
