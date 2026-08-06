import { Patient } from '../models/Patient.js';

/**
 * Gives every pre-existing patient the sequential number that new ones get on
 * creation. Idempotent — patients that already have a code are skipped — so it
 * is safe to run on every boot alongside the template seed.
 *
 * Numbers are allocated per doctor in registration order, so an existing
 * practice sees 00001, 00002, … in the order they actually took patients on.
 */
export async function backfillPatientCodes(): Promise<number> {
  // `$exists: false` covers documents written before the field existed; `null`
  // covers any that were explicitly cleared.
  const missing = await Patient.find({ $or: [{ code: { $exists: false } }, { code: null }] })
    .select('_id doctorUserId createdAt')
    .sort({ doctorUserId: 1, createdAt: 1 });
  if (!missing.length) return 0;

  // Highest code already issued per doctor, so a backfill never reuses one.
  const highest = new Map<string, number>();
  const seeded = await Patient.aggregate<{ _id: unknown; max: number }>([
    { $match: { code: { $ne: null } } },
    { $group: { _id: '$doctorUserId', max: { $max: '$code' } } },
  ]);
  for (const row of seeded) highest.set(String(row._id), row.max ?? 0);

  let written = 0;
  for (const p of missing) {
    const key = String(p.doctorUserId);
    const next = (highest.get(key) ?? 0) + 1;
    highest.set(key, next);
    // updateOne, not save(): the encryption pre-save hook would otherwise
    // re-encrypt already-encrypted PHI on a document we only loaded ids for.
    await Patient.updateOne({ _id: p._id }, { $set: { code: next } });
    written += 1;
  }
  return written;
}
