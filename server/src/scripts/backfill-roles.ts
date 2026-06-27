// One-time migration: users created before the `role` field existed have no
// role stored. The schema default fills it in on read, but DB-level queries
// (countDocuments({ role: 'parent' }), filtered finds) won't match them. Set the
// field explicitly so those queries are correct. Idempotent — safe to re-run.
//
//   npx tsx src/scripts/backfill-roles.ts
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const res = await User.updateMany({ role: { $exists: false } }, { $set: { role: 'parent' } });
  console.log(`Backfilled role='parent' on ${res.modifiedCount} legacy user(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
