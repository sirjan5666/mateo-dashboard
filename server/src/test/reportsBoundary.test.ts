import 'dotenv/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

/**
 * Reports & Analytics, against a real database.
 *
 * The page it feeds used to print design-reference placeholders (₹18,74,560 of
 * revenue, 2,486 patients, a fixed May-2025 series). These tests assert the
 * things that would let that happen again, or would be worse:
 *
 *  - the figures are the real counts for the requested window, and the daily
 *    series SUM to the period totals (a series of zeroes summing to zero used
 *    to satisfy the old contract);
 *  - the previous-window block is the equal-length window immediately before,
 *    so the deltas are measured and not invented;
 *  - no PHI leaves — service names are aggregated from ENCRYPTED invoice items,
 *    and no patient name, reason or symptom appears in the payload;
 *  - saved reports are tenant-scoped and their CSV snapshot is encrypted at rest.
 *
 * Skips gracefully with no mongod, exactly like ehrBoundary.test.ts.
 */
const TEST_URI = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mateo').replace(
  /\/[^/?]+(\?|$)/,
  '/mateo_reports_test$1',
);

let dbOk = false;
try {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2000 });
  dbOk = true;
} catch {
  dbOk = false;
}

process.env.DATA_ENCRYPTION_KEY ||= randomBytes(32).toString('base64');

const { Patient } = await import('../models/Patient.js');
const { Encounter } = await import('../models/Encounter.js');
const { DoctorAppointment } = await import('../models/DoctorAppointment.js');
const { Invoice } = await import('../models/Invoice.js');
const { ClinicLocation } = await import('../models/ClinicLocation.js');
const { SavedReport } = await import('../models/SavedReport.js');
const { SpecialtyTemplate } = await import('../models/SpecialtyTemplate.js');
const { isEncrypted } = await import('../lib/crypto/fieldCipher.js');
const { default: analyticsRouter } = await import('../routes/doctorAnalytics.js');

const oid = () => new mongoose.Types.ObjectId();
const DAY = 86_400_000;
const ago = (n: number) => new Date(Date.now() - n * DAY);

/** Mount the real router behind a stub that plays the practice owner. */
function appAs(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.userId = userId;
    next();
  });
  app.use('/api/doctor', analyticsRouter);
  return app;
}

