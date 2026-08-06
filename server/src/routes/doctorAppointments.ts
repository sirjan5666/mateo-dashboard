import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
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
router.use(requireAuth, requireRole('doctor'));

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
  const appt = new DoctorAppointment({
    doctorUserId: req.userId,
    patientId: patient._id,
    start: new Date(body.start),
    durationMin: body.durationMin ?? 30,
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
  if (body.start !== undefined) {
    appt.start = new Date(body.start);
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
