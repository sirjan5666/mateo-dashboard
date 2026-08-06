import { Router } from 'express';
import { Types, isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { guardModule, loadStaffContext } from '../middleware/permissions.js';
import { auditAccess } from '../middleware/audit.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { ClinicLocation } from '../models/ClinicLocation.js';
import type { IClinicLocation } from '../models/ClinicLocation.js';
import { StaffMember } from '../models/StaffMember.js';
import { Patient } from '../models/Patient.js';
import { Invoice } from '../models/Invoice.js';
import { DoctorAppointment } from '../models/DoctorAppointment.js';
import { istDateString } from '../lib/ist.js';

// Multi-clinic management. Doctor-role-gated and tenant-scoped (doctorUserId) —
// a doctor can never read or mutate another practice's locations.
//
// Analytics are AGGREGATED LIVE from the tenant's own Patient / Invoice /
// Appointment collections. Nothing is cached on the location doc, so the numbers
// on this page can never drift from the collections they came from, and an empty
// practice honestly reports zeros rather than a seeded figure.
const router = Router();
// RBAC: a staff session is narrowed to what its role allows. The doctor who
// owns the practice passes every check — see middleware/permissions.ts.
router.use(requireAuth, requireRole('doctor'), loadStaffContext, guardModule('locations', [
  { match: '/active', method: 'PATCH', action: 'deactivate' },
]));

type LocationDoc = Awaited<ReturnType<typeof ClinicLocation.findOne>>;

interface LocStats {
  patients: number;
  revenueMtd: number;
  appointmentsMtd: number;
}
const NO_STATS: LocStats = { patients: 0, revenueMtd: 0, appointmentsMtd: 0 };

function shape(loc: NonNullable<LocationDoc>, teamMembers = 0, stats: LocStats = NO_STATS) {
  return {
    id: loc._id,
    name: loc.name,
    code: loc.code,
    addressLine: loc.addressLine,
    city: loc.city,
    state: loc.state,
    pincode: loc.pincode,
    phone: loc.phone ?? null,
    email: loc.email ?? null,
    services: loc.services ?? [],
    openingHours: loc.openingHours ?? null,
    drugLicenceNo: loc.drugLicenceNo ?? null,
    gstin: loc.gstin ?? null,
    isPrimary: loc.isPrimary,
    active: loc.active,
    hue: loc.hue,
    createdAt: loc.createdAt,
    // All three are real counts, scoped to this clinic. Patients carry a
    // locationId; revenue is attributed through the patient the invoice is for.
    teamMembers,
    patients: stats.patients,
    revenueMtd: stats.revenueMtd,
    appointmentsMtd: stats.appointmentsMtd,
  };
}

const HUES = ['#4F63F5', '#12A150', '#F59E0B', '#8B5CF6', '#EC4899', '#0EA5E9'];

/**
 * locationId -> { patients, revenueMtd, appointmentsMtd }, in three grouped
 * queries rather than three per clinic.
 *
 * Revenue and appointments hang off the PATIENT's clinic, not the invoice —
 * an invoice has no location of its own, and attributing it to where the
 * patient is registered is the only honest reading. Patients registered before
 * locations existed have no locationId and are simply not counted anywhere,
 * rather than being dumped into the primary clinic.
 */
async function locationStats(req: Parameters<typeof scopeToDoctor>[0], monthStart: Date): Promise<Map<string, LocStats>> {
  const doctorId = new Types.ObjectId(req.userId); // $match does not cast

  const [byPatients, byRevenue, byAppts] = await Promise.all([
    Patient.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { doctorUserId: doctorId, locationId: { $ne: null }, archivedAt: { $exists: false } } },
      { $group: { _id: '$locationId', n: { $sum: 1 } } },
    ]),
    Invoice.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { doctorUserId: doctorId, status: { $ne: 'cancelled' }, date: { $gte: monthStart } } },
      { $lookup: { from: 'patients', localField: 'patientId', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      { $match: { 'p.locationId': { $ne: null } } },
      { $group: { _id: '$p.locationId', n: { $sum: '$amountPaid' } } },
    ]),
    DoctorAppointment.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { doctorUserId: doctorId, start: { $gte: monthStart } } },
      { $lookup: { from: 'patients', localField: 'patientId', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      { $match: { 'p.locationId': { $ne: null } } },
      { $group: { _id: '$p.locationId', n: { $sum: 1 } } },
    ]),
  ]);

  const map = new Map<string, LocStats>();
  const put = (id: unknown, key: keyof LocStats, n: number) => {
    const k = String(id);
    const cur = map.get(k) ?? { ...NO_STATS };
    cur[key] = n;
    map.set(k, cur);
  };
  for (const r of byPatients) put(r._id, 'patients', r.n);
  for (const r of byRevenue) put(r._id, 'revenueMtd', r.n);
  for (const r of byAppts) put(r._id, 'appointmentsMtd', r.n);
  return map;
}

