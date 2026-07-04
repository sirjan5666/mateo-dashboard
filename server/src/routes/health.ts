import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { HealthRecord } from '../models/HealthRecord.js';
import type { IHealthRecord } from '../models/HealthRecord.js';
import { Appointment } from '../models/Appointment.js';
import type { IAppointment } from '../models/Appointment.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { isFutureISTDate } from '../lib/ist.js';

const MIN_DATE = new Date('2000-01-01T00:00:00.000Z');
const MAX_DATE = new Date('2100-01-01T00:00:00.000Z');

// ── Health records (past/today only) ──
const recordSchema = z.object({
  recordType: z.enum(['checkup', 'illness', 'medication', 'allergy', 'measurement', 'note', 'other']),
  title: z.string().trim().min(1).max(120),
  recordDate: z.coerce
    .date()
    .refine((d) => d.getTime() >= MIN_DATE.getTime(), 'Date is too far in the past')
    .refine((d) => !isFutureISTDate(d), 'Date cannot be in the future'),
  provider: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

function publicRecord(r: IHealthRecord & { id: string }) {
  return {
    id: r.id,
    recordType: r.recordType,
    title: r.title,
    recordDate: r.recordDate,
    provider: r.provider ?? null,
    notes: r.notes ?? null,
    createdAt: r.createdAt,
  };
}

// ── Appointments (future allowed) ──
const appointmentSchema = z.object({
  scheduledAt: z.coerce
    .date()
    .refine((d) => d.getTime() >= MIN_DATE.getTime(), 'Date is too far in the past')
    .refine((d) => d.getTime() <= MAX_DATE.getTime(), 'Date is too far in the future'),
  reason: z.string().trim().min(1).max(120),
  location: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

function publicAppointment(a: IAppointment & { id: string }) {
  return {
    id: a.id,
    scheduledAt: a.scheduledAt,
    reason: a.reason,
    location: a.location ?? null,
    notes: a.notes ?? null,
    completed: a.completed,
    createdAt: a.createdAt,
  };
}

const router = Router();

// ---- Records ----
router.get('/babies/:id/records', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const records = await HealthRecord.find({ babyId: baby._id }).sort({ recordDate: -1, createdAt: -1 });
  res.json({ records: records.map((r) => publicRecord(r)) });
});

router.post('/babies/:id/records', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const body = recordSchema.parse(req.body);
  if (body.recordDate.getTime() < baby.dob.getTime()) {
    res.status(400).json({ error: 'Date cannot be before the baby was born' });
    return;
  }
  const record = await HealthRecord.create({ babyId: baby._id, ...body });
  res.status(201).json({ record: publicRecord(record) });
});

router.delete('/babies/:id/records/:recordId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const recordId = String(req.params.recordId);
  const record = isValidObjectId(recordId) ? await HealthRecord.findById(recordId) : null;
  if (!record || record.babyId.toString() !== baby._id.toString()) {
    res.status(404).json({ error: 'Record not found' });
    return;
  }
  await record.deleteOne();
  res.json({ ok: true });
});

// ---- Appointments ----
router.get('/babies/:id/appointments', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const appointments = await Appointment.find({ babyId: baby._id }).sort({ scheduledAt: 1 });
  res.json({ appointments: appointments.map((a) => publicAppointment(a)) });
});

router.post('/babies/:id/appointments', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const body = appointmentSchema.parse(req.body);
  const appt = await Appointment.create({ babyId: baby._id, ...body });
  res.status(201).json({ appointment: publicAppointment(appt) });
});

const patchSchema = z.object({ completed: z.boolean() });

router.patch('/babies/:id/appointments/:apptId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const apptId = String(req.params.apptId);
  const appt = isValidObjectId(apptId) ? await Appointment.findById(apptId) : null;
  if (!appt || appt.babyId.toString() !== baby._id.toString()) {
    res.status(404).json({ error: 'Appointment not found' });
    return;
  }
  const { completed } = patchSchema.parse(req.body);
  appt.completed = completed;
  await appt.save();
  res.json({ appointment: publicAppointment(appt) });
});

router.delete('/babies/:id/appointments/:apptId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const apptId = String(req.params.apptId);
  const appt = isValidObjectId(apptId) ? await Appointment.findById(apptId) : null;
  if (!appt || appt.babyId.toString() !== baby._id.toString()) {
    res.status(404).json({ error: 'Appointment not found' });
    return;
  }
  await appt.deleteOne();
  res.json({ ok: true });
});

export default router;
