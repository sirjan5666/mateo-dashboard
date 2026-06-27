// Create or promote a user to a given role. Admin accounts (and, while we build
// the doctor panel, test doctor accounts) are made here — never via public
// signup, which can only ever create a parent.
//
//   npx tsx src/scripts/seed-user.ts <email> <password> <name> [role=admin]
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { User, USER_ROLES } from '../models/User.js';
import type { UserRole } from '../models/User.js';

async function main() {
  const [email, password, name, roleArg] = process.argv.slice(2);
  if (!email || !password || !name) {
    console.error('Usage: tsx src/scripts/seed-user.ts <email> <password> <name> [role=admin]');
    process.exit(1);
  }
  const role = (roleArg ?? 'admin') as UserRole;
  if (!USER_ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: ${USER_ROLES.join(', ')}`);
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  const lowerEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email: lowerEmail });
  if (existing) {
    existing.role = role;
    existing.passwordHash = passwordHash;
    existing.name = name;
    await existing.save();
    console.log(`Updated existing user ${lowerEmail} → role=${role}`);
  } else {
    await User.create({ email: lowerEmail, name, passwordHash, role, consentAcceptedAt: new Date() });
    console.log(`Created user ${lowerEmail} → role=${role}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
