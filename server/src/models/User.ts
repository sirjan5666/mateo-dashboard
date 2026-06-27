import { Schema, model } from 'mongoose';

// Roles sharing ONE backend, told apart by role:
//  - parent: the baby-tracking dashboard (the original family app)
//  - doctor: the practice/EHR tenant — owns their own Patient records
//  - patient: the patient portal — sees ONLY their own doctor-held record
//  - admin:  the control panel — manages everyone (created via seed script only)
export type UserRole = 'parent' | 'doctor' | 'admin' | 'patient';
export const USER_ROLES: UserRole[] = ['parent', 'doctor', 'admin', 'patient'];

export interface IUser {
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  role: UserRole;
  consentAcceptedAt: Date;
  // Refer & Earn: each parent's own shareable code, credits they've earned, and
  // the code (if any) they were referred with. Code is generated lazily.
  referralCode?: string;
  referralCredits?: number;
  referredByCode?: string;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    // Public signup only ever creates 'parent' or 'doctor'. 'admin' is set by the
    // seed script. Existing accounts (no role stored) read back as 'parent'.
    role: { type: String, enum: USER_ROLES, required: true, default: 'parent', index: true },
    // DPDP: set at signup, when the user explicitly accepts the consent screen
    consentAcceptedAt: { type: Date, required: true },
    // Refer & Earn
    referralCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    referralCredits: { type: Number, default: 0, min: 0 },
    referredByCode: { type: String, uppercase: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const User = model<IUser>('User', userSchema);
