import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { guardModule, loadStaffContext } from '../middleware/permissions.js';
import { auditAccess, recordAudit } from '../middleware/audit.js';
import { loadOwnedPatient, scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { uploadDocument, uploadsDir } from '../middleware/upload.js';
import {
  DOCUMENT_TYPES, GrowthMeasurement, Immunisation, NOTE_CATEGORIES, PatientDocument, PatientNote,
} from '../models/PatientClinical.js';
import { decryptField, decryptOptional } from '../lib/crypto/fieldCipher.js';

/**
 * The per-patient stores behind the Patient Workspace tabs: growth measurements,
 * clinical notes, documents and immunisations.
 *
 * Every route is doctor-role-gated and goes through `loadOwnedPatient`, so a
 * patientId from the client is never trusted. Collection queries additionally
 * pass through `scopeToDoctor` — defence in depth, per hard rule 5.
 *
 * Free text is decrypted only in these shapers, never via getters.
 */
const router = Router();
// RBAC: a staff session is narrowed to what its role allows. The doctor who
// owns the practice passes every check — see middleware/permissions.ts.
router.use(requireAuth, requireRole('doctor'), loadStaffContext, guardModule('patients', [
  { match: '/growth-records', method: 'GET', action: 'view' },
]));

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Growth measurements ──────────────────────────────────────────────────────

const growthSchema = z.object({
  takenAt: z.string().min(4).max(40),
  weightKg: z.number().min(0).max(300).optional(),
  heightCm: z.number().min(0).max(250).optional(),
  headCircumferenceCm: z.number().min(0).max(100).optional(),
  recordedBy: z.string().trim().max(120).optional(),
  note: z.string().trim().max(2000).optional(),
});

/** BMI is DERIVED, never accepted from the client — kg / m². */
function bmiOf(weightKg?: number, heightCm?: number): number | undefined {
  if (!weightKg || !heightCm) return undefined;
  const m = heightCm / 100;
  return round2(weightKg / (m * m));
}

router.get('/patients/:id/growth-records', auditAccess('growth'), loadOwnedPatient, async (req, res) => {
  const rows = await GrowthMeasurement.find(scopeToDoctor(req, { patientId: req.patient!._id }))
    .sort({ takenAt: -1 })
    .limit(200);
  res.json({
    records: rows.map((r) => ({
      id: r._id,
      takenAt: r.takenAt,
      weightKg: r.weightKg ?? null,
      heightCm: r.heightCm ?? null,
      headCircumferenceCm: r.headCircumferenceCm ?? null,
      bmi: r.bmi ?? null,
      recordedBy: r.recordedBy ?? null,
      note: decryptOptional(r.note || undefined) ?? null,
    })),
  });
});

router.post('/patients/:id/growth-records', auditAccess('growth'), loadOwnedPatient, async (req, res) => {
  const body = growthSchema.parse(req.body);
  if (!body.weightKg && !body.heightCm && !body.headCircumferenceCm) {
    res.status(400).json({ error: 'Record at least one measurement' });
    return;
  }
  const rec = await GrowthMeasurement.create({
    doctorUserId: req.userId,
    patientId: req.patient!._id,
    takenAt: new Date(body.takenAt),
    weightKg: body.weightKg,
    heightCm: body.heightCm,
    headCircumferenceCm: body.headCircumferenceCm,
    bmi: bmiOf(body.weightKg, body.heightCm),
    recordedBy: body.recordedBy,
    note: body.note,
  });
  await recordAudit(req, { action: 'create', resourceType: 'growth', resourceId: rec._id, patientId: req.patient!._id, outcome: 'allow' });
  res.status(201).json({ record: { id: rec._id, takenAt: rec.takenAt, bmi: rec.bmi ?? null } });
});

router.delete('/patients/:id/growth-records/:recordId', auditAccess('growth'), loadOwnedPatient, async (req, res) => {
  const { recordId } = req.params;
  const rec = isValidObjectId(recordId)
    ? await GrowthMeasurement.findOne(scopeToDoctor(req, { _id: recordId, patientId: req.patient!._id }))
    : null;
  if (!rec) {
    res.status(404).json({ error: 'Measurement not found' });
    return;
  }
  await rec.deleteOne();
  res.json({ ok: true });
});

// ── Notes ────────────────────────────────────────────────────────────────────

const noteSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  category: z.enum(NOTE_CATEGORIES).optional(),
  pinned: z.boolean().optional(),
});

