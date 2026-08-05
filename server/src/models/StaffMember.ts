import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * A sub-user account inside one doctor's practice. Doctor-owned, tenant-scoped.
 *
 * ⚠ THESE ACCOUNTS CANNOT LOG IN YET. This model stores the roster and the role
 * assignment so the doctor can manage staff; wiring an actual staff login means
 * adding a role to USER_ROLES and enforcing `StaffRole.permissions` on every
 * doctor route, which is a separate, security-reviewed change. Until then
 * `passwordHash` is written at create time but no auth path reads it.
 *
 * Not PHI (staff contact details, not patient data), so nothing is encrypted —
 * but the password is bcrypt-hashed exactly as in User, never stored in plain.
 */
export interface IStaffMember {
  doctorUserId: Types.ObjectId; // TENANT
  roleId: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  /** Which clinic this person works at; null = all of the doctor's locations. */
  locationId?: Types.ObjectId;
  employeeCode?: string;
  passwordHash: string;
  active: boolean;
  lastActiveAt?: Date;
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
    passwordHash: { type: String, required: true },
    active: { type: Boolean, default: true },
    lastActiveAt: { type: Date },
  },
  { timestamps: true },
);

staffMemberSchema.index({ doctorUserId: 1, active: 1 });
// One staff email per practice. Two doctors may each employ the same person.
staffMemberSchema.index({ doctorUserId: 1, email: 1 }, { unique: true });

export const StaffMember = model<IStaffMember>('StaffMember', staffMemberSchema);