/** locationId -> active staff count, in one query rather than N. */
async function staffCounts(req: Parameters<typeof scopeToDoctor>[0]): Promise<Map<string, number>> {
  const rows = await StaffMember.find(scopeToDoctor(req, { active: true })).select('locationId');
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.locationId) continue;
    const k = r.locationId.toString();
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

const upsertSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9-]+$/, 'Use letters, numbers and hyphens only'),
  addressLine: z.string().trim().min(3).max(240),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  phone: z.string().trim().max(24).optional().or(z.literal('')),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  services: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  openingHours: z.string().trim().max(120).optional().or(z.literal('')),
  drugLicenceNo: z.string().trim().max(40).optional().or(z.literal('')),
  gstin: z.string().trim().max(20).optional().or(z.literal('')),
  isPrimary: z.boolean().optional(),
});

// GET /api/doctor/locations — every clinic this doctor practises at.
router.get('/locations', auditAccess('location'), async (req, res) => {
  const monthStart = new Date(`${istDateString(new Date()).slice(0, 7)}-01T00:00:00+05:30`);
  const [locations, staff, stats] = await Promise.all([
    ClinicLocation.find(scopeToDoctor(req)).sort({ isPrimary: -1, name: 1 }),
    staffCounts(req),
    locationStats(req, monthStart),
  ]);
  res.json({
    locations: locations.map((l) => shape(l, staff.get(l._id.toString()) ?? 0, stats.get(l._id.toString()))),
  });
});

/**
 * GET /api/doctor/locations/analytics — the numbers behind the Locations page.
 *
 * Every figure is counted from the tenant's own collections. Patients and
 * invoices do not currently carry a locationId, so per-location splits are not
 * invented here: the practice totals are returned once under `practice`, and
 * each location reports only what it genuinely owns (its own record). Wire
 * locationId onto Patient/Invoice to make these per-clinic.
 */
router.get('/locations/analytics', auditAccess('location'), async (req, res) => {
  const monthStart = new Date(`${istDateString(new Date()).slice(0, 7)}-01T00:00:00+05:30`);
  // $match does NOT cast — scopeToDoctor's string id would silently match nothing.
  const doctorId = new Types.ObjectId(req.userId);

  const [locations, patients, activePatients, invoiceAgg, monthInvoiceAgg, appointments] = await Promise.all([
    ClinicLocation.find(scopeToDoctor(req)).sort({ isPrimary: -1, name: 1 }),
    Patient.countDocuments(scopeToDoctor(req)),
    Patient.countDocuments(scopeToDoctor(req, { archivedAt: { $exists: false } })),
    Invoice.aggregate<{ revenue: number; count: number }>([
      { $match: { doctorUserId: doctorId, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, revenue: { $sum: '$amountPaid' }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate<{ revenue: number; count: number }>([
      { $match: { doctorUserId: doctorId, status: { $ne: 'cancelled' }, date: { $gte: monthStart } } },
      { $group: { _id: null, revenue: { $sum: '$amountPaid' }, count: { $sum: 1 } } },
    ]),
    DoctorAppointment.countDocuments(scopeToDoctor(req, { start: { $gte: monthStart } })),
  ]);

  res.json({
    practice: {
      totalPatients: patients,
      activePatients,
      revenueAllTime: invoiceAgg[0]?.revenue ?? 0,
      revenueMtd: monthInvoiceAgg[0]?.revenue ?? 0,
      invoicesMtd: monthInvoiceAgg[0]?.count ?? 0,
      appointmentsMtd: appointments,
    },
    locations: locations.map((l) => ({
      id: l._id,
      name: l.name,
      active: l.active,
      isPrimary: l.isPrimary,
      services: l.services?.length ?? 0,
    })),
    totals: {
      locations: locations.length,
      activeLocations: locations.filter((l) => l.active).length,
    },
  });
});

// GET /api/doctor/locations/:id
router.get('/locations/:id', auditAccess('location'), async (req, res) => {
  const { id } = req.params;
  const loc = isValidObjectId(id) ? await ClinicLocation.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!loc) {
    res.status(404).json({ error: 'Location not found' });
    return;
  }
  res.json({ location: shape(loc) });
});

// POST /api/doctor/locations — add a clinic. The first one is primary by default.
router.post('/locations', auditAccess('location'), async (req, res) => {
  const body = upsertSchema.parse(req.body);
  const existing = await ClinicLocation.countDocuments(scopeToDoctor(req));
  const makePrimary = body.isPrimary === true || existing === 0;

  // Demote the incumbent BEFORE inserting, so the "exactly one primary"
  // invariant never briefly holds two.
  if (makePrimary) {
    await ClinicLocation.updateMany(scopeToDoctor(req, { isPrimary: true }), { $set: { isPrimary: false } });
  }

  const loc = await ClinicLocation.create({
    doctorUserId: req.userId,
    name: body.name,
    code: body.code.toLowerCase(),
    addressLine: body.addressLine,
    city: body.city,
    state: body.state,
    pincode: body.pincode,
    phone: body.phone || undefined,
    email: body.email || undefined,
    services: body.services ?? [],
    openingHours: body.openingHours || undefined,
    drugLicenceNo: body.drugLicenceNo || undefined,
    gstin: body.gstin ? body.gstin.toUpperCase() : undefined,
    isPrimary: makePrimary,
    active: true,
    hue: HUES[existing % HUES.length],
  });
  res.status(201).json({ location: shape(loc) });
});

// PATCH /api/doctor/locations/:id — edit. Ownership is verified in-query.
router.patch('/locations/:id', auditAccess('location'), async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Location not found' });
    return;
  }
  const body = upsertSchema.partial().parse(req.body);
  const loc = await ClinicLocation.findOne(scopeToDoctor(req, { _id: id }));
  if (!loc) {
    res.status(404).json({ error: 'Location not found' });
    return;
  }

  const patch: Partial<IClinicLocation> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.code !== undefined) patch.code = body.code.toLowerCase();
  if (body.addressLine !== undefined) patch.addressLine = body.addressLine;
  if (body.city !== undefined) patch.city = body.city;
  if (body.state !== undefined) patch.state = body.state;
  if (body.pincode !== undefined) patch.pincode = body.pincode;
  if (body.phone !== undefined) patch.phone = body.phone || undefined;
  if (body.email !== undefined) patch.email = body.email || undefined;
  if (body.services !== undefined) patch.services = body.services;
  if (body.openingHours !== undefined) patch.openingHours = body.openingHours || undefined;
  if (body.drugLicenceNo !== undefined) patch.drugLicenceNo = body.drugLicenceNo || undefined;
  if (body.gstin !== undefined) patch.gstin = body.gstin ? body.gstin.toUpperCase() : undefined;

  Object.assign(loc, patch);
  await loc.save();
  res.json({ location: shape(loc) });
});

