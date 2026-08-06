import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { guardModule, loadStaffContext } from '../middleware/permissions.js';
import { loadOwnedPatient, scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { auditAccess, recordAudit } from '../middleware/audit.js';
import { requireConsent } from '../middleware/requireConsent.js';
import { DoctorAppointment, APPOINTMENT_MODES, APPOINTMENT_STATUSES } from '../models/DoctorAppointment.js';
import type { IDoctorAppointment } from '../models/DoctorAppointment.js';
import { ClinicLocation } from '../models/ClinicLocation.js';
import { Patient } from '../models/Patient.js';
import type { IPatient } from '../models/Patient.js';
import { decryptField, decryptOptional } from '../lib/crypto/fieldCipher.js';

// Doctor's own scheduling for their patients. Tenant-scoped; `reason` decrypted only
// in the shaper. Schedule responses attach the (decrypted) patient name.
const router = Router();
// RBAC: a staff session is narrowed to what its role allows. The doctor who
// owns the practice passes every check — see middleware/permissions.ts.
router.use(requireAuth, requireRole('doctor'), loadStaffContext, guardModule('appointments'));

function publicAppointment(a: HydratedDocument<IDoctorAppointment>, patientName?: string) {
  return {
    id: a._id,
    patientId: a.patientId,
    patient: patientName ? { id: a.patientId, name: patientName } : undefined,
    start: a.start,
    durationMin: a.durationMin,
    mode: a.mode,
    status: a.status,
    reason: decryptOptional(a.reason || undefined) ?? null,
    symptoms: decryptOptional(a.symptoms || undefined) ?? null,
    notes: decryptOptional(a.notes || undefined) ?? null,
    locationId: a.locationId ?? null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

// Attach decrypted patient names to a batch of appointments (tenant-scoped fetch).
async function withPatients(req: Parameters<typeof scopeToDoctor>[0], appts: HydratedDocument<IDoctorAppointment>[]) {
  const ids = [...new Set(appts.map((a) => a.patientId.toString()))];
  const patients = await Patient.find(scopeToDoctor(req, { _id: { $in: ids } }));
  const nameById = new Map(patients.map((p) => [p._id.toString(), decryptField(p.displayName)]));
  return appts.map((a) => publicAppointment(a, nameById.get(a.patientId.toString())));
}

const apptShape = {
  start: z.string().min(1),
  durationMin: z.number().int().min(5).max(480).optional(),
  mode: z.enum(APPOINTMENT_MODES).optional(),
  reason: z.string().max(500).optional(),
  // Booking-time clinical context. PHI, encrypted at rest like `reason`.
  symptoms: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
  locationId: z.string().optional(),
};
const createSchema = z.object(apptShape);
const updateSchema = z.object({ ...apptShape, start: z.string().min(1).optional(), status: z.enum(APPOINTMENT_STATUSES).optional() });

/**
 * A doctor cannot be in two places at once, so an appointment may not overlap
 * another SCHEDULED one. Cancelled/completed/no-show slots are free again.
 *
 * The client greys out taken slots, but that is cosmetic — a stale tab, two
 * browser windows or a direct API call would all double-book without this.
 * `ignoreId` lets a reschedule move an appointment without colliding with itself.
 */
async function findClash(
  req: Parameters<typeof scopeToDoctor>[0],
  start: Date,
  durationMin: number,
  ignoreId?: string,
) {
  const end = new Date(start.getTime() + durationMin * 60_000);
  const filter = scopeToDoctor(req, {
    status: 'scheduled',
    // Any appointment starting before this one ends; the overlap test below
    // then rules out those that finish before it starts.
    start: { $lt: end },
  });
  if (ignoreId) filter._id = { $ne: ignoreId };
  const near = await DoctorAppointment.find(filter).sort({ start: -1 }).limit(50);
  return near.find((a) => new Date(a.start.getTime() + a.durationMin * 60_000) > start) ?? null;
}

/** Doctor-facing, so the clashing time is IST wall-clock, not a raw ISO string. */
const IST_TIME = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
});
const clashMessage = (a: HydratedDocument<IDoctorAppointment>) =>
  `That slot overlaps an appointment already booked for ${IST_TIME.format(a.start)}`;

/** Bookings are for the future. A small grace window covers walk-ins being
 *  entered a few minutes after the patient actually arrived. */
const BACKDATE_GRACE_MS = 60 * 60_000;

function tooFarInThePast(start: Date): boolean {
  return start.getTime() < Date.now() - BACKDATE_GRACE_MS;
}

// GET /api/doctor/appointments/:appointmentId — one appointment.
// The reschedule form loads from here; scanning a date window instead would
// silently show a blank form for anything outside it.
router.get('/appointments/:appointmentId', auditAccess('appointment'), async (req, res) => {
  const { appointmentId } = req.params;
  const appt = isValidObjectId(appointmentId)
    ? await DoctorAppointment.findOne(scopeToDoctor(req, { _id: appointmentId }))
    : null;
  if (!appt) {
    res.status(404).json({ error: 'Appointment not found' });
    return;
  }
  const [shaped] = await withPatients(req, [appt]);
  res.json({ appointment: shaped });
});

// GET /api/doctor/appointments?from=&to=&status= — the doctor's schedule.
router.get('/appointments', auditAccess('appointment'), async (req, res) => {
  const q = z
    .object({ from: z.string().optional(), to: z.string().optional(), status: z.enum(APPOINTMENT_STATUSES).optional() })
    .parse(req.query);
  const filter = scopeToDoctor(req, {});
  const range: Record<string, Date> = {};
  if (q.from) range.$gte = new Date(q.from);
  if (q.to) range.$lte = new Date(q.to);
  if (q.from || q.to) filter.start = range;
  if (q.status) filter.status = q.status;
  const appts = await DoctorAppointment.find(filter).sort({ start: 1 }).limit(500);
  res.json({ appointments: await withPatients(req, appts) });
});

// GET /api/doctor/patients/:id/appointments — one patient's appointments.
router.get('/patients/:id/appointments', auditAccess('appointment'), loadOwnedPatient, async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const appts = await DoctorAppointment.find(scopeToDoctor(req, { patientId: patient._id })).sort({ start: -1 });
  res.json({ appointments: appts.map((a) => publicAppointment(a)) });
});

