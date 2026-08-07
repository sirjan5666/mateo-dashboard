import { Router } from 'express';
import { z } from 'zod';
import { guardRoutes } from '../middleware/permissions.js';
import { auditAccess } from '../middleware/audit.js';
import { scopeToDoctor } from '../middleware/loadOwnedPatient.js';
import { DoctorProfile, DEFAULT_PREFERENCES, WEEK_DAYS } from '../models/DoctorProfile.js';
import type { IClinicPreferences, IWorkingHours } from '../models/DoctorProfile.js';
import { ClinicLocation } from '../models/ClinicLocation.js';

/**
 * Clinic Settings — the practice's account-level preferences, working hours and
 * the clinic contact details shown to patients.
 *
 * Owner-and-`settings`-role gated, tenant-scoped. Three stores are stitched into
 * one page so the doctor sees "settings" rather than three models:
 *   • clinic name / email / phone  → the PRIMARY ClinicLocation (the same record
 *     that prints on invoices and prescriptions, so there is one source of truth)
 *   • working hours + preferences  → the doctor's DoctorProfile
 *
 * Nothing here is a clinical or statutory value; the pharmacy licence and GSTIN
 * stay on the location record and its own screen.
 */
const router = Router();
guardRoutes(router, 'settings');

/** A sensible week when a practice has never set its hours: 9–6, Sunday closed. */
const DEFAULT_HOURS: IWorkingHours = WEEK_DAYS.reduce((acc, day) => {
  acc[day] = { start: '09:00', end: '18:00', closed: day === 'sunday' };
  return acc;
}, {} as IWorkingHours);

const HHMM = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');
const dayHoursSchema = z.object({ start: HHMM, end: HHMM, closed: z.boolean() });
const workingHoursSchema = z.object(
  Object.fromEntries(WEEK_DAYS.map((d) => [d, dayHoursSchema])) as Record<(typeof WEEK_DAYS)[number], typeof dayHoursSchema>,
);

const preferencesSchema = z.object({
  dateFormat: z.enum(['DD MMM YYYY', 'DD/MM/YYYY']),
  timeFormat: z.enum(['12', '24']),
  currency: z.string().trim().max(8),
  language: z.enum(['en', 'hi']),
  defaultPage: z.enum(['dashboard', 'appointments', 'patients']),
  patientPortal: z.boolean(),
  autoPatientId: z.boolean(),
  appointmentReminders: z.boolean(),
  whatsappNotifications: z.boolean(),
  onlineBooking: z.boolean(),
  dataBackup: z.boolean(),
  sessionTimeoutMins: z.number().int().min(0).max(1440),
});

const clinicSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(24).optional().or(z.literal('')),
});

const putSchema = z.object({
  clinic: clinicSchema.optional(),
  workingHours: workingHoursSchema.optional(),
  preferences: preferencesSchema.partial().optional(),
});

/** The doctor's single primary clinic, or the first one if none is flagged. */
async function primaryLocation(req: Parameters<typeof scopeToDoctor>[0]) {
  return (
    (await ClinicLocation.findOne(scopeToDoctor(req, { isPrimary: true }))) ??
    (await ClinicLocation.findOne(scopeToDoctor(req)).sort({ createdAt: 1 }))
  );
}

function settingsShape(
  clinic: Awaited<ReturnType<typeof primaryLocation>>,
  workingHours: IWorkingHours,
  preferences: IClinicPreferences,
) {
  return {
    // null when the practice has not added a location yet — the UI then asks
    // them to add one rather than editing a clinic that does not exist.
    clinic: clinic
      ? { id: String(clinic._id), name: clinic.name, email: clinic.email ?? '', phone: clinic.phone ?? '' }
      : null,
    workingHours,
    preferences,
  };
}

/**
 * Read hours and preferences as PLAIN objects. Spreading a Mongoose subdocument
 * directly copies its internal document keys, not its field values — which
 * silently collapsed every saved preference back to the default. `toObject()`
 * gives real values to merge.
 */
function readProfile(profile: Awaited<ReturnType<typeof DoctorProfile.findOne>>) {
  const p = profile?.toObject();
  return {
    workingHours: (p?.workingHours as IWorkingHours | undefined) ?? DEFAULT_HOURS,
    // Stored preferences layered over the defaults, so a field added later is
    // never missing from an older profile.
    preferences: { ...DEFAULT_PREFERENCES, ...(p?.preferences ?? {}) },
  };
}

// GET /api/doctor/settings
router.get('/settings', auditAccess('settings'), async (req, res) => {
  const [profile, clinic] = await Promise.all([
    DoctorProfile.findOne({ userId: req.userId }),
    primaryLocation(req),
  ]);
  const { workingHours, preferences } = readProfile(profile);
  res.json(settingsShape(clinic, workingHours, preferences));
});

// PUT /api/doctor/settings — save any subset; unsent sections are left untouched.
router.put('/settings', auditAccess('settings'), async (req, res) => {
  const body = putSchema.parse(req.body);

  if (body.clinic) {
    const clinic = await primaryLocation(req);
    if (!clinic) {
      res.status(400).json({ error: 'Add a clinic location before saving its details' });
      return;
    }
    clinic.name = body.clinic.name;
    clinic.email = body.clinic.email || undefined;
    clinic.phone = body.clinic.phone || undefined;
    await clinic.save();
  }

  if (body.workingHours || body.preferences) {
    // A doctor may not have completed the profile form yet; create a minimal
    // profile so their settings still persist rather than silently vanishing.
    const profile =
      (await DoctorProfile.findOne({ userId: req.userId })) ??
      new DoctorProfile({ userId: req.userId, specialization: 'General', consultationFee: 0 });
    if (body.workingHours) {
      profile.workingHours = body.workingHours;
      profile.markModified('workingHours');
    }
    if (body.preferences) {
      // Merge against the PLAIN current values, never the raw subdocument.
      const current = (profile.toObject().preferences ?? {}) as Partial<IClinicPreferences>;
      profile.preferences = { ...DEFAULT_PREFERENCES, ...current, ...body.preferences };
      profile.markModified('preferences');
    }
    await profile.save();
  }

  const [profile, clinic] = await Promise.all([
    DoctorProfile.findOne({ userId: req.userId }),
    primaryLocation(req),
  ]);
  const { workingHours, preferences } = readProfile(profile);
  res.json(settingsShape(clinic, workingHours, preferences));
});

export default router;
