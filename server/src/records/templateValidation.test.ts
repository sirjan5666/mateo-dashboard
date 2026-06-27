import { describe, expect, it } from 'vitest';
import { findSensitiveSearchableConflict } from './templateValidation.js';
import { GLOBAL_TEMPLATES } from './seedTemplates.js';
import type { FieldDefinition } from './types.js';

describe('findSensitiveSearchableConflict', () => {
  it('flags a field that is both sensitive and searchable', () => {
    const fields: FieldDefinition[] = [{ key: 'ssn', label: 'SSN', type: 'text', sensitive: true, searchable: true }];
    expect(findSensitiveSearchableConflict(fields)?.key).toBe('ssn');
  });

  it('allows sensitive-only and searchable-only fields', () => {
    const fields: FieldDefinition[] = [
      { key: 'allergies', label: 'Allergies', type: 'textarea', sensitive: true },
      { key: 'complaint', label: 'Complaint', type: 'text', searchable: true },
    ];
    expect(findSensitiveSearchableConflict(fields)).toBeUndefined();
  });

  it('every seed template is conflict-free', () => {
    for (const t of GLOBAL_TEMPLATES) {
      expect(findSensitiveSearchableConflict(t.fields), t.specialization).toBeUndefined();
    }
  });
});
