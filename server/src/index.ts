import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { seedGlobalTemplates } from './records/seedGlobalTemplates.js';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB');

  /**
   * A doctor cannot register a patient without a SpecialtyTemplate to file them
   * under, and there is no UI to create one — so on a fresh database the whole
   * EHR was unusable until someone SSH'd in and ran a script. The seeder is
   * idempotent (matched on ownerless + specialization), so running it every boot
   * is a no-op once the starters exist.
   *
   * A failure here must NOT stop the server: the rest of the app (parent
   * trackers, shop, chat) does not depend on templates.
   */
  try {
    const created = await seedGlobalTemplates();
    if (created > 0) console.log(`Seeded ${created} global specialty template(s)`);
  } catch (err) {
    console.error('[boot] could not seed specialty templates:', err instanceof Error ? err.message : err);
  }

  createApp().listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
