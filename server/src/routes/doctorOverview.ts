import { Router } from 'express';
import { Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { auditAccess } from '../middleware/audit.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { Patient } from '../models/Patient.js';
import { Encounter } from '../models/Encounter.js';
import { DoctorAppointment } from '../models/DoctorAppointment.js';
import { CareMessage } from '../models/CareMessage.js';
import type { IDoctorAppointment } from '../models/DoctorAppointment.js';
import { decryptField } from '../lib/crypto/fieldCipher.js';
import { istDateString } from '../lib/ist.js';

// EHR dashboard aggregates for the doctor home — all tenant-scoped. Returns some PHI
// (patient names), so it is audited as a read. Day windows use the IST calendar.
const router = Router();
router.use(requireAuth, requireRole('doctor'));

const DAY_MS = 24 * 60 * 60 * 1000;
/** UTC instant of IST midnight for the given instant's IST day (IST = UTC+5:30, no DST). */
function istDayStartUTC(d: Date): Date {
  return new Date(`${istDateString(d)}T00:00:00+05:30`);
}

router.get('/overview', auditAccess('dashboard'), async (req, res) => {
  const now = new Date();
  const todayStart = istDayStartUTC(now);
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);
  const weekStart = new Date(todayStart.getTime() - 6 * DAY_MS); // last 7 IST days incl. today

  const activeFilter = scopeToDoctor(req, { archivedAt: { $exists: false } });

  const [activePatients, todayAppts, upcomingAppts, weekEncounters, recentPatients, encountersWeek, statusAgg, unreadMessages] =
    await Promise.all([
      Patient.countDocuments(activeFilter),
      DoctorAppointment.find(scopeToDoctor(req, { start: { $gte: todayStart, $lt: todayEnd } })).sort({ start: 1 }),
      DoctorAppointment.find(scopeToDoctor(req, { start: { $gte: now }, status: 'scheduled' })).sort({ start: 1 }).limit(6),
      Encounter.countDocuments(scopeToDoctor(req, { date: { $gte: weekStart } })),
      Patient.find(activeFilter).sort({ updatedAt: -1 }).limit(6),
      Encounter.find(scopeToDoctor(req, { date: { $gte: weekStart } })).select('date'),
      Patient.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: new Types.ObjectId(req.userId), archivedAt: { $exists: false } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      CareMessage.countDocuments(scopeToDoctor(req, { senderRole: 'patient', readByDoctorAt: { $exists: false } })),
    ]);

  // Decrypt names for the appointments shown (one scoped fetch).
  const apptIds = [...new Set([...todayAppts, ...upcomingAppts].map((a) => a.patientId.toString()))];
  const apptPatients = await Patient.find(scopeToDoctor(req, { _id: { $in: apptIds } }));
  const nameById = new Map(apptPatients.map((p) => [p._id.toString(), decryptField(p.displayName)]));
  const shapeAppt = (a: HydratedDocument<IDoctorAppointment>) => ({
    id: a._id,
    patientId: a.patientId,
    patientName: nameById.get(a.patientId.toString()) ?? 'Patient',
    start: a.start,
    durationMin: a.durationMin,
    mode: a.mode,
    status: a.status,
  });

  // Bucket encounters into the last 7 IST days.
  const dayCounts = new Map<string, number>();
  for (let i = 0; i < 7; i += 1) dayCounts.set(istDateString(new Date(weekStart.getTime() + i * DAY_MS)), 0);
  for (const e of encountersWeek) {
    const k = istDateString(e.date);
    if (dayCounts.has(k)) dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
  }

  res.json({
    counts: {
      activePatients,
      todayAppointments: todayAppts.length,
      weekEncounters,
      upcoming: upcomingAppts.length,
      unreadMessages,
    },
    today: todayAppts.map(shapeAppt),
    upcoming: upcomingAppts.map(shapeAppt),
    recentPatients: recentPatients.map((p) => ({
      id: p._id,
      name: decryptField(p.displayName),
      status: p.status,
      specialtyTemplateId: p.specialtyTemplateId,
      updatedAt: p.updatedAt,
    })),
    encountersByDay: [...dayCounts.entries()].map(([date, count]) => ({ date, count })),
    statusBreakdown: statusAgg.map((s) => ({ status: s._id, count: s.count })),
  });
});

export default router;
