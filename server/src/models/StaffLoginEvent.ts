import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * Login history for staff accounts — successes AND failures.
 *
 * Failures are the point: a run of them against one account is the only signal
 * a small clinic will ever get that someone is guessing a password. The email
 * attempted is recorded even when it matches no account, so probing shows up.
 *
 * Append-only by convention (nothing updates these rows) and swept after a year.
 */
export const LOGIN_OUTCOMES = ['success', 'bad_password', 'unknown_email', 'disabled', 'not_activated', 'locked'] as const;
export type LoginOutcome = (typeof LOGIN_OUTCOMES)[number];

export interface IStaffLoginEvent {
  /** Absent when the email matched no account in any practice. */
  doctorUserId?: Types.ObjectId;
  staffId?: Types.ObjectId;
  email: string;
  outcome: LoginOutcome;
  ip?: string;
  userAgent?: string;
  at: Date;
}

const staffLoginEventSchema = new Schema<IStaffLoginEvent>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'StaffMember', index: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    outcome: { type: String, enum: LOGIN_OUTCOMES, required: true },
    ip: { type: String, trim: true, maxlength: 64 },
    userAgent: { type: String, trim: true, maxlength: 300 },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

staffLoginEventSchema.index({ doctorUserId: 1, at: -1 });
// Retained a year, then swept — long enough to investigate, short enough not to
// become an indefinite record of who was at a desk on a given day.
staffLoginEventSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const StaffLoginEvent = model<IStaffLoginEvent>('StaffLoginEvent', staffLoginEventSchema);