// POST /api/doctor/locations/:id/primary — "Set as Primary" in the row menu.
router.post('/locations/:id/primary', auditAccess('location'), async (req, res) => {
  const { id } = req.params;
  const loc = isValidObjectId(id) ? await ClinicLocation.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!loc) {
    res.status(404).json({ error: 'Location not found' });
    return;
  }
  // A deactivated clinic must not become the practice's primary address.
  if (!loc.active) {
    res.status(400).json({ error: 'Reactivate this location before making it primary' });
    return;
  }
  await ClinicLocation.updateMany(scopeToDoctor(req, { isPrimary: true }), { $set: { isPrimary: false } });
  loc.isPrimary = true;
  await loc.save();
  const monthStart = new Date(`${istDateString(new Date()).slice(0, 7)}-01T00:00:00+05:30`);
  const [locations, staff, stats] = await Promise.all([
    ClinicLocation.find(scopeToDoctor(req)).sort({ isPrimary: -1, name: 1 }),
    staffCounts(req),
    locationStats(req, monthStart),
  ]);
  res.json({
    locations: locations.map((l) => shape(l, staff.get(l._id.toString()) ?? 0, stats.get(l._id.toString()))),
  });
});

// POST /api/doctor/locations/:id/active — "Deactivate" / "Activate".
router.post('/locations/:id/active', auditAccess('location'), async (req, res) => {
  const { id } = req.params;
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  const loc = isValidObjectId(id) ? await ClinicLocation.findOne(scopeToDoctor(req, { _id: id })) : null;
  if (!loc) {
    res.status(404).json({ error: 'Location not found' });
    return;
  }
  // Deactivating the primary would leave the practice with no primary address.
  if (!active && loc.isPrimary) {
    const alternative = await ClinicLocation.findOne(
      scopeToDoctor(req, { _id: { $ne: loc._id }, active: true }),
    ).sort({ name: 1 });
    if (!alternative) {
      res.status(400).json({ error: 'This is your only active location — add another before deactivating it' });
      return;
    }
    alternative.isPrimary = true;
    await alternative.save();
    loc.isPrimary = false;
  }
  loc.active = active;
  await loc.save();
  const monthStart = new Date(`${istDateString(new Date()).slice(0, 7)}-01T00:00:00+05:30`);
  const [locations, staff, stats] = await Promise.all([
    ClinicLocation.find(scopeToDoctor(req)).sort({ isPrimary: -1, name: 1 }),
    staffCounts(req),
    locationStats(req, monthStart),
  ]);
  res.json({
    locations: locations.map((l) => shape(l, staff.get(l._id.toString()) ?? 0, stats.get(l._id.toString()))),
  });
});

export default router;
