import { beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { _resetKeyCache, isEncrypted } from '../lib/crypto/fieldCipher.js';
import { decryptSensitiveFields, encryptSensitiveFields } from './recordCrypto.js';
import type { FieldDefinition } from './types.js';

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  _resetKeyCache();
});

const fields: FieldDefinition[] = [
  { key: 'chief_complaint', label: 'Chief complaint', type: 'text' }, // NOT sensitive
  { key: 'allergies', label: 'Allergies', type: 'textarea', sensitive: true },
  { key: 'bp', label: 'BP', type: 'number' },
];

describe('recordCrypto — sensitive field encryption for the record Map', () => {
  it('encrypts only sensitive string values, leaving others as plaintext', () => {
    const m = new Map<string, unknown>([
      ['chief_complaint', 'cough'],
      ['allergies', 'penicillin'],
      ['bp', 120],
    ]);
    encryptSensitiveFields(fields, m);
    expect(m.get('chief_complaint')).toBe('cough'); // untouched
    expect(m.get('bp')).toBe(120); // untouched
    expect(isEncrypted(m.get('allergies') as string)).toBe(true);
    expect(m.get('allergies')).not.toContain('penicillin');
  });

  it('round-trips via decrypt', () => {
    const m = new Map<string, unknown>([['allergies', 'sulfa drugs']]);
    encryptSensitiveFields(fields, m);
    decryptSensitiveFields(fields, m);
    expect(m.get('allergies')).toBe('sulfa drugs');
  });

  it('is idempotent — a second encrypt does not double-encrypt', () => {
    const m = new Map<string, unknown>([['allergies', 'peanuts']]);
    encryptSensitiveFields(fields, m);
    const once = m.get('allergies');
    encryptSensitiveFields(fields, m);
    expect(m.get('allergies')).toBe(once);
    decryptSensitiveFields(fields, m);
    expect(m.get('allergies')).toBe('peanuts');
  });
});
