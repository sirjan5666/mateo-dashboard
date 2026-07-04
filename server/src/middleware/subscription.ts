import type { NextFunction, Request, Response } from 'express';
import { User, hasActiveSubscription } from '../models/User.js';

/**
 * Gate a route behind the parent paid plan. Runs AFTER requireAuth (needs
 * req.userId). Modeled on requireRole: re-loads the user from the DB on every
 * request so a subscription flip (purchase, expiry) takes effect immediately —
 * never trusting a stale token or a client claim.
 *
 * Rules (see hasActiveSubscription in models/User.ts — the single source of truth):
 *  - non-parent roles pass through (doctor/admin/patient routes are never gated)
 *  - parents with NO subscription sub-doc pass (grandfathered pre-paywall accounts)
 *  - parents with an active, non-expired plan pass
 *  - everyone else gets 402 with code 'subscription_required' so the client can
 *    route them to the subscribe page.
 *
 * IMPORTANT (Express wiring): most tracker routers share the same '/api' mount in
 * app.ts, so this must be composed PER-ROUTE (requireAuth, requireSubscription,
 * loadOwnedBaby, …) — a router.use() here would silently gate unrelated routers
 * mounted later in the chain (consultations, community, …).
 */
export async function requireSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = req.authUser ?? (await User.findById(req.userId));
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (!hasActiveSubscription(user)) {
    res.status(402).json({
      error: 'This feature is part of the Mateo plan. Subscribe to unlock all trackers.',
      code: 'subscription_required',
    });
    return;
  }
  req.authUser = user;
  req.userRole = user.role;
  next();
}
