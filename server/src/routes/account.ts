import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Baby } from '../models/Baby.js';
import { VaccineDose } from '../models/VaccineDose.js';
import { GrowthLog } from '../models/GrowthLog.js';
import { SkinLog } from '../models/SkinLog.js';
import { FoodLog } from '../models/FoodLog.js';
import { SleepLog } from '../models/SleepLog.js';
import { FeedLog } from '../models/FeedLog.js';
import { DiaperLog } from '../models/DiaperLog.js';
import { Allergy } from '../models/Allergy.js';
import { SymptomLog } from '../models/SymptomLog.js';
import { MedicineCourse } from '../models/MedicineCourse.js';
import { MedicineDoseLog } from '../models/MedicineDoseLog.js';
import { MilestoneAchievement } from '../models/MilestoneAchievement.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Appointment } from '../models/Appointment.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { ChatSession } from '../models/ChatSession.js';
import { EmergencyContact } from '../models/EmergencyContact.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { Consultation } from '../models/Consultation.js';
import { ConsultationMessage } from '../models/ConsultationMessage.js';
import { Prescription } from '../models/Prescription.js';
import { requireAuth, AUTH_COOKIE } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { eraseUserData } from '../lib/eraseUser.js';

const router = Router();
router.use(requireAuth);

// GET /api/account/export — DPDP data portability: everything we hold on this user.
router.get('/export', async (req, res) => {
  const userId = req.userId!;
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  const babies = await Baby.find({ userId });
  const babyIds = babies.map((b) => b._id);
  const [doses, growth, skin, food, sleep, feeds, diapers, allergies, symptoms, medicineCourses, medicineDoses, milestones, records, appointments, chatSessions, chat, contacts] =
    await Promise.all([
      VaccineDose.find({ babyId: { $in: babyIds } }),
      GrowthLog.find({ babyId: { $in: babyIds } }),
      SkinLog.find({ babyId: { $in: babyIds } }),
      FoodLog.find({ babyId: { $in: babyIds } }),
      SleepLog.find({ babyId: { $in: babyIds } }),
      FeedLog.find({ babyId: { $in: babyIds } }),
      DiaperLog.find({ babyId: { $in: babyIds } }),
      Allergy.find({ babyId: { $in: babyIds } }),
      SymptomLog.find({ babyId: { $in: babyIds } }),
      MedicineCourse.find({ babyId: { $in: babyIds } }),
      MedicineDoseLog.find({ babyId: { $in: babyIds } }),
      MilestoneAchievement.find({ babyId: { $in: babyIds } }),
      HealthRecord.find({ babyId: { $in: babyIds } }),
      Appointment.find({ babyId: { $in: babyIds } }),
      ChatSession.find({ babyId: { $in: babyIds } }),
      ChatMessage.find({ babyId: { $in: babyIds } }),
      EmergencyContact.find({ userId }),
    ]);
  // Doctor accounts carry a professional profile instead of babies.
  const doctorProfile = await DoctorProfile.findOne({ userId });
  // Consultations where this user is either the parent or the doctor, + their chat.
  const consultations = await Consultation.find({ $or: [{ parentUserId: userId }, { doctorUserId: userId }] });
  const consultationMessages = await ConsultationMessage.find({ consultationId: { $in: consultations.map((c) => c._id) } });
  const prescriptions = await Prescription.find({ $or: [{ parentUserId: userId }, { doctorUserId: userId }] });
  res.json({
    exportedAt: new Date().toISOString(),
    account: { id: user.id, name: user.name, email: user.email, role: user.role, consentAcceptedAt: user.consentAcceptedAt, createdAt: user.createdAt },
    doctorProfile,
    consultations,
    consultationMessages,
    prescriptions,
    babies,
    vaccineDoses: doses,
    growthLogs: growth,
    skinLogs: skin,
    foodLogs: food,
    sleepLogs: sleep,
    feedLogs: feeds,
    diaperLogs: diapers,
    allergies,
    symptomLogs: symptoms,
    medicineCourses,
    medicineDoseLogs: medicineDoses,
    milestoneAchievements: milestones,
    healthRecords: records,
    appointments,
    chatSessions,
    chatMessages: chat,
    emergencyContacts: contacts,
  });
});

// DELETE /api/account — DPDP right to erasure: remove the user and ALL their data.
router.delete('/', async (req, res) => {
  await eraseUserData(req.userId!);
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/' });
  res.json({ ok: true });
});

// POST /api/account/password — change the account password. Exists mainly so
// doctor-invited parents can rotate the emailed temporary password; requires the
// current password so a stolen cookie alone can't take over the account.
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});
router.post('/password', async (req, res) => {
  const { currentPassword, newPassword } = passwordSchema.parse(req.body);
  const user = await User.findById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ ok: true });
});

// POST /api/account/confirm-consent — DPDP: a doctor-invited parent personally
// affirms the consent screen on first login (the doctor recorded in-clinic
// consent at intake; this captures the parent's own acceptance).
router.post('/confirm-consent', async (req, res) => {
  const user = await User.findById(req.userId!);
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  if (user.consentPending) {
    user.consentPending = false;
    user.consentAcceptedAt = new Date();
    await user.save();
  }
  res.json({ ok: true });
});

// PATCH /api/account/profile — update display name.
const profileSchema = z.object({ name: z.string().trim().min(1).max(100) });
router.patch('/profile', async (req, res) => {
  const userId = req.userId!;
  const { name } = profileSchema.parse(req.body);
  const user = await User.findByIdAndUpdate(userId, { $set: { name } }, { new: true }).select('-passwordHash');
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

// ── Emergency contacts ──
function publicContact(c: { id: string; name: string; relation?: string; phone: string }) {
  return { id: c.id, name: c.name, relation: c.relation ?? null, phone: c.phone };
}

router.get('/contacts', async (req, res) => {
  const contacts = await EmergencyContact.find({ userId: req.userId! }).sort({ createdAt: 1 });
  res.json({ contacts: contacts.map((c) => publicContact(c)) });
});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  relation: z.string().trim().max(60).optional(),
  phone: z.string().trim().min(3).max(30),
});

router.post('/contacts', async (req, res) => {
  const body = contactSchema.parse(req.body);
  const contact = await EmergencyContact.create({ userId: req.userId!, ...body });
  res.status(201).json({ contact: publicContact(contact) });
});

router.delete('/contacts/:contactId', async (req, res) => {
  const contactId = String(req.params.contactId);
  const contact = isValidObjectId(contactId) ? await EmergencyContact.findById(contactId) : null;
  if (!contact || contact.userId.toString() !== req.userId) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }
  await contact.deleteOne();
  res.json({ ok: true });
});

export default router;
