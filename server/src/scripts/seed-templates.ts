// Seed the global (ownerless) specialty templates a doctor can pick from.
//   npx tsx src/scripts/seed-templates.ts
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { seedGlobalTemplates } from '../records/seedGlobalTemplates.js';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const created = await seedGlobalTemplates();
  console.log(`Seeded ${created} new global template(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
