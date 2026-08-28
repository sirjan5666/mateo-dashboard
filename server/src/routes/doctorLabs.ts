import { Router } from 'express';
import path from 'node:path';
import { z } from 'zod';
import { Types } from 'mongoose';
import { guardRoutes } from '../middleware/permissions.js';
import { uploadDocument, uploadsDir } from '../middleware/upload.js';
import { LAB_ANALYTES, LAB_DATA_STATUS, flagValue, labById } from '../labs/reference.js';
import { searchLabTests } from '../labs/testCatalog.js';
import { LabOrder, LAB_ORDER_STATUSES } from '../models/LabOrder.js';
import type { LabOrderStatus } from '../models/LabOrder.js';
import { Patient } from '../models/Patient.js';

const router = Router();
guardRoutes(router, 'consultations');

router.get('/labs/catalog', (_req, res) => {
  res.json({ status: LAB_DATA_STATUS, analytes: LAB_ANALYTES });
});

// Typeahead over the real orderable lab-test price catalog (individual + packages).
router.get('/labs/test-catalog', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  res.json({ tests: searchLabTests(q, 20) });
});

const interpretSchema = z.object({
  ageMonths: z.number().min(0).max(1200),
  results: z
    .array(
      z.object({
        analyteId: z.string().min(1),
        value: z.number().finite(),
      }),
    )
    .max(40),
});

router.post('/labs/interpret', (req, res) => {
  const { ageMonths, results } = interpretSchema.parse(req.body);

  const flagged = results
    .map((r) => {
      const a = labById.get(r.analyteId);
      if (!a) return null;
      const flag = flagValue(a, r.value, ageMonths);
      return {
        analyteId: a.id,
        name: a.name,
        unit: a.unit,
        category: a.category,
        decimals: a.decimals,
        note: a.note ?? null,
        value: r.value,
        level: flag?.level ?? 'normal',
        refLow: flag?.low ?? null,
        refHigh: flag?.high ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const abnormal = flagged.filter((f) => f.level !== 'normal').length;
  res.json({ status: LAB_DATA_STATUS, ageMonths, results: flagged, abnormal });
});

// ── Lab Orders: CRUD for in-house lab test management ──

function nextOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LAB-${dateStr}-${rand}`;
}

router.get('/labs/orders', async (req, res) => {
  const doctorUserId = req.userId;
  const { status, patientId, limit: lim } = req.query;
  const filter: Record<string, unknown> = { doctorUserId };
  if (status && LAB_ORDER_STATUSES.includes(status as LabOrderStatus)) filter.status = status;
  if (patientId && Types.ObjectId.isValid(patientId as string)) filter.patientId = patientId;
  const orders = await LabOrder.find(filter).sort({ orderedAt: -1 }).limit(Math.min(Number(lim) || 100, 500)).lean();

  const patientIds = [...new Set(orders.map((o) => o.patientId.toString()))];
  const patients = await Patient.find({ _id: { $in: patientIds } }).select('displayName').lean();
  const pMap = new Map(patients.map((p) => [p._id.toString(), p.displayName]));

  res.json({
    orders: orders.map((o) => ({
      id: o._id.toString(),
      patientId: o.patientId.toString(),
      patientName: pMap.get(o.patientId.toString()) ?? 'Unknown',
      orderNumber: o.orderNumber,
      tests: o.tests,
      status: o.status,
      priority: o.priority,
      results: o.results,
      notes: o.notes ?? null,
      orderedAt: o.orderedAt.toISOString(),
      sampleCollectedAt: o.sampleCollectedAt?.toISOString() ?? null,
      completedAt: o.completedAt?.toISOString() ?? null,
      hasReport: !!o.reportFile,
      reportUploadedAt: o.reportUploadedAt?.toISOString() ?? null,
    })),
  });
});

const createOrderSchema = z.object({
  patientId: z.string().min(1),
  tests: z.array(z.string().min(1)).min(1).max(40),
  priority: z.enum(['routine', 'urgent']).optional(),
  notes: z.string().max(2000).optional(),
});

router.post('/labs/orders', async (req, res) => {
  const doctorUserId = req.userId;
  const body = createOrderSchema.parse(req.body);
  if (!Types.ObjectId.isValid(body.patientId)) return res.status(400).json({ error: 'Invalid patient' });
  const patient = await Patient.findOne({ _id: body.patientId, doctorUserId });
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const order = await LabOrder.create({
    doctorUserId,
    patientId: body.patientId,
    orderNumber: nextOrderNumber(),
    tests: body.tests,
    priority: body.priority ?? 'routine',
    notes: body.notes,
    orderedAt: new Date(),
  });

  res.status(201).json({
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
  });
});

const updateStatusSchema = z.object({
  status: z.enum(['sample_collected', 'in_progress', 'completed', 'cancelled']),
});

router.patch('/labs/orders/:id/status', async (req, res) => {
  const doctorUserId = req.userId;
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const body = updateStatusSchema.parse(req.body);
  const order = await LabOrder.findOne({ _id: req.params.id, doctorUserId });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = body.status;
  if (body.status === 'sample_collected' && !order.sampleCollectedAt) order.sampleCollectedAt = new Date();
  if (body.status === 'completed') order.completedAt = new Date();
  await order.save();
  res.json({ status: order.status });
});

const addResultsSchema = z.object({
  results: z.array(z.object({
    analyteId: z.string().min(1),
    value: z.number().finite(),
  })).min(1).max(40),
  ageMonths: z.number().min(0).max(1200),
});

router.post('/labs/orders/:id/results', async (req, res) => {
  const doctorUserId = req.userId;
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const body = addResultsSchema.parse(req.body);
  const order = await LabOrder.findOne({ _id: req.params.id, doctorUserId });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const interpreted = body.results
    .map((r) => {
      const a = labById.get(r.analyteId);
      if (!a) return null;
      const flag = flagValue(a, r.value, body.ageMonths);
      return {
        analyteId: a.id,
        name: a.name,
        value: r.value,
        unit: a.unit,
        level: (flag?.level ?? 'normal') as 'low' | 'normal' | 'high',
        refLow: flag?.low ?? null,
        refHigh: flag?.high ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  order.results = interpreted;
  order.status = 'completed';
  order.completedAt = new Date();
  await order.save();

  res.json({ results: order.results, status: order.status });
});

// ── Lab report file (upload once the test is done; served back inline) ──
// The report is stored against the order (which is scoped to one patient), so it
// is reachable from the patient's lab/test section and never leaks across tenants.
router.post('/labs/orders/:id/report', uploadDocument, async (req, res) => {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const order = await LabOrder.findOne({ _id: id, doctorUserId: req.userId });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.reportFile = file.filename;
  order.reportUploadedAt = new Date();
  await order.save();
  return res.status(201).json({ hasReport: true, reportUploadedAt: order.reportUploadedAt.toISOString() });
});

router.get('/labs/orders/:id/report', async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const order = await LabOrder.findOne({ _id: req.params.id, doctorUserId: req.userId });
  if (!order || !order.reportFile) return res.status(404).json({ error: 'No report on this order' });
  // Filenames are server-generated UUIDs (never client text) — safe to join, but
  // resolve + prefix-check to be certain the path stays inside uploadsDir.
  const full = path.resolve(uploadsDir, order.reportFile);
  if (!full.startsWith(path.resolve(uploadsDir))) return res.status(400).json({ error: 'Bad path' });
  res.setHeader('Content-Disposition', `inline; filename="lab-report-${order.orderNumber}${path.extname(order.reportFile)}"`);
  return res.sendFile(full);
});

export default router;
