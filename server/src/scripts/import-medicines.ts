// Seed the IndiaMedicine reference catalog from the public "A-Z medicines dataset
// of India" CSV (~254k rows). One-time / re-runnable; it clears the collection
// and bulk-loads it, then (re)builds the nameLower index.
//
//   npx tsx src/scripts/import-medicines.ts "<path-to>/A_Z_medicines_dataset_of_India.csv"
//
// CSV columns (fixed positions; some headers are blank in this export):
//   0 id | 1 name | 2..4 (blank) | 5 type | 6 pack_size_label | 7 short_composition1 | 8 short_composition2
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { IndiaMedicine } from '../models/IndiaMedicine.js';
import type { IIndiaMedicine } from '../models/IndiaMedicine.js';

const BATCH = 5000;

// Minimal quote-aware CSV line parser (handles "" escapes and commas in quotes).
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const clean = (s: string | undefined): string | undefined => {
  const t = (s ?? '').trim();
  return t.length ? t : undefined;
};

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: tsx src/scripts/import-medicines.ts <path-to-csv>');
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected. Clearing existing IndiaMedicine catalog…');
  await IndiaMedicine.collection.drop().catch(() => undefined); // ignore "ns not found"

  const rl = createInterface({ input: createReadStream(csvPath, 'utf8'), crlfDelay: Infinity });

  let header = true;
  let total = 0;
  let skipped = 0;
  let batch: IIndiaMedicine[] = [];

  const flush = async () => {
    if (!batch.length) return;
    await IndiaMedicine.insertMany(batch, { ordered: false });
    total += batch.length;
    batch = [];
    if (total % 50000 === 0) console.log(`  …${total} inserted`);
  };

  for await (const raw of rl) {
    const line = raw.replace(/\r$/, '');
    if (header) { header = false; continue; }
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const name = clean(f[1]);
    if (!name) { skipped++; continue; }
    batch.push({
      name,
      nameLower: name.toLowerCase(),
      type: clean(f[5]),
      packSize: clean(f[6]),
      composition1: clean(f[7]),
      composition2: clean(f[8]),
    });
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  console.log(`Inserted ${total} medicines (skipped ${skipped} blank-name rows). Building index…`);
  await IndiaMedicine.createIndexes();
  console.log('Done. IndiaMedicine catalog ready.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
