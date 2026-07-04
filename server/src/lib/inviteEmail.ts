// Credential-invite email for doctor-added parents — same optional-infrastructure
// pattern as the shop's order notifications (plain-text, house style, never
// breaks the calling flow). IMPORTANT: callers must branch on the returned
// boolean — when SMTP is unconfigured the invite did NOT go out and the doctor
// UI must show the credentials on-screen instead (show-once panel).
import { env } from '../config/env.js';
import { mailerConfigured, sendMail } from './mailer.js';

export interface ParentInviteInput {
  to: string;
  parentName: string;
  babyName: string;
  doctorName: string;
  tempPassword: string;
}

/**
 * Email the dashboard credentials to a doctor-invited parent. Returns whether
 * the email was actually attempted (SMTP configured). The temp password is
 * deliberately NEVER logged — we check mailerConfigured() BEFORE sendMail so
 * the "(not configured) would email…" log line can never carry credentials.
 */
export async function sendParentInviteEmail(input: ParentInviteInput): Promise<boolean> {
  if (!mailerConfigured()) return false;
  const url = env.APP_BASE_URL.replace(/\/$/, '');
  const lines = [
    `Hi ${input.parentName},`,
    '',
    `Dr. ${input.doctorName} has set up a Mateo dashboard for ${input.babyName} — a private space to follow ${input.babyName}'s health, growth and appointments, and to stay in touch with your doctor.`,
    '',
    `Sign in at: ${url}`,
    `Email: ${input.to}`,
    `Temporary password: ${input.tempPassword}`,
    '',
    'Please change your password after your first sign-in (Settings → Security).',
    '',
    'Warmly,',
    'The Mateo team',
  ];
  await sendMail({
    to: input.to,
    subject: `Your Mateo dashboard for ${input.babyName} is ready`,
    text: lines.join('\n'),
  });
  return true;
}
