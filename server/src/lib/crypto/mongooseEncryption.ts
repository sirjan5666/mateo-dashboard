import type { Schema } from 'mongoose';
import { encryptField, isEncrypted } from './fieldCipher.js';

// Mongoose plugin: encrypt the given top-level string paths on save (idempotent —
// already-encrypted values are left alone). Decryption is done EXPLICITLY by the
// response shaper via decryptField, NOT via schema getters, so lean()/aggregate()
// can never accidentally leak plaintext or double-encode ciphertext.
//
// pre('save') covers create + document .save() (the write path the EHR uses). The
// async form fails CLOSED — if encryption throws, the save rejects and no plaintext
// is stored. `this` is contextually typed as the document by the pre('save') overload.
//
// Update operators (findOneAndUpdate/updateOne/...) do NOT run the save hook, so a
// $set of an encrypted path would write plaintext. The second hook below makes that
// fail CLOSED rather than relying on a convention. $unset is allowed (it stores no
// plaintext — needed by eraseUser's unlink).
export function encryptedFields(schema: Schema, paths: string[]): void {
  schema.pre('save', async function encryptOnSave() {
    for (const p of paths) {
      const v = this.get(p);
      if (typeof v === 'string' && v.length > 0 && !isEncrypted(v)) this.set(p, encryptField(v));
    }
  });

  schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany', 'replaceOne'], function blockPlaintextUpdate() {
    const q = this as unknown as { getUpdate(): Record<string, unknown> | null };
    const update = q.getUpdate() ?? {};
    const set = (update.$set ?? {}) as Record<string, unknown>;
    const setOnInsert = (update.$setOnInsert ?? {}) as Record<string, unknown>;
    for (const p of paths) {
      if (update[p] !== undefined || set[p] !== undefined || setOnInsert[p] !== undefined) {
        throw new Error(
          `Encrypted field "${p}" cannot be written via an update operator — load the document and use .save() so it is encrypted at rest.`,
        );
      }
    }
  });
}
