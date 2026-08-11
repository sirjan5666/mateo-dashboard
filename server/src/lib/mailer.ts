// Minimal email sender (Nodemailer over SMTP). Email is OPTIONAL infrastructure:
// when SMTP isn't configured, sendMail() is a no-op that logs, so nothing breaks
// in dev and admin notifications still work in-app (Admin → Orders). This mirrors
// the AI provider's "configured?" pattern — the app runs fully without keys.
import nodemailer from 'nodemailer';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { EmailLog } from '../models/EmailLog.js';
import type { EmailStatus } from '../models/EmailLog.js';

export function mailerConfigured(): boolean {
  return !!(env.SMTP_HOST && env.SMTP_PORT && env.MAIL_FROM);
}

// Lazily create and reuse one transport.
let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransport(): ReturnType<typeof nodemailer.createTransport> {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // 465 = implicit TLS; 587/25 = STARTTLS
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

export interface MailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  /** Category for the Email Logs screen: invite, reminder, order, other. */
  kind?: string;
  /** Tenant this mail belongs to, when it is a practice's mail. */
  doctorUserId?: Types.ObjectId | string;
}

/**
 * Record the attempt. Subject + recipient only — a body can carry PHI, so it is
 * never persisted. Logging must never be the reason a send "fails", hence the
 * swallowed catch.
 */
async function record(input: MailInput, status: EmailStatus, extra: { error?: string; messageId?: string } = {}) {
  try {
    await EmailLog.create({
      doctorUserId: input.doctorUserId,
      to: Array.isArray(input.to) ? input.to.join(', ') : input.to,
      subject: input.subject,
      kind: input.kind ?? 'other',
      status,
      error: extra.error,
      messageId: extra.messageId,
    });
  } catch (err) {
    console.error('[mailer] could not write the email log:', err instanceof Error ? err.message : err);
  }
}

/** Send an email if SMTP is configured; otherwise log and return (never throws). */
export async function sendMail(input: MailInput): Promise<void> {
  if (!mailerConfigured()) {
    console.log(`[mailer] (not configured) would email "${input.subject}" to`, input.to);
    await record(input, 'skipped', { error: 'SMTP is not configured' });
    return;
  }
  try {
    const info = await getTransport().sendMail({
      from: env.MAIL_FROM,
      to: Array.isArray(input.to) ? input.to.join(', ') : input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    await record(input, 'sent', { messageId: typeof info?.messageId === 'string' ? info.messageId : undefined });
  } catch (err) {
    // Notifications must never break the order flow — log and move on.
    console.error('[mailer] send failed:', err);
    await record(input, 'failed', { error: err instanceof Error ? err.message.slice(0, 300) : 'Send failed' });
  }
}
