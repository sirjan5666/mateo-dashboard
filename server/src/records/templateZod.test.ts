import { describe, expect, it } from 'vitest';
import { zodForTemplate } from './templateZod.js';
import type { FieldDefinition } from './types.js';

// A small cross-specialty template (note: nothing here is hardcoded in a model).
const fields: FieldDefinition[] = [
  { key: 'chief_complaint', label: 'Chief complaint', type: 'text', required: true, maxLength: 200 },
  { key: 'bp_systolic', label: 'BP systolic', type: 'number', min: 40, max: 300 },
  { key: 'severity', label: 'Severity', type: 'select', options: ['mild', 'moderate', 'severe'] },
  { key: 'onset', label: 'Onset', type: 'date' },
  { key: 'old_note', label: 'Old note', type: 'text', archived: true },
];

describe('zodForTemplate — specialty-agnostic field validation', () => {
  const schema = zodForTemplate(fields);

  it('accepts a valid record', () => {
    expect(
      schema.safeParse({ chief_complaint: 'cough', bp_systolic: 120, severity: 'mild', onset: '2026-06-21T10:00:00.000Z' }).success,
    ).toBe(true);
  });

  it('requires required fields', () => {
    expect(schema.safeParse({ bp_systolic: 120 }).success).toBe(false); // missing chief_complaint
  });

  it('enforces number min/max', () => {
    expect(schema.safeParse({ chief_complaint: 'x', bp_systolic: 5 }).success).toBe(false);
  });

  it('enforces select options', () => {
    expect(schema.safeParse({ chief_complaint: 'x', severity: 'critical' }).success).toBe(false);
  });

  it('validates date format', () => {
    expect(schema.safeParse({ chief_complaint: 'x', onset: 'yesterday' }).success).toBe(false);
  });

  it('rejects unknown field keys (strict)', () => {
    expect(schema.safeParse({ chief_complaint: 'x', injected: 'nope' }).success).toBe(false);
  });

  it('accepts a stored value for an archived field (lenient)', () => {
    expect(schema.safeParse({ chief_complaint: 'x', old_note: 'legacy text' }).success).toBe(true);
  });
});
