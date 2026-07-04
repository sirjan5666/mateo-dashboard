import { Router } from 'express';
import { Types, isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { auditAccess, recordAudit } from '../middleware/audit.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { Invoice, INVOICE_STATUSES } from '../models/Invoice.js';
import type { IInvoice, InvoiceStatus } from '../models/Invoice.js';
import { Transaction } from '../models/Transaction.js';
import { Patient } from '../models/Patient.js';
import { decryptField, decryptOptional } from '../lib/crypto/fieldCipher.js';
import { istDateString } from '../lib/ist.js';

// Practice billing (invoices / receipts / collections). Doctor-role-gated and
// tenant-scoped like every EHR document. The patient roster is the tenant boundary:
// an invoice can only be created for / read for a patient owned by the calling
// doctor (verified in-query via scopeToDoctor). Line items + notes decrypt only in
// the shaper. Money totals are plain so collection totals aggregate in the DB.
const router = Router();
router.use(requireAuth, requireRole('doctor'));

const DAY_MS = 86_400_000;
function istDayStartUTC(d: Date): Date {
  return new Date(`${istDateString(d)}T00:00:00+05:30`);
}

interface LineItem {
  description: string;
  amount: number;
}

function parseItems(enc: string): LineItem[] {
  const json = decryptOptional(enc || undefined);
  if (!json) return [];
  try {
    const arr: unknown = JSON.parse(json);
    return Array.isArray(arr) ? (arr as LineItem[]) : [];
  } catch {
    return [];
  }
}

function listShape(inv: HydratedDocument<IInvoice>, patientName: string) {
  return {
    id: inv._id,
    number: inv.number,
    patientId: inv.patientId,
    patientName,
    date: inv.date,
    total: inv.total,
    amountPaid: inv.amountPaid,
    status: inv.status,
    paidAt: inv.paidAt ?? null,
  };
}

function fullShape(inv: HydratedDocument<IInvoice>, patientName: string) {
  return {
    ...listShape(inv, patientName),
    items: parseItems(inv.itemsEnc),
    notes: decryptOptional(inv.notes || undefined) ?? null,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

// Decrypt patient display names for a set of invoices — one tenant-scoped fetch.
async function namesFor(req: Parameters<typeof scopeToDoctor>[0], invoices: HydratedDocument<IInvoice>[]) {
  const ids = [...new Set(invoices.map((i) => i.patientId.toString()))];
  const patients = await Patient.find(scopeToDoctor(req, { _id: { $in: ids } }));
  return new Map(patients.map((p) => [p._id.toString(), decryptField(p.displayName)]));
}

const itemSchema = z.object({ description: z.string().min(1).max(200), amount: z.number().min(0).max(10_000_000) });
const createSchema = z.object({
  patientId: z.string().min(1),
  items: z.array(itemSchema).min(1).max(50),
  date: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});
const patchSchema = z.object({ status: z.enum(['paid', 'unpaid', 'cancelled']) });

// GET /api/doctor/billing/invoices?status= — all of the doctor's invoices.
router.get('/billing/invoices', auditAccess('invoice'), async (req, res) => {
  const q = req.query.status;
  const status = typeof q === 'string' && (INVOICE_STATUSES as string[]).includes(q) ? (q as InvoiceStatus) : undefined;
  const invoices = await Invoice.find(scopeToDoctor(req, status ? { status } : {}))
    .sort({ date: -1, createdAt: -1 })
    .limit(200);
  const names = await namesFor(req, invoices);
  res.json({ invoices: invoices.map((i) => listShape(i, names.get(i.patientId.toString()) ?? 'Patient')) });
});

// GET /api/doctor/billing/invoices/:id — full invoice (decrypts line items).
router.get('/billing/invoices/:id', auditAccess('invoice'), async (req, res) => {
  const { id } = req.params;
  const inv = isValidObjectId(id) ? await Invoice.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!inv) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  const names = await namesFor(req, [inv]);
  res.json({ invoice: fullShape(inv, names.get(inv.patientId.toString()) ?? 'Patient') });
});

// POST /api/doctor/billing/invoices — create. Patient ownership verified in-query.
router.post('/billing/invoices', auditAccess('invoice'), async (req, res) => {
  const body = createSchema.parse(req.body);
  const patient = isValidObjectId(body.patientId) ? await Patient.findOne(scopeToDoctor(req, { _id: body.patientId })) : null;
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' });
    return;
  }
  const items: LineItem[] = body.items.map((i) => ({ description: i.description, amount: Math.round(i.amount * 100) / 100 }));
  const total = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  // Per-doctor invoice number from a tenant-scoped count. The { doctorUserId, number }
  // unique index makes a concurrent-create collision fail loudly (E11000); retry with a
  // bumped number so two simultaneous creates never share INV-####.
  let inv: HydratedDocument<IInvoice> | null = null;
  for (let attempt = 0; attempt < 5 && !inv; attempt += 1) {
    const count = await Invoice.countDocuments(scopeToDoctor(req, {}));
    const candidate = new Invoice({
      doctorUserId: req.userId,
      patientId: patient._id,
      number: `INV-${String(count + 1 + attempt).padStart(4, '0')}`,
      date: body.date ? new Date(body.date) : new Date(),
      itemsEnc: JSON.stringify(items),
      total,
      amountPaid: 0,
      status: 'unpaid',
      notes: body.notes || undefined,
    });
    try {
      await candidate.save();
      inv = candidate;
    } catch (e) {
      if (e && typeof e === 'object' && (e as { code?: number }).code === 11000 && attempt < 4) continue;
      throw e;
    }
  }
  if (!inv) {
    res.status(409).json({ error: 'Could not allocate an invoice number — please retry' });
    return;
  }
  await recordAudit(req, {
    action: 'create',
    resourceType: 'invoice',
    resourceId: inv._id,
    patientId: patient._id,
    changedFields: ['number', 'total', 'items'],
    outcome: 'allow',
  });
  res.status(201).json({ invoice: fullShape(inv, decryptField(patient.displayName)) });
});

// PATCH /api/doctor/billing/invoices/:id — pay / unpay / cancel.
router.patch('/billing/invoices/:id', auditAccess('invoice'), async (req, res) => {
  const { id } = req.params;
  const inv = isValidObjectId(id) ? await Invoice.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!inv) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  const { status } = patchSchema.parse(req.body);
  const prevPaid = inv.amountPaid;
  if (status === 'paid') {
    inv.amountPaid = inv.total;
    inv.paidAt = new Date();
    inv.status = 'paid';
  } else if (status === 'unpaid') {
    inv.amountPaid = 0;
    inv.paidAt = undefined;
    inv.status = 'unpaid';
  } else {
    // Cancelling clears any recorded payment so a cancelled invoice never counts
    // toward collections and carries no stale money on its record.
    inv.status = 'cancelled';
    inv.amountPaid = 0;
    inv.paidAt = undefined;
  }
  await inv.save();

  // Ledger: record the change in collected money. Paid (0→total) writes a credit;
  // reversing a payment (unpaid/cancel after paid) writes a matching debit. The
  // description carries only the invoice number — never a patient name (not PHI).
  const delta = inv.amountPaid - prevPaid;
  if (delta !== 0) {
    await Transaction.create({
      doctorUserId: req.userId,
      amount: Math.abs(delta),
      type: delta > 0 ? 'credit' : 'debit',
      date: new Date(),
      description: delta > 0 ? `Payment received · ${inv.number}` : `${status === 'cancelled' ? 'Cancellation reversal' : 'Payment reversed'} · ${inv.number}`,
      relatedInvoiceId: inv._id,
    });
  }

  await recordAudit(req, {
    action: 'update',
    resourceType: 'invoice',
    resourceId: inv._id,
    patientId: inv.patientId,
    changedFields: ['status', 'amountPaid', 'paidAt'],
    outcome: 'allow',
  });
  const names = await namesFor(req, [inv]);
  res.json({ invoice: fullShape(inv, names.get(inv.patientId.toString()) ?? 'Patient') });
});

