import { env } from '../config/env.js';
import { mailerConfigured, sendMail } from './mailer.js';

/**
 * Staff invitation and password-reset emails.
 *
 * Unlike the parent-invite path, these call `sendMail` UNCONDITIONALLY — even
 * when SMTP is not configured. That is deliberate: `sendMail` records a
 * `skipped` row, so the clinic's Email Logs show that an invitation was raised
 * and could not go out. The parent-invite path returns early instead and
 * therefore records nothing, which is why that page looked permanently empty
 * (review bug #3).
 *
 * Nothing secret is logged: EmailLog stores the subject and recipient, never the
 * body, so the link never lands in the log — and the not-configured branch of
 * sendMail logs the subject and recipient only, for the same reason.
 *
 * Both senders return whether a mail could actually GO OUT. `sendMail` never
 * throws, so "no exception" is not evidence of delivery; without SMTP the caller
 * has to be told, and show the link on screen instead.
 */

/** Where an invited staff member sets their password. */
export function staffActivateLink(token: string): string {
  return `${base()}/staff/activate?token=${encodeURIComponent(token)}`;
}

/** Where a staff member chooses a new password after a reset request. */
export function staffResetLink(token: string): string {
  return `${base()}/staff/reset?token=${encodeURIComponent(token)}`;
}

const base = () => env.APP_BASE_URL.replace(/\/$/, '');

export interface StaffInviteInput {
  to: string;
  name: string;
  practice: string;
  token: string;
  doctorUserId: string;
  expiresInHours: number;
}

export async function sendStaffInviteEmail(input: StaffInviteInput): Promise<boolean> {
  const link = staffActivateLink(input.token);
  const lines = [
    `Hi ${input.name},`,
    '',
    `${input.practice} has created a Mateo Clinic OS account for you.`,
    '',
    'Set your password and sign in here:',
    link,
    '',
    `This link expires in ${input.expiresInHours} hours. If it does, ask your clinic administrator to send a new invitation.`,
    '',
    'If you were not expecting this, you can ignore this email.',
    '',
    'The Mateo team',
  ];
  await sendMail({
    to: input.to,
    subject: `Your ${input.practice} staff account`,
    text: lines.join('\n'),
    doctorUserId: input.doctorUserId,
  });
  return mailerConfigured();
}

export interface StaffResetInput {
  to: string;
  name: string;
  practice: string;
  token: string;
  doctorUserId: string;
  expiresInMinutes: number;
}

export async function sendStaffResetEmail(input: StaffResetInput): Promise<boolean> {
  const link = staffResetLink(input.token);
  const lines = [
    `Hi ${input.name},`,
    '',
    `Someone asked to reset the password for your ${input.practice} staff account.`,
    '',
    'Choose a new password here:',
    link,
    '',
    `This link expires in ${input.expiresInMinutes} minutes.`,
    '',
    'If this was not you, no action is needed — your password has not changed.',
    '',
    'The Mateo team',
  ];
  await sendMail({
    to: input.to,
    subject: 'Reset your Mateo Clinic OS password',
    text: lines.join('\n'),
    doctorUserId: input.doctorUserId,
  });
  return mailerConfigured();
}
