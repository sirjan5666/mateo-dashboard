import { describe, expect, it } from 'vitest';
import { GLOBAL_TEMPLATES } from './seedTemplates.js';
import { zodForTemplate } from './templateZod.js';
import type { FieldDefinition } from './types.js';

// Build one valid value per field so we can assert a complete record passes the
// template-compiled schema.
function sampleValue(f: FieldDefinition): unknown {
  switch (f.type) {
    case 'number':
      return f.min ?? 1;
    case 'date':
      return '2026-06-21T10:00:00.000Z';
    case 'select':
      return f.options?.[0];
    default:
      return 'sample';
  }
}

function dupes(keys: string[]): string[] {
  const seen = new Set<string>();
  return keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
}

describe('GLOBAL_TEMPLATES integrity', () => {
  it('ships at least the three core specialties', () => {
    expect(GLOBAL_TEMPLATES.map((t) => t.specialization)).toEqual(
      expect.arrayContaining(['general', 'dermatology', 'pediatrics']),
    );
  });

  for (const t of GLOBAL_TEMPLATES) {
    describe(`${t.name} (${t.specialization})`, () => {
      it('compiles to a zod schema and accepts a full sample record', () => {
        const schema = zodForTemplate(t.fields);
        const sample = Object.fromEntries(t.fields.filter((f) => !f.archived).map((f) => [f.key, sampleValue(f)]));
        const result = schema.safeParse(sample);
        expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
      });

      it('has unique field / status / tag keys', () => {
        expect(dupes(t.fields.map((f) => f.key))).toEqual([]);
        expect(dupes(t.statuses.map((s) => s.key))).toEqual([]);
        expect(dupes(t.historyTags.map((h) => h.key))).toEqual([]);
      });

      it('has exactly one default status', () => {
        expect(t.statuses.filter((s) => s.isDefault)).toHaveLength(1);
      });

      it('gives every select field non-empty options', () => {
        for (const f of t.fields.filter((f) => f.type === 'select')) {
          expect(f.options && f.options.length > 0).toBe(true);
        }
      });
    });
  }
});