async function call(
  app: express.Express,
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
) {
  const server = app.listen(0);
  try {
    const port = (server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/api/doctor${path}`, {
      method: init.method ?? 'GET',
      headers: { 'content-type': 'application/json' },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    return { status: res.status, json: (await res.json()) as Record<string, never> };
  } finally {
    await new Promise<void>((r) => server.close(() => { r(); }));
  }
}

const d = dbOk ? describe : describe.skip;

d('Reports & Analytics (DB-backed)', () => {
  let doctor: mongoose.Types.ObjectId;
  let other: mongoose.Types.ObjectId;
  let template: mongoose.Types.ObjectId;
  let patient: mongoose.Types.ObjectId;

  beforeEach(async () => {
    doctor = oid();
    other = oid();
    await Promise.all([
      Patient.deleteMany({}), Encounter.deleteMany({}), DoctorAppointment.deleteMany({}),
      Invoice.deleteMany({}), ClinicLocation.deleteMany({}), SavedReport.deleteMany({}),
      SpecialtyTemplate.deleteMany({}),
    ]);
    const tpl = await SpecialtyTemplate.create({
      specialization: 'test',
      name: 'Test',
      version: 1,
      fields: [{ key: 'chief_complaint', label: 'CC', type: 'text', order: 1 }],
      statuses: [{ key: 'active', label: 'Active', tone: 'sky', isDefault: true }],
    });
    template = tpl._id;

    // Two patients in the window, one older — so "new in window" (2) and the
    // live roster (3) are different numbers and cannot be confused.
    const inWindow = [];
    for (const [i, name] of ['Aarav Mehta', 'Myra Kapoor'].entries()) {
      const p = new Patient({
        doctorUserId: doctor, specialtyTemplateId: template, displayName: name,
        dob: '2025-04-10', sex: i === 0 ? 'male' : 'female', status: 'active',
      });
      p.set('createdAt', ago(5 + i));
      await p.save();
      inWindow.push(p);
    }
    const old = new Patient({
      doctorUserId: doctor, specialtyTemplateId: template, displayName: 'Ishan Rao',
      dob: '2020-01-01', sex: 'male', status: 'active',
    });
    old.set('createdAt', ago(120));
    await old.save();
    patient = inWindow[0]._id;

    const loc = await ClinicLocation.create({
      doctorUserId: doctor, name: 'Andheri Clinic', code: 'AND', addressLine: '1 Main Rd',
      city: 'Mumbai', state: 'MH', pincode: '400001', services: [], isPrimary: true, active: true,
    });

    // 3 appointments in the window, 1 in the previous window.
    for (const dd of [2, 4, 9]) {
      await DoctorAppointment.create({
        doctorUserId: doctor, patientId: patient, start: ago(dd), durationMin: 30,
        mode: 'in_person', status: 'completed', locationId: loc._id,
        reason: 'Persistent cough for four days',
      });
    }
    await DoctorAppointment.create({
      doctorUserId: doctor, patientId: patient, start: ago(40), durationMin: 30,
      mode: 'in_person', status: 'completed',
    });
    // 2 consultations in the window, 1 before it.
    for (const dd of [3, 6]) {
      await Encounter.create({ doctorUserId: doctor, patientId: patient, date: ago(dd), kind: 'visit', subjective: 'Cough' });
    }
    await Encounter.create({ doctorUserId: doctor, patientId: patient, date: ago(45), kind: 'visit' });

    // ₹900 collected in the window (600 + 300), ₹500 in the one before.
    await Invoice.create({
      doctorUserId: doctor, patientId: patient, number: 'INV-1', date: ago(3),
      itemsEnc: JSON.stringify([{ description: 'General Consultation', amount: 600 }, { description: 'Dressing', amount: 300 }]),
      total: 900, amountPaid: 900, status: 'paid', paidAt: ago(3),
    });
    await Invoice.create({
      doctorUserId: doctor, patientId: patient, number: 'INV-0', date: ago(42),
      itemsEnc: JSON.stringify([{ description: 'General Consultation', amount: 500 }]),
      total: 500, amountPaid: 500, status: 'paid', paidAt: ago(42),
    });
  });

  afterAll(async () => {
    // logAction is fire-and-forget; give an in-flight audit write a tick to land
    // before the connection goes, or it logs a spurious "client was closed".
    await new Promise((r) => setTimeout(r, 50));
    if (dbOk) await mongoose.disconnect();
  });

  describe('GET /analytics/report', () => {
    it('reports the real counts for the window, and only that window', async () => {
      const { status, json } = await call(appAs(doctor.toString()), '/analytics/report');
      expect(status).toBe(200);
      const r = json as unknown as {
        appointments: { total: number; byDay: { count: number }[]; byLocation: { label: string; count: number }[] };
        consultations: { total: number; byDay: { count: number }[] };
        patients: { newCount: number; totalActive: number };
        revenue: { total: number; byDay: { amount: number }[] };
      };
      expect(r.appointments.total).toBe(3); // the 40-days-ago one is out of range
      expect(r.consultations.total).toBe(2);
      expect(r.patients.newCount).toBe(2);
      expect(r.patients.totalActive).toBe(3); // the whole roster, not the window
      expect(r.revenue.total).toBe(900);
      expect(r.appointments.byLocation).toEqual([{ label: 'Andheri Clinic', count: 3 }]);
    });

    it('has daily series that SUM to the period totals', async () => {
      // The page plots these. They used to be hard zeroes, which summed to zero
      // and still "matched" a contract that only checked the shape.
      const { json } = await call(appAs(doctor.toString()), '/analytics/report');
      const r = json as unknown as {
        appointments: { total: number; byDay: { count: number }[] };
        consultations: { total: number; byDay: { count: number }[] };
        revenue: { total: number; byDay: { amount: number }[] };
      };
      const sum = (xs: { count: number }[]) => xs.reduce((t, x) => t + x.count, 0);
      expect(sum(r.appointments.byDay)).toBe(r.appointments.total);
      expect(sum(r.consultations.byDay)).toBe(r.consultations.total);
      expect(r.revenue.byDay.reduce((t, x) => t + x.amount, 0)).toBe(r.revenue.total);
      // One row per day of the default 30-day window, all three aligned.
      expect(r.revenue.byDay).toHaveLength(30);
      expect(r.appointments.byDay).toHaveLength(30);
      expect(r.consultations.byDay).toHaveLength(30);
    });

    it('measures the previous window instead of inventing a delta', async () => {
      const { json } = await call(appAs(doctor.toString()), '/analytics/report');
      const r = json as unknown as { range: { from: string; to: string }; previous: { from: string; to: string; revenueTotal: number; appointments: number; consultations: number } };
      expect(r.previous.appointments).toBe(1);
      expect(r.previous.consultations).toBe(1);
      expect(r.previous.revenueTotal).toBe(500);
      // Immediately before the window, and it ends where the window begins.
      expect(r.previous.to < r.range.from).toBe(true);
    });

    it('aggregates services out of the encrypted line items, without a patient attached', async () => {
      const { json } = await call(appAs(doctor.toString()), '/analytics/report');
      const r = json as unknown as { services: { label: string; count: number; amount: number }[] };
      expect(r.services).toEqual(
        expect.arrayContaining([
          { label: 'General Consultation', count: 1, amount: 600 },
          { label: 'Dressing', count: 1, amount: 300 },
        ]),
      );
      // The previous window's invoice must not be counted in.
      expect(r.services.find((s) => s.label === 'General Consultation')?.amount).toBe(600);
    });

    it('leaks no PHI', async () => {
      const { json } = await call(appAs(doctor.toString()), '/analytics/report');
      const blob = JSON.stringify(json);
      for (const phi of ['Aarav', 'Myra', 'Ishan', 'Persistent cough', 'Cough', '2025-04-10']) {
        expect(blob).not.toContain(phi);
      }
    });

    it('is scoped to the caller — another practice sees its own emptiness', async () => {
      const { json } = await call(appAs(other.toString()), '/analytics/report');
      const r = json as unknown as {
        appointments: { total: number; byLocation: unknown[] };
        patients: { totalActive: number };
        revenue: { total: number };
        services: unknown[];
      };
      expect(r.appointments.total).toBe(0);
      expect(r.patients.totalActive).toBe(0);
      expect(r.revenue.total).toBe(0);
      expect(r.services).toEqual([]);
      expect(r.appointments.byLocation).toEqual([]);
    });

    it('honours an explicit range', async () => {
      const iso = (dd: number) => ago(dd).toISOString().slice(0, 10);
      // A 3-day window that contains only the appointment from 2 days ago.
      const { json } = await call(appAs(doctor.toString()), `/analytics/report?from=${iso(2)}&to=${iso(0)}`);
      const r = json as unknown as { appointments: { total: number }; consultations: { total: number } };
      expect(r.appointments.total).toBe(1);
      expect(r.consultations.total).toBe(0);
    });
  });

  describe('saved reports', () => {
    const body = { name: 'Practice summary', type: 'summary' as const, from: '2026-08-20', to: '2026-09-18', csv: 'Metric,Value\r\n"Total Appointments","3"' };

    it('records an export and hands the same snapshot back', async () => {
      const app = appAs(doctor.toString());
      const created = await call(app, '/analytics/reports/saved', { method: 'POST', body });
      expect(created.status).toBe(201);
      const id = (created.json as unknown as { id: string }).id;

      const listed = await call(app, '/analytics/reports/saved');
      expect((listed.json as unknown as { reports: { id: string }[] }).reports.map((x) => x.id)).toEqual([id]);

      const one = await call(app, `/analytics/reports/saved/${id}`);
      // The stored CSV, not a fresh run of the range — the figures must not drift.
      expect((one.json as unknown as { csv: string }).csv).toBe(body.csv);
    });

    it('encrypts the snapshot at rest', async () => {
      await call(appAs(doctor.toString()), '/analytics/reports/saved', { method: 'POST', body });
      const raw = await mongoose.connection.db!.collection('savedreports').findOne({});
      expect(isEncrypted(String(raw?.csvEnc))).toBe(true);
      expect(String(raw?.csvEnc)).not.toContain('Total Appointments');
    });

    it('cannot be read across practices', async () => {
      const created = await call(appAs(doctor.toString()), '/analytics/reports/saved', { method: 'POST', body });
      const id = (created.json as unknown as { id: string }).id;

      const asOther = appAs(other.toString());
      expect((await call(asOther, `/analytics/reports/saved/${id}`)).status).toBe(404);
      expect((await call(asOther, '/analytics/reports/saved')).json).toEqual({ reports: [] });
    });

    it('404s a malformed id rather than throwing a cast error', async () => {
      expect((await call(appAs(doctor.toString()), '/analytics/reports/saved/not-an-id')).status).toBe(404);
    });

    it('swaps a reversed range rather than storing it backwards', async () => {
      const created = await call(appAs(doctor.toString()), '/analytics/reports/saved', {
        method: 'POST',
        body: { ...body, from: '2026-09-18', to: '2026-08-20' },
      });
      expect(created.json as unknown as { from: string; to: string }).toMatchObject({ from: '2026-08-20', to: '2026-09-18' });
    });
  });
});
