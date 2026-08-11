import 'dotenv/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

/**
 * Clinic Settings persistence.
 *
 * The bug this guards against: spreading a Mongoose SUBDOCUMENT (`{ ...profile
 * .preferences }`) copies its internal document keys, not its field values, so
 * every saved preference silently collapsed back to the default. It typechecked
 * and returned 200 — only reading the value back catches it.
 *
 * Skips gracefully with no mongod, like the other boundary suites.
 */
const TEST_URI = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mateo').replace(
  /\/[^/?]+(\?|$)/,
  '/mateo_settings_test$1',
);

let dbOk = false;
try {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2000 });
  dbOk = true;
} catch {
  dbOk = false;
}

process.env.DATA_ENCRYPTION_KEY ||= randomBytes(32).toString('base64');

const { DoctorProfile } = await import('../models/DoctorProfile.js');
const { default: settingsRouter } = await import('../routes/doctorSettings.js');

const oid = () => new mongoose.Types.ObjectId();

/** Mount the real settings router behind a stub that plays the practice owner. */
function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.userId = userId;
    next();
  });
  app.use('/api/doctor', settingsRouter);
  return app;
}

async function call(app: express.Express, method: 'GET' | 'PUT', body?: unknown) {
  const server = app.listen(0);
  try {
    const port = (server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/api/doctor/settings`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  } finally {
    await new Promise<void>((r) => server.close(() => { r(); }));
  }
}

const d = dbOk ? describe : describe.skip;

d('Clinic settings persistence (DB-backed)', () => {
  let doctor: string;

  beforeEach(async () => {
    await DoctorProfile.deleteMany({});
    doctor = oid().toString();
  });

  afterAll(async () => {
    if (dbOk) await mongoose.disconnect();
  });

  it('returns defaults for a practice that has never saved settings', async () => {
    const { status, json } = await call(appAs(doctor), 'GET');
    expect(status).toBe(200);
    const prefs = json.preferences as Record<string, unknown>;
    expect(prefs.defaultPage).toBe('dashboard');
    expect(prefs.sessionTimeoutMins).toBe(30);
  });

  it('persists a saved preference and reads it back — not the default', async () => {
    const app = appAs(doctor);
    const put = await call(app, 'PUT', { preferences: { defaultPage: 'patients', sessionTimeoutMins: 60 } });
    expect((put.json.preferences as Record<string, unknown>).defaultPage).toBe('patients');

    // The real regression: a SECOND, independent read must still see it.
    const get = await call(app, 'GET');
    const prefs = get.json.preferences as Record<string, unknown>;
    expect(prefs.defaultPage).toBe('patients');
    expect(prefs.sessionTimeoutMins).toBe(60);
  });

  it('merges a partial update over stored values rather than resetting them', async () => {
    const app = appAs(doctor);
    await call(app, 'PUT', { preferences: { defaultPage: 'patients', dataBackup: false } });
    // A later edit that names only one field must leave the others intact.
    await call(app, 'PUT', { preferences: { defaultPage: 'appointments' } });

    const prefs = (await call(app, 'GET')).json.preferences as Record<string, unknown>;
    expect(prefs.defaultPage).toBe('appointments');
    expect(prefs.dataBackup).toBe(false); // preserved, not reset to the default (true)
  });

  it('saves working hours', async () => {
    const app = appAs(doctor);
    const hours = {
      monday: { start: '10:00', end: '19:00', closed: false },
      tuesday: { start: '09:00', end: '18:00', closed: false },
      wednesday: { start: '09:00', end: '18:00', closed: false },
      thursday: { start: '09:00', end: '18:00', closed: false },
      friday: { start: '09:00', end: '18:00', closed: false },
      saturday: { start: '09:00', end: '14:00', closed: false },
      sunday: { start: '09:00', end: '18:00', closed: true },
    };
    await call(app, 'PUT', { workingHours: hours });
    const wh = (await call(app, 'GET')).json.workingHours as Record<string, { start: string; closed: boolean }>;
    expect(wh.monday.start).toBe('10:00');
    expect(wh.sunday.closed).toBe(true);
  });
});
