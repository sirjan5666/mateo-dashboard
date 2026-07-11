import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  NotificationPreference,
  NOTIFICATION_LANGUAGES,
  type INotificationPreference,
} from '../models/NotificationPreference.js';

const router = Router();
router.use(requireAuth);

function publicPrefs(p: INotificationPreference) {
  return {
    emailEnabled: p.emailEnabled,
    whatsappEnabled: p.whatsappEnabled,
    whatsappNumber: p.whatsappNumber ?? '',
    preferredHour: p.preferredHour,
    language: p.language,
    mutedTypes: p.mutedTypes,
  };
}

// Sensible defaults for a parent who hasn't set preferences yet — dashboard is
// always on, email on, WhatsApp off until they opt in with a number.
const DEFAULTS = {
  emailEnabled: true,
  whatsappEnabled: false,
  whatsappNumber: '',
  preferredHour: 9,
  language: 'en' as const,
  mutedTypes: [] as string[],
};

const updateSchema = z
  .object({
    emailEnabled: z.boolean(),
    whatsappEnabled: z.boolean(),
    // Loose validation: digits, spaces, +, - and () — the WhatsApp integration
    // (Phase 3) will normalise to E.164 before sending.
    whatsappNumber: z
      .string()
      .trim()
      .max(20)
      .regex(/^[+()\d][\d\s()-]*$/, 'Enter a valid phone number')
      .or(z.literal('')),
    preferredHour: z.number().int().min(0).max(23),
    language: z.enum(NOTIFICATION_LANGUAGES as [string, ...string[]]),
    mutedTypes: z.array(z.string().max(40)).max(50),
  })
  .partial()
  .refine((b) => !(b.whatsappEnabled === true && (b.whatsappNumber ?? '').trim() === ''), {
    message: 'A WhatsApp number is required to turn on WhatsApp reminders',
    path: ['whatsappNumber'],
  });

router.get('/notification-preferences', async (req, res) => {
  const prefs = await NotificationPreference.findOne({ userId: req.userId });
  res.json({ preferences: prefs ? publicPrefs(prefs) : DEFAULTS });
});

router.put('/notification-preferences', async (req, res) => {
  const body = updateSchema.parse(req.body);
  // Clearing WhatsApp toggle wipes the stored number (privacy: don't retain a number
  // for a channel that's off).
  const patch: Record<string, unknown> = { ...body };
  if (body.whatsappEnabled === false) patch.whatsappNumber = '';
  const prefs = await NotificationPreference.findOneAndUpdate(
    { userId: req.userId },
    { $set: patch, $setOnInsert: { userId: req.userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  res.json({ preferences: publicPrefs(prefs!) });
});

export default router;
