import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { hasActiveSubscription } from '../models/User.js';
import type { IUser, SubscriptionPlan } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createRazorpayOrder, razorpayConfigured, verifyPaymentSignature } from '../lib/razorpay.js';
import { Baby } from '../models/Baby.js';

// The Mateo plan — prices are PLACEHOLDERS to be replaced with the real MRP
// (same convention as the shop catalog). Amounts live ONLY on the server; the
// client never supplies a price.
export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, { amountInr: number; days: number; label: string; maxBabies: number }> = {
  monthly: { amountInr: 199, days: 30, label: 'Monthly', maxBabies: 1 },
  yearly: { amountInr: 1499, days: 365, label: 'Yearly', maxBabies: 3 },
};

/** Baby limit for grandfathered (no subscription sub-doc) and mateo-source accounts. */
export const GRANDFATHERED_MAX_BABIES = 5;

/**
 * Determine the maximum number of babies a user may add.
 * - Doctors and admins: unlimited (returns Infinity).
 * - Parents with no subscription sub-doc (grandfathered): GRANDFATHERED_MAX_BABIES.
 * - Parents with an active plan: the plan's maxBabies.
 * - Parents with an inactive/expired plan: monthly limit (1) as the baseline.
 */
export function getMaxBabies(user: Pick<IUser, 'role' | 'subscription'>): number {
  if (user.role !== 'parent') return Infinity;
  const sub = user.subscription;
  // Grandfathered — pre-paywall account (no subscription sub-doc at all)
  if (!sub) return GRANDFATHERED_MAX_BABIES;
  // Mateo-source active accounts get the grandfathered limit
  if (sub.source === 'mateo' && hasActiveSubscription(user)) return GRANDFATHERED_MAX_BABIES;
  // Active plan with a known tier
  if (hasActiveSubscription(user) && sub.plan) {
    return SUBSCRIPTION_PLANS[sub.plan]?.maxBabies ?? SUBSCRIPTION_PLANS.monthly.maxBabies;
  }
  // Inactive or no plan — baseline
  return SUBSCRIPTION_PLANS.monthly.maxBabies;
}

const checkoutSchema = z.object({ plan: z.enum(['monthly', 'yearly']) });
const verifySchema = z.object({
  razorpayPaymentId: z.string().min(1).max(200),
  razorpaySignature: z.string().min(1).max(500),
});

function publicSubscription(user: { role: 'parent' | 'doctor' | 'admin' | 'patient'; subscription?: { source?: string; plan?: string; activatedAt?: Date; expiresAt?: Date } }) {
  return {
    active: hasActiveSubscription(user as Parameters<typeof hasActiveSubscription>[0]),
    source: user.subscription?.source ?? 'mateo',
    plan: user.subscription?.plan,
    activatedAt: user.subscription?.activatedAt,
    expiresAt: user.subscription?.expiresAt,
  };
}

const router = Router();

// Current subscription state + the plan table the subscribe page renders.
router.get('/subscription', requireAuth, requireRole('parent', 'admin'), async (req, res) => {
  const user = req.authUser!;
  const maxBabies = getMaxBabies(user);
  const currentBabyCount = user.role === 'parent' ? await Baby.countDocuments({ userId: req.userId }) : 0;
  res.json({
    subscription: publicSubscription(user),
    plans: SUBSCRIPTION_PLANS,
    razorpayConfigured: razorpayConfigured(),
    maxBabies: Number.isFinite(maxBabies) ? maxBabies : null,
    currentBabyCount,
  });
});

// Start a plan purchase. Mirrors the shop's order flow: with Razorpay configured
// we create the gateway order for Checkout; otherwise a clearly-labelled mock
// payment activates immediately so dev works end-to-end.
router.post('/subscription/checkout', requireAuth, requireRole('parent'), async (req, res) => {
  const user = req.authUser!;
  const { plan } = checkoutSchema.parse(req.body);
  const price = SUBSCRIPTION_PLANS[plan];

  // Guard: never write a pending sub-doc over an active (or grandfathered)
  // subscription — an abandoned checkout must not lock anyone out.
  if (hasActiveSubscription(user)) {
    res.status(409).json({ error: 'You already have full access to Mateo.' });
    return;
  }

  if (razorpayConfigured()) {
    try {
      const rzp = await createRazorpayOrder(price.amountInr, `sub-${user.id}`.slice(0, 40));
      user.subscription = {
        active: false,
        source: user.subscription?.source ?? 'doctor',
        plan,
        payment: { method: 'razorpay', razorpayOrderId: rzp.id, amountInr: price.amountInr },
      };
      await user.save();
      res.status(201).json({
        razorpay: { keyId: env.RAZORPAY_KEY_ID, orderId: rzp.id, amount: rzp.amount, currency: rzp.currency },
      });
    } catch (err) {
      console.error('Razorpay subscription order failed:', err);
      res.status(502).json({ error: 'Could not start payment right now. Please try again.' });
    }
    return;
  }

  // Mock path — activating a paid plan without payment must never happen in
  // production just because env keys are missing, UNLESS ALLOW_MOCK_PAYMENTS is
  // explicitly set (pre-launch testing before Razorpay LIVE keys exist).
  if (env.NODE_ENV === 'production' && !env.ALLOW_MOCK_PAYMENTS) {
    res.status(503).json({ error: 'Payments are not configured. Please try again later.' });
    return;
  }
  const now = new Date();
  user.subscription = {
    active: true,
    source: 'purchase',
    plan,
    activatedAt: now,
    expiresAt: new Date(now.getTime() + price.days * 86_400_000),
    payment: { method: 'mock', amountInr: price.amountInr, paidAt: now },
  };
  await user.save();
  res.status(201).json({ subscription: publicSubscription(user), mock: true });
});

// Verify the Razorpay payment and activate the plan. The HMAC signature is the
// trust boundary — a client claiming "paid" means nothing without it.
router.post('/subscription/verify', requireAuth, requireRole('parent'), async (req, res) => {
  const user = req.authUser!;
  if (hasActiveSubscription(user)) {
    res.json({ subscription: publicSubscription(user) }); // idempotent
    return;
  }
  const pendingOrderId = user.subscription?.payment?.razorpayOrderId;
  const plan = user.subscription?.plan;
  if (!pendingOrderId || !plan) {
    res.status(400).json({ error: 'No pending payment to verify. Please start checkout again.' });
    return;
  }
  const { razorpayPaymentId, razorpaySignature } = verifySchema.parse(req.body);
  if (!verifyPaymentSignature(pendingOrderId, razorpayPaymentId, razorpaySignature)) {
    res.status(400).json({ error: 'Payment verification failed' });
    return;
  }
  const price = SUBSCRIPTION_PLANS[plan];
  const now = new Date();
  user.subscription = {
    active: true,
    source: 'purchase',
    plan,
    activatedAt: now,
    expiresAt: new Date(now.getTime() + price.days * 86_400_000),
    payment: {
      method: 'razorpay',
      razorpayOrderId: pendingOrderId,
      razorpayPaymentId,
      amountInr: price.amountInr,
      paidAt: now,
    },
  };
  await user.save();
  res.json({ subscription: publicSubscription(user) });
});

export default router;
