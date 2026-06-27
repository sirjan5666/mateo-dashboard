import 'dotenv/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// Boundary / security tests for the doctor-EHR domain. These need a real MongoDB
// (to exercise indexes, the encryption pre-save hook, append-only guards, and the
// tenancy queries). They run against a DEDICATED local test database and SKIP
// gracefully if no mongod is reachable — so the pure unit suite still passes in
// any environment (CI without Mongo, etc.). Run locally with mongod up to exercise.

process.env.DATA_ENCRYPTION_KEY ||= randomBytes(32).toString('base64');

const TEST_URI = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mateo').replace(
  /\/[^/?]+(\?|$)/,
  '/mateo_ehr_test$1',
);

let dbOk = false;
try {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 2000 });
  dbOk = true;
} catch {
  dbOk = false;
}

// Imported after the key is set; models read the key lazily on save.
const { Patient } = await import('../models/Patient.js');
const { PatientRecord } = await import('../models/PatientRecord.js');
const { Encounter } = await import('../models/Encounter.js');
const { DoctorAppointment } = await import('../models/DoctorAppointment.js');
const { DoctorPrescription } = await import('../models/DoctorPrescription.js');
const { CareMessage } = await import('../models/CareMessage.js');
const { SpecialtyTemplate } = await import('../models/SpecialtyTemplate.js');
const { ConsentRecord } = await import('../models/ConsentRecord.js');
const { AuditLog } = await import('../models/AuditLog.js');
const { User } = await import('../models/User.js');
const { loadOwnedPatient, loadOwnedRecord } = await import('../middleware/loadOwnedPatient.js');
const { loadMyPatient } = await import('../middleware/loadMyPatient.js');
const { requireConsent } = await import('../middleware/requireConsent.js');
const { writePatientRecord } = await import('../records/writePatientRecord.js');
const { decryptSensitiveFields } = await import('../records/recordCrypto.js');
const { isEncrypted } = await import('../lib/crypto/fieldCipher.js');
const { eraseUserData } = await import('../lib/eraseUser.js');

// ---- tiny express test doubles ---------------------------------------------
function fakeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(b: unknown) {
      res.body = b;
      return res;
    },
  };
  return res;
}
function fakeReq(init: Partial<Request>): Request {
  return { params: {}, ...init } as unknown as Request;
}
async function runMw(
  mw: (req: Request, res: Response, next: NextFunction) => unknown,
  req: Request,
) {
  const res = fakeRes();
  let nexted = false;
  await mw(req, res as unknown as Response, (() => {
    nexted = true;
  }) as NextFunction);
  return { res, nexted };
}

async function makeTemplate(ownerUserId?: mongoose.Types.ObjectId) {
  return SpecialtyTemplate.create({
    ...(ownerUserId ? { ownerUserId } : {}),
    specialization: 'test',
    name: 'Test',
    version: 1,
    fields: [
      { key: 'chief_complaint', label: 'CC', type: 'text', searchable: true, order: 1 },
      { key: 'allergies', label: 'Allergies', type: 'textarea', sensitive: true, order: 2 },
    ],
    statuses: [{ key: 'active', label: 'Active', tone: 'sky', isDefault: true }],
    historyTags: [{ key: 'preterm', label: 'Preterm', color: 'violet' }],
  });
}

function makePatient(doctorUserId: mongoose.Types.ObjectId, templateId: mongoose.Types.ObjectId) {
  return Patient.create({
    doctorUserId,
    specialtyTemplateId: templateId,
    displayName: 'Riya Sharma',
    phone: '9999999999',
    status: 'active',
  });
}