// GET /api/doctor/billing/transactions?from=&to= — the money ledger (credits/debits).
const rangeSchema = z.object({ from: z.string().max(40).optional(), to: z.string().max(40).optional() });
router.get('/billing/transactions', auditAccess('billing'), async (req, res) => {
  const { from, to } = rangeSchema.parse(req.query);
  const dateMatch: Record<string, unknown> = {};
  if (from || to) {
    const df: Record<string, Date> = {};
    if (from) df.$gte = istDayStartUTC(new Date(from));
    if (to) df.$lte = new Date(`${istDateString(new Date(to))}T23:59:59+05:30`);
    dateMatch.date = df;
  }
  const txns = await Transaction.find(scopeToDoctor(req, dateMatch)).sort({ date: -1, createdAt: -1 }).limit(500);
  let credits = 0;
  let debits = 0;
  for (const t of txns) {
    if (t.type === 'credit') credits += t.amount;
    else debits += t.amount;
  }
  res.json({
    transactions: txns.map((t) => ({
      id: t._id,
      amount: t.amount,
      type: t.type,
      date: t.date,
      description: t.description,
      relatedInvoiceId: t.relatedInvoiceId ?? null,
    })),
    totals: { credits, debits, net: Math.round((credits - debits) * 100) / 100 },
  });
});

