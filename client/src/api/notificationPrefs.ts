import { api } from './client';

export type NotificationLanguage = 'en' | 'hi' | 'hi-en';

export interface NotificationPreferences {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  preferredHour: number;
  language: NotificationLanguage;
  mutedTypes: string[];
}

export function getNotificationPreferences() {
  return api<{ preferences: NotificationPreferences }>('/notification-preferences');
}

export function updateNotificationPreferences(input: Partial<NotificationPreferences>) {
  return api<{ preferences: NotificationPreferences }>('/notification-preferences', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
