import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * One signed-in device for one staff member.
 *
 * Access tokens are short-lived and stateless (a JWT cookie, same as the rest of
 * the app). This collection is the REFRESH side: it is what makes "log out",
 * "log out everywhere" and "deactivate this account now" actually take effect —
 * a stateless token alone cannot be withdrawn before it expires.
 *
 * The refresh token itself is NEVER stored. Only a SHA-256 of it is, exactly as
 * a password is only ever stored hashed: a dump of this collection must not let
 * anyone resume a session.
 */
export interface IStaffSession {
  doctorUserId: Types.ObjectId; // TENANT
  staffId: Types.ObjectId;
  /** SHA-256 of the refresh token. Unique so a token can be looked up directly. */
  tokenHash: string;
  /** Coarse device description from the user agent — for the sessions list. */
  device?: string;
  ip?: string;
  userAgent?: string;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const staffSessionSchema = new Schema<IStaffSession>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'StaffMember', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    device: { type: String, trim: true, maxlength: 120 },
    ip: { type: String, trim: true, maxlength: 64 },
    userAgent: { type: String, trim: true, maxlength: 300 },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true },
);

// Expired sessions are swept by Mongo rather than accumulating forever. The TTL
// runs on expiresAt, so a revoked-but-unexpired row still exists to be listed.
staffSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
staffSessionSchema.index({ staffId: 1, revokedAt: 1 });

export const StaffSession = model<IStaffSession>('StaffSession', staffSessionSchema);