router.get('/patients/:id/notes', auditAccess('note'), loadOwnedPatient, async (req, res) => {
  const rows = await PatientNote.find(scopeToDoctor(req, { patientId: req.patient!._id }))
    .sort({ pinned: -1, createdAt: -1 })
    .limit(200);
  const byCategory = NOTE_CATEGORIES.map((c) => ({
    label: c,
    count: rows.filter((r) => r.category === c).length,
  }));
  res.json({
    notes: rows.map((n) => ({
      id: n._id,
      category: n.category,
      text: decryptField(n.text),
      author: n.author ?? null,
      pinned: n.pinned,
      createdAt: n.createdAt,
    })),
    // Derived from the very list above, so the donut can never disagree with it.
    byCategory,
    categories: NOTE_CATEGORIES,
  });
});

router.post('/patients/:id/notes', auditAccess('note'), loadOwnedPatient, async (req, res) => {
  const body = noteSchema.parse(req.body);
  const note = await PatientNote.create({
    doctorUserId: req.userId,
    patientId: req.patient!._id,
    category: body.category ?? 'General Note',
    text: body.text,
    author: req.authUser?.name,
    pinned: body.pinned ?? false,
  });
  await recordAudit(req, { action: 'create', resourceType: 'note', resourceId: note._id, patientId: req.patient!._id, outcome: 'allow' });
  res.status(201).json({ note: { id: note._id, category: note.category, pinned: note.pinned, createdAt: note.createdAt } });
});

router.patch('/patients/:id/notes/:noteId', auditAccess('note'), loadOwnedPatient, async (req, res) => {
  const { noteId } = req.params;
  const body = noteSchema.partial().parse(req.body);
  const note = isValidObjectId(noteId)
    ? await PatientNote.findOne(scopeToDoctor(req, { _id: noteId, patientId: req.patient!._id }))
    : null;
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  if (body.text !== undefined) note.text = body.text;
  if (body.category !== undefined) note.category = body.category;
  if (body.pinned !== undefined) note.pinned = body.pinned;
  await note.save();
  res.json({ note: { id: note._id, pinned: note.pinned } });
});

router.delete('/patients/:id/notes/:noteId', auditAccess('note'), loadOwnedPatient, async (req, res) => {
  const { noteId } = req.params;
  const note = isValidObjectId(noteId)
    ? await PatientNote.findOne(scopeToDoctor(req, { _id: noteId, patientId: req.patient!._id }))
    : null;
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  await note.deleteOne();
  res.json({ ok: true });
});

// ── Documents ────────────────────────────────────────────────────────────────

const KB = 1024;
function humanSize(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < KB * KB) return `${Math.round(bytes / KB)} KB`;
  return `${(bytes / (KB * KB)).toFixed(1)} MB`;
}
const EXT_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

router.get('/patients/:id/documents', auditAccess('document'), loadOwnedPatient, async (req, res) => {
  const rows = await PatientDocument.find(scopeToDoctor(req, { patientId: req.patient!._id }))
    .sort({ createdAt: -1 })
    .limit(200);
  const byType = DOCUMENT_TYPES.map((t) => ({ label: t, count: rows.filter((r) => r.type === t).length }))
    .filter((t) => t.count > 0);
  res.json({
    documents: rows.map((d) => ({
      id: d._id,
      name: decryptField(d.name),
      type: d.type,
      ext: EXT_LABEL[d.mimeType] ?? 'FILE',
      sizeBytes: d.sizeBytes,
      size: humanSize(d.sizeBytes),
      uploadedBy: d.uploadedBy ?? null,
      note: decryptOptional(d.note || undefined) ?? null,
      createdAt: d.createdAt,
    })),
    byType,
    totalBytes: rows.reduce((t, d) => t + d.sizeBytes, 0),
    types: DOCUMENT_TYPES,
  });
});

