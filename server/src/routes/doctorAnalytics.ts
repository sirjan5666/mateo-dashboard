import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { auditAccess } from '../middleware/audit.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { Patient } from '../models/Patient.js';
import { Encounter } from '../models/Encounter.js';
import { DoctorAppointment } from '../models/DoctorAppointment.js';
import { Invoice } from '../models/Invoice.js';
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

// GET /api/doctor/analytics/report?from=&to= — date-range report feeding the
// Reports page (Revenue / Patients / Appointments / Consultations tabs). All
// tenant-scoped; returns counts + money aggregates only (no PHI beyond in-memory
// age bucketing). Defaults to the last 30 days.
const DAY = 86_400_000;
const reportRange = z.object({ from: z.string().max(40).optional(), to: z.string().max(40).optional() });
const SEX_LABEL: Record<string, string> = { male: 'Boys', female: 'Girls', other: 'Other', unspecified: 'Unspecified' };
const APPT_STATUS_LABEL: Record<string, string> = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };
const APPT_MODE_LABEL: Record<string, string> = { in_person: 'In-person', phone: 'Phone', video: 'Video' };
const ENC_KIND_LABEL: Record<string, string> = { visit: 'Visit', follow_up: 'Follow-up', phone: 'Phone', procedure: 'Procedure', note: 'Note' };

router.get('/analytics/report', auditAccess('analytics'), async (req, res) => {
  const { from, to } = reportRange.parse(req.query);
  const now = new Date();
  const start = from ? new Date(`${istDateString(new Date(from))}T00:00:00+05:30`) : new Date(now.getTime() - 29 * DAY);
  const end = to ? new Date(`${istDateString(new Date(to))}T23:59:59+05:30`) : now;
  const tz = 'Asia/Kolkata';
  const doctorId = new Types.ObjectId(req.userId);

  const [revByDayAgg, paidInvoices, billTotals, newPatients, genderAgg, statusAgg, dobDocs, apptStatusAgg, apptModeAgg, apptDurAgg, encKindAgg] =
    await Promise.all([
      Invoice.aggregate<{ _id: string; amount: number }>([
        { $match: { doctorUserId: doctorId, status: { $ne: 'cancelled' }, paidAt: { $gte: start, $lte: end } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: tz } }, amount: { $sum: '$amountPaid' } } },
      ]),
      Invoice.countDocuments({ doctorUserId: doctorId, status: 'paid', paidAt: { $gte: start, $lte: end } }),
      Invoice.aggregate<{ invoiced: number; collected: number }>([
        { $match: { doctorUserId: doctorId, status: { $ne: 'cancelled' }, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, invoiced: { $sum: '$total' }, collected: { $sum: '$amountPaid' } } },
      ]),
      Patient.countDocuments({ doctorUserId: doctorId, createdAt: { $gte: start, $lte: end } }),
      Patient.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: doctorId, createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: '$sex', count: { $sum: 1 } } },
      ]),
      Patient.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: doctorId, archivedAt: { $exists: false } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Patient.find({ doctorUserId: doctorId, createdAt: { $gte: start, $lte: end } }).select('dob'),
      DoctorAppointment.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: doctorId, start: { $gte: start, $lte: end } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DoctorAppointment.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: doctorId, start: { $gte: start, $lte: end } } },
        { $group: { _id: '$mode', count: { $sum: 1 } } },
      ]),
      DoctorAppointment.aggregate<{ avg: number; total: number }>([
        { $match: { doctorUserId: doctorId, start: { $gte: start, $lte: end } } },
        { $group: { _id: null, avg: { $avg: '$durationMin' }, total: { $sum: 1 } } },
      ]),
      Encounter.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: doctorId, date: { $gte: start, $lte: end } } },
        { $group: { _id: '$kind', count: { $sum: 1 } } },
      ]),
    ]);

  // Revenue by day across the whole range (capped so a huge range can't explode).
  const revMap = new Map(revByDayAgg.map((r) => [r._id, r.amount]));
  const byDay: { date: string; amount: number }[] = [];
  for (let t = start.getTime(), n = 0; t <= end.getTime() && n < 186; t += DAY, n += 1) {
    const k = istDateString(new Date(t));
    byDay.push({ date: k, amount: revMap.get(k) ?? 0 });
  }
  const revTotal = [...revMap.values()].reduce((s, v) => s + v, 0);
  const topDays = byDay.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const invoiced = billTotals[0]?.invoiced ?? 0;
  const collected = billTotals[0]?.collected ?? 0;

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

  const label = (map: Record<string, string>, rows: { _id: string; count: number }[]) =>
    rows.map((r) => ({ label: map[r._id] ?? r._id, count: r.count }));

  res.json({
    range: { from: istDateString(start), to: istDateString(end) },
    revenue: {
      total: revTotal,
      paidInvoices,
      collectionRate: invoiced > 0 ? Math.round((collected / invoiced) * 100) : null,
      collected,
      invoiced,
      byDay,
      topDays,
    },
    patients: {
      newCount: newPatients,
      byGender: label(SEX_LABEL, genderAgg),
      byAge: Object.entries(buckets).filter(([, v]) => v > 0).map(([lbl, count]) => ({ label: lbl, count })),
      byStatus: statusAgg.map((s) => ({ label: s._id, count: s.count })),
    },
    appointments: {
      total: apptDurAgg[0]?.total ?? 0,
      avgDurationMin: apptDurAgg[0] ? Math.round(apptDurAgg[0].avg) : 0,
      byStatus: label(APPT_STATUS_LABEL, apptStatusAgg),
      byMode: label(APPT_MODE_LABEL, apptModeAgg),
    },
    consultations: {
      total: encKindAgg.reduce((s, r) => s + r.count, 0),
      byKind: label(ENC_KIND_LABEL, encKindAgg),
    },
  });
});

export default router;
