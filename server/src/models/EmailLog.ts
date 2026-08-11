import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * Delivery record for every email the app tries to send. Written by
 * `lib/mailer.ts` on both success and failure, so the Email Logs screen shows
 * what actually happened rather than what was intended.
 *
 * ⚠ SUBJECT AND RECIPIENT ONLY — never the body. A credential invite or a
 * vaccine reminder body can carry PHI; the subject line and address are the
 * minimum needed to answer "did it go out?". `error` stores the transport's
 * message, which is about SMTP, not the patient.
 */
export type EmailStatus = 'sent' | 'failed' | 'skipped';
export const EMAIL_STATUSES: EmailStatus[] = ['sent', 'failed', 'skipped'];

export interface IEmailLog {
  /** Tenant when the mail belongs to a practice; absent for platform mail. */
  doctorUserId?: Types.ObjectId;
  to: string;
  subject: string;
  /** Coarse category so the screen can filter: invite, reminder, order, other. */
  kind: string;
  status: EmailStatus;
  /** Why a send was skipped (no SMTP configured) or failed. Never PHI. */
  error?: string;
  messageId?: string;
  createdAt: Date;
}

const emailLogSchema = new Schema<IEmailLog>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    kind: { type: String, default: 'other' },
    status: { type: String, enum: EMAIL_STATUSES, required: true },
    error: { type: String },
    messageId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

emailLogSchema.index({ createdAt: -1 });
emailLogSchema.index({ doctorUserId: 1, createdAt: -1 });

export const EmailLog = model<IEmailLog>('EmailLog', emailLogSchema);
