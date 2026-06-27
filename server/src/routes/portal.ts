import { Router } from 'express';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { auditAccess, recordAudit } from '../middleware/audit.js';
import { loadMyPatient } from '../middleware/loadMyPatient.js';
import { CareMessage } from '../models/CareMessage.js';
import type { IPatient } from '../models/Patient.js';
import { PatientRecord } from '../models/PatientRecord.js';
import { SpecialtyTemplate } from '../models/SpecialtyTemplate.js';
import { Encounter } from '../models/Encounter.js';
import { DoctorAppointment } from '../models/DoctorAppointment.js';
import { DoctorPrescription } from '../models/DoctorPrescription.js';
import { User } from '../models/User.js';
import { decryptField, decryptOptional } from '../lib/crypto/fieldCipher.js';
import { decryptSensitiveFields } from '../records/recordCrypto.js';
import type { FieldDefinition } from '../records/types.js';

// The PATIENT portal: read-only access to the patient's OWN record. Every route is
// patient-role-gated, audited, and scoped to req.myPatient (loaded by patientUserId).
const router = Router();
router.use(requireAuth, requireRole('patient'), auditAccess('portal'), loadMyPatient);

function myId(req: { myPatient?: HydratedDocument<IPatient> }) {
  return (req.myPatient as HydratedDocument<IPatient>)._id;
}

// GET /api/portal/me — own demographics + record + who my doctor is.
router.get('/me', async (req, res) => {
  const patient = req.myPatient as HydratedDocument<IPatient>;
  const [template, record, doctor] = await Promise.all([
    SpecialtyTemplate.findById(patient.specialtyTemplateId),
    PatientRecord.findOne({ patientId: patient._id }),
    User.findById(patient.doctorUserId).select('name'),
  ]);
  let fields: Record<string, unknown> = {};
  if (record && template) {
    const values = new Map<string, unknown>(record.fields as Map<string, unknown>);
    decryptSensitiveFields(template.fields as unknown as FieldDefinition[], values);
    fields = Object.fromEntries(values);
  }
  res.json({
    patient: {
      id: patient._id,
      displayName: decryptField(patient.displayName),
      dob: decryptOptional(patient.dob || undefined) ?? null,
      sex: patient.sex,
      phone: decryptOptional(patient.phone || undefined) ?? null,
      status: patient.status,
    },
    doctor: doctor ? { name: doctor.name } : null,
    template: template ? { name: template.name, fields: template.fields, statuses: template.statuses } : null,
    record: record && template ? { status: record.status, tags: record.tags, fields, updatedAt: record.updatedAt } : null,
  });
});

// GET /api/portal/encounters — own visit notes (newest first).
router.get('/encounters', async (req, res) => {
  const list = await Encounter.find({ patientId: myId(req) }).sort({ date: -1 });
  res.json({
    encounters: list.map((e) => ({
      id: e._id,
      date: e.date,
      kind: e.kind,
      subjective: decryptOptional(e.subjective || undefined) ?? null,
      objective: decryptOptional(e.objective || undefined) ?? null,
      assessment: decryptOptional(e.assessment || undefined) ?? null,
      plan: decryptOptional(e.plan || undefined) ?? null,
    })),
  });
});

// GET /api/portal/prescriptions — own medications.
router.get('/prescriptions', async (req, res) => {
  const list = await DoctorPrescription.find({ patientId: myId(req) }).sort({ date: -1 });
  res.json({
    prescriptions: list.map((p) => ({
      id: p._id,
      date: p.date,
      drug: decryptField(p.drug),
      dose: decryptOptional(p.dose || undefined) ?? null,
      frequency: decryptOptional(p.frequency || undefined) ?? null,
      duration: decryptOptional(p.duration || undefined) ?? null,
      instructions: decryptOptional(p.instructions || undefined) ?? null,
      status: p.status,
    })),
  });
});

// GET /api/portal/appointments — own appointments.
router.get('/appointments', async (req, res) => {
  const list = await DoctorAppointment.find({ patientId: myId(req) }).sort({ start: -1 });
  res.json({
    appointments: list.map((a) => ({
      id: a._id,
      start: a.start,
      durationMin: a.durationMin,
      mode: a.mode,
      status: a.status,
      reason: decryptOptional(a.reason || undefined) ?? null,
    })),
  });
});

// GET /api/portal/messages — the care thread (marks the doctor's messages read).
router.get('/messages', async (req, res) => {
  const patient = req.myPatient as HydratedDocument<IPatient>;
  await CareMessage.updateMany(
    { patientId: patient._id, senderRole: 'doctor', readByPatientAt: { $exists: false } },
    { $set: { readByPatientAt: new Date() } },
  );
  const list = await CareMessage.find({ patientId: patient._id }).sort({ createdAt: 1 });
  res.json({
    messages: list.map((m) => ({ id: m._id, senderRole: m.senderRole, body: decryptField(m.body), mine: m.senderRole === 'patient', createdAt: m.createdAt })),
  });
});

// GET /api/portal/notifications — unread (doctor-sent) message count.
router.get('/notifications', async (req, res) => {
  const total = await CareMessage.countDocuments({ patientId: myId(req), senderRole: 'doctor', readByPatientAt: { $exists: false } });
  res.json({ messages: { total } });
});

// POST /api/portal/messages — patient sends a message to their doctor.
router.post('/messages', async (req, res) => {
  const patient = req.myPatient as HydratedDocument<IPatient>;
  const { body } = z.object({ body: z.string().min(1).max(4000) }).parse(req.body);
  const msg = new CareMessage({
    doctorUserId: patient.doctorUserId,
    patientId: patient._id,
    senderRole: 'patient',
    senderUserId: req.userId,
    body,
    readByPatientAt: new Date(),
  });
  await msg.save();
  await recordAudit(req, { action: 'create', resourceType: 'message', resourceId: msg._id, patientId: patient._id, outcome: 'allow' });
  res.status(201).json({ message: { id: msg._id, senderRole: msg.senderRole, body: decryptField(msg.body), mine: true, createdAt: msg.createdAt } });
});

export default router;
