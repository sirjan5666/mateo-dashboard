// Mateo Sitare — the single knob panel for the loyalty economy.
//
// Sitare (सितारे, "stars") is the app's reward currency. EVERY number that
// governs how many ★ a user earns or how much they can redeem lives here so the
// owner can retune the whole economy from one file. These are PLACEHOLDER values
// (see SHOP_AND_LOYALTY_DESIGN_BRIEF.md) — safe to change without touching logic.
//
// IMS Act 1992 note: nothing here applies to infant formula. Formula earns 0 ★
// and can't be redeemed against — that exclusion lives in ./eligibility.ts and is
// enforced at every call site, independent of these numbers.

export const SITARE = {
  /** ★ earned per ₹100 of eligible (non-formula) spend, floored. */
  EARN_PER_100_INR: 5,
  /** ★ for an approved product review rated >= REVIEW_MIN_STAR_FOR_REWARD. */
  REVIEW_APPROVED: 50,
  REVIEW_MIN_STAR_FOR_REWARD: 4,
  /** ★ per meaningful tracker/journey entry, capped per IST day (all trackers combined). */
  TRACKER_PER_ENTRY: 5,
  TRACKER_DAILY_CAP: 20,
  /** ★ per approved community contribution, capped per IST day. */
  COMMUNITY_PER_CONTRIBUTION: 10,
  COMMUNITY_DAILY_CAP: 30,
  /** ★ when a booked consultation is marked completed. */
  CONSULTATION_COMPLETED: 100,
  /** Referral: ★ to the referrer + ★ welcome to the referee (runs ALONGSIDE the ₹ referral credit). */
  REFERRAL_REFERRER: 200,
  REFERRAL_REFEREE: 100,
  /** Redemption: how many ★ equal ₹1 (★10 = ₹1). */
  CONVERSION_POINTS_PER_INR: 10,
  /** Redemption is capped at this fraction of the eligible subtotal per order. */
  REDEMPTION_CAP_PCT: 0.2,
  /** Earned ★ expire this many months after they're earned. */
  EXPIRY_MONTHS: 12,
} as const;

/** ★ earned for a given eligible spend (formula already excluded by the caller). */
export function earnForSpend(eligibleInr: number): number {
  if (eligibleInr <= 0) return 0;
  return Math.floor(eligibleInr / 100) * SITARE.EARN_PER_100_INR;
}

/** ₹ value of a points amount (floored — partial rupees are never granted). */
export function pointsToInr(points: number): number {
  return Math.floor(Math.max(0, points) / SITARE.CONVERSION_POINTS_PER_INR);
}

/** ★ needed to cover a rupee amount. */
export function inrToPoints(inr: number): number {
  return Math.max(0, Math.round(inr)) * SITARE.CONVERSION_POINTS_PER_INR;
}

/** Max ₹ that points may cover on an order, given the eligible subtotal. */
export function maxRedeemInr(eligibleInr: number): number {
  return Math.floor(Math.max(0, eligibleInr) * SITARE.REDEMPTION_CAP_PCT);
}

/** The date `EXPIRY_MONTHS` after `from` (earn-lot expiry). */
export function expiryFrom(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + SITARE.EXPIRY_MONTHS);
  return d;
}
