// Dev check: read a patient's RAW Mongo doc and confirm PHI is ciphertext at rest.
//   npx tsx src/scripts/check-encrypted.ts <patientId>
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Patient } from '../models/Patient.js';
import { PatientRecord } from '../models/PatientRecord.js';
import { isEncrypted } from '../lib/crypto/fieldCipher.js';

async function main() {
  const pid = process.argv[2];
  if (!pid) {
    console.error('Usage: tsx src/scripts/check-encrypted.ts <patientId>');
    process.exit(1);
  }
  await mongoose.connect(env.MONGODB_URI);
  const p = await Patient.findById(pid).lean();
  const r = await PatientRecord.findOne({ patientId: pid }).lean();

  const rawFields = r?.fields as unknown as Map<string, unknown> | Record<string, unknown> | undefined;
  const allergies =
    rawFields instanceof Map ? rawFields.get('allergies') : rawFields?.allergies;

  console.log(
    JSON.stringify(
      {
        displayName_isCiphertext: p ? isEncrypted(p.displayName) : null,
        displayName_sample: typeof p?.displayName === 'string' ? `${p.displayName.slice(0, 14)}…` : null,
        phone_isCiphertext: p?.phone ? isEncrypted(p.phone) : 'n/a',
        record_allergies_isCiphertext: typeof allergies === 'string' ? isEncrypted(allergies) : allergies,
        record_searchText: r?.searchText ?? null, // should be NON-PHI (searchable fields only)
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
