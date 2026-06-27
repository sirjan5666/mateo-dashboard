import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { unlink, readFile } from 'node:fs/promises';
import { z } from 'zod';
import { Prescription } from '../models/Prescription.js';
import type { IPrescription } from '../models/Prescription.js';
import type { IBaby } from '../models/Baby.js';
import { MedicineDoseLog } from '../models/MedicineDoseLog.js';
import { MedicineCourse } from '../models/MedicineCourse.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { uploadImage } from '../middleware/upload.js';
import { istDateString } from '../lib/ist.js';
import { assistantVisionAvailable, extractPrescriptionItems } from '../ai/provider.js';

const router = Router();

const courseKey = (prescriptionId: string, itemIndex: number) => `${prescriptionId}:${itemIndex}`;

// Adherence summary for one course's dose logs.
function adherence(logs: { givenAt: Date }[]) {
  const today = istDateString(new Date());
  const givenToday = logs.filter((l) => istDateString(l.givenAt) === today).length;
  let lastGivenAt: Date | null = null;
  for (const l of logs) if (!lastGivenAt || l.givenAt > lastGivenAt) lastGivenAt = l.givenAt;
  return { givenToday, lastGivenAt, totalGiven: logs.length };
}

// Resolve + ownership-check a course from its prescription id + item index.
async function loadCourse(
  userId: string | undefined,
  baby: IBaby & { _id: unknown },
  prescriptionIdParam: string,
  itemIndexParam: string,
): Promise<{ rx: HydratedDocument<IPrescription>; idx: number } | null> {
  if (!isValidObjectId(prescriptionIdParam)) return null;
  const idx = Number.parseInt(itemIndexParam, 10);
  if (!Number.isInteger(idx) || idx < 0) return null;
  const rx = await Prescription.findById(prescriptionIdParam);
  if (!rx || rx.parentUserId.toString() !== userId) return null;
  if (!rx.babyId || rx.babyId.toString() !== String(baby._id)) return null;
  if (idx >= rx.items.length) return null;
  return { rx, idx };
}

// ── List this baby's medicines (from prescriptions) + adherence ────────
router.get('/babies/:id/medicines', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const prescriptions = await Prescription.find({ parentUserId: req.userId, babyId: baby._id }).sort({ createdAt: -1 });
  if (prescriptions.length === 0) {
    res.json({ active: [], completed: [] });
    return;
  }
  const rxIds = prescriptions.map((p) => p._id);
  const doctorIds = prescriptions.map((p) => p.doctorUserId).filter((d): d is NonNullable<typeof d> => d != null);
  const [doctors, states, doseLogs] = await Promise.all([
    User.find({ _id: { $in: doctorIds } }).select('name'),
    MedicineCourse.find({ prescriptionId: { $in: rxIds } }),
    MedicineDoseLog.find({ prescriptionId: { $in: rxIds }, babyId: baby._id }),
  ]);
  const doctorName = new Map(doctors.map((d) => [d.id, d.name]));
  const activeByKey = new Map(states.map((s) => [courseKey(s.prescriptionId.toString(), s.itemIndex), s.active]));
  const logsByKey = new Map<string, { givenAt: Date }[]>();
  for (const l of doseLogs) {
    const k = courseKey(l.prescriptionId.toString(), l.itemIndex);
    (logsByKey.get(k) ?? logsByKey.set(k, []).get(k)!).push({ givenAt: l.givenAt });
  }

  const active: unknown[] = [];
  const completed: unknown[] = [];
  for (const rx of prescriptions) {
    rx.items.forEach((item, idx) => {
      const k = courseKey(rx.id, idx);
      const isActive = activeByKey.get(k) ?? true;
      const view = {
        prescriptionId: rx.id,
        itemIndex: idx,
        medicine: item.medicine,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        notes: item.notes ?? null,
        prescribedAt: rx.createdAt,
        source: rx.source,
        doctorName: rx.doctorUserId ? doctorName.get(rx.doctorUserId.toString()) ?? 'Doctor' : null,
        active: isActive,
        ...adherence(logsByKey.get(k) ?? []),
      };
      (isActive ? active : completed).push(view);
    });
  }
  res.json({ active, completed });
});

