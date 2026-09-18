import { Router } from 'express';
import { Types, isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { guardRoutes, actorName } from '../middleware/permissions.js';
import { auditAccess, logAction } from '../middleware/audit.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { Patient } from '../models/Patient.js';
import { Encounter } from '../models/Encounter.js';
import { DoctorAppointment } from '../models/DoctorAppointment.js';
import { Invoice } from '../models/Invoice.js';
import { ClinicLocation } from '../models/ClinicLocation.js';
import { AuditLog } from '../models/AuditLog.js';
import { SavedReport, SAVED_REPORT_KEEP } from '../models/SavedReport.js';
import { decryptOptional } from '../lib/crypto/fieldCipher.js';
import { parseInvoiceItems } from '../lib/invoiceItems.js';
import { istDateString } from '../lib/ist.js';

// Practice analytics for the doctor — read-only aggregates over the doctor's OWN
// (tenant-scoped) patients, encounters and appointments. Returns NO PHI, only
// counts; but it decrypts dob in memory to bucket ages, so it is audited as a
// read. All aggregations are $matched on doctorUserId (defence in depth).
const router = Router();
// RBAC: a staff session is narrowed to what its role allows. The doctor who
// owns the practice passes every check — see middleware/permissions.ts.
// Saving an export is part of exporting, not a new kind of write — map the POST
// to the module's `export` action rather than the method-derived `create`, which
// the `reports` module does not define.
guardRoutes(router, 'reports', [{ match: '/analytics/reports/saved', method: 'POST', action: 'export' }]);

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
// age bucketing and service-name grouping). Defaults to the last 30 days.
const DAY = 86_400_000;
/** Day-series cap, so a multi-year range cannot explode the payload. */
const MAX_DAYS = 186;
/** Invoices decrypted for the Top Services split, newest first. */
const MAX_INVOICES_SCANNED = 3_000;
/** Named service rows before the tail is folded into "Others". */
const TOP_SERVICES = 5;
/** Rows in the Recent Activity feed. */
const ACTIVITY_ROWS = 8;
const reportRange = z.object({ from: z.string().max(40).optional(), to: z.string().max(40).optional() });
const SEX_LABEL: Record<string, string> = { male: 'Boys', female: 'Girls', other: 'Other', unspecified: 'Unspecified' };
const APPT_STATUS_LABEL: Record<string, string> = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };
const APPT_MODE_LABEL: Record<string, string> = { in_person: 'In-person', phone: 'Phone', video: 'Video' };
const ENC_KIND_LABEL: Record<string, string> = { visit: 'Visit', follow_up: 'Follow-up', phone: 'Phone', procedure: 'Procedure', note: 'Note' };
// Acquisition source is honest, not invented: a patient linked to a parent-app
// account (parentUserId set) came in through the family dashboard; everyone else
// was registered directly at the clinic. No fabricated funnel/lead stages.
const SOURCE_LABEL: Record<string, string> = { parent_app: 'Parent app', clinic: 'Clinic' };

