import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { uploadPhoto, uploadsDir } from '../middleware/upload.js';
import { getProduct } from '../data/shop-catalog.js';
import { ProductReview } from '../models/ProductReview.js';
import type { IProductReview } from '../models/ProductReview.js';
import { ReviewHelpful } from '../models/ReviewHelpful.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { award, reverse } from '../points/service.js';
import { SITARE } from '../points/economics.js';

const router = Router();

const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(1, 'Add a short title').max(120),
  body: z.string().trim().min(1, 'Write a few words').max(2000),
});

// Multer errors (size/type) become 400s, not 500s. Mirrors routes/skin.ts.
function handleUpload(req: Request, res: Response, next: NextFunction): void {
  uploadPhoto(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      return;
    }
    next();
  });
}

// A verified buyer has a paid, delivered order containing this product.
async function hasDeliveredPurchase(userId: string, productId: string): Promise<string | null> {
  const order = await Order.findOne({
    userId,
    'payment.status': 'paid',
    status: 'delivered',
    'items.productId': productId,
  }).select('_id');
  return order ? order.id : null;
}

function firstName(name?: string): string {
  return (name ?? 'A parent').trim().split(/\s+/)[0] || 'A parent';
}

function publicReview(r: IProductReview & { id: string }, reviewerName: string, mine: boolean) {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    reviewerName,
    verified: true, // creation is gated to verified buyers
    mine,
    helpfulCount: r.helpfulCount,
    photoUrl: r.photoFile ? `/api/shop/products/${r.productId}/reviews/${r.id}/photo` : null,
    createdAt: r.createdAt,
  };
}

// GET /api/shop/products/:id/reviews — list + rating aggregation + can-review state.
router.get('/shop/products/:id/reviews', requireAuth, async (req, res) => {
  const productId = String(req.params.id);
  const product = getProduct(productId);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 10;

  const [rows, total, agg] = await Promise.all([
    ProductReview.find({ productId, status: 'published' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name'),
    ProductReview.countDocuments({ productId, status: 'published' }),
    ProductReview.aggregate<{ _id: number; count: number }>([
      { $match: { productId, status: 'published' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let count = 0;
  for (const g of agg) {
    distribution[g._id as 1 | 2 | 3 | 4 | 5] = g.count;
    sum += g._id * g.count;
    count += g.count;
  }
  const average = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

  // Can the current user review? (Mateo product, verified buyer, not yet reviewed.)
  const alreadyReviewed = await ProductReview.exists({ productId, userId: req.userId });
  const isFormula = product.brand === 'neucomed';
  const verifiedOrderId = isFormula || alreadyReviewed ? null : await hasDeliveredPurchase(req.userId!, productId);

  res.json({
    rating: { average, count, distribution },
    reviews: rows.map((r) => {
      const u = r.userId as unknown as { name?: string; _id: unknown } | null;
      const mine = String((u?._id as { toString(): string })?.toString?.() ?? '') === req.userId;
      return publicReview(r, firstName(u?.name), mine);
    }),
    page,
    total,
    hasMore: page * limit < total,
    reviewable: !isFormula,
    canReview: Boolean(verifiedOrderId),
    alreadyReviewed: Boolean(alreadyReviewed),
    reward: SITARE.REVIEW_APPROVED,
    rewardMinStars: SITARE.REVIEW_MIN_STAR_FOR_REWARD,
  });
});

// GET photo — authenticated stream, same pattern as skin logs.
router.get('/shop/products/:id/reviews/:reviewId/photo', requireAuth, async (req, res) => {
  const { reviewId } = req.params;
  const review = isValidObjectId(reviewId) ? await ProductReview.findById(reviewId) : null;
  if (!review || !review.photoFile) {
    res.status(404).json({ error: 'Photo not found' });
    return;
  }
  res.sendFile(path.join(uploadsDir, review.photoFile));
});

// POST /api/shop/products/:id/reviews — verified-buyer create; ★ reward on 4–5★.
router.post('/shop/products/:id/reviews', requireAuth, handleUpload, async (req, res) => {
  const productId = String(req.params.id);
  const cleanupFile = async () => {
    if (req.file) await unlink(req.file.path).catch(() => {});
  };

  const product = getProduct(productId);
  if (!product) {
    await cleanupFile();
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  // IMS Act: infant formula is not reviewable (a review + ★ reward is an inducement).
  if (product.brand === 'neucomed') {
    await cleanupFile();
    res.status(403).json({ error: 'This product cannot be reviewed.' });
    return;
  }

  let body: z.infer<typeof createReviewSchema>;
  try {
    body = createReviewSchema.parse(req.body);
  } catch (err) {
    await cleanupFile();
    throw err;
  }

  const verifiedOrderId = await hasDeliveredPurchase(req.userId!, productId);
  if (!verifiedOrderId) {
    await cleanupFile();
    res.status(403).json({ error: 'Only verified buyers of a delivered order can review this product.' });
    return;
  }

  let review;
  try {
    review = await ProductReview.create({
      productId,
      userId: req.userId,
      orderId: verifiedOrderId,
      rating: body.rating,
      title: body.title,
      body: body.body,
      photoFile: req.file?.filename,
    });
  } catch (err: unknown) {
    await cleanupFile();
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      res.status(409).json({ error: "You've already reviewed this product." });
      return;
    }
    throw err;
  }

  // Reward honest 4–5★ reviews (one rewardable review per product per user; the
  // dedupeKey + the unique review index both guarantee single-award).
  let awarded = 0;
  if (body.rating >= SITARE.REVIEW_MIN_STAR_FOR_REWARD) {
    const result = await award({
      userId: req.userId!,
      source: 'product_review',
      amount: SITARE.REVIEW_APPROVED,
      refType: 'review',
      refId: review.id,
      dedupeKey: `earn:review:${review.id}`,
    });
    awarded = result.awarded;
    if (result.ledgerId) {
      review.rewardedLedgerId = result.ledgerId as unknown as typeof review.rewardedLedgerId;
      await review.save();
    }
  }

  const u = await User.findById(req.userId).select('name');
  res.status(201).json({ review: publicReview(review, firstName(u?.name ?? undefined), true), awarded });
});

// POST /api/shop/products/:id/reviews/:reviewId/helpful — one vote per user.
router.post('/shop/products/:id/reviews/:reviewId/helpful', requireAuth, async (req, res) => {
  const { reviewId } = req.params;
  const review = isValidObjectId(reviewId) ? await ProductReview.findById(reviewId) : null;
  if (!review || review.status !== 'published') {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  try {
    await ReviewHelpful.create({ reviewId: review._id, userId: req.userId });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      res.json({ ok: true, helpfulCount: review.helpfulCount, already: true });
      return;
    }
    throw err;
  }
  review.helpfulCount += 1;
  await review.save();
  res.json({ ok: true, helpfulCount: review.helpfulCount });
});

// DELETE /api/shop/products/:id/reviews/:reviewId — author removes their review;
// claws back the ★ reward (anti-farming), mirroring the community-delete rule.
router.delete('/shop/products/:id/reviews/:reviewId', requireAuth, async (req, res) => {
  const { reviewId } = req.params;
  const review = isValidObjectId(reviewId) ? await ProductReview.findById(reviewId) : null;
  if (!review || review.userId.toString() !== req.userId) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  await reverse({ dedupeKey: `earn:review:${review.id}`, reason: 'review_deleted' });
  if (review.photoFile) await unlink(path.join(uploadsDir, review.photoFile)).catch(() => {});
  await review.deleteOne();
  res.json({ ok: true });
});

export default router;
