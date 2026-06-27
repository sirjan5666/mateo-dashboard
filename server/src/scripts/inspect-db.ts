import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Baby } from '../models/Baby.js';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  const users = await User.find({}).select('name email role');
  const babies = await Baby.find({}).select('name userId createdAt');
  console.log(`\nUsers (${users.length}):`);
  for (const u of users) {
    const count = babies.filter((b) => b.userId.toString() === u.id).length;
    console.log(`  ${u.email} [${u.role}] id=${u.id} — ${count} babies`);
  }
  console.log(`\nBabies (${babies.length} total):`);
  for (const b of babies) {
    console.log(`  ${b.name}  owner=${b.userId.toString()}  created=${b.createdAt.toISOString()}`);
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
