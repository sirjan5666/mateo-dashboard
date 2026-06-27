// Minimal email sender (Nodemailer over SMTP). Email is OPTIONAL infrastructure:
// when SMTP isn't configured, sendMail() is a no-op that logs, so nothing breaks
// in dev and admin notifications still work in-app (Admin → Orders). This mirrors
// the AI provider's "configured?" pattern — the app runs fully without keys.
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

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
}

/** Send an email if SMTP is configured; otherwise log and return (never throws). */
export async function sendMail(input: MailInput): Promise<void> {
  if (!mailerConfigured()) {
    console.log(`[mailer] (not configured) would email "${input.subject}" to`, input.to);
    return;
  }
  try {
    await getTransport().sendMail({
      from: env.MAIL_FROM,
      to: Array.isArray(input.to) ? input.to.join(', ') : input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  } catch (err) {
    // Notifications must never break the order flow — log and move on.
    console.error('[mailer] send failed:', err);
  }
}
