import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// App-level field encryption for patient PHI (AES-256-GCM). Ciphertext is stored
// as "v1:<base64(iv|tag|ciphertext)>".
//
// The "v1" prefix is a FORWARD-COMPAT marker only. TODAY there is exactly ONE key
// (DATA_ENCRYPTION_KEY) and ONE version: real key rotation / crypto-shred would
// need a version->key registry (not yet built), and DPDP erasure currently works
// by deleting rows (see eraseUser.ts), NOT by crypto-shred. Do not build a shred
// story on this until the registry exists.
//
// COMPLIANCE/SECURITY notes:
//  - Encryption AT REST for SENSITIVE fields, layered over host/disk encryption.
//    App-encrypted fields are NOT server-queryable — searchable patient data goes
//    through the non-PHI `searchText` denorm instead.
//  - The master key comes from DATA_ENCRYPTION_KEY (32-byte base64). It MUST NOT
//    be the JWT secret (enforced in env.ts) and is NEVER logged.
//  - Read lazily from process.env (not the parsed env object) so unit tests can
//    set the key without import-order coupling.

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16; // 128-bit GCM tag — pinned on both paths (see below)

let cachedKey: Buffer | null = null;

function masterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error('DATA_ENCRYPTION_KEY is not set — it is required to handle patient PHI.');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to 32 bytes (base64-encoded).');
  cachedKey = key;
  return key;
}

/** True if `value` is in our encrypted envelope format. */
export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}

/** Encrypt a string into the "v1:<base64>" envelope. */
export function encryptField(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  // Pin authTagLength so the tag is always 128-bit (and silence Node's DEP0182).
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv, { authTagLength: TAG_BYTES });
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, ct]).toString('base64')}`;
}

/**
 * Decrypt an envelope. Fails CLOSED: a value that is not a valid "v1:" envelope
 * throws rather than being served as-is — there is no legacy plaintext PHI to
 * migrate, so a non-envelope value can only mean a write bug or injected data,
 * which must surface loudly, never silently leak. The error carries no value.
 */
export function decryptField(stored: string): string {
  if (!isEncrypted(stored)) {
    throw new Error('decryptField: value is not a v1 encrypted envelope — refusing to serve unverified data.');
  }
  const buf = Buffer.from(stored.slice(VERSION.length + 1), 'base64');
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  // subarray returns a short slice without throwing — reject a sub-128-bit tag so
  // an attacker with DB write access cannot weaken GCM forgery resistance.
  if (tag.length !== TAG_BYTES) throw new Error('decryptField: invalid GCM tag length.');
  const ct = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** Encrypt an optional/nullable value; '' and null/undefined become undefined. */
export function encryptOptional(v: string | null | undefined): string | undefined {
  return v == null || v === '' ? undefined : encryptField(v);
}

/** Decrypt an optional/nullable value (null/undefined pass through as undefined). */
export function decryptOptional(v: string | null | undefined): string | undefined {
  return v == null ? undefined : decryptField(v);
}

/** Test helper — clears the memoized key after the env var changes in a test. */
export function _resetKeyCache(): void {
  cachedKey = null;
}
