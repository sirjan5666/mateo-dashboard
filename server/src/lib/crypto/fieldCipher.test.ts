import { beforeAll, describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { _resetKeyCache, decryptField, encryptField, isEncrypted } from './fieldCipher.js';

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  _resetKeyCache();
});

describe('fieldCipher (AES-256-GCM at-rest field encryption)', () => {
  it('round-trips text and the ciphertext does not leak the plaintext', () => {
    const out = encryptField('Riya Sharma');
    expect(out).not.toContain('Riya');
    expect(isEncrypted(out)).toBe(true);
    expect(decryptField(out)).toBe('Riya Sharma');
  });

  it('round-trips unicode / Devanagari', () => {
    const s = 'रिया · हृदय रोग · 9.5kg';
    expect(decryptField(encryptField(s))).toBe(s);
  });

  it('uses a random IV (ciphertext differs each time)', () => {
    expect(encryptField('x')).not.toBe(encryptField('x'));
  });

  it('fails CLOSED on a non-envelope value (no silent plaintext pass-through)', () => {
    expect(isEncrypted('not-encrypted')).toBe(false);
    expect(() => decryptField('not-encrypted')).toThrow();
  });

  it('fails authentication when ciphertext is tampered', () => {
    const out = encryptField('secret value');
    const i = out.length - 5;
    const tampered = out.slice(0, i) + (out[i] === 'A' ? 'B' : 'A') + out.slice(i + 1);
    expect(() => decryptField(tampered)).toThrow();
  });

  it('rejects a sub-128-bit (short) GCM tag', () => {
    // Craft a forged envelope: 12-byte IV + a 4-byte tag + empty ciphertext.
    const forged = `v1:${Buffer.concat([randomBytes(12), randomBytes(4)]).toString('base64')}`;
    expect(() => decryptField(forged)).toThrow(/tag length/i);
  });
});