// POST /api/doctor/patients/:id/appointments — schedule a visit.
router.post('/patients/:id/appointments', loadOwnedPatient, requireConsent('treatment'), async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const body = createSchema.parse(req.body);
  const locationId = body.locationId && isValidObjectId(body.locationId)
    ? (await ClinicLocation.findOne(scopeToDoctor(req, { _id: body.locationId })))?._id ?? null
    : null;

  const start = new Date(body.start);
  const durationMin = body.durationMin ?? 30;
  if (Number.isNaN(start.getTime())) {
    res.status(400).json({ error: 'That date and time could not be read' });
    return;
  }
  if (tooFarInThePast(start)) {
    res.status(400).json({ error: 'Appointments cannot be booked in the past' });
    return;
  }
  const clash = await findClash(req, start, durationMin);
  if (clash) {
    res.status(409).json({ error: clashMessage(clash) });
    return;
  }

  const appt = new DoctorAppointment({
    doctorUserId: req.userId,
    patientId: patient._id,
    start,
    durationMin,
    mode: body.mode ?? 'in_person',
    reason: body.reason || undefined,
    symptoms: body.symptoms || undefined,
    notes: body.notes || undefined,
    // Validated against the doctor's own clinics — never trusted from the client.
    locationId: locationId ?? undefined,
  });
  await appt.save();
  await recordAudit(req, {
    action: 'create',
    resourceType: 'appointment',
    resourceId: appt._id,
    patientId: patient._id,
    changedFields: ['start', 'durationMin', 'mode', ...(body.reason ? ['reason'] : [])],
    outcome: 'allow',
  });
  res.status(201).json({ appointment: publicAppointment(appt) });
});

// PATCH /api/doctor/appointments/:appointmentId — reschedule / set status.
router.patch('/appointments/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;
  const appt = isValidObjectId(appointmentId)
    ? await DoctorAppointment.findOne(scopeToDoctor(req, { _id: appointmentId }))
    : null;
  if (!appt) {
    res.status(404).json({ error: 'Appointment not found' });
    return;
  }
  const body = updateSchema.parse(req.body);
  const changed: string[] = [];

  // A move has to clear the same guards as a fresh booking — otherwise the
  // reschedule path is a hole straight through them. Checked BEFORE anything is
  // mutated, so a rejected move leaves the appointment exactly as it was.
  const movingTo = body.start !== undefined ? new Date(body.start) : appt.start;
  const movingDuration = body.durationMin ?? appt.durationMin;
  if (Number.isNaN(movingTo.getTime())) {
    res.status(400).json({ error: 'That date and time could not be read' });
    return;
  }
  const rescheduling = body.start !== undefined || body.durationMin !== undefined;
  // Status-only writes (cancel, mark completed) must never be blocked by these.
  if (rescheduling) {
    if (tooFarInThePast(movingTo)) {
      res.status(400).json({ error: 'Appointments cannot be moved into the past' });
      return;
    }
    // A cancelled appointment being revived still must not land on a taken slot.
    if ((body.status ?? appt.status) === 'scheduled') {
      const clash = await findClash(req, movingTo, movingDuration, appt.id as string);
      if (clash) {
        res.status(409).json({ error: clashMessage(clash) });
        return;
      }
    }
  }

  if (body.start !== undefined) {
    appt.start = movingTo;
    changed.push('start');
  }
  if (body.durationMin !== undefined) {
    appt.durationMin = body.durationMin;
    changed.push('durationMin');
  }
  if (body.mode !== undefined) {
    appt.mode = body.mode;
    changed.push('mode');
  }
  if (body.status !== undefined) {
    appt.status = body.status;
    changed.push('status');
  }
  if (body.reason !== undefined) {
    appt.reason = body.reason || undefined;
    changed.push('reason');
  }
  if (body.symptoms !== undefined) {
    appt.symptoms = body.symptoms || undefined;
    changed.push('symptoms');
  }
  if (body.notes !== undefined) {
    appt.notes = body.notes || undefined;
    changed.push('notes');
  }
  await appt.save();
  await recordAudit(req, {
    action: 'update',
    resourceType: 'appointment',
    resourceId: appt._id,
    patientId: appt.patientId,
    changedFields: changed,
    outcome: 'allow',
  });
  res.json({ appointment: publicAppointment(appt) });
});

export default router;
