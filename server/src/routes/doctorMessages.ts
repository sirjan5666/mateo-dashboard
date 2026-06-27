import { Router } from 'express';
import { Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loadOwnedPatient, scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { auditAccess, recordAudit } from '../middleware/audit.js';
import { CareMessage } from '../models/CareMessage.js';
import type { ICareMessage, MessageSender } from '../models/CareMessage.js';
import { Patient } from '../models/Patient.js';
import { decryptField } from '../lib/crypto/fieldCipher.js';
import type { IPatient } from '../models/Patient.js';

// Doctor side of the doctor<->patient care thread. Tenant-scoped; message bodies
// decrypted only in the shaper. Reading marks the patient's messages as read.
const router = Router();
router.use(requireAuth, requireRole('doctor'));

function shape(m: HydratedDocument<ICareMessage>) {
  return {
    id: m._id,
    senderRole: m.senderRole,
    body: decryptField(m.body),
    mine: m.senderRole === 'doctor',
    createdAt: m.createdAt,
  };
}

// GET /api/doctor/threads — one row per patient with a thread: last message + unread count.
router.get('/threads', async (req, res) => {
  const agg = await CareMessage.aggregate<{ _id: Types.ObjectId; lastBody: string; lastSender: MessageSender; lastAt: Date; unread: number }>([
    { $match: { doctorUserId: new Types.ObjectId(req.userId) } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$patientId',
        lastBody: { $first: '$body' },
        lastSender: { $first: '$senderRole' },
        lastAt: { $first: '$createdAt' },
        unread: { $sum: { $cond: [{ $and: [{ $eq: ['$senderRole', 'patient'] }, { $eq: [{ $type: '$readByDoctorAt' }, 'missing'] }] }, 1, 0] } },
      },
    },
    { $sort: { lastAt: -1 } },
  ]);
  // Decrypt names only for patients still owned by this doctor (defensive scope).
  const patients = await Patient.find(scopeToDoctor(req, { _id: { $in: agg.map((a) => a._id) } }));
  const nameById = new Map(patients.map((p) => [p._id.toString(), decryptField(p.displayName)]));
  const threads = agg
    .filter((a) => nameById.has(a._id.toString()))
    .map((a) => ({
      patientId: a._id,
      patientName: nameById.get(a._id.toString()),
      lastSender: a.lastSender,
      lastBody: decryptField(a.lastBody),
      lastAt: a.lastAt,
      unread: a.unread,
    }));
  res.json({ threads });
});

// GET /api/doctor/notifications — unread (patient-sent) message counts, total + per patient.
router.get('/notifications', async (req, res) => {
  const agg = await CareMessage.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { doctorUserId: new Types.ObjectId(req.userId), senderRole: 'patient', readByDoctorAt: { $exists: false } } },
    { $group: { _id: '$patientId', count: { $sum: 1 } } },
  ]);
  const byPatient = agg.map((a) => ({ patientId: a._id, count: a.count }));
  res.json({ messages: { total: byPatient.reduce((s, x) => s + x.count, 0), byPatient } });
});

// GET /api/doctor/patients/:id/messages — full thread (marks patient msgs read).
router.get('/patients/:id/messages', auditAccess('message'), loadOwnedPatient, async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  await CareMessage.updateMany(
    scopeToDoctor(req, { patientId: patient._id, senderRole: 'patient', readByDoctorAt: { $exists: false } }),
    { $set: { readByDoctorAt: new Date() } },
  );
  const list = await CareMessage.find(scopeToDoctor(req, { patientId: patient._id })).sort({ createdAt: 1 });
  res.json({ messages: list.map(shape) });
});

// POST /api/doctor/patients/:id/messages — send a message to the patient.
router.post('/patients/:id/messages', loadOwnedPatient, async (req, res) => {
  const patient = req.patient as HydratedDocument<IPatient>;
  const { body } = z.object({ body: z.string().min(1).max(4000) }).parse(req.body);
  const msg = new CareMessage({
    doctorUserId: req.userId,
    patientId: patient._id,
    senderRole: 'doctor',
    senderUserId: req.userId,
    body,
    readByDoctorAt: new Date(),
  });
  await msg.save();
  await recordAudit(req, { action: 'create', resourceType: 'message', resourceId: msg._id, patientId: patient._id, outcome: 'allow' });
  res.status(201).json({ message: shape(msg) });
});

export default router;
