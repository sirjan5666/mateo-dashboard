import { decryptField, encryptField, isEncrypted } from '../lib/crypto/fieldCipher.js';
import type { FieldDefinition } from './types.js';

// Template-driven field-level encryption for PatientRecord.fields.
//
// WHY THIS EXISTS: the generic encryptedFields() Mongoose plugin only encrypts a
// fixed list of TOP-LEVEL string paths — it cannot reach a Mongoose Map keyed by
// dynamic, per-template field keys. So PatientRecord.fields gets NO encryption from
// that plugin. The (Phase-1 commit-4) writePatientRecord() choke point MUST call
// encryptSensitiveFields() right after zodForTemplate(...).parse() and before .save();
// the response shaper MUST call decryptSensitiveFields() before returning.
//
// Only STRING values of fields flagged `sensitive:true` are encrypted (free-text
// PHI: allergies, medications, notes). Numbers/dates are left as-is and must not be
// marked sensitive (enforced by validateTemplateFields → no sensitive+searchable,
// and sensitive fields should be text/textarea). Idempotent via isEncrypted().

/** Encrypt sensitive string values in place. Call before persisting a record. */
export function encryptSensitiveFields(fields: FieldDefinition[], values: Map<string, unknown>): void {
  for (const f of fields) {
    if (!f.sensitive) continue;
    const v = values.get(f.key);
    if (typeof v === 'string' && v.length > 0 && !isEncrypted(v)) values.set(f.key, encryptField(v));
  }
}

/** Decrypt sensitive values in place. Call in the response shaper before returning. */
export function decryptSensitiveFields(fields: FieldDefinition[], values: Map<string, unknown>): void {
  for (const f of fields) {
    if (!f.sensitive) continue;
    const v = values.get(f.key);
    if (typeof v === 'string' && isEncrypted(v)) values.set(f.key, decryptField(v));
  }
}
