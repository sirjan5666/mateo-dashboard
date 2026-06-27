import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loadOwnedPatient, scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { auditAccess, recordAudit } from '../middleware/audit.js';
import { requireConsent } from '../middleware/requireConsent.js';
import { Patient, PATIENT_SEXES } from '../models/Patient.js';
import type { IPatient } from '../models/Patient.js';
import { User } from '../models/User.js';
import { SpecialtyTemplate } from '../models/SpecialtyTemplate.js';
import type { ISpecialtyTemplate } from '../models/SpecialtyTemplate.js';
import { PatientRecord } from '../models/PatientRecord.js';
import type { IPatientRecord } from '../models/PatientRecord.js';
import { ConsentRecord } from '../models/ConsentRecord.js';
import { zodForTemplate } from '../records/templateZod.js';
import { writePatientRecord } from '../records/writePatientRecord.js';
import { decryptField, decryptOptional } from '../lib/crypto/fieldCipher.js';
import { decryptSensitiveFields } from '../records/recordCrypto.js';
import type { FieldDefinition } from '../records/types.js';

// The single-doctor EHR surface. Every route is doctor-role-gated and tenant-scoped
// (Patient.doctorUserId === req.userId). PHI demographics are decrypted only in the
// response shapers (never served as ciphertext, never logged).
//
// COMPLIANCE: placeholder consent policy version — finalise the DPDP consent text,
// then enforce it in requireConsent (see that file's TODO).
const POLICY_VERSION = 'v1';

const router = Router();
router.use(requireAuth, requireRole('doctor'));

// ---- response shapers (decrypt here, nowhere else) -------------------------
function publicTemplate(t: HydratedDocument<ISpecialtyTemplate>) {
  return {
    id: t._id,
    name: t.name,
    specialization: t.specialization,
    version: t.version,
    fields: t.fields,
    statuses: t.statuses,
    historyTags: t.historyTags,
    isGlobal: t.ownerUserId == null,
  };
}

