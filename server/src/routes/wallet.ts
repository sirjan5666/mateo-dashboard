import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { PointsLedger } from '../models/PointsLedger.js';
import type { IPointsLedger } from '../models/PointsLedger.js';
import { getProduct } from '../data/shop-catalog.js';
import { eligibleSubtotalInr } from '../points/eligibility.js';
import { availableBalance, expireDueLots, expiringSoon, previewRedeem, recomputeUserCache } from '../points/service.js';
import { SITARE } from '../points/economics.js';
import { User } from '../models/User.js';

const router = Router();

// Map an internal ledger row to the public "wallet activity" shape. `bucket`
// classifies it for the client's earned/redeemed/pending/expired filter tabs.
function publicEntry(row: IPointsLedger & { id: string }) {
  let bucket: 'earned' | 'redeemed' | 'pending' | 'expired';
  if (row.status === 'reserved') bucket = 'pending';
  else if (row.status === 'expired' || row.entryType === 'expire') bucket = 'expired';
  else if (row.amount < 0) bucket = 'redeemed';
  else bucket = 'earned';
  return {
    id: row.id,
    bucket,
    entryType: row.entryType,
    source: row.source,
    amount: row.amount,
    status: row.status,
    refType: row.refType ?? null,
    refId: row.refId ?? null,
    expiresAt: row.expiresAt ?? null,
    createdAt: row.createdAt,
  };
}

// GET /api/wallet/balance — headline numbers for the wallet + nav pill.
// Lazily sweeps expired lots first so the balance is always current without a cron.
router.get('/balance', requireAuth, async (req, res) => {
  const userId = req.userId!;
  await expireDueLots();
  await recomputeUserCache(userId);
  const user = await User.findById(userId).select('sitareBalance sitareReserved sitareLifetime');
  const soon = await expiringSoon(userId);
  res.json({
    balance: user?.sitareBalance ?? 0,
    reserved: user?.sitareReserved ?? 0,
    lifetime: user?.sitareLifetime ?? 0,
    expiringSoon: { points: soon.points, before: soon.before },
    conversion: { pointsPerInr: SITARE.CONVERSION_POINTS_PER_INR },
  });
});

const ledgerQuery = z.object({
  filter: z.enum(['all', 'earned', 'redeemed', 'pending', 'expired']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

// GET /api/wallet/ledger — paginated history for the wallet page.
router.get('/ledger', requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { filter, page, limit } = ledgerQuery.parse(req.query);

  const match: Record<string, unknown> = { userId };
  if (filter === 'pending') match.status = 'reserved';
  else if (filter === 'expired') Object.assign(match, { $or: [{ status: 'expired' }, { entryType: 'expire' }] });
  else if (filter === 'earned') Object.assign(match, { amount: { $gt: 0 }, status: { $ne: 'reserved' } });
  else if (filter === 'redeemed') Object.assign(match, { amount: { $lt: 0 }, status: 'settled' });

  const [rows, total] = await Promise.all([
    PointsLedger.find(match).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    PointsLedger.countDocuments(match),
  ]);
  res.json({
    entries: rows.map((r) => publicEntry(r)),
    page,
    limit,
    total,
    hasMore: page * limit < total,
  });
});

const previewSchema = z.object({
  context: z.enum(['cart', 'consultation']),
  requestedPoints: z.number().int().min(0).optional(),
  // cart context
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(99) }))
    .max(50)
    .optional(),
  // consultation context
  feeInr: z.number().int().min(0).optional(),
});

// POST /api/wallet/preview — server-authoritative "how much can I take off?" for
// the Apply-Sitare control. The client NEVER computes discounts itself.
router.post('/preview', requireAuth, async (req, res) => {
  const userId = req.userId!;
  const body = previewSchema.parse(req.body);

  let eligibleInr: number;
  if (body.context === 'cart') {
    // Re-price from the catalog and exclude formula — never trust client prices.
    const items = (body.items ?? [])
      .map((line) => {
        const p = getProduct(line.productId);
        return p ? { brand: p.brand, priceInr: p.priceInr, quantity: line.quantity } : null;
      })
      .filter((x): x is { brand: 'mateo' | 'neucomed'; priceInr: number; quantity: number } => x !== null);
    eligibleInr = eligibleSubtotalInr(items);
  } else {
    eligibleInr = Math.max(0, body.feeInr ?? 0);
  }

  const preview = await previewRedeem({ userId, eligibleInr, requestedPoints: body.requestedPoints });
  const balance = await availableBalance(userId);
  res.json({ ...preview, balance, conversion: { pointsPerInr: SITARE.CONVERSION_POINTS_PER_INR } });
});

export default router;
