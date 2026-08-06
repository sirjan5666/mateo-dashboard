import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { DoctorAppointment } from '../models/DoctorAppointment.js';
import { Invoice } from '../models/Invoice.js';
import { CareMessage } from '../models/CareMessage.js';
import { Medicine } from '../models/Pharmacy.js';
import { istDateString } from '../lib/ist.js';

/**
 * Dashboard alerts — the "Alerts & Reminders" panel.
 *
 * Every row is a REAL count from the doctor's own collections; a signal with a
 * count of zero is simply not returned, so the panel shrinks to nothing on a
 * quiet day rather than inventing something to say. No PHI: counts and ids only.
 */
const router = Router();
router.use(requireAuth, requireRole('doctor'));

interface Alert {
  id: string;
  icon: string;
  accent: string;
  tint: string;
  title: string;
  note: string;
  to: string;
}

const RED = { accent: '#EF4444', tint: '#FEF2F2' };
const AMBER = { accent: '#F59E0B', tint: '#FFFBEB' };
const BLUE = { accent: '#2B6FF0', tint: '#EFF6FF' };

router.get('/dashboard/alerts', async (req, res) => {
  const doctorId = new Types.ObjectId(req.userId);
  const now = new Date();
  const todayStart = new Date(`${istDateString(now)}T00:00:00+05:30`);
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);
  const in60Days = new Date(now.getTime() + 60 * 86_400_000);

  const [scheduledToday, unpaid, unreadMessages, meds] = await Promise.all([
    DoctorAppointment.countDocuments(scopeToDoctor(req, { start: { $gte: todayStart, $lt: todayEnd }, status: 'scheduled' })),
    Invoice.countDocuments(scopeToDoctor(req, { status: { $in: ['unpaid', 'partial'] } })),
    CareMessage.countDocuments({ doctorUserId: doctorId, senderRole: 'patient', readByDoctorAt: { $exists: false } }),
    // One read covers all three stock signals.
    Medicine.find(scopeToDoctor(req, { active: true })).select('qtyInStock reorderLevel expiry'),
  ]);

  const outOfStock = meds.filter((m) => m.qtyInStock <= 0).length;
  const lowStock = meds.filter((m) => m.qtyInStock > 0 && m.qtyInStock <= m.reorderLevel).length;
  const expiringSoon = meds.filter((m) => m.expiry && m.expiry <= in60Days && m.qtyInStock > 0).length;

  const alerts: Alert[] = [];
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  if (scheduledToday > 0) {
    alerts.push({
      id: 'today', icon: 'CalendarCheck', ...BLUE,
      title: `${scheduledToday} ${plural(scheduledToday, 'appointment', 'appointments')} still to see today`,
      note: 'Open the day’s schedule', to: '/doctor/appointments',
    });
  }
  if (outOfStock > 0) {
    alerts.push({
      id: 'out-of-stock', icon: 'AlertCircle', ...RED,
      title: `${outOfStock} ${plural(outOfStock, 'medicine is', 'medicines are')} out of stock`,
      note: 'Reorder from the pharmacy', to: '/doctor/pharmacy',
    });
  }
  if (lowStock > 0) {
    alerts.push({
      id: 'low-stock', icon: 'AlertTriangle', ...AMBER,
      title: `${lowStock} ${plural(lowStock, 'medicine is', 'medicines are')} low in stock`,
      note: 'At or below the reorder level', to: '/doctor/pharmacy',
    });
  }
  if (expiringSoon > 0) {
    alerts.push({
      id: 'expiring', icon: 'AlertTriangle', ...AMBER,
      title: `${expiringSoon} ${plural(expiringSoon, 'batch expires', 'batches expire')} within 60 days`,
      note: 'Check the expiry report', to: '/doctor/pharmacy',
    });
  }
  if (unpaid > 0) {
    alerts.push({
      id: 'unpaid', icon: 'AlertCircle', ...RED,
      title: `${unpaid} ${plural(unpaid, 'invoice is', 'invoices are')} unpaid`,
      note: 'Review collections', to: '/doctor/revenue',
    });
  }
  if (unreadMessages > 0) {
    alerts.push({
      id: 'messages', icon: 'AlertCircle', ...BLUE,
      title: `${unreadMessages} unread ${plural(unreadMessages, 'message', 'messages')} from patients`,
      note: 'Reply from Messages', to: '/doctor/messages',
    });
  }

  res.json({ alerts });
});

export default router;
