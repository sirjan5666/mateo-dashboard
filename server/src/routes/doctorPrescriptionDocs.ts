import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loadOwnedPatient, scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { auditAccess, recordAudit } from '../middleware/audit.js';
import { requireConsent } from '../middleware/requireConsent.js';
import { PrescriptionDocument } from '../models/PrescriptionDocument.js';
import type { IPrescriptionDocument } from '../models/PrescriptionDocument.js';
import { DoctorPrescription } from '../models/DoctorPrescription.js';
import { ClinicLocation } from '../models/ClinicLocation.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { GrowthMeasurement } from '../models/PatientClinical.js';
import { Patient } from '../models/Patient.js';
import type { IPatient } from '../models/Patient.js';
import { PatientRecord } from '../models/PatientRecord.js';
import { decryptField, decryptOptional } from '../lib/crypto/fieldCipher.js';
import { decryptSensitiveFields } from '../records/recordCrypto.js';
import type { FieldDefinition } from '../records/types.js';
import { SpecialtyTemplate } from '../models/SpecialtyTemplate.js';

/**
 * Printable prescriptions.
 *
 * A prescription document is a HEADER (id, diagnosis, review, investigations,
 * advice) plus the DoctorPrescription rows that point at it. Those rows are the
 * same ones the workspace tab and the parent's medicine reminders read, so the
 * printed sheet can never disagree with the active medication list.
 *
 * The full GET assembles everything the letterhead needs — clinic, doctor
 * credentials, patient demographics, weight at issue — in ONE tenant-scoped
 * read, so the print view never has to stitch six calls together and risk
 * printing half a document.
 */
const router = Router();
router.use(requireAuth, requireRole('doctor'));

