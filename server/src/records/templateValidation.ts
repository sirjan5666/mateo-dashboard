import type { FieldDefinition } from './types.js';

// Invariant: a field can never be BOTH `sensitive` (encrypted at rest, not
// server-queryable) AND `searchable` (its value is copied verbatim into the
// non-PHI `searchText` text index). Allowing both would leak encrypted PHI as
// plaintext into an index — defeating the encryption entirely. Enforced at
// template save (SpecialtyTemplate pre-validate) and to be re-checked in the
// template-edit route's zod when it lands (commit 4).
export function findSensitiveSearchableConflict(fields: FieldDefinition[]): FieldDefinition | undefined {
  return fields.find((f) => Boolean(f.sensitive) && Boolean(f.searchable));
}
