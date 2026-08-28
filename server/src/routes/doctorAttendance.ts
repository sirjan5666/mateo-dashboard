import { Router } from 'express';
import { z } from 'zod';
import { isValidObjectId } from 'mongoose';
import { guardRoutes } from '../middleware/permissions.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { StaffMember } from '../models/StaffMember.js';
import { StaffAttendance, ATTENDANCE_STATUSES } from '../models/StaffAttendance.js';
import { istDateString } from '../lib/ist.js';

const router = Router();
// Attendance is part of staff management — gate it with the 'team' module.
guardRoutes(router, 'team');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Roster + each person's attendance for one day (defaults to today, IST). */
router.get('/attendance', async (req, res) => {
  const date = typeof req.query.date === 'string' && DATE_RE.test(req.query.date) ? req.query.date : istDateString(new Date());
  const [staff, marks] = await Promise.all([
    StaffMember.find(scopeToDoctor(req, { active: true })).select('name employeeCode').sort({ name: 1 }),
    StaffAttendance.find(scopeToDoctor(req, { date })),
  ]);
  const byStaff = new Map(marks.map((m) => [m.staffId.toString(), m]));
  res.json({
    date,
    staff: staff.map((s) => {
      const m = byStaff.get(s._id.toString());
      return {
        staffId: s._id.toString(),
        name: s.name,
        employeeCode: s.employeeCode ?? null,
        status: m?.status ?? null,
        checkIn: m?.checkIn ?? null,
        checkOut: m?.checkOut ?? null,
        note: m?.note ?? null,
      };
    }),
  });
});

const markSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().regex(DATE_RE),
  status: z.enum(ATTENDANCE_STATUSES),
  checkIn: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  checkOut: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  note: z.string().max(500).optional(),
});

/** Mark (or re-mark) one staff member's attendance for a day. */
router.put('/attendance', async (req, res) => {
  const body = markSchema.parse(req.body);
  if (!isValidObjectId(body.staffId)) return res.status(400).json({ error: 'Invalid staff' });
  // Ownership: the staff member must belong to this doctor.
  const member = await StaffMember.findOne(scopeToDoctor(req, { _id: body.staffId }));
  if (!member) return res.status(404).json({ error: 'Staff member not found' });

  const mark = await StaffAttendance.findOneAndUpdate(
    scopeToDoctor(req, { staffId: body.staffId, date: body.date }),
    { $set: { status: body.status, checkIn: body.checkIn || undefined, checkOut: body.checkOut || undefined, note: body.note || undefined } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return res.json({
    staffId: body.staffId,
    date: mark.date,
    status: mark.status,
    checkIn: mark.checkIn ?? null,
    checkOut: mark.checkOut ?? null,
    note: mark.note ?? null,
  });
});

export default router;
