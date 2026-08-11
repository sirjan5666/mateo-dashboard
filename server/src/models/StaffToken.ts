import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * A single-use, expiring link token: the staff invitation, and the password
 * reset. One collection rather than two, because they behave identically —
 * issue, email, redeem once, expire — and splitting them would mean two places
 * to get the "has this already been used?" check right.
 *
 * As with sessions, only a SHA-256 of the token is stored. The plain token
 * exists in exactly one place: the email that was sent.
 */
export const STAFF_TOKEN_PURPOSES = ['invite', 'reset'] as const;
export type StaffTokenPurpose = (typeof STAFF_TOKEN_PURPOSES)[number];

export interface IStaffToken {
  doctorUserId: Types.ObjectId; // TENANT
  staffId: Types.ObjectId;
  purpose: StaffTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const staffTokenSchema = new Schema<IStaffToken>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'StaffMember', required: true, index: true },
    purpose: { type: String, enum: STAFF_TOKEN_PURPOSES, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

// Swept once expired; a used token is kept until then so a second click on the
// same link can say "already used" rather than "invalid link".
staffTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const StaffToken = model<IStaffToken>('StaffToken', staffTokenSchema);