const parseList = (enc?: string): string[] => {
  const json = decryptOptional(enc || undefined);
  if (!json) return [];
  try {
    const arr: unknown = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

/** RX + YYMMDD + 5-digit per-doctor sequence, e.g. RX250518-00123. */
function numberFor(issued: Date, seq: number): string {
  const yy = String(issued.getFullYear()).slice(-2);
  const mm = String(issued.getMonth() + 1).padStart(2, '0');
  const dd = String(issued.getDate()).padStart(2, '0');
  return `RX${yy}${mm}${dd}-${String(seq).padStart(5, '0')}`;
}

function headerShape(d: HydratedDocument<IPrescriptionDocument>) {
  return {
    id: d._id,
    number: d.number,
    issuedAt: d.issuedAt,
    diagnosis: decryptOptional(d.diagnosis || undefined) ?? null,
    reviewAfterDays: d.reviewAfterDays ?? null,
    investigations: parseList(d.investigationsEnc),
    advice: parseList(d.adviceEnc),
    weightKg: d.weightKg ?? null,
    locationId: d.locationId ?? null,
    encounterId: d.encounterId ?? null,
  };
}

const itemSchema = z.object({
  drug: z.string().trim().min(1).max(200),
  strength: z.string().trim().max(120).optional(),
  dose: z.string().trim().max(120).optional(),
  frequency: z.string().trim().max(120).optional(),
  duration: z.string().trim().max(120).optional(),
  instructions: z.string().trim().max(200).optional(),
});

const createSchema = z.object({
  issuedAt: z.string().max(40).optional(),
  diagnosis: z.string().trim().max(500).optional(),
  reviewAfterDays: z.number().int().min(0).max(365).optional(),
  investigations: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  advice: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  locationId: z.string().optional(),
  encounterId: z.string().optional(),
  items: z.array(itemSchema).min(1).max(30),
});

// GET /api/doctor/patients/:id/prescription-documents — newest first.
router.get('/patients/:id/prescription-documents', auditAccess('prescription'), loadOwnedPatient, async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const docs = await PrescriptionDocument.find(scopeToDoctor(req, { patientId: patient._id }))
    .sort({ issuedAt: -1 })
    .limit(100);
  const counts = await DoctorPrescription.aggregate<{ _id: unknown; n: number }>([
    { $match: { documentId: { $in: docs.map((d) => d._id) } } },
    { $group: { _id: '$documentId', n: { $sum: 1 } } },
  ]);
  const byDoc = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({
    documents: docs.map((d) => ({ ...headerShape(d), medicineCount: byDoc.get(String(d._id)) ?? 0 })),
  });
});

/**
 * GET /api/doctor/prescription-documents/:docId — everything the printed sheet
 * renders. Tenant-scoped, so another clinic's id simply 404s.
 */
router.get('/prescription-documents/:docId', auditAccess('prescription'), async (req, res) => {
  const { docId } = req.params;
  const doc = isValidObjectId(docId)
    ? await PrescriptionDocument.findOne(scopeToDoctor(req, { _id: docId }))
    : null;
  if (!doc) {
    res.status(404).json({ error: 'Prescription not found' });
    return;
  }

  const [items, patient, profile, clinic] = await Promise.all([
    // Ordered by _id: sequential saves give increasing ObjectIds, whereas two
    // lines saved in the same millisecond share a createdAt and could swap.
    DoctorPrescription.find(scopeToDoctor(req, { documentId: doc._id })).sort({ _id: 1 }),
    Patient.findOne(scopeToDoctor(req, { _id: doc.patientId })),
    DoctorProfile.findOne({ userId: req.userId }),
    doc.locationId ? ClinicLocation.findOne(scopeToDoctor(req, { _id: doc.locationId })) : null,
  ]);

  // Allergies live on the doctor's own template record, so they are read the
  // same way the workspace reads them rather than duplicated onto the sheet.
  let allergies: string | null = null;
  if (patient) {
    const record = await PatientRecord.findOne(scopeToDoctor(req, { patientId: patient._id }));
    const template = record ? await SpecialtyTemplate.findById(record.templateId) : null;
    if (record && template) {
      const values = new Map<string, unknown>(record.fields as Map<string, unknown>);
      decryptSensitiveFields(template.fields as unknown as FieldDefinition[], values);
      const raw = values.get('allergies');
      allergies = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    }
  }

  res.json({
    document: headerShape(doc),
    items: items.map((p) => ({
      id: p._id,
      drug: decryptField(p.drug),
      strength: decryptOptional(p.strength || undefined) ?? null,
      dose: decryptOptional(p.dose || undefined) ?? null,
      frequency: decryptOptional(p.frequency || undefined) ?? null,
      duration: decryptOptional(p.duration || undefined) ?? null,
      instructions: decryptOptional(p.instructions || undefined) ?? null,
      status: p.status,
    })),
    patient: patient
      ? {
        id: patient._id,
        displayName: decryptField(patient.displayName),
        dob: decryptOptional(patient.dob) ?? null,
        sex: patient.sex,
        phone: decryptOptional(patient.phone) ?? null,
        address: decryptOptional(patient.address) ?? null,
        allergies,
      }
      : null,
    doctor: {
      name: req.authUser?.name ?? 'Doctor',
      qualifications: profile?.qualifications || null,
      specialization: profile?.specialization || null,
      registrationNo: profile?.registrationNo || null,
    },
    clinic: clinic
      ? {
        name: clinic.name,
        address: [clinic.addressLine, `${clinic.city} - ${clinic.pincode}`].filter(Boolean).join(', '),
        phone: clinic.phone ?? null,
        email: clinic.email ?? null,
        website: clinic.website ?? null,
        openingHours: clinic.openingHours ?? null,
      }
      : null,
  });
});

/**
 * POST /api/doctor/patients/:id/prescription-documents — issue a prescription.
 *
 * Creates the header and its medication rows together. The rows carry
 * `documentId`, which is what makes them appear on this sheet; they are ordinary
 * DoctorPrescription rows in every other respect.
 */
router.post('/patients/:id/prescription-documents', loadOwnedPatient, requireConsent('treatment'), async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const body = createSchema.parse(req.body);
  const issuedAt = body.issuedAt ? new Date(body.issuedAt) : new Date();

  const locationId = body.locationId && isValidObjectId(body.locationId)
    ? (await ClinicLocation.findOne(scopeToDoctor(req, { _id: body.locationId })))?._id ?? undefined
    : (await ClinicLocation.findOne(scopeToDoctor(req, { isPrimary: true, active: true })))?._id ?? undefined;

  // The weight the child was dosed against, frozen onto the sheet so a reprint
  // years later does not silently show today's weight.
  const latestGrowth = await GrowthMeasurement.findOne(
    scopeToDoctor(req, { patientId: patient._id, weightKg: { $exists: true } }),
  ).sort({ takenAt: -1 });

  // Same concurrent-create guard as invoices: unique index + retry.
  let doc: HydratedDocument<IPrescriptionDocument> | null = null;
  const seed = await PrescriptionDocument.countDocuments(scopeToDoctor(req, {}));
  for (let attempt = 0; attempt < 5 && !doc; attempt += 1) {
    const candidate = new PrescriptionDocument({
      doctorUserId: req.userId,
      patientId: patient._id,
      locationId,
      encounterId: body.encounterId && isValidObjectId(body.encounterId) ? body.encounterId : undefined,
      number: numberFor(issuedAt, seed + 1 + attempt),
      issuedAt,
      diagnosis: body.diagnosis || undefined,
      reviewAfterDays: body.reviewAfterDays,
      investigationsEnc: body.investigations?.length ? JSON.stringify(body.investigations) : undefined,
      adviceEnc: body.advice?.length ? JSON.stringify(body.advice) : undefined,
      weightKg: latestGrowth?.weightKg,
    });
    try {
      await candidate.save();
      doc = candidate;
    } catch (e: unknown) {
      const dup = typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 11000;
      if (!dup) throw e;
    }
  }
  if (!doc) {
    res.status(409).json({ error: 'Could not allocate a prescription number — please retry' });
    return;
  }

  // Saved one at a time, NOT via insertMany: encryptedFields hooks pre('save'),
  // which insertMany bypasses entirely — it would write this child's medication
  // names to the database in plaintext. Sequential saves also give the rows
  // increasing ObjectIds, which is what fixes the printed S. No. order.
  for (const it of body.items) {
    const line = new DoctorPrescription({
      doctorUserId: req.userId,
      patientId: patient._id,
      documentId: doc._id,
      encounterId: doc.encounterId,
      date: issuedAt,
      drug: it.drug,
      strength: it.strength || undefined,
      dose: it.dose || undefined,
      frequency: it.frequency || undefined,
      duration: it.duration || undefined,
      instructions: it.instructions || undefined,
      status: 'active',
    });
    await line.save();
  }

  await recordAudit(req, {
    action: 'create',
    resourceType: 'prescription',
    resourceId: doc._id,
    patientId: patient._id,
    changedFields: ['number', 'items'],
    outcome: 'allow',
  });
  res.status(201).json({ document: headerShape(doc) });
});

export default router;