router.get('/analytics/report', auditAccess('analytics'), async (req, res) => {
  const { from, to } = reportRange.parse(req.query);
  const now = new Date();
  // Both ends snap to IST calendar days, INCLUDING the default window. An
  // un-snapped start (now minus 29×24h) landed mid-afternoon, which put the
  // previous window's end label on the same day as this window's start label —
  // so the page read "20 Aug – 18 Sep, vs 22 Jul – 20 Aug". Whole days only.
  const startDay = from ? istDateString(new Date(from)) : istDateString(new Date(now.getTime() - 29 * DAY));
  const start = new Date(`${startDay}T00:00:00+05:30`);
  const end = to ? new Date(`${istDateString(new Date(to))}T23:59:59+05:30`) : now;
  /**
   * The immediately-preceding window of the SAME length — what every "vs …"
   * figure on the page is measured against. Nothing is invented: when the
   * previous window had no activity the delta comes back null and the card
   * shows the current figure on its own.
   */
  const span = Math.max(end.getTime() - start.getTime(), DAY);
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  const tz = 'Asia/Kolkata';
  const doctorId = new Types.ObjectId(req.userId);
  const perDay = (field: string) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: tz } });

  const [
    revByDayAgg, paidInvoices, billTotals,
    newPatients, activeNewPatients, activePatients,
    genderAgg, statusAgg, sourceAgg, dobDocs,
    apptStatusAgg, apptModeAgg, apptDurAgg, apptByDayAgg, apptLocationAgg,
    encKindAgg, encByDayAgg,
    invoiceItemDocs, locationDocs, activityRows,
    prevRevAgg, prevApptCount, prevEncCount, prevNewPatients,
  ] = await Promise.all([
      Invoice.aggregate<{ _id: string; amount: number }>([
        { $match: { doctorUserId: doctorId, status: { $ne: 'cancelled' }, paidAt: { $gte: start, $lte: end } } },
        { $group: { _id: perDay('$paidAt'), amount: { $sum: '$amountPaid' } } },
      ]),
      Invoice.countDocuments({ doctorUserId: doctorId, status: 'paid', paidAt: { $gte: start, $lte: end } }),
      Invoice.aggregate<{ invoiced: number; collected: number }>([
        { $match: { doctorUserId: doctorId, status: { $ne: 'cancelled' }, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, invoiced: { $sum: '$total' }, collected: { $sum: '$amountPaid' } } },
      ]),
      Patient.countDocuments({ doctorUserId: doctorId, createdAt: { $gte: start, $lte: end } }),
      // Same window but roster-only (archived excluded) — feeds the Total Patients
      // period filter (spec #1), which must stay consistent with the active count.
      Patient.countDocuments({ doctorUserId: doctorId, archivedAt: { $exists: false }, createdAt: { $gte: start, $lte: end } }),
      // The whole live roster. The Patient Demographics donut buckets the ages of
      // patients ACQUIRED in the window, so its centre needs the practice total
      // to sit against rather than a hard-coded 2,486.
      Patient.countDocuments({ doctorUserId: doctorId, archivedAt: { $exists: false } }),
      Patient.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: doctorId, createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: '$sex', count: { $sum: 1 } } },
      ]),
      Patient.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: doctorId, archivedAt: { $exists: false } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Acquisition source over ALL active patients (pairs with the Total Patients KPI).
      Patient.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: doctorId, archivedAt: { $exists: false } } },
        { $group: { _id: { $cond: [{ $ifNull: ['$parentUserId', false] }, 'parent_app', 'clinic'] }, count: { $sum: 1 } } },
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
      // Per-day appointments — the Appointments Overview line. Until this existed
      // the chart plotted flat zeroes, because only revenue had a daily split.
      DoctorAppointment.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: doctorId, start: { $gte: start, $lte: end } } },
        { $group: { _id: perDay('$start'), count: { $sum: 1 } } },
      ]),
      // Appointments per clinic location (null = no location recorded).
      DoctorAppointment.aggregate<{ _id: Types.ObjectId | null; count: number }>([
        { $match: { doctorUserId: doctorId, start: { $gte: start, $lte: end } } },
        { $group: { _id: '$locationId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Encounter.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: doctorId, date: { $gte: start, $lte: end } } },
        { $group: { _id: '$kind', count: { $sum: 1 } } },
      ]),
      Encounter.aggregate<{ _id: string; count: number }>([
        { $match: { doctorUserId: doctorId, date: { $gte: start, $lte: end } } },
        { $group: { _id: perDay('$date'), count: { $sum: 1 } } },
      ]),
      // Line items for the window, for the Top Services split. Capped: a busy
      // practice over a year-long range would otherwise decrypt unboundedly.
      Invoice.find({ doctorUserId: doctorId, status: { $ne: 'cancelled' }, date: { $gte: start, $lte: end } })
        .select('itemsEnc')
        .sort({ date: -1 })
        .limit(MAX_INVOICES_SCANNED),
      ClinicLocation.find({ doctorUserId: doctorId }).select('name'),
      // Recent Activity. ONLY the rows written by logAction() — those carry a
      // PHI-free one-line description. The bulk of the audit trail is per-request
      // access logging with no description, which is not activity a doctor reads.
      AuditLog.find({
        doctorUserId: doctorId,
        outcome: 'allow',
        actionKey: { $exists: true, $ne: null },
        description: { $exists: true, $ne: '' },
      })
        .sort({ at: -1 })
        .limit(ACTIVITY_ROWS)
        .select('action actionKey description actorName targetEntityId at'),
      Invoice.aggregate<{ amount: number }>([
        { $match: { doctorUserId: doctorId, status: { $ne: 'cancelled' }, paidAt: { $gte: prevStart, $lte: prevEnd } } },
        { $group: { _id: null, amount: { $sum: '$amountPaid' } } },
      ]),
      DoctorAppointment.countDocuments({ doctorUserId: doctorId, start: { $gte: prevStart, $lte: prevEnd } }),
      Encounter.countDocuments({ doctorUserId: doctorId, date: { $gte: prevStart, $lte: prevEnd } }),
      Patient.countDocuments({ doctorUserId: doctorId, createdAt: { $gte: prevStart, $lte: prevEnd } }),
    ]);

  // One shared list of IST day keys so revenue, appointments and consultations
  // all land on the same x-axis.
  const dayKeys: string[] = [];
  for (let t = start.getTime(), n = 0; t <= end.getTime() && n < MAX_DAYS; t += DAY, n += 1) {
    dayKeys.push(istDateString(new Date(t)));
  }
  const countsPerDay = (rows: { _id: string; count: number }[]) => {
    const m = new Map(rows.map((r) => [r._id, r.count]));
    return dayKeys.map((date) => ({ date, count: m.get(date) ?? 0 }));
  };

  const revMap = new Map(revByDayAgg.map((r) => [r._id, r.amount]));
  const byDay = dayKeys.map((date) => ({ date, amount: revMap.get(date) ?? 0 }));
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

  /**
   * Top services. The service names live INSIDE the encrypted invoice line
   * items, so they are decrypted in memory and only the aggregate leaves — the
   * same in-memory, audited pattern this route already uses to bucket ages.
   * Nothing here is attributable to a patient. Grouped case-insensitively,
   * keeping the first spelling the practice actually typed.
   */
  const serviceTotals = new Map<string, { label: string; count: number; amount: number }>();
  for (const inv of invoiceItemDocs) {
    for (const item of parseInvoiceItems(inv.itemsEnc)) {
      const label = String(item?.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!label) continue;
      const key = label.toLowerCase();
      const row = serviceTotals.get(key) ?? { label, count: 0, amount: 0 };
      row.count += 1;
      row.amount += Number.isFinite(Number(item?.amount)) ? Number(item.amount) : 0;
      serviceTotals.set(key, row);
    }
  }
  const rankedServices = [...serviceTotals.values()].sort((a, b) => b.count - a.count || b.amount - a.amount);
  const services = rankedServices.slice(0, TOP_SERVICES);
  const restServices = rankedServices.slice(TOP_SERVICES);
  if (restServices.length) {
    services.push({
      label: 'Others',
      count: restServices.reduce((s, r) => s + r.count, 0),
      amount: restServices.reduce((s, r) => s + r.amount, 0),
    });
  }

  // Appointments per clinic location. There is no per-PROVIDER split to give:
  // a practice is one doctor here, and staff (reception/OPD/accounts) are never
  // attributed to an appointment. Location is the split that actually exists.
  const locationNames = new Map(locationDocs.map((l) => [String(l._id), l.name]));
  const byLocation = apptLocationAgg.map((r) => ({
    label: r._id ? locationNames.get(String(r._id)) ?? 'Removed location' : 'No location recorded',
    count: r.count,
  }));

  const label = (map: Record<string, string>, rows: { _id: string; count: number }[]) =>
    rows.map((r) => ({ label: map[r._id] ?? r._id, count: r.count }));

  res.json({
    range: { from: istDateString(start), to: istDateString(end) },
    // The equal-length window before this one, so the client can show a real
    // change instead of a hard-coded percentage.
    previous: {
      from: istDateString(prevStart),
      to: istDateString(prevEnd),
      revenueTotal: prevRevAgg[0]?.amount ?? 0,
      appointments: prevApptCount,
      consultations: prevEncCount,
      newPatients: prevNewPatients,
    },
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
      activeNewCount: activeNewPatients,
      totalActive: activePatients,
      byGender: label(SEX_LABEL, genderAgg),
      byAge: Object.entries(buckets).filter(([, v]) => v > 0).map(([lbl, count]) => ({ label: lbl, count })),
      byStatus: statusAgg.map((s) => ({ label: s._id, count: s.count })),
      bySource: label(SOURCE_LABEL, sourceAgg),
    },
    appointments: {
      total: apptDurAgg[0]?.total ?? 0,
      avgDurationMin: apptDurAgg[0] ? Math.round(apptDurAgg[0].avg) : 0,
      byStatus: label(APPT_STATUS_LABEL, apptStatusAgg),
      byMode: label(APPT_MODE_LABEL, apptModeAgg),
      byDay: countsPerDay(apptByDayAgg),
      byLocation,
    },
    consultations: {
      total: encKindAgg.reduce((s, r) => s + r.count, 0),
      byKind: label(ENC_KIND_LABEL, encKindAgg),
      byDay: countsPerDay(encByDayAgg),
    },
    services,
    activity: activityRows.map((r) => ({
      id: String(r._id),
      action: r.actionKey ?? r.action,
      description: r.description ?? '',
      actorName: r.actorName ?? null,
      entityId: r.targetEntityId ?? null,
      at: r.at.toISOString(),
    })),
  });
});