// ── Add your own medicine (offline doctor / typed in) ──────────────────
const manualSchema = z.object({
  diagnosis: z.string().trim().max(200).optional(),
  items: z
    .array(
      z.object({
        medicine: z.string().trim().min(1).max(120),
        dosage: z.string().trim().max(80).optional().default(''),
        frequency: z.string().trim().max(80).optional().default(''),
        duration: z.string().trim().max(80).optional().default(''),
        notes: z.string().trim().max(200).optional(),
      }),
    )
    .min(1, 'Add at least one medicine')
    .max(30),
});

router.post('/babies/:id/medicines/manual', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const body = manualSchema.parse(req.body);
  await Prescription.create({
    parentUserId: req.userId,
    babyId: baby._id,
    source: 'self',
    diagnosis: body.diagnosis ?? '',
    items: body.items,
  });
  res.status(201).json({ ok: true });
});

// ── Read medicines from a prescription photo (best-effort; needs a vision model) ──
function handleImageUpload(req: Request, res: Response, next: NextFunction): void {
  uploadImage(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      return;
    }
    next();
  });
}

router.post('/babies/:id/medicines/ocr', requireAuth, loadOwnedBaby, handleImageUpload, async (req, res) => {
  const cleanup = async () => {
    if (req.file) await unlink(req.file.path).catch(() => {});
  };
  if (!req.file) {
    res.status(400).json({ error: 'No image uploaded' });
    return;
  }
  if (!assistantVisionAvailable()) {
    await cleanup();
    res.json({ available: false, items: [] });
    return;
  }
  try {
    const data = await readFile(req.file.path);
    const items = await extractPrescriptionItems(data.toString('base64'), req.file.mimetype);
    await cleanup();
    res.json({ available: true, items });
  } catch {
    await cleanup();
    res.json({ available: true, items: [], error: 'Could not read the photo — please type the medicines instead.' });
  }
});

// ── Log a dose given ───────────────────────────────────────────────────
router.post('/babies/:id/medicines/:prescriptionId/:itemIndex/doses', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const ctx = await loadCourse(req.userId, baby, String(req.params.prescriptionId), String(req.params.itemIndex));
  if (!ctx) {
    res.status(404).json({ error: 'Medicine not found' });
    return;
  }
  await MedicineDoseLog.create({
    babyId: baby._id,
    parentUserId: req.userId,
    prescriptionId: ctx.rx._id,
    itemIndex: ctx.idx,
    medicine: ctx.rx.items[ctx.idx].medicine,
    givenAt: new Date(),
  });
  const logs = await MedicineDoseLog.find({ prescriptionId: ctx.rx._id, itemIndex: ctx.idx, babyId: baby._id });
  res.status(201).json(adherence(logs));
});

// ── Undo the most recent dose ──────────────────────────────────────────
router.delete('/babies/:id/medicines/:prescriptionId/:itemIndex/doses', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const ctx = await loadCourse(req.userId, baby, String(req.params.prescriptionId), String(req.params.itemIndex));
  if (!ctx) {
    res.status(404).json({ error: 'Medicine not found' });
    return;
  }
  const latest = await MedicineDoseLog.findOne({ prescriptionId: ctx.rx._id, itemIndex: ctx.idx, babyId: baby._id }).sort({ givenAt: -1 });
  if (latest) await latest.deleteOne();
  const logs = await MedicineDoseLog.find({ prescriptionId: ctx.rx._id, itemIndex: ctx.idx, babyId: baby._id });
  res.json(adherence(logs));
});

// ── Mark a course finished / active again ──────────────────────────────
const patchSchema = z.object({ active: z.boolean() });

router.patch('/babies/:id/medicines/:prescriptionId/:itemIndex', requireAuth, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const ctx = await loadCourse(req.userId, baby, String(req.params.prescriptionId), String(req.params.itemIndex));
  if (!ctx) {
    res.status(404).json({ error: 'Medicine not found' });
    return;
  }
  const { active } = patchSchema.parse(req.body);
  await MedicineCourse.findOneAndUpdate(
    { prescriptionId: ctx.rx._id, itemIndex: ctx.idx },
    { $set: { active }, $setOnInsert: { babyId: baby._id, parentUserId: req.userId } },
    { upsert: true },
  );
  res.json({ active });
});

export default router;
