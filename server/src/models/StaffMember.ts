import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * A sub-user account inside one doctor's practice. Doctor-owned, tenant-scoped.
 *
 * These accounts CAN log in (routes/staffAuth.ts). A staff session carries the
 * DOCTOR as its subject, so every existing tenant-scoped query keeps working
 * untouched, plus the staff id — and `requirePermission` then narrows what that
 * session may actually do. See middleware/permissions.ts.
 *
 * Lifecycle: invited -> active -> disabled. An invited account has no password
 * yet; it is set by redeeming the emailed invite link. Disabling revokes every
 * live session immediately rather than waiting for a token to expire.
 *
 * Not PHI (staff contact details, not patient data), so nothing is encrypted —
 * but the password is bcrypt-hashed exactly as in User, never stored in plain.
 */
export const STAFF_STATUSES = ['invited', 'active', 'disabled'] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export interface IStaffMember {
  doctorUserId: Types.ObjectId; // TENANT
  roleId: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  /** Which clinic this person works at; null = all of the doctor's locations. */
  locationId?: Types.ObjectId;
  employeeCode?: string;
  /** Absent until an invite is redeemed — an invited account has no password. */
  passwordHash?: string;
  status: StaffStatus;
  /**
   * Kept in step with `status` for the existing Team & Roles UI and every query
   * that already filters on it. `status` is the source of truth.
   */
  active: boolean;
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  /** Set when an admin resets the password, cleared once the staff member does. */
  mustChangePassword?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const staffMemberSchema = new Schema<IStaffMember>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'StaffRole', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 24 },
    locationId: { type: Schema.Types.ObjectId, ref: 'ClinicLocation' },
    employeeCode: { type: String, trim: true, maxlength: 40 },
    passwordHash: { type: String },
    status: { type: String, enum: STAFF_STATUSES, default: 'invited', index: true },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    lastActiveAt: { type: Date },
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true },
);

/** `active` mirrors `status` — derived on every save so they cannot drift. */
staffMemberSchema.pre('save', function syncActive() {
  this.active = this.status === 'active';
});

staffMemberSchema.index({ doctorUserId: 1, active: 1 });
// One staff email per practice. Two doctors may each employ the same person.
staffMemberSchema.index({ doctorUserId: 1, email: 1 }, { unique: true });

export const StaffMember = model<IStaffMember>('StaffMember', staffMemberSchema);
