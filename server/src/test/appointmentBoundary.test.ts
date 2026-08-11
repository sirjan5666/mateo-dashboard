import 'dotenv/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';

/**
 * The concurrent double-booking guard.
 *
 * `findClash` in the route stops a sequential clash, but two SIMULTANEOUS
 * bookings both read "no clash" before either inserts — a TOCTOU race that let a
 * real double-book through. The partial unique index on
 * `{doctorUserId, start, status}` (status: 'scheduled') is the atomic backstop.
 * This asserts the index actually enforces it, at the model level.
 *
 * Skips gracefully with no mongod, like the other boundary suites.
 */
const TEST_URI = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mateo').replace(
  /\/[^/?]+(\?|$)/,
  '/mateo_appt_test$1',
);

let dbOk = false;
try {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2000 });
  dbOk = true;
} catch {
  dbOk = false;
}

process.env.DATA_ENCRYPTION_KEY ||= randomBytes(32).toString('base64');

const { DoctorAppointment } = await import('../models/DoctorAppointment.js');

const oid = () => new mongoose.Types.ObjectId();
const d = dbOk ? describe : describe.skip;

d('Appointment double-book guard (DB-backed)', () => {
  let doctor: mongoose.Types.ObjectId;
  const start = new Date('2027-05-01T04:00:00.000Z');

  beforeEach(async () => {
    await DoctorAppointment.deleteMany({});
    // The unique index only enforces once it is actually built.
    await DoctorAppointment.init();
    doctor = oid();
  });

  afterAll(async () => {
    if (dbOk) await mongoose.disconnect();
  });

  const make = (over = {}) =>
    new DoctorAppointment({ doctorUserId: doctor, patientId: oid(), start, durationMin: 30, status: 'scheduled', ...over });

  it('rejects a second SCHEDULED appointment at the same doctor+start (E11000)', async () => {
    await make().save();
    let code: number | undefined;
    try {
      await make({ patientId: oid() }).save();
    } catch (e) {
      code = (e as { code?: number }).code;
    }
    expect(code).toBe(11000);
    expect(await DoctorAppointment.countDocuments({ status: 'scheduled' })).toBe(1);
  });

  it('lets a fired-in-parallel burst settle to exactly one winner', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => make({ patientId: oid() }).save()),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1);
    expect(await DoctorAppointment.countDocuments({ status: 'scheduled' })).toBe(1);
  });

  it('allows a new scheduled slot once the old one is freed (cancelled)', async () => {
    const first = await make().save();
    first.status = 'cancelled';
    await first.save();
    // The freed slot can be rebooked — the partial index ignores non-scheduled rows.
    await expect(make({ patientId: oid() }).save()).resolves.toBeTruthy();
    expect(await DoctorAppointment.countDocuments({ status: 'scheduled' })).toBe(1);
  });
});
