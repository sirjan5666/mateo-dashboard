import { SpecialtyTemplate } from '../models/SpecialtyTemplate.js';
import { GLOBAL_TEMPLATES } from './seedTemplates.js';

/**
 * Idempotently insert the global (ownerless) starter templates a doctor can pick
 * from. Matched by (no owner + specialization). Safe to run repeatedly. Run via
 * `npx tsx src/scripts/seed-templates.ts`.
 */
export async function seedGlobalTemplates(): Promise<number> {
  let created = 0;
  for (const t of GLOBAL_TEMPLATES) {
    const exists = await SpecialtyTemplate.findOne({ ownerUserId: { $exists: false }, specialization: t.specialization });
    if (exists) continue;
    await SpecialtyTemplate.create({
      specialization: t.specialization,
      name: t.name,
      version: 1,
      fields: t.fields,
      statuses: t.statuses,
      historyTags: t.historyTags,
      isActive: true,
      changeLog: [],
    });
    created += 1;
  }
  return created;
}
