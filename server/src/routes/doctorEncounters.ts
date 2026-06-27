import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loadOwnedPatient, scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { auditAccess, recordAudit } from '../middleware/audit.js';
import { requireConsent } from '../middleware/requireConsent.js';
import { Encounter, ENCOUNTER_KINDS } from '../models/Encounter.js';
import type { IEncounter } from '../models/Encounter.js';
import { decryptOptional } from '../lib/crypto/fieldCipher.js';
import type { IPatient } from '../models/Patient.js';

// Clinical encounters (SOAP visit notes). Doctor-role-gated + tenant-scoped. SOAP
// narrative is decrypted only in the shaper. Writes require an active treatment consent.
const router = Router();
router.use(requireAuth, requireRole('doctor'));

function publicEncounter(e: HydratedDocument<IEncounter>) {
  return {
    id: e._id,
    date: e.date,
    kind: e.kind,
    subjective: decryptOptional(e.subjective || undefined) ?? null,
    objective: decryptOptional(e.objective || undefined) ?? null,
    assessment: decryptOptional(e.assessment || undefined) ?? null,
    plan: decryptOptional(e.plan || undefined) ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

const soapShape = {
  kind: z.enum(ENCOUNTER_KINDS).optional(),
  date: z.string().min(1).max(40).optional(),
  subjective: z.string().max(8000).optional(),
  objective: z.string().max(8000).optional(),
  assessment: z.string().max(8000).optional(),
  plan: z.string().max(8000).optional(),
};
const createSchema = z
  .object(soapShape)
  .refine((b) => [b.subjective, b.objective, b.assessment, b.plan].some((v) => v && v.trim().length > 0), {
    message: 'At least one SOAP field is required',
  });
const updateSchema = z.object(soapShape);

const SOAP_KEYS = ['subjective', 'objective', 'assessment', 'plan'] as const;

// GET /api/doctor/patients/:id/encounters — newest-first timeline.
router.get('/patients/:id/encounters', auditAccess('encounter'), loadOwnedPatient, async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const encounters = await Encounter.find(scopeToDoctor(req, { patientId: patient._id })).sort({ date: -1 });
  res.json({ encounters: encounters.map(publicEncounter) });
});

// POST /api/doctor/patients/:id/encounters — add a visit note (encrypts on save).
router.post('/patients/:id/encounters', loadOwnedPatient, requireConsent('treatment'), async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const body = createSchema.parse(req.body);
  const encounter = new Encounter({
    doctorUserId: req.userId,
    patientId: patient._id,
    date: body.date ? new Date(body.date) : new Date(),
    kind: body.kind ?? 'visit',
    subjective: body.subjective || undefined,
    objective: body.objective || undefined,
    assessment: body.assessment || undefined,
    plan: body.plan || undefined,
  });
  await encounter.save();
  await recordAudit(req, {
    action: 'create',
    resourceType: 'encounter',
    resourceId: encounter._id,
    patientId: patient._id,
    changedFields: ['date', 'kind', ...SOAP_KEYS.filter((k) => body[k] !== undefined)],
    outcome: 'allow',
  });
  res.status(201).json({ encounter: publicEncounter(encounter) });
});

// PATCH /api/doctor/encounters/:encounterId — amend a note (tenant-scoped load, .save()).
router.patch('/encounters/:encounterId', async (req, res) => {
  const { encounterId } = req.params;
  const encounter = isValidObjectId(encounterId)
    ? await Encounter.findOne(scopeToDoctor(req, { _id: encounterId }))
    : null;
  if (!encounter) {
    res.status(404).json({ error: 'Encounter not found' });
    return;
  }
  const body = updateSchema.parse(req.body);
  const changed: string[] = [];
  if (body.date !== undefined) {
    encounter.date = new Date(body.date);
    changed.push('date');
  }
  if (body.kind !== undefined) {
    encounter.kind = body.kind;
    changed.push('kind');
  }
  for (const k of SOAP_KEYS) {
    if (body[k] !== undefined) {
      encounter[k] = body[k] || undefined; // '' clears the field (never store empty in an encrypted path)
      changed.push(k);
    }
  }
  await encounter.save(); // re-encrypts changed SOAP fields
  await recordAudit(req, {
    action: 'update',
    resourceType: 'encounter',
    resourceId: encounter._id,
    patientId: encounter.patientId,
    changedFields: changed,
    outcome: 'allow',
  });
  res.json({ encounter: publicEncounter(encounter) });
});

export default router;