// GET /api/doctor/billing/summary — outstanding + collections (plain-field aggregates).
router.get('/billing/summary', auditAccess('billing'), async (req, res) => {
  const now = new Date();
  const todayStart = istDayStartUTC(now);
  const [yr, mo] = istDateString(now).split('-').map(Number);
  const monthStart = new Date(`${yr}-${String(mo).padStart(2, '0')}-01T00:00:00+05:30`);
  const weekStart = new Date(todayStart.getTime() - 6 * DAY_MS);
  const doctorId = new Types.ObjectId(req.userId);

  const [outstandingAgg, todayAgg, monthAgg, byDayAgg, totalInvoices, unpaidCount] = await Promise.all([
    Invoice.aggregate<{ out: number }>([
      { $match: { doctorUserId: doctorId, status: { $in: ['unpaid', 'partial'] } } },
      { $group: { _id: null, out: { $sum: { $subtract: ['$total', '$amountPaid'] } } } },
    ]),
    Invoice.aggregate<{ sum: number }>([
      { $match: { doctorUserId: doctorId, status: { $ne: 'cancelled' }, paidAt: { $gte: todayStart } } },
      { $group: { _id: null, sum: { $sum: '$amountPaid' } } },
    ]),
    Invoice.aggregate<{ sum: number }>([
      { $match: { doctorUserId: doctorId, status: { $ne: 'cancelled' }, paidAt: { $gte: monthStart } } },
      { $group: { _id: null, sum: { $sum: '$amountPaid' } } },
    ]),
    Invoice.aggregate<{ _id: string; sum: number }>([
      { $match: { doctorUserId: doctorId, status: { $ne: 'cancelled' }, paidAt: { $gte: weekStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Asia/Kolkata' } }, sum: { $sum: '$amountPaid' } } },
    ]),
    Invoice.countDocuments(scopeToDoctor(req, {})),
    Invoice.countDocuments(scopeToDoctor(req, { status: { $in: ['unpaid', 'partial'] } })),
  ]);

  const byDayMap = new Map(byDayAgg.map((r) => [r._id, r.sum]));
  const byDay: { date: string; label: string; amount: number }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart.getTime() + i * DAY_MS);
    const k = istDateString(d);
    byDay.push({ date: k, label: new Date(`${k}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }), amount: byDayMap.get(k) ?? 0 });
  }

  res.json({
    outstanding: outstandingAgg[0]?.out ?? 0,
    collectedToday: todayAgg[0]?.sum ?? 0,
    collectedMonth: monthAgg[0]?.sum ?? 0,
    byDay,
    totalInvoices,
    unpaidCount,
  });
});

export default router;
