import { Router } from 'express';
import { Types, isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { guardRoutes } from '../middleware/permissions.js';
import { auditAccess } from '../middleware/audit.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import {
  Distributor, Medicine, MEDICINE_CATEGORIES, PAYMENT_MODES, PharmacyBill, PharmacyPurchase,
  StockMovement,
} from '../models/Pharmacy.js';
import type { IBillItem, IMedicine } from '../models/Pharmacy.js';
import { Patient } from '../models/Patient.js';
import { decryptField } from '../lib/crypto/fieldCipher.js';
import { istDateString } from '../lib/ist.js';

/**
 * In-clinic pharmacy: inventory, purchases (stock in) and counter billing
 * (stock out). Doctor-role-gated and tenant-scoped like the rest of the doctor
 * domain — every query goes through scopeToDoctor.
 *
 * ⚠ NO MULTI-DOCUMENT TRANSACTIONS. Mongo runs standalone in this deployment,
 * so `session.startTransaction()` would throw. Stock is therefore moved with
 * per-document ATOMIC CONDITIONAL UPDATES:
 *
 *     findOneAndUpdate({ _id, doctorUserId, qtyInStock: { $gte: qty } },
 *                      { $inc: { qtyInStock: -qty } })
 *
 * A null result means another till already took the stock — the sale is
 * rejected rather than driving the balance negative. When a later line in the
 * same bill fails, the earlier lines are compensated back (see `releaseStock`)
 * so a half-applied bill can never be left behind.
 */
const router = Router();
// RBAC: a staff session is narrowed to what its role allows. The doctor who
// owns the practice passes every check — see middleware/permissions.ts.
guardRoutes(router, 'pharmacy', [
  { match: '/bills', method: 'POST', action: 'sale' },
  { match: '/purchases', method: 'POST', action: 'purchase' },
  { match: '/adjust', action: 'adjust' },
  { match: '/import', action: 'import' },
]);

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── shapers ──────────────────────────────────────────────────────────────────

type MedDoc = Awaited<ReturnType<typeof Medicine.findOne>>;

export function stockStatus(m: { qtyInStock: number; reorderLevel: number }): 'In Stock' | 'Low Stock' | 'Out of Stock' {
  if (m.qtyInStock <= 0) return 'Out of Stock';
  return m.qtyInStock <= m.reorderLevel ? 'Low Stock' : 'In Stock';
}

function medShape(m: NonNullable<MedDoc>, distributorName: string | null) {
  const level = m.capacity > 0 ? Math.max(0, Math.min(100, Math.round((m.qtyInStock / m.capacity) * 100))) : 0;
  return {
    id: m._id,
    sku: m.sku,
    name: m.name,
    form: m.form ?? null,
    category: m.category,
    batch: m.batch,
    distributorId: m.distributorId ?? null,
    distributorName,
    expiry: m.expiry ? m.expiry.toISOString().slice(0, 10) : null,
    purchaseRate: m.purchaseRate,
    mrp: m.mrp,
    gstPct: m.gstPct,
    qtyInStock: m.qtyInStock,
    capacity: m.capacity,
    reorderLevel: m.reorderLevel,
    level,
    status: stockStatus(m),
    active: m.active,
  };
}

async function distributorNames(req: Parameters<typeof scopeToDoctor>[0]) {
  const ds = await Distributor.find(scopeToDoctor(req)).select('name');
  return new Map(ds.map((d) => [d._id.toString(), d.name]));
}

// ── Inventory ────────────────────────────────────────────────────────────────

// GET /api/pharmacy/inventory?q=&category=&status=
router.get('/inventory', auditAccess('pharmacy'), async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';

  const filter: Record<string, unknown> = { active: true };
  if (category && (MEDICINE_CATEGORIES as readonly string[]).includes(category)) filter.category = category;
  if (q) {
    // Escaped so a user typing "(" cannot throw an invalid-regex 500.
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(safe, 'i') }, { sku: new RegExp(safe, 'i') }, { batch: new RegExp(safe, 'i') }];
  }

  const [rows, names] = await Promise.all([
    Medicine.find(scopeToDoctor(req, filter)).sort({ name: 1 }).limit(500),
    distributorNames(req),
  ]);
  let items = rows.map((m) => medShape(m, m.distributorId ? names.get(m.distributorId.toString()) ?? null : null));
  if (status === 'alerts') items = items.filter((i) => i.status !== 'In Stock');
  else if (status) items = items.filter((i) => i.status === status);

  res.json({ items, total: items.length });
});