function publicPatient(p: HydratedDocument<IPatient>) {
  return {
    id: p._id,
    displayName: decryptField(p.displayName),
    dob: decryptOptional(p.dob),
    sex: p.sex,
    phone: decryptOptional(p.phone),
    status: p.status,
    specialtyTemplateId: p.specialtyTemplateId,
    archivedAt: p.archivedAt ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function publicRecord(rec: HydratedDocument<IPatientRecord>, template: HydratedDocument<ISpecialtyTemplate>) {
  const fieldDefs = template.fields as unknown as FieldDefinition[];
  const values = new Map<string, unknown>(rec.fields as Map<string, unknown>);
  decryptSensitiveFields(fieldDefs, values);
  return {
    id: rec._id,
    status: rec.status,
    tags: rec.tags,
    templateVersion: rec.templateVersion,
    fields: Object.fromEntries(values),
    updatedAt: rec.updatedAt,
  };
}

function defaultStatus(template: HydratedDocument<ISpecialtyTemplate>): string {
  return template.statuses.find((s) => s.isDefault)?.key ?? template.statuses[0]?.key ?? 'active';
}

// A template usable by this doctor: their own, or a global (ownerless) one.
async function loadUsableTemplate(req: { userId?: string }, templateId: string) {
  if (!isValidObjectId(templateId)) return null;
  return SpecialtyTemplate.findOne({
    _id: templateId,
    isActive: true,
    $or: [{ ownerUserId: req.userId }, { ownerUserId: { $exists: false } }],
  });
}

// ---- templates -------------------------------------------------------------
router.get('/templates', async (req, res) => {
  const templates = await SpecialtyTemplate.find({
    isActive: true,
    $or: [{ ownerUserId: req.userId }, { ownerUserId: { $exists: false } }],
  }).sort({ name: 1 });
  res.json({ templates: templates.map(publicTemplate) });
});

// ---- patients --------------------------------------------------------------
const createPatientSchema = z.object({
  templateId: z.string(),
  displayName: z.string().min(1).max(200),
  dob: z.string().min(1).max(40).optional(),
  sex: z.enum(PATIENT_SEXES).optional(),
  phone: z.string().min(1).max(40).optional(),
  status: z.string().optional(),
});

router.post('/patients', async (req, res) => {
  const body = createPatientSchema.parse(req.body);
  const template = await loadUsableTemplate(req, body.templateId);
  if (!template) {
    res.status(400).json({ error: 'Unknown or inaccessible template' });
    return;
  }
  const status = body.status ?? defaultStatus(template);
  if (!template.statuses.some((s) => s.key === status)) {
    res.status(400).json({ error: `Unknown status "${status}" for this template` });
    return;
  }
  const patient = new Patient({
    doctorUserId: req.userId,
    specialtyTemplateId: template._id,
    displayName: body.displayName,
    dob: body.dob,
    sex: body.sex ?? 'unspecified',
    phone: body.phone,
    status,
  });
  await patient.save(); // pre-save hook encrypts displayName/dob/phone

  // In-clinic consent captured at intake so PHI processing is lawful from the start.
  await ConsentRecord.create([
    { patientId: patient._id, doctorUserId: req.userId, purpose: 'record_storage', status: 'granted', method: 'in_clinic', policyVersion: POLICY_VERSION },
    { patientId: patient._id, doctorUserId: req.userId, purpose: 'treatment', status: 'granted', method: 'in_clinic', policyVersion: POLICY_VERSION },
  ]);

  await recordAudit(req, {
    action: 'create',
    resourceType: 'patient',
    resourceId: patient._id,
    patientId: patient._id,
    changedFields: ['displayName', 'dob', 'sex', 'phone', 'status'],
    outcome: 'allow',
  });
  await recordAudit(req, {
    action: 'consent_grant',
    resourceType: 'consent',
    patientId: patient._id,
    changedFields: ['record_storage', 'treatment'],
    outcome: 'allow',
  });

  res.status(201).json({ patient: publicPatient(patient) });
});

const listQuerySchema = z.object({
  status: z.string().optional(),
  q: z.string().optional(),
  includeArchived: z.coerce.boolean().optional(),
});

router.get('/patients', auditAccess('patient'), async (req, res) => {
  const { status, q, includeArchived } = listQuerySchema.parse(req.query);
  const filter = scopeToDoctor(req, {});
  if (!includeArchived) filter.archivedAt = { $exists: false };
  if (status) filter.status = status;
  const patients = await Patient.find(filter).sort({ updatedAt: -1 }).limit(200);
  let list = patients.map(publicPatient);
  // Name is encrypted (not server-queryable) — filter the decrypted page in memory.
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((p) => p.displayName.toLowerCase().includes(needle));
  }
  res.json({ patients: list });
});

router.get('/patients/:id', auditAccess('patient'), loadOwnedPatient, async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const [template, record, portalUser] = await Promise.all([
    SpecialtyTemplate.findById(patient.specialtyTemplateId),
    PatientRecord.findOne(scopeToDoctor(req, { patientId: patient._id })),
    patient.patientUserId ? User.findById(patient.patientUserId).select('email') : null,
  ]);
  res.json({
    patient: publicPatient(patient),
    template: template ? publicTemplate(template) : null,
    record: record && template ? publicRecord(record, template) : null,
    portal: { active: !!portalUser, email: portalUser?.email ?? null },
  });
});

// POST /api/doctor/patients/:id/portal — create or reset the patient's portal login.
// The doctor sets the credentials and shares them out-of-band (chosen onboarding model).
const portalSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(200) });
router.post('/patients/:id/portal', loadOwnedPatient, async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const body = portalSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 12);

  if (patient.patientUserId) {
    // Already linked — reset the bound user's password (don't touch the email).
    const user = await User.findById(patient.patientUserId);
    if (user) {
      user.passwordHash = passwordHash;
      await user.save();
      await recordAudit(req, { action: 'update', resourceType: 'portal_access', resourceId: user._id, patientId: patient._id, changedFields: ['password'], outcome: 'allow' });
      res.json({ portal: { active: true, email: user.email } });
      return;
    }
    // bound user vanished — fall through to recreate
  }

  const existing = await User.findOne({ email: body.email });
  if (existing) {
    res.status(409).json({ error: 'That email is already in use by another account' });
    return;
  }
  const user = await User.create({
    email: body.email,
    name: decryptField(patient.displayName),
    passwordHash,
    role: 'patient',
    consentAcceptedAt: new Date(),
  });
  patient.patientUserId = user._id;
  await patient.save();
  await recordAudit(req, { action: 'create', resourceType: 'portal_access', resourceId: user._id, patientId: patient._id, changedFields: ['patientUserId'], outcome: 'allow' });
  res.status(201).json({ portal: { active: true, email: user.email } });
});

const updatePatientSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  dob: z.string().min(1).max(40).optional(),
  sex: z.enum(PATIENT_SEXES).optional(),
  phone: z.string().min(1).max(40).optional(),
  status: z.string().optional(),
});

router.patch('/patients/:id', loadOwnedPatient, async (req, res) => {
  const body = updatePatientSchema.parse(req.body);
  const patient = req.patient as HydratedDocument<IPatient>;
  const changed: string[] = [];

  if (body.status !== undefined) {
    const template = await SpecialtyTemplate.findById(patient.specialtyTemplateId);
    if (!template || !template.statuses.some((s) => s.key === body.status)) {
      res.status(400).json({ error: `Unknown status "${body.status}" for this template` });
      return;
    }
    patient.status = body.status;
    changed.push('status');
  }
  if (body.displayName !== undefined) {
    patient.displayName = body.displayName;
    changed.push('displayName');
  }
  if (body.dob !== undefined) {
    patient.dob = body.dob;
    changed.push('dob');
  }
  if (body.sex !== undefined) {
    patient.sex = body.sex;
    changed.push('sex');
  }
  if (body.phone !== undefined) {
    patient.phone = body.phone;
    changed.push('phone');
  }
  await patient.save(); // re-encrypts any changed PHI; unchanged ciphertext is skipped
  await recordAudit(req, {
    action: 'update',
    resourceType: 'patient',
    resourceId: patient._id,
    patientId: patient._id,
    changedFields: changed,
    outcome: 'allow',
  });
  res.json({ patient: publicPatient(patient) });
});

router.delete('/patients/:id', loadOwnedPatient, async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  if (!patient.archivedAt) {
    patient.archivedAt = new Date();
    await patient.save();
  }
  await recordAudit(req, {
    action: 'delete',
    resourceType: 'patient',
    resourceId: patient._id,
    patientId: patient._id,
    outcome: 'allow',
  });
  res.json({ patient: publicPatient(patient) });
});

// ---- the patient record (template-driven values) ---------------------------
router.put('/patients/:id/record', loadOwnedPatient, requireConsent('record_storage'), async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const template = await SpecialtyTemplate.findById(patient.specialtyTemplateId);
  if (!template) {
    res.status(400).json({ error: 'Patient has no template' });
    return;
  }
  const fieldDefs = template.fields as unknown as FieldDefinition[];
  const statusKeys = template.statuses.map((s) => s.key);
  const tagKeys = template.historyTags.map((t) => t.key);

  const envelopeSchema = z.object({
    fields: z.unknown().optional(),
    status: statusKeys.length ? z.enum(statusKeys as [string, ...string[]]).optional() : z.string().optional(),
    tags: (tagKeys.length ? z.array(z.enum(tagKeys as [string, ...string[]])) : z.array(z.string()).max(0)).optional(),
  });
  const body = envelopeSchema.parse(req.body);
  const fields = zodForTemplate(fieldDefs).parse(body.fields ?? {});
  const status = body.status ?? patient.status;
  const tags = body.tags ?? [];

  const { record, changedFieldKeys } = await writePatientRecord(patient, template, { fields, status, tags });
  await recordAudit(req, {
    action: 'update',
    resourceType: 'patient_record',
    resourceId: record._id,
    patientId: patient._id,
    changedFields: changedFieldKeys,
    outcome: 'allow',
  });
  res.json({ record: publicRecord(record, template) });
});

export default router;
