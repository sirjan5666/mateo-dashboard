import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { auditAccess } from '../middleware/audit.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { Patient } from '../models/Patient.js';
import { Encounter } from '../models/Encounter.js';
import { DoctorAppointment } from '../models/DoctorAppointment.js';
import { decryptOptional } from '../lib/crypto/fieldCipher.js';
import { istDateString } from '../lib/ist.js';

// Practice analytics for the doctor — read-only aggregates over the doctor's OWN
// (tenant-scoped) patients, encounters and appointments. Returns NO PHI, only
// counts; but it decrypts dob in memory to bucket ages, so it is audited as a
// read. All aggregations are $matched on doctorUserId (defence in depth).
const router = Router();
router.use(requireAuth, requireRole('doctor'));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MS_PER_MONTH = 30.4375 * 86_400_000;

router.get('/analytics', auditAccess('analytics'), async (req, res) => {
  const now = new Date();
  const [yr, mo] = istDateString(now).split('-').map(Number);
  const monthStart = new Date(`${yr}-${String(mo).padStart(2, '0')}-01T00:00:00+05:30`);

  // Last 6 IST months, oldest → current.
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    let mm = mo - i;
    let yy = yr;
    while (mm <= 0) {
      mm += 12;
      yy -= 1;
    }
    months.push({ key: `${yy}-${String(mm).padStart(2, '0')}`, label: MONTHS[mm - 1] });
  }
  const sixMonthsAgo = new Date(`${months[0].key}-01T00:00:00+05:30`);

  const tz = 'Asia/Kolkata';
  const doctorId = new Types.ObjectId(req.userId);

  const [activePatients, newThisMonth, encountersThisMonth, patientsByMonthAgg, encountersByMonthAgg, statusAgg, kindAgg, apptAgg, dobDocs] = await Promise.all([
    Patient.countDocuments(scopeToDoctor(req, { archivedAt: { $exists: false } })),
    Patient.countDocuments(scopeToDoctor(req, { createdAt: { $gte: monthStart } })),
    Encounter.countDocuments(scopeToDoctor(req, { date: { $gte: monthStart } })),
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: { doctorUserId: doctorId, createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: tz } }, count: { $sum: 1 } } },
    ]),
    Encounter.aggregate<{ _id: string; count: number }>([
      { $match: { doctorUserId: doctorId, date: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: tz } }, count: { $sum: 1 } } },
    ]),
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: { doctorUserId: doctorId, archivedAt: { $exists: false } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Encounter.aggregate<{ _id: string; count: number }>([
      { $match: { doctorUserId: doctorId } },
      { $group: { _id: '$kind', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    DoctorAppointment.aggregate<{ _id: string; count: number }>([
      { $match: { doctorUserId: doctorId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Patient.find(scopeToDoctor(req, { archivedAt: { $exists: false } })).select('dob'),
  ]);

  const pbm = new Map(patientsByMonthAgg.map((r) => [r._id, r.count]));
  const ebm = new Map(encountersByMonthAgg.map((r) => [r._id, r.count]));
  const patientsByMonth = months.map((m) => ({ month: m.label, count: pbm.get(m.key) ?? 0 }));
  const encountersByMonth = months.map((m) => ({ month: m.label, count: ebm.get(m.key) ?? 0 }));

  // Age buckets — decrypt dob in memory, return only counts.
  const buckets: Record<string, number> = { '<1y': 0, '1–2y': 0, '2–5y': 0, '5y+': 0, Unknown: 0 };
  for (const p of dobDocs) {
    const dobStr = decryptOptional(p.dob || undefined);
    const am = dobStr ? (now.getTime() - Date.parse(dobStr)) / MS_PER_MONTH : NaN;
    if (Number.isNaN(am) || am < 0) buckets.Unknown += 1;
    else if (am < 12) buckets['<1y'] += 1;
    else if (am < 24) buckets['1–2y'] += 1;
    else if (am < 60) buckets['2–5y'] += 1;
    else buckets['5y+'] += 1;
  }
  const ageGroups = Object.entries(buckets)
    .filter(([, v]) => v > 0)
    .map(([label, count]) => ({ label, count }));

  const outcomeMap = new Map(apptAgg.map((r) => [r._id, r.count]));
  const completed = outcomeMap.get('completed') ?? 0;
  const noShow = outcomeMap.get('no_show') ?? 0;
  const apptCompletionPct = completed + noShow > 0 ? Math.round((completed / (completed + noShow)) * 100) : null;

  res.json({
    kpis: { activePatients, newThisMonth, encountersThisMonth, apptCompletionPct },
    patientsByMonth,
    encountersByMonth,
    ageGroups,
    statusBreakdown: statusAgg.map((s) => ({ status: s._id, count: s.count })),
    encounterKinds: kindAgg.map((k) => ({ kind: k._id, count: k.count })),
    appointmentOutcomes: apptAgg.map((a) => ({ status: a._id, count: a.count })),
  });
});

export default router;
