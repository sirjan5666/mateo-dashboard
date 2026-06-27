import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loadOwnedPatient, scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { auditAccess, recordAudit } from '../middleware/audit.js';
import { requireConsent } from '../middleware/requireConsent.js';
import { DoctorPrescription, RX_STATUSES } from '../models/DoctorPrescription.js';
import type { IDoctorPrescription } from '../models/DoctorPrescription.js';
import { decryptField, decryptOptional } from '../lib/crypto/fieldCipher.js';
import type { IPatient } from '../models/Patient.js';

// Prescriptions (one medication per row). Doctor-role-gated + tenant-scoped; the
// medication free-text is decrypted only in the shaper. Writes require treatment consent.
const router = Router();
router.use(requireAuth, requireRole('doctor'));

function publicRx(p: HydratedDocument<IDoctorPrescription>) {
  return {
    id: p._id,
    patientId: p.patientId,
    encounterId: p.encounterId ?? null,
    date: p.date,
    drug: decryptField(p.drug),
    dose: decryptOptional(p.dose || undefined) ?? null,
    frequency: decryptOptional(p.frequency || undefined) ?? null,
    duration: decryptOptional(p.duration || undefined) ?? null,
    instructions: decryptOptional(p.instructions || undefined) ?? null,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

const rxShape = {
  drug: z.string().min(1).max(200),
  dose: z.string().max(120).optional(),
  frequency: z.string().max(120).optional(),
  duration: z.string().max(120).optional(),
  instructions: z.string().max(2000).optional(),
  date: z.string().min(1).max(40).optional(),
  status: z.enum(RX_STATUSES).optional(),
};
const createSchema = z.object(rxShape);
const updateSchema = z.object({ ...rxShape, drug: z.string().min(1).max(200).optional() });

const OPTIONAL_RX_FIELDS = ['dose', 'frequency', 'duration', 'instructions'] as const;

// GET /api/doctor/patients/:id/prescriptions — newest-first medication list.
router.get('/patients/:id/prescriptions', auditAccess('prescription'), loadOwnedPatient, async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const list = await DoctorPrescription.find(scopeToDoctor(req, { patientId: patient._id })).sort({ date: -1 });
  res.json({ prescriptions: list.map(publicRx) });
});

// POST /api/doctor/patients/:id/prescriptions — prescribe a medication.
router.post('/patients/:id/prescriptions', loadOwnedPatient, requireConsent('treatment'), async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const body = createSchema.parse(req.body);
  const rx = new DoctorPrescription({
    doctorUserId: req.userId,
    patientId: patient._id,
    date: body.date ? new Date(body.date) : new Date(),
    drug: body.drug,
    dose: body.dose || undefined,
    frequency: body.frequency || undefined,
    duration: body.duration || undefined,
    instructions: body.instructions || undefined,
    status: body.status ?? 'active',
  });
  await rx.save();
  await recordAudit(req, {
    action: 'create',
    resourceType: 'prescription',
    resourceId: rx._id,
    patientId: patient._id,
    changedFields: ['drug', 'status', ...OPTIONAL_RX_FIELDS.filter((k) => body[k] !== undefined)],
    outcome: 'allow',
  });
  res.status(201).json({ prescription: publicRx(rx) });
});

// PATCH /api/doctor/prescriptions/:prescriptionId — edit / change status (e.g. stop).
router.patch('/prescriptions/:prescriptionId', async (req, res) => {
  const { prescriptionId } = req.params;
  const rx = isValidObjectId(prescriptionId)
    ? await DoctorPrescription.findOne(scopeToDoctor(req, { _id: prescriptionId }))
    : null;
  if (!rx) {
    res.status(404).json({ error: 'Prescription not found' });
    return;
  }
  const body = updateSchema.parse(req.body);
  const changed: string[] = [];
  if (body.date !== undefined) {
    rx.date = new Date(body.date);
    changed.push('date');
  }
  if (body.status !== undefined) {
    rx.status = body.status;
    changed.push('status');
  }
  if (body.drug !== undefined) {
    rx.drug = body.drug; // required field — zod guarantees non-empty
    changed.push('drug');
  }
  for (const k of OPTIONAL_RX_FIELDS) {
    if (body[k] !== undefined) {
      rx[k] = body[k] || undefined; // '' clears (never store empty in an encrypted path)
      changed.push(k);
    }
  }
  await rx.save();
  await recordAudit(req, {
    action: 'update',
    resourceType: 'prescription',
    resourceId: rx._id,
    patientId: rx.patientId,
    changedFields: changed,
    outcome: 'allow',
  });
  res.json({ prescription: publicRx(rx) });
});

export default router;
