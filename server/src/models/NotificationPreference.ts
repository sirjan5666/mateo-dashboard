import { Schema, model, Types } from 'mongoose';

// Per-parent delivery settings for the proactive notification engine (Phase 3).
// Captured at baby onboarding (Phase 1) and editable later. One doc per user.
//
// The DASHBOARD channel is always on (in-app is the always-works channel) and is
// intentionally NOT stored as a toggle. Only the optional outbound channels
// (email, WhatsApp) are opt-in here.
//
// `language` is the language of the notification COPY (from daily-notifications.json:
// en | hi | hi-en/Hinglish). It is deliberately separate from the app-UI locale so a
// mother can read a Hindi/Hinglish UI or an English one independently of her reminders.

export type NotificationLanguage = 'en' | 'hi' | 'hi-en';
export const NOTIFICATION_LANGUAGES: NotificationLanguage[] = ['en', 'hi', 'hi-en'];

export interface INotificationPreference {
  userId: Types.ObjectId;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  // E.164-ish number for WhatsApp; only meaningful when whatsappEnabled. Never used
  // for marketing — only this parent's own babies' reminders.
  whatsappNumber?: string;
  // Preferred local (IST) hour to receive the day's notification, 0–23.
  preferredHour: number;
  language: NotificationLanguage;
  // Content-type slugs the parent has muted (e.g. 'Tip', 'Vision'); safety/vaccine
  // types should be excluded from muting in the UI.
  mutedTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const notificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    emailEnabled: { type: Boolean, required: true, default: true },
    whatsappEnabled: { type: Boolean, required: true, default: false },
    whatsappNumber: { type: String, trim: true },
    preferredHour: { type: Number, required: true, default: 9, min: 0, max: 23 },
    language: { type: String, enum: NOTIFICATION_LANGUAGES, required: true, default: 'en' },
    mutedTypes: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const NotificationPreference = model<INotificationPreference>(
  'NotificationPreference',
  notificationPreferenceSchema,
);
