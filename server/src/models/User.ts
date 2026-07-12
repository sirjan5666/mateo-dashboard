import { Schema, model } from 'mongoose';

// Roles sharing ONE backend, told apart by role:
//  - parent: the baby-tracking dashboard (the original family app)
//  - doctor: the practice/EHR tenant — owns their own Patient records
//  - patient: the patient portal — sees ONLY their own doctor-held record
//  - admin:  the control panel — manages everyone (created via seed script only)
export type UserRole = 'parent' | 'doctor' | 'admin' | 'patient';
export const USER_ROLES: UserRole[] = ['parent', 'doctor', 'admin', 'patient'];

// How a parent got their subscription (or why they don't have one yet):
//  - mateo:    account created by Mateo (admin) — plan included, active from day one
//  - purchase: parent bought the plan in-app (Razorpay, or the labelled mock in dev)
//  - doctor:   account created by a doctor's "Add patient" invite — starts WITHOUT
//              an active plan; trackers show as "Paid" until they subscribe
export type SubscriptionSource = 'mateo' | 'purchase' | 'doctor';
export type SubscriptionPlan = 'monthly' | 'yearly';

export interface ISubscription {
  active: boolean;
  source: SubscriptionSource;
  plan?: SubscriptionPlan;
  activatedAt?: Date;
  /** Absent = does not expire (mateo-granted). */
  expiresAt?: Date;
  // Mirrors the shop's IOrderPayment shape so payments read the same everywhere.
  payment?: {
    method: 'razorpay' | 'mock';
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    amountInr?: number;
    paidAt?: Date;
  };
}

export interface IUser {
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  role: UserRole;
  consentAcceptedAt: Date;
  // DPDP: doctor-invited parents must personally confirm consent on first login
  // (the doctor recorded in-clinic consent, but the app asks the parent too).
  consentPending?: boolean;
  /**
   * GRANDFATHER RULE (mirrors the role default note below): a parent doc with NO
   * subscription sub-doc is treated as subscribed with source 'mateo' — every
   * account that existed before the paywall keeps full access with no migration.
   * Only three places ever write this field: admin parent-create (mateo),
   * the doctor invite-parent flow (doctor, inactive), and subscription checkout/
   * verify (purchase). Keep it that way.
   */
  subscription?: ISubscription;
  // Refer & Earn: each parent's own shareable code, credits they've earned, and
  // the code (if any) they were referred with. Code is generated lazily.
  referralCode?: string;
  referralCredits?: number;
  referredByCode?: string;
  // Mateo Sitare loyalty — DENORMALISED cache only (PointsLedger is authoritative).
  // Recomputed on every ledger mutation by points/service.ts. Absent => 0.
  sitareBalance?: number; // spendable ★ now
  sitareReserved?: number; // ★ held by in-flight orders
  sitareLifetime?: number; // total ★ ever earned (for tiers/marketing)
  createdAt: Date;
}

/** The single source of truth for "does this parent have the paid plan?". */
export function hasActiveSubscription(user: Pick<IUser, 'role' | 'subscription'>): boolean {
  if (user.role !== 'parent') return true; // gating only applies to parents
  const sub = user.subscription;
  if (!sub) return true; // grandfathered — pre-paywall account
  if (!sub.active) return false;
  if (sub.expiresAt && sub.expiresAt.getTime() <= Date.now()) return false;
  return true;
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
    // DPDP: doctor-invited parents confirm the consent screen on first login
    consentPending: { type: Boolean },
    // Paid plan — see the grandfather rule on IUser.subscription above.
    subscription: {
      type: new Schema(
        {
          active: { type: Boolean, required: true, default: false },
          source: { type: String, enum: ['mateo', 'purchase', 'doctor'], required: true },
          plan: { type: String, enum: ['monthly', 'yearly'] },
          activatedAt: { type: Date },
          expiresAt: { type: Date },
          payment: {
            type: new Schema(
              {
                method: { type: String, enum: ['razorpay', 'mock'] },
                razorpayOrderId: { type: String },
                razorpayPaymentId: { type: String },
                amountInr: { type: Number, min: 0 },
                paidAt: { type: Date },
              },
              { _id: false },
            ),
          },
        },
        { _id: false },
      ),
    },
    // Refer & Earn
    referralCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    referralCredits: { type: Number, default: 0, min: 0 },
    referredByCode: { type: String, uppercase: true, trim: true },
    // Mateo Sitare loyalty cache (see IUser note). Non-authoritative.
    sitareBalance: { type: Number, default: 0, min: 0 },
    sitareReserved: { type: Number, default: 0, min: 0 },
    sitareLifetime: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const User = model<IUser>('User', userSchema);
