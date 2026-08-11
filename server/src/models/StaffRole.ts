import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * A permission role inside one doctor's practice (Reception, OPD, Accounts, HR,
 * Pharmacy, or anything the doctor invents). Doctor-owned and tenant-scoped.
 *
 * The permission matrix is a plain map of module -> level so a new module can be
 * added without a migration. Unknown/missing modules read as 'none', so a role
 * created before a module existed can never accidentally grant access to it.
 */
export const STAFF_MODULES = [
  'dashboard',
  'appointments',
  'patients',
  'prescriptions',
  'billing',
  'pharmacy',
  'reports',
  'locations',
  'team',
  'settings',
  'logs',
] as const;
export type StaffModule = (typeof STAFF_MODULES)[number];

export const PERMISSION_LEVELS = ['none', 'view', 'edit', 'full'] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export interface IStaffRole {
  doctorUserId: Types.ObjectId; // TENANT
  name: string;
  description?: string;
  /** module -> level. Absent key means 'none'. */
  permissions: Record<string, PermissionLevel>;
  /** Seeded defaults cannot be deleted, only edited — keeps the matrix populated. */
  isSystem: boolean;
  tint: string;
  fg: string;
  createdAt: Date;
  updatedAt: Date;
}

const staffRoleSchema = new Schema<IStaffRole>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 240 },
    permissions: { type: Schema.Types.Mixed, default: {} },
    isSystem: { type: Boolean, default: false },
    tint: { type: String, default: '#EEF2FF' },
    fg: { type: String, default: '#3B4FE0' },
  },
  { timestamps: true },
);

staffRoleSchema.index({ doctorUserId: 1, name: 1 }, { unique: true });

export const StaffRole = model<IStaffRole>('StaffRole', staffRoleSchema);