afterAll(async () => {
  if (dbOk) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

describe.skipIf(!dbOk)('EHR boundary (DB-backed)', () => {
  beforeEach(async () => {
    // Raw driver clears bypass the append-only guards on AuditLog/ConsentRecord.
    await Promise.all(
      [Patient, PatientRecord, Encounter, DoctorAppointment, DoctorPrescription, CareMessage, SpecialtyTemplate, ConsentRecord, AuditLog, User].map(
        (m) => m.collection.deleteMany({}),
      ),
    );
  });

  describe('tenancy: Doctor A vs Doctor B', () => {
    it('loadOwnedPatient: 403 for another doctor, 200 for the owner', async () => {
      const docA = new mongoose.Types.ObjectId();
      const docB = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);

      const denied = await runMw(loadOwnedPatient, fakeReq({ userId: docB.toString(), params: { id: patient.id } }));
      expect(denied.res.statusCode).toBe(403);
      expect(denied.nexted).toBe(false);

      const ok = await runMw(loadOwnedPatient, fakeReq({ userId: docA.toString(), params: { id: patient.id } }));
      expect(ok.nexted).toBe(true);
      expect(ok.res.statusCode).toBe(0);
    });

    it('loadOwnedRecord: a foreign record is 404 (never loaded), the owner gets it', async () => {
      const docA = new mongoose.Types.ObjectId();
      const docB = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);
      const { record } = await writePatientRecord(patient, tpl, { fields: { chief_complaint: 'fever' }, status: 'active', tags: [] });

      const foreign = await runMw(loadOwnedRecord, fakeReq({ userId: docB.toString(), params: { id: record.id } }));
      expect(foreign.res.statusCode).toBe(404);

      const mine = await runMw(loadOwnedRecord, fakeReq({ userId: docA.toString(), params: { id: record.id } }));
      expect(mine.nexted).toBe(true);
    });
  });

  describe('patient portal tenancy', () => {
    it('loadMyPatient returns ONLY the caller’s own bound record', async () => {
      const doc = new mongoose.Types.ObjectId();
      const userA = new mongoose.Types.ObjectId();
      const userB = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const pA = await Patient.create({ doctorUserId: doc, patientUserId: userA, specialtyTemplateId: tpl._id, displayName: 'A', status: 'active' });
      const pB = await Patient.create({ doctorUserId: doc, patientUserId: userB, specialtyTemplateId: tpl._id, displayName: 'B', status: 'active' });

      const reqA = fakeReq({ userId: userA.toString() });
      const a = await runMw(loadMyPatient, reqA);
      expect(a.nexted).toBe(true);
      const loadedA = (reqA as unknown as { myPatient?: { _id: { toString(): string } } }).myPatient;
      expect(loadedA?._id.toString()).toBe(pA._id.toString());

      const reqB = fakeReq({ userId: userB.toString() });
      await runMw(loadMyPatient, reqB);
      const loadedB = (reqB as unknown as { myPatient?: { _id: { toString(): string } } }).myPatient;
      expect(loadedB?._id.toString()).toBe(pB._id.toString());
    });

    it('a user with no bound patient gets 404 (no record leaks)', async () => {
      const orphan = await runMw(loadMyPatient, fakeReq({ userId: new mongoose.Types.ObjectId().toString() }));
      expect(orphan.res.statusCode).toBe(404);
    });
  });

  describe('encryption at rest', () => {
    it('patient PHI is ciphertext in Mongo, plaintext only via the model', async () => {
      const docA = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);

      const raw = await Patient.collection.findOne({ _id: patient._id });
      expect(isEncrypted(raw?.displayName)).toBe(true);
      expect(isEncrypted(raw?.phone)).toBe(true);
      expect(String(raw?.displayName)).not.toContain('Riya');
    });

    it('writePatientRecord encrypts sensitive fields and keeps searchText non-PHI', async () => {
      const docA = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);
      await writePatientRecord(patient, tpl, { fields: { chief_complaint: 'cough', allergies: 'penicillin' }, status: 'active', tags: ['preterm'] });

      const raw = await PatientRecord.collection.findOne({ patientId: patient._id });
      const fields = (raw?.fields ?? {}) as Record<string, unknown>;
      expect(isEncrypted(fields.allergies)).toBe(true); // sensitive → encrypted
      expect(fields.chief_complaint).toBe('cough'); // non-sensitive → plaintext
      expect(raw?.searchText).toContain('cough'); // searchable field
      expect(raw?.searchText).not.toContain('penicillin'); // sensitive never in the index

      const decrypted = new Map<string, unknown>(Object.entries(fields));
      decryptSensitiveFields(tpl.fields, decrypted);
      expect(decrypted.get('allergies')).toBe('penicillin');
    });
  });

  describe('clinical encounters', () => {
    it('SOAP narrative is encrypted at rest, decrypts via the model', async () => {
      const docA = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);
      const e = await Encounter.create({ doctorUserId: docA, patientId: patient._id, date: new Date(), kind: 'visit', subjective: 'reports fever for 3 days', plan: 'paracetamol, review in 48h' });

      const raw = await Encounter.collection.findOne({ _id: e._id });
      expect(isEncrypted(raw?.subjective)).toBe(true);
      expect(isEncrypted(raw?.plan)).toBe(true);
      expect(String(raw?.subjective)).not.toContain('fever');

      const reloaded = await Encounter.findById(e._id);
      const { decryptOptional } = await import('../lib/crypto/fieldCipher.js');
      expect(decryptOptional(reloaded?.subjective)).toBe('reports fever for 3 days');
    });

    it('encounters are tenant-scoped (Doctor B sees none of Doctor A’s)', async () => {
      const docA = new mongoose.Types.ObjectId();
      const docB = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);
      await Encounter.create({ doctorUserId: docA, patientId: patient._id, date: new Date(), kind: 'visit', subjective: 'x' });
      expect(await Encounter.countDocuments({ doctorUserId: docB })).toBe(0);
      expect(await Encounter.countDocuments({ doctorUserId: docA })).toBe(1);
    });
  });

  describe('appointments', () => {
    it('reason is encrypted at rest and appointments are tenant-scoped', async () => {
      const docA = new mongoose.Types.ObjectId();
      const docB = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);
      const appt = await DoctorAppointment.create({ doctorUserId: docA, patientId: patient._id, start: new Date(), reason: 'fever follow-up' });

      const raw = await DoctorAppointment.collection.findOne({ _id: appt._id });
      expect(isEncrypted(raw?.reason)).toBe(true);
      expect(String(raw?.reason)).not.toContain('fever');

      expect(await DoctorAppointment.countDocuments({ doctorUserId: docB })).toBe(0);
      expect(await DoctorAppointment.countDocuments({ doctorUserId: docA })).toBe(1);
    });
  });

  describe('prescriptions', () => {
    it('the drug name is encrypted at rest and prescriptions are tenant-scoped', async () => {
      const docA = new mongoose.Types.ObjectId();
      const docB = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);
      const rx = await DoctorPrescription.create({ doctorUserId: docA, patientId: patient._id, date: new Date(), drug: 'Amoxicillin 250mg', dose: '5 ml', frequency: 'Thrice daily', status: 'active' });

      const raw = await DoctorPrescription.collection.findOne({ _id: rx._id });
      expect(isEncrypted(raw?.drug)).toBe(true);
      expect(isEncrypted(raw?.frequency)).toBe(true);
      expect(String(raw?.drug)).not.toContain('Amoxicillin');

      expect(await DoctorPrescription.countDocuments({ doctorUserId: docB })).toBe(0);
      expect(await DoctorPrescription.countDocuments({ doctorUserId: docA })).toBe(1);
    });
  });

  describe('care messages', () => {
    it('message body is encrypted at rest and threads are tenant-scoped', async () => {
      const docA = new mongoose.Types.ObjectId();
      const docB = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);
      const m = await CareMessage.create({ doctorUserId: docA, patientId: patient._id, senderRole: 'doctor', senderUserId: docA, body: 'Please book a follow-up next week' });

      const raw = await CareMessage.collection.findOne({ _id: m._id });
      expect(isEncrypted(raw?.body)).toBe(true);
      expect(String(raw?.body)).not.toContain('follow-up');

      expect(await CareMessage.countDocuments({ doctorUserId: docB })).toBe(0);
      expect(await CareMessage.countDocuments({ doctorUserId: docA })).toBe(1);
    });
  });

  describe('consent gate', () => {
    it('blocks without consent, allows after a grant', async () => {
      const docA = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);
      const req = fakeReq({ userId: docA.toString(), patient });

      const blocked = await runMw(requireConsent('record_storage'), req);
      expect(blocked.res.statusCode).toBe(403);

      await ConsentRecord.create({ patientId: patient._id, doctorUserId: docA, purpose: 'record_storage', status: 'granted', policyVersion: 'v1' });
      const allowed = await runMw(requireConsent('record_storage'), fakeReq({ userId: docA.toString(), patient }));
      expect(allowed.nexted).toBe(true);
    });

    it('fails closed on a same-instant withdrawal (withdrawal wins the tie)', async () => {
      const docA = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);
      const at = new Date();
      // Raw insert so both rows share an identical `at` timestamp.
      await ConsentRecord.collection.insertMany([
        { patientId: patient._id, doctorUserId: docA, purpose: 'record_storage', status: 'granted', policyVersion: 'v1', at },
        { patientId: patient._id, doctorUserId: docA, purpose: 'record_storage', status: 'withdrawn', policyVersion: 'v1', at },
      ]);
      const res = await runMw(requireConsent('record_storage'), fakeReq({ userId: docA.toString(), patient }));
      expect(res.res.statusCode).toBe(403);
    });
  });

  describe('append-only + write guards', () => {
    it('AuditLog rejects update/delete but allows create', async () => {
      await expect(AuditLog.create({ action: 'read', resourceType: 'patient', outcome: 'allow' })).resolves.toBeTruthy();
      await expect(AuditLog.updateOne({}, { $set: { outcome: 'deny' } })).rejects.toThrow();
      await expect(AuditLog.deleteMany({})).rejects.toThrow();
    });

    it('ConsentRecord rejects a mutating update but allows $unset + delete (for erasure)', async () => {
      const docA = new mongoose.Types.ObjectId();
      const c = await ConsentRecord.create({ patientId: new mongoose.Types.ObjectId(), doctorUserId: docA, purpose: 'treatment', status: 'granted', policyVersion: 'v1', grantedIp: '1.2.3.4' });
      await expect(ConsentRecord.updateOne({ _id: c._id }, { $set: { status: 'withdrawn' } })).rejects.toThrow();
      await expect(ConsentRecord.updateOne({ _id: c._id }, { $unset: { grantedIp: '' } })).resolves.toBeTruthy();
      await expect(ConsentRecord.deleteMany({ _id: c._id })).resolves.toBeTruthy();
    });

    it('encrypted Patient fields cannot be written via an update operator', async () => {
      const docA = new mongoose.Types.ObjectId();
      const tpl = await makeTemplate();
      const patient = await makePatient(docA, tpl._id);
      await expect(Patient.updateOne({ _id: patient._id }, { $set: { displayName: 'Hacker' } })).rejects.toThrow();
      await expect(Patient.updateOne({ _id: patient._id }, { $set: { status: 'active' } })).resolves.toBeTruthy();
      await expect(Patient.updateOne({ _id: patient._id }, { $unset: { phone: '' } })).resolves.toBeTruthy();
    });

    it('a template field cannot be both sensitive and searchable', async () => {
      await expect(
        SpecialtyTemplate.create({
          specialization: 'bad',
          name: 'Bad',
          fields: [{ key: 'ssn', label: 'SSN', type: 'text', sensitive: true, searchable: true }],
          statuses: [{ key: 'active', label: 'Active', isDefault: true }],
          historyTags: [],
        }),
      ).rejects.toThrow();
    });
  });

  describe('right-to-erasure', () => {
    it('erases the doctor-owned patient/record/consent but retains the audit trail', async () => {
      const doc = await User.create({ email: `d${Date.now()}@x.test`, name: 'Doc', passwordHash: 'x', role: 'doctor', consentAcceptedAt: new Date() });
      const tpl = await makeTemplate(doc._id);
      const patient = await makePatient(doc._id, tpl._id);
      await writePatientRecord(patient, tpl, { fields: { chief_complaint: 'fever' }, status: 'active', tags: [] });
      await Encounter.create({ doctorUserId: doc._id, patientId: patient._id, date: new Date(), kind: 'visit', subjective: 'fever' });
      await DoctorAppointment.create({ doctorUserId: doc._id, patientId: patient._id, start: new Date(), reason: 'review' });
      await DoctorPrescription.create({ doctorUserId: doc._id, patientId: patient._id, date: new Date(), drug: 'Paracetamol' });
      await CareMessage.create({ doctorUserId: doc._id, patientId: patient._id, senderRole: 'doctor', senderUserId: doc._id, body: 'hello' });
      await ConsentRecord.create({ patientId: patient._id, doctorUserId: doc._id, purpose: 'record_storage', status: 'granted', policyVersion: 'v1' });
      await AuditLog.create({ action: 'create', resourceType: 'patient', doctorUserId: doc._id, patientId: patient._id, outcome: 'allow' });

      await eraseUserData(doc.id);

      expect(await Patient.countDocuments({ doctorUserId: doc._id })).toBe(0);
      expect(await PatientRecord.countDocuments({ doctorUserId: doc._id })).toBe(0);
      expect(await Encounter.countDocuments({ doctorUserId: doc._id })).toBe(0);
      expect(await DoctorAppointment.countDocuments({ doctorUserId: doc._id })).toBe(0);
      expect(await DoctorPrescription.countDocuments({ doctorUserId: doc._id })).toBe(0);
      expect(await CareMessage.countDocuments({ doctorUserId: doc._id })).toBe(0);
      expect(await ConsentRecord.countDocuments({ doctorUserId: doc._id })).toBe(0);
      expect(await SpecialtyTemplate.countDocuments({ ownerUserId: doc._id })).toBe(0);
      // AuditLog is retained for accountability.
      expect(await AuditLog.countDocuments({ doctorUserId: doc._id })).toBeGreaterThan(0);
    });
  });
});
