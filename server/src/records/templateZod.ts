import { z } from 'zod';
import type { FieldDefinition } from './types.js';

// Compile a zod schema from a specialty template's field list, so dynamic custom
// fields get the SAME validate-then-Mongoose treatment and {path, message} error
// shape as the hand-written route schemas. Used by the (later) writePatientRecord()
// choke point: `zodForTemplate(template.fields).parse(req.body.fields)` before any
// DB write.
//
// Rules:
//  - required fields are required; the rest are optional.
//  - archived fields are accepted leniently (their previously-stored values must
//    still round-trip) but are never required.
//  - unknown field keys are REJECTED (.strict) so junk/injected keys can't be stored.
export function zodForTemplate(fields: FieldDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (f.archived) {
      shape[f.key] = z.unknown().optional();
      continue;
    }
    let s: z.ZodTypeAny;
    switch (f.type) {
      case 'number': {
        let n = z.number({ message: `${f.label} must be a number` });
        if (f.min != null) n = n.min(f.min, `${f.label} must be at least ${f.min}`);
        if (f.max != null) n = n.max(f.max, `${f.label} must be at most ${f.max}`);
        s = n;
        break;
      }
      case 'date':
        s = z.string().datetime({ message: `${f.label} must be a valid date` });
        break;
      case 'select':
        s = f.options && f.options.length > 0 ? z.enum(f.options as [string, ...string[]]) : z.string();
        break;
      case 'textarea':
      case 'text':
      default: {
        let t = z.string();
        if (f.maxLength != null) t = t.max(f.maxLength, `${f.label} is too long`);
        s = t;
        break;
      }
    }
    shape[f.key] = f.required ? s : s.optional();
  }
  return z.object(shape).strict();
}