router.post('/patients/:id/documents', auditAccess('document'), loadOwnedPatient, uploadDocument, async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Attach a file' });
    return;
  }
  const body = z
    .object({ name: z.string().trim().max(200).optional(), type: z.enum(DOCUMENT_TYPES).optional(), note: z.string().trim().max(1000).optional() })
    .parse(req.body ?? {});
  const doc = await PatientDocument.create({
    doctorUserId: req.userId,
    patientId: req.patient!._id,
    name: body.name || file.originalname,
    type: body.type ?? 'Other',
    storedName: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    uploadedBy: req.authUser?.name,
    note: body.note,
  });
  await recordAudit(req, { action: 'create', resourceType: 'document', resourceId: doc._id, patientId: req.patient!._id, outcome: 'allow' });
  res.status(201).json({ document: { id: doc._id, type: doc.type, size: humanSize(doc.sizeBytes) } });
});

/**
 * Streams the file back. The document is looked up tenant-scoped FIRST, and the
 * path is rebuilt from `uploadsDir` + the stored name — a client can never
 * influence what is read off disk.
 */
router.get('/patients/:id/documents/:docId/file', auditAccess('document'), loadOwnedPatient, async (req, res) => {
  const { docId } = req.params;
  const doc = isValidObjectId(docId)
    ? await PatientDocument.findOne(scopeToDoctor(req, { _id: docId, patientId: req.patient!._id }))
    : null;
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const full = path.join(uploadsDir, path.basename(doc.storedName));
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${decryptField(doc.name).replace(/"/g, '')}"`);
  createReadStream(full)
    .on('error', () => res.status(404).end())
    .pipe(res);
});

router.delete('/patients/:id/documents/:docId', auditAccess('document'), loadOwnedPatient, async (req, res) => {
  const { docId } = req.params;
  const doc = isValidObjectId(docId)
    ? await PatientDocument.findOne(scopeToDoctor(req, { _id: docId, patientId: req.patient!._id }))
    : null;
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  await doc.deleteOne();
  res.json({ ok: true });
});

// ── Immunisations ────────────────────────────────────────────────────────────

const immSchema = z.object({
  vaccine: z.string().trim().min(1).max(120),
  doseLabel: z.string().trim().max(60).optional(),
  status: z.enum(['given', 'due', 'overdue']).optional(),
  givenAt: z.string().max(40).optional(),
  dueAt: z.string().max(40).optional(),
  batch: z.string().trim().max(40).optional(),
});

router.get('/patients/:id/immunisations', auditAccess('immunisation'), loadOwnedPatient, async (req, res) => {
  const rows = await Immunisation.find(scopeToDoctor(req, { patientId: req.patient!._id }))
    .sort({ dueAt: 1, createdAt: 1 })
    .limit(200);
  const now = new Date();
  const shaped = rows.map((r) => ({
    id: r._id,
    vaccine: r.vaccine,
    doseLabel: r.doseLabel ?? null,
    // A "due" dose whose date has passed reads as overdue without a nightly job.
    status: r.status === 'due' && r.dueAt && r.dueAt < now ? 'overdue' : r.status,
    givenAt: r.givenAt ?? null,
    dueAt: r.dueAt ?? null,
    batch: r.batch ?? null,
    administeredBy: r.administeredBy ?? null,
  }));
  res.json({
    immunisations: shaped,
    summary: {
      given: shaped.filter((s) => s.status === 'given').length,
      due: shaped.filter((s) => s.status === 'due').length,
      overdue: shaped.filter((s) => s.status === 'overdue').length,
    },
  });
});

router.post('/patients/:id/immunisations', auditAccess('immunisation'), loadOwnedPatient, async (req, res) => {
  const body = immSchema.parse(req.body);
  const row = await Immunisation.create({
    doctorUserId: req.userId,
    patientId: req.patient!._id,
    vaccine: body.vaccine,
    doseLabel: body.doseLabel,
    status: body.status ?? (body.givenAt ? 'given' : 'due'),
    givenAt: body.givenAt ? new Date(body.givenAt) : undefined,
    dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
    batch: body.batch,
    administeredBy: body.givenAt ? req.authUser?.name : undefined,
  });
  await recordAudit(req, { action: 'create', resourceType: 'immunisation', resourceId: row._id, patientId: req.patient!._id, outcome: 'allow' });
  res.status(201).json({ immunisation: { id: row._id, status: row.status } });
});

export default router;