// GET /api/pharmacy/inventory/summary — the KPI row, fast movers and category split.
router.get('/inventory/summary', auditAccess('pharmacy'), async (req, res) => {
  const doctorId = new Types.ObjectId(req.userId); // $match does not cast
  const in60Days = new Date(Date.now() + 60 * 86_400_000);
  const monthStart = new Date(`${istDateString(new Date()).slice(0, 7)}-01T00:00:00+05:30`);

  const [meds, byCategory, fastMovers] = await Promise.all([
    Medicine.find(scopeToDoctor(req, { active: true })).select('qtyInStock reorderLevel purchaseRate expiry category'),
    Medicine.aggregate<{ _id: string; count: number }>([
      { $match: { doctorUserId: doctorId, active: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    // Units sold this month, from the bills themselves — never a stored counter.
    PharmacyBill.aggregate<{ _id: string; units: number }>([
      { $match: { doctorUserId: doctorId, createdAt: { $gte: monthStart }, status: { $ne: 'draft' } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', units: { $sum: '$items.qty' } } },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const stockValue = meds.reduce((t, m) => t + m.qtyInStock * m.purchaseRate, 0);
  const lowStock = meds.filter((m) => m.qtyInStock > 0 && m.qtyInStock <= m.reorderLevel).length;
  const outOfStock = meds.filter((m) => m.qtyInStock <= 0).length;
  const expiringSoon = meds.filter((m) => m.expiry && m.expiry <= in60Days).length;
  const totalSkus = meds.length;

  const PALETTE: Record<string, string> = {
    Antibiotics: '#4F46E5', Analgesics: '#2B6FF0', Vitamins: '#12A150',
    Respiratory: '#F59E0B', Topicals: '#EC4899', Others: '#CBD5E1',
  };
  const BAR = ['#4F46E5', '#6D5AE0', '#12A150', '#F59E0B', '#EF4444'];

  res.json({
    kpis: { stockValue: round2(stockValue), totalSkus, lowStock, outOfStock, expiringSoon },
    categories: byCategory.map((c) => ({
      label: c._id,
      count: c.count,
      pct: totalSkus ? Math.round((c.count / totalSkus) * 100) : 0,
      color: PALETTE[c._id] ?? '#CBD5E1',
    })),
    fastMovers: fastMovers.map((f, i) => ({ name: f._id, units: f.units, color: BAR[i % BAR.length] })),
  });
});

const medicineSchema = z.object({
  sku: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(160),
  form: z.string().trim().max(60).optional().or(z.literal('')),
  category: z.enum(MEDICINE_CATEGORIES).optional(),
  batch: z.string().trim().min(1).max(40),
  distributorId: z.string().optional().or(z.literal('')),
  expiry: z.string().max(20).optional().or(z.literal('')),
  purchaseRate: z.number().min(0).max(1_000_000),
  mrp: z.number().min(0).max(1_000_000),
  gstPct: z.number().min(0).max(28).optional(),
  qtyInStock: z.number().int().min(0).max(1_000_000).optional(),
  capacity: z.number().int().min(1).max(1_000_000).optional(),
  reorderLevel: z.number().int().min(0).max(1_000_000).optional(),
});

/** Ownership-checked distributor lookup — never trust an id from the client. */
async function ownedDistributorId(req: Parameters<typeof scopeToDoctor>[0], id: string | undefined) {
  if (!id) return undefined;
  const d = isValidObjectId(id) ? await Distributor.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!d) throw Object.assign(new Error('Unknown distributor'), { status: 400 });
  return d._id;
}

// POST /api/pharmacy/medicines — "Add Medicine / SKU".
router.post('/medicines', auditAccess('pharmacy'), async (req, res) => {
  const body = medicineSchema.parse(req.body);
  const opening = body.qtyInStock ?? 0;
  const med = await Medicine.create({
    doctorUserId: req.userId,
    sku: body.sku.toUpperCase(),
    name: body.name,
    form: body.form || undefined,
    category: body.category ?? 'Others',
    batch: body.batch.toUpperCase(),
    distributorId: await ownedDistributorId(req, body.distributorId || undefined),
    expiry: body.expiry ? new Date(body.expiry) : undefined,
    purchaseRate: body.purchaseRate,
    mrp: body.mrp,
    gstPct: body.gstPct ?? 12,
    qtyInStock: opening,
    capacity: body.capacity ?? Math.max(opening, 100),
    reorderLevel: body.reorderLevel ?? 10,
    active: true,
  });
  // Opening stock is a movement too, so the ledger explains the whole balance.
  if (opening > 0) {
    await StockMovement.create({
      doctorUserId: req.userId, medicineId: med._id, delta: opening, balanceAfter: opening,
      reason: 'adjustment', refType: 'manual', note: 'Opening stock',
    });
  }
  const names = await distributorNames(req);
  res.status(201).json({ item: medShape(med, med.distributorId ? names.get(med.distributorId.toString()) ?? null : null) });
});

// PATCH /api/pharmacy/medicines/:id — edit everything EXCEPT the stock balance.
router.patch('/medicines/:id', auditAccess('pharmacy'), async (req, res) => {
  const { id } = req.params;
  const body = medicineSchema.partial().omit({ qtyInStock: true }).extend({ active: z.boolean().optional() }).parse(req.body);
  const med = isValidObjectId(id) ? await Medicine.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!med) {
    res.status(404).json({ error: 'Medicine not found' });
    return;
  }
  const patch: Partial<IMedicine> = {};
  if (body.sku !== undefined) patch.sku = body.sku.toUpperCase();
  if (body.name !== undefined) patch.name = body.name;
  if (body.form !== undefined) patch.form = body.form || undefined;
  if (body.category !== undefined) patch.category = body.category;
  if (body.batch !== undefined) patch.batch = body.batch.toUpperCase();
  if (body.distributorId !== undefined) patch.distributorId = await ownedDistributorId(req, body.distributorId || undefined);
  if (body.expiry !== undefined) patch.expiry = body.expiry ? new Date(body.expiry) : undefined;
  if (body.purchaseRate !== undefined) patch.purchaseRate = body.purchaseRate;
  if (body.mrp !== undefined) patch.mrp = body.mrp;
  if (body.gstPct !== undefined) patch.gstPct = body.gstPct;
  if (body.capacity !== undefined) patch.capacity = body.capacity;
  if (body.reorderLevel !== undefined) patch.reorderLevel = body.reorderLevel;
  if (body.active !== undefined) patch.active = body.active;
  Object.assign(med, patch);
  await med.save();
  const names = await distributorNames(req);
  res.json({ item: medShape(med, med.distributorId ? names.get(med.distributorId.toString()) ?? null : null) });
});

// POST /api/pharmacy/medicines/:id/adjust — the +/− buttons and stock take.
router.post('/medicines/:id/adjust', auditAccess('pharmacy'), async (req, res) => {
  const { id } = req.params;
  const { delta, note } = z
    .object({ delta: z.number().int().refine((n) => n !== 0, 'Delta cannot be zero'), note: z.string().max(240).optional() })
    .parse(req.body);
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Medicine not found' });
    return;
  }
  // Atomic + guarded: the $gte precondition is what stops a negative balance.
  const filter = delta < 0
    ? scopeToDoctor(req, { _id: id, qtyInStock: { $gte: -delta } })
    : scopeToDoctor(req, { _id: id });
  const med = await Medicine.findOneAndUpdate(filter, { $inc: { qtyInStock: delta } }, { new: true });
  if (!med) {
    const exists = await Medicine.findOne(scopeToDoctor(req, { _id: id }));
    res.status(exists ? 409 : 404).json({
      error: exists ? `Only ${exists.qtyInStock} left in stock` : 'Medicine not found',
    });
    return;
  }
  await StockMovement.create({
    doctorUserId: req.userId, medicineId: med._id, delta, balanceAfter: med.qtyInStock,
    reason: 'adjustment', refType: 'manual', note: note || undefined,
  });
  const names = await distributorNames(req);
  res.json({ item: medShape(med, med.distributorId ? names.get(med.distributorId.toString()) ?? null : null) });
});

// GET /api/pharmacy/inventory/export — "Download Inventory". CSV, not a fake xlsx.
router.get('/inventory/export', auditAccess('pharmacy'), async (req, res) => {
  const [rows, names] = await Promise.all([
    Medicine.find(scopeToDoctor(req, { active: true })).sort({ name: 1 }),
    distributorNames(req),
  ]);
  const head = ['SKU', 'Name', 'Form', 'Category', 'Batch', 'Distributor', 'Expiry', 'PurchaseRate', 'MRP', 'GSTPct', 'QtyInStock', 'Capacity', 'ReorderLevel', 'Status'];
  // Quote everything and double embedded quotes — a name with a comma must not
  // shift every later column.
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.map(esc).join(',')];
  for (const m of rows) {
    lines.push([
      m.sku, m.name, m.form ?? '', m.category, m.batch,
      m.distributorId ? names.get(m.distributorId.toString()) ?? '' : '',
      m.expiry ? m.expiry.toISOString().slice(0, 10) : '',
      m.purchaseRate, m.mrp, m.gstPct, m.qtyInStock, m.capacity, m.reorderLevel, stockStatus(m),
    ].map(esc).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="inventory-${istDateString(new Date())}.csv"`);
  res.send(`\uFEFF${lines.join('\r\n')}`); // BOM so Excel reads UTF-8
});

// POST /api/pharmacy/inventory/import — "Import Stock". Upsert by SKU+batch.
const importSchema = z.object({
  rows: z.array(medicineSchema.extend({ qtyInStock: z.number().int().min(0).max(1_000_000).optional() })).min(1).max(1000),
});
router.post('/inventory/import', auditAccess('pharmacy'), async (req, res) => {
  const { rows } = importSchema.parse(req.body);
  let created = 0;
  let updated = 0;
  const errors: { sku: string; message: string }[] = [];

  for (const r of rows) {
    try {
      const sku = r.sku.toUpperCase();
      const batch = r.batch.toUpperCase();
      const existing = await Medicine.findOne(scopeToDoctor(req, { sku, batch }));
      const qty = r.qtyInStock ?? 0;
      if (existing) {
        // An import ADDS stock to the batch it names; it never overwrites a
        // balance, so re-importing cannot silently erase a day's sales.
        existing.purchaseRate = r.purchaseRate;
        existing.mrp = r.mrp;
        if (r.expiry) existing.expiry = new Date(r.expiry);
        if (qty > 0) {
          existing.qtyInStock += qty;
          existing.capacity = Math.max(existing.capacity, existing.qtyInStock);
        }
        await existing.save();
        if (qty > 0) {
          await StockMovement.create({
            doctorUserId: req.userId, medicineId: existing._id, delta: qty,
            balanceAfter: existing.qtyInStock, reason: 'adjustment', refType: 'manual', note: 'Stock import',
          });
        }
        updated += 1;
      } else {
        const med = await Medicine.create({
          doctorUserId: req.userId, sku, name: r.name, form: r.form || undefined,
          category: r.category ?? 'Others', batch,
          expiry: r.expiry ? new Date(r.expiry) : undefined,
          purchaseRate: r.purchaseRate, mrp: r.mrp, gstPct: r.gstPct ?? 12,
          qtyInStock: qty, capacity: r.capacity ?? Math.max(qty, 100), reorderLevel: r.reorderLevel ?? 10,
        });
        if (qty > 0) {
          await StockMovement.create({
            doctorUserId: req.userId, medicineId: med._id, delta: qty, balanceAfter: qty,
            reason: 'adjustment', refType: 'manual', note: 'Stock import',
          });
        }
        created += 1;
      }
    } catch (e) {
      errors.push({ sku: r.sku, message: e instanceof Error ? e.message : 'Could not import' });
    }
  }
  res.json({ created, updated, failed: errors.length, errors });
});

// GET /api/pharmacy/movements?medicineId= — the auto-decrement trail.
router.get('/movements', auditAccess('pharmacy'), async (req, res) => {
  const medicineId = typeof req.query.medicineId === 'string' ? req.query.medicineId : '';
  const filter = medicineId && isValidObjectId(medicineId) ? { medicineId } : {};
  const [moves, meds] = await Promise.all([
    StockMovement.find(scopeToDoctor(req, filter)).sort({ createdAt: -1 }).limit(200),
    Medicine.find(scopeToDoctor(req)).select('name sku'),
  ]);
  const names = new Map(meds.map((m) => [m._id.toString(), `${m.name} (${m.sku})`]));
  res.json({
    movements: moves.map((m) => ({
      id: m._id,
      medicineId: m.medicineId,
      medicineName: names.get(m.medicineId.toString()) ?? 'Removed item',
      delta: m.delta,
      balanceAfter: m.balanceAfter,
      reason: m.reason,
      note: m.note ?? null,
      createdAt: m.createdAt,
    })),
  });
});

// ── Distributors ─────────────────────────────────────────────────────────────

router.get('/distributors', auditAccess('pharmacy'), async (req, res) => {
  const ds = await Distributor.find(scopeToDoctor(req, { active: true })).sort({ name: 1 });
  res.json({
    distributors: ds.map((d) => ({
      id: d._id, name: d.name, contactPerson: d.contactPerson ?? null, phone: d.phone ?? null,
      email: d.email ?? null, gstin: d.gstin ?? null, addressLine: d.addressLine ?? null,
    })),
  });
});

router.post('/distributors', auditAccess('pharmacy'), async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(120),
    contactPerson: z.string().trim().max(120).optional().or(z.literal('')),
    phone: z.string().trim().max(24).optional().or(z.literal('')),
    email: z.string().trim().email().max(160).optional().or(z.literal('')),
    gstin: z.string().trim().max(20).optional().or(z.literal('')),
    addressLine: z.string().trim().max(240).optional().or(z.literal('')),
  }).parse(req.body);
  const d = await Distributor.create({
    doctorUserId: req.userId, name: body.name,
    contactPerson: body.contactPerson || undefined, phone: body.phone || undefined,
    email: body.email || undefined, gstin: body.gstin || undefined, addressLine: body.addressLine || undefined,
  });
  res.status(201).json({ distributor: { id: d._id, name: d.name } });
});

/** Ledger for one distributor — purchases, payments and the outstanding balance. */
router.get('/distributors/:id/ledger', auditAccess('pharmacy'), async (req, res) => {
  const { id } = req.params;
  const d = isValidObjectId(id) ? await Distributor.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!d) {
    res.status(404).json({ error: 'Distributor not found' });
    return;
  }
  const purchases = await PharmacyPurchase.find(scopeToDoctor(req, { distributorId: d._id }))
    .sort({ invoiceDate: -1 })
    .limit(100);
  const totalPurchased = purchases.reduce((t, p) => t + p.grandTotal, 0);
  const totalPaid = purchases.reduce((t, p) => t + p.amountPaid, 0);
  res.json({
    distributor: { id: d._id, name: d.name },
    kpis: {
      totalPurchased: round2(totalPurchased),
      totalPaid: round2(totalPaid),
      outstanding: round2(totalPurchased - totalPaid),
    },
    // Running balance is DERIVED here, newest first, so it always reconciles.
    transactions: purchases.map((p) => ({
      id: p._id,
      date: p.invoiceDate,
      reference: p.invoiceNo,
      debit: p.grandTotal,
      credit: p.amountPaid,
      balance: round2(p.grandTotal - p.amountPaid),
      status: p.status,
    })),
  });
});

// ── Purchases (stock IN) ─────────────────────────────────────────────────────

const purchaseSchema = z.object({
  distributorId: z.string().min(1),
  invoiceNo: z.string().trim().min(1).max(60),
  invoiceDate: z.string().min(4).max(30),
  items: z.array(z.object({
    sku: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(160),
    batch: z.string().trim().min(1).max(40),
    expiry: z.string().max(20).optional().or(z.literal('')),
    qty: z.number().int().min(1).max(1_000_000),
    rate: z.number().min(0).max(1_000_000),
    mrp: z.number().min(0).max(1_000_000),
    gstPct: z.number().min(0).max(28),
  })).min(1).max(100),
  discount: z.number().min(0).max(10_000_000).optional(),
  amountPaid: z.number().min(0).max(10_000_000).optional(),
  paymentMode: z.enum(PAYMENT_MODES).optional(),
  paymentReference: z.string().trim().max(120).optional().or(z.literal('')),
  dueDate: z.string().max(30).optional().or(z.literal('')),
});

router.get('/purchases', auditAccess('pharmacy'), async (req, res) => {
  const [purchases, names] = await Promise.all([
    PharmacyPurchase.find(scopeToDoctor(req)).sort({ invoiceDate: -1 }).limit(200),
    distributorNames(req),
  ]);
  res.json({
    purchases: purchases.map((p) => ({
      id: p._id,
      invoiceNo: p.invoiceNo,
      invoiceDate: p.invoiceDate,
      distributorName: names.get(p.distributorId.toString()) ?? 'Distributor',
      itemCount: p.items.length,
      grandTotal: p.grandTotal,
      amountPaid: p.amountPaid,
      status: p.status,
    })),
  });
});

// POST /api/pharmacy/purchases — records the bill AND adds the stock.
router.post('/purchases', auditAccess('pharmacy'), async (req, res) => {
  const body = purchaseSchema.parse(req.body);
  const distributor = isValidObjectId(body.distributorId)
    ? await Distributor.findOne(scopeToDoctor(req, { _id: body.distributorId }))
    : null;
  if (!distributor) {
    res.status(400).json({ error: 'Choose a distributor from your own list' });
    return;
  }

  /**
   * Money is computed HERE from the line items. A client-sent total is ignored.
   *
   * NOTE the deliberate difference from a counter bill: a distributor quotes an
   * ex-GST `rate`, so tax is ADDED here. On a retail bill the price is the MRP,
   * which is tax-inclusive, so tax is EXTRACTED there. Both are correct; do not
   * "align" them.
   */
  const subtotal = round2(body.items.reduce((t, i) => t + i.qty * i.rate, 0));
  const gstAmount = round2(body.items.reduce((t, i) => t + (i.qty * i.rate * i.gstPct) / 100, 0));
  const discount = round2(body.discount ?? 0);
  const grandTotal = round2(subtotal + gstAmount - discount);
  if (grandTotal < 0) {
    res.status(400).json({ error: 'Discount cannot exceed the invoice total' });
    return;
  }
  const amountPaid = round2(Math.min(body.amountPaid ?? 0, grandTotal));
  const status = amountPaid >= grandTotal ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';

  // Create the purchase FIRST: its unique (doctor, distributor, invoiceNo) index
  // is what makes a double-submit fail loudly instead of adding stock twice.
  const purchase = await PharmacyPurchase.create({
    doctorUserId: req.userId,
    distributorId: distributor._id,
    invoiceNo: body.invoiceNo,
    invoiceDate: new Date(body.invoiceDate),
    items: body.items.map((i) => ({
      sku: i.sku.toUpperCase(), name: i.name, batch: i.batch.toUpperCase(),
      expiry: i.expiry ? new Date(i.expiry) : undefined,
      qty: i.qty, rate: i.rate, mrp: i.mrp, gstPct: i.gstPct,
    })),
    subtotal, gstAmount, discount, grandTotal, amountPaid,
    paymentMode: body.paymentMode ?? 'cash',
    paymentReference: body.paymentReference || undefined,
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    status,
  });

  // Then bring the stock in — one medicine row per SKU+batch, created if new.
  for (const line of purchase.items) {
    const med = await Medicine.findOneAndUpdate(
      scopeToDoctor(req, { sku: line.sku, batch: line.batch }),
      {
        $inc: { qtyInStock: line.qty },
        $set: {
          name: line.name, purchaseRate: line.rate, mrp: line.mrp, gstPct: line.gstPct,
          distributorId: distributor._id, active: true,
          ...(line.expiry ? { expiry: line.expiry } : {}),
        },
        $setOnInsert: { doctorUserId: req.userId, category: 'Others', reorderLevel: 10 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    // Keep the shelf at least as big as what is on it, so level% stays ≤ 100.
    if (med.capacity < med.qtyInStock) {
      med.capacity = med.qtyInStock;
      await med.save();
    }
    await StockMovement.create({
      doctorUserId: req.userId, medicineId: med._id, delta: line.qty,
      balanceAfter: med.qtyInStock, reason: 'purchase', refType: 'purchase', refId: purchase._id,
      note: `Purchase ${purchase.invoiceNo}`,
    });
  }

  res.status(201).json({
    purchase: {
      id: purchase._id, invoiceNo: purchase.invoiceNo, invoiceDate: purchase.invoiceDate,
      distributorName: distributor.name, subtotal, gstAmount, discount, grandTotal,
      amountPaid, balanceDue: round2(grandTotal - amountPaid), status,
      items: purchase.items.length,
    },
  });
});

// ── Bills (stock OUT) ────────────────────────────────────────────────────────

const billSchema = z.object({
  patientId: z.string().optional().or(z.literal('')),
  walkInName: z.string().trim().max(120).optional().or(z.literal('')),
  items: z.array(z.object({
    medicineId: z.string().min(1),
    qty: z.number().int().min(1).max(100_000),
    discPct: z.number().min(0).max(100).optional(),
  })).min(1).max(100),
  discount: z.number().min(0).max(10_000_000).optional(),
  amountReceived: z.number().min(0).max(10_000_000).optional(),
  paymentMode: z.enum(PAYMENT_MODES).optional(),
  paymentReference: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

/** Give back stock taken earlier in a bill that then failed. Best-effort. */
async function releaseStock(req: Parameters<typeof scopeToDoctor>[0], taken: { id: Types.ObjectId; qty: number }[]) {
  for (const t of taken) {
    await Medicine.updateOne(scopeToDoctor(req, { _id: t.id }), { $inc: { qtyInStock: t.qty } });
  }
}

/** INV-<yyyymmdd>-<n> — per-doctor sequential, collision-safe via the unique index. */
async function nextBillNumber(req: Parameters<typeof scopeToDoctor>[0]): Promise<string> {
  const day = istDateString(new Date()).replace(/-/g, '');
  const todayCount = await PharmacyBill.countDocuments(scopeToDoctor(req, { number: new RegExp(`^INV-${day}-`) }));
  return `INV-${day}-${String(todayCount + 1).padStart(4, '0')}`;
}

router.get('/bills', auditAccess('pharmacy'), async (req, res) => {
  const bills = await PharmacyBill.find(scopeToDoctor(req)).sort({ createdAt: -1 }).limit(200);
  const ids = [...new Set(bills.filter((b) => b.patientId).map((b) => b.patientId!.toString()))];
  const patients = ids.length ? await Patient.find(scopeToDoctor(req, { _id: { $in: ids } })) : [];
  const names = new Map(patients.map((p) => [p._id.toString(), decryptField(p.displayName)]));
  res.json({
    bills: bills.map((b) => ({
      id: b._id, number: b.number,
      customer: b.patientId ? names.get(b.patientId.toString()) ?? 'Patient' : b.walkInName || 'Walk-in',
      itemCount: b.items.length, payable: b.payable, amountReceived: b.amountReceived,
      paymentMode: b.paymentMode, status: b.status, createdAt: b.createdAt,
    })),
  });
});

router.get('/bills/:id', auditAccess('pharmacy'), async (req, res) => {
  const { id } = req.params;
  const bill = isValidObjectId(id) ? await PharmacyBill.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!bill) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }
  let customer = bill.walkInName || 'Walk-in customer';
  let patient: { id: string; name: string; dob: string | null; sex: string; phone: string | null } | null = null;
  if (bill.patientId) {
    const p = await Patient.findOne(scopeToDoctor(req, { _id: bill.patientId }));
    if (p) {
      customer = decryptField(p.displayName);
      patient = {
        id: p._id.toString(), name: customer,
        dob: p.dob ? decryptField(p.dob) : null, sex: p.sex,
        phone: p.phone ? decryptField(p.phone) : null,
      };
    }
  }
  res.json({ bill: { ...bill.toObject(), id: bill._id, customer, patient } });
});

// POST /api/pharmacy/bills — generates the invoice AND decrements stock.
router.post('/bills', auditAccess('pharmacy'), async (req, res) => {
  const body = billSchema.parse(req.body);
  if (!body.patientId && !body.walkInName) {
    res.status(400).json({ error: 'Select a patient or name the walk-in customer' });
    return;
  }

  // Patient (if any) must be this doctor's — verified in-query.
  let patient = null;
  if (body.patientId) {
    patient = isValidObjectId(body.patientId)
      ? await Patient.findOne(scopeToDoctor(req, { _id: body.patientId }))
      : null;
    if (!patient) {
      res.status(400).json({ error: 'Choose a patient from your own roster' });
      return;
    }
  }

  // Load every line's medicine up front so a bad id fails before any stock moves.
  const medIds = body.items.map((i) => i.medicineId);
  if (medIds.some((m) => !isValidObjectId(m))) {
    res.status(400).json({ error: 'One of the items is not a valid medicine' });
    return;
  }
  const meds = await Medicine.find(scopeToDoctor(req, { _id: { $in: medIds } }));
  const medById = new Map(meds.map((m) => [m._id.toString(), m]));
  for (const line of body.items) {
    if (!medById.has(line.medicineId)) {
      res.status(400).json({ error: 'One of the items is not in your inventory' });
      return;
    }
  }

  // Take the stock, guarded. Any shortfall rolls back what was already taken.
  const taken: { id: Types.ObjectId; qty: number }[] = [];
  const lines: IBillItem[] = [];
  for (const line of body.items) {
    const med = medById.get(line.medicineId)!;
    const updated = await Medicine.findOneAndUpdate(
      scopeToDoctor(req, { _id: med._id, qtyInStock: { $gte: line.qty } }),
      { $inc: { qtyInStock: -line.qty } },
      { new: true },
    );
    if (!updated) {
      await releaseStock(req, taken);
      const current = await Medicine.findOne(scopeToDoctor(req, { _id: med._id }));
      res.status(409).json({
        error: `${med.name} — only ${current?.qtyInStock ?? 0} left in stock`,
        sku: med.sku,
        available: current?.qtyInStock ?? 0,
      });
      return;
    }
    taken.push({ id: med._id, qty: line.qty });
    const discPct = line.discPct ?? 0;
    lines.push({
      medicineId: med._id, sku: med.sku, name: med.name, batch: med.batch,
      qty: line.qty, mrp: med.mrp, discPct, gstPct: med.gstPct,
      amount: round2(line.qty * med.mrp * (1 - discPct / 100)),
    });
  }

  /**
   * Money, derived server-side from the lines we just priced.
   *
   * ⚠ MRP IS TAX-INCLUSIVE. Under the Legal Metrology (Packaged Commodities)
   * Rules a retail sale may never exceed the printed MRP, so GST is EXTRACTED
   * from the amount the customer pays — never added on top of it. Adding it
   * would bill ₹72.80 for a ₹65 MRP strip, which is an offence, not a rounding
   * quibble.
   *
   *   payable = Σ(MRP × qty × (1 − lineDisc)) − billDiscount
   *   taxable = Σ(lineShareOfPayable ÷ (1 + rate))      ← back-calculated
   *   gst     = payable − taxable
   *
   * Rates can differ per line, so the split is computed per line and only then
   * summed; `factor` spreads the bill-level discount proportionally.
   */
  const gross = round2(lines.reduce((t, l) => t + l.amount, 0));
  const discount = round2(Math.min(body.discount ?? 0, gross));
  const payable = round2(gross - discount);
  const factor = gross > 0 ? payable / gross : 0;
  const taxable = round2(lines.reduce((t, l) => t + (l.amount * factor) / (1 + l.gstPct / 100), 0));
  const gstAmount = round2(payable - taxable);
  // Kept for the response/receipt: what the goods listed at before any discount.
  const subtotal = gross;
  const amountReceived = round2(body.amountReceived ?? 0);
  const changeReturned = round2(Math.max(0, amountReceived - payable));
  const status = amountReceived >= payable ? 'paid' : 'partial';

  let bill;
  try {
    bill = await PharmacyBill.create({
      doctorUserId: req.userId,
      number: await nextBillNumber(req),
      patientId: patient?._id,
      walkInName: patient ? undefined : body.walkInName || 'Walk-in customer',
      items: lines, subtotal, discount, taxable, gstAmount, payable,
      amountReceived, changeReturned,
      paymentMode: body.paymentMode ?? 'cash',
      paymentReference: body.paymentReference || undefined,
      notes: body.notes || undefined,
      status,
    });
  } catch (e) {
    // The invoice never persisted — put the stock back rather than losing it.
    await releaseStock(req, taken);
    throw e;
  }

  for (const l of lines) {
    const med = await Medicine.findOne(scopeToDoctor(req, { _id: l.medicineId })).select('qtyInStock');
    await StockMovement.create({
      doctorUserId: req.userId, medicineId: l.medicineId, delta: -l.qty,
      balanceAfter: med?.qtyInStock ?? 0, reason: 'sale', refType: 'bill', refId: bill._id,
      note: `Bill ${bill.number}`,
    });
  }

  res.status(201).json({
    bill: {
      id: bill._id, number: bill.number,
      customer: patient ? decryptField(patient.displayName) : bill.walkInName,
      items: lines, subtotal, discount, taxable, gstAmount, payable,
      amountReceived, changeReturned, status,
      paymentMode: bill.paymentMode, createdAt: bill.createdAt,
    },
  });
});

export default router;