// ── Saved reports — what the "Recent Reports" table lists ────────────────────
// A report the practice actually exported, with the CSV snapshot it downloaded.
// The snapshot is the point: re-running the range later gives different figures
// (invoices get paid, appointments complete), and a doctor re-downloading last
// week's export expects last week's numbers.
const savedReportBody = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['summary', 'appointments', 'revenue', 'patients', 'services']).default('summary'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  csv: z.string().min(1).max(200_000),
});

interface SavedRow {
  _id: unknown;
  name: string;
  type: string;
  rangeFrom: string;
  rangeTo: string;
  generatedByName: string;
  createdAt: Date;
}
const savedShape = (r: SavedRow) => ({
  id: String(r._id),
  name: r.name,
  type: r.type,
  from: r.rangeFrom,
  to: r.rangeTo,
  generatedBy: r.generatedByName,
  generatedAt: r.createdAt.toISOString(),
});

// GET /api/doctor/analytics/reports/saved?limit= — newest first, tenant-scoped.
router.get('/analytics/reports/saved', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), SAVED_REPORT_KEEP);
  const rows = await SavedReport.find(scopeToDoctor(req))
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('name type rangeFrom rangeTo generatedByName createdAt');
  res.json({ reports: rows.map(savedShape) });
});

// POST /api/doctor/analytics/reports/saved — records an export.
router.post('/analytics/reports/saved', async (req, res) => {
  const body = savedReportBody.parse(req.body);
  const [rangeFrom, rangeTo] = body.from <= body.to ? [body.from, body.to] : [body.to, body.from];
  const doc = await SavedReport.create({
    doctorUserId: req.userId,
    name: body.name,
    type: body.type,
    rangeFrom,
    rangeTo,
    // The staff member if there is one, else the doctor. A staff session carries
    // the DOCTOR as req.userId (the tenancy trick), so req.authUser?.name alone
    // would credit the wrong person for a receptionist's export.
    generatedByName: actorName(req) ?? 'Clinic',
    csvEnc: body.csv,
  });
  // Keep the history bounded: a practice exporting daily would otherwise grow it
  // without limit, and only the most recent rows are ever read.
  const stale = await SavedReport.find(scopeToDoctor(req))
    .sort({ createdAt: -1 })
    .skip(SAVED_REPORT_KEEP)
    .select('_id');
  if (stale.length) {
    await SavedReport.deleteMany({ doctorUserId: req.userId, _id: { $in: stale.map((s) => s._id) } });
  }
  logAction(req, {
    action: 'report.exported',
    description: `Exported "${doc.name}" for ${rangeFrom} → ${rangeTo}`,
    actor: { id: String(req.userId), name: actorName(req) },
    target: { entity: { type: 'savedreport', id: doc._id } },
    meta: { type: doc.type, from: rangeFrom, to: rangeTo },
  });
  res.status(201).json(savedShape(doc));
});

// GET /api/doctor/analytics/reports/saved/:id — hands back the stored CSV so the
// row's Download button re-downloads exactly what was exported.
router.get('/analytics/reports/saved/:id', async (req, res) => {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  const doc = await SavedReport.findOne(scopeToDoctor(req, { _id: id }));
  if (!doc) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  res.json({ ...savedShape(doc), csv: decryptOptional(doc.csvEnc) ?? '' });
});

export default router;
