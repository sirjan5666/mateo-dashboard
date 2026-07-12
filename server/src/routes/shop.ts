import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getProduct, listProducts, type Brand } from '../data/shop-catalog.js';
import { Order, ORDER_STATUSES } from '../models/Order.js';
import type { IOrder, OrderStatus } from '../models/Order.js';
import { AdminNotification } from '../models/AdminNotification.js';
import { createRazorpayOrder, razorpayConfigured, verifyPaymentSignature } from '../lib/razorpay.js';
import { env } from '../config/env.js';
import { notifyAdminsOfNewOrder } from '../shop/notify.js';
import { eligibleSubtotalInr } from '../points/eligibility.js';
import { earnForSpend } from '../points/economics.js';
import { award, confirmReservation, releaseReservation, reserveForOrder, reverse } from '../points/service.js';

// Free shipping over this subtotal, otherwise a flat fee. This is plain shipping
// — NOT a discount or inducement (which the IMS Act forbids for formula).
const SHIPPING_FLAT_INR = 49;
const FREE_SHIPPING_OVER_INR = 499;

const brandSchema = z.enum(['mateo', 'neucomed']);

const addressSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number'),
  email: z.string().trim().email().optional().or(z.literal('')),
  line1: z.string().trim().min(1, 'Address is required').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, 'City is required').max(80),
  state: z.string().trim().min(1, 'State is required').max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
  country: z.string().trim().max(80).default('India'),
});

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
        size: z.string().max(40).optional(),
      }),
    )
    .min(1, 'Your cart is empty')
    .max(50),
  shippingAddress: addressSchema,
  // Mateo Sitare: how many ★ the buyer wants to redeem. Always re-clamped
  // server-side (balance, 20% eligible cap, whole-rupee steps) — never trusted.
  redeemPoints: z.number().int().min(0).max(1_000_000).optional(),
});

const verifySchema = z.object({
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

const adminUpdateSchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']).optional(),
    note: z.string().trim().max(300).optional(),
    tracking: z
      .object({
        carrier: z.string().trim().max(80).optional(),
        trackingNumber: z.string().trim().max(120).optional(),
        url: z.string().trim().max(500).optional(),
      })
      .optional(),
  })
  .refine((b) => b.status || b.tracking, 'Nothing to update');

function genOrderNumber(): string {
  const t = Date.now().toString(36).toUpperCase().slice(-5);
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `MT-${t}${r}`;
}

function publicOrder(o: HydratedDocument<IOrder>) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    items: o.items,
    subtotalInr: o.subtotalInr,
    shippingInr: o.shippingInr,
    totalInr: o.totalInr,
    shippingAddress: o.shippingAddress,
    status: o.status,
    statusHistory: o.statusHistory,
    tracking: o.tracking,
    hasFormula: o.items.some((i) => i.brand === 'neucomed'),
    sitare: o.sitare
      ? {
          pointsRedeemed: o.sitare.pointsRedeemed,
          discountInr: o.sitare.discountInr,
          eligibleSubtotalInr: o.sitare.eligibleSubtotalInr,
          earnedPoints: o.sitare.earnedPoints,
        }
      : null,
    payment: {
      method: o.payment.method,
      status: o.payment.status,
      amountInr: o.payment.amountInr,
      paidAt: o.payment.paidAt,
    },
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// Award Sitare for a paid order on its eligible (non-formula) subtotal.
// Idempotent via the order-scoped dedupeKey, so re-verify never double-awards.
async function earnOrder(order: HydratedDocument<IOrder>): Promise<number> {
  const amount = earnForSpend(eligibleSubtotalInr(order.items));
  if (amount <= 0) return 0;
  const result = await award({
    userId: order.userId.toString(),
    source: 'shop_purchase',
    amount,
    refType: 'order',
    refId: order.id,
    dedupeKey: `earn:order:${order.id}`,
  });
  return result.awarded;
}

const router = Router();

// ── Catalog ──────────────────────────────────────────────────────────────────
router.get('/products', requireAuth, (req, res) => {
  const brandParam = req.query.brand;
  const brand = typeof brandParam === 'string' && brandSchema.safeParse(brandParam).success ? (brandParam as Brand) : undefined;
  res.json({ products: listProducts(brand) });
});

router.get('/products/:id', requireAuth, (req, res) => {
  const product = getProduct(String(req.params.id));
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({ product });
});

// ── Orders (parent / customer) ───────────────────────────────────────────────
// Create an order. Prices are ALWAYS recomputed from the catalog — the client's
// numbers are never trusted. With Razorpay configured we return the gateway
// order for Checkout; otherwise we fall back to a labelled mock payment so the
// flow is fully usable in dev.
router.post('/orders', requireAuth, async (req, res) => {
  const body = createOrderSchema.parse(req.body);

  // Re-price every line from the authoritative catalog.
  const items = body.items.map((line) => {
    const p = getProduct(line.productId);
    if (!p) throw Object.assign(new Error(`Unknown product: ${line.productId}`), { status: 400 });
    return {
      productId: p.id,
      name: p.name,
      brand: p.brand,
      priceInr: p.priceInr,
      quantity: line.quantity,
      size: line.size && p.sizes?.includes(line.size) ? line.size : p.sizes?.[0],
      image: p.image,
    };
  });

  const subtotalInr = items.reduce((sum, i) => sum + i.priceInr * i.quantity, 0);
  const shippingInr = subtotalInr >= FREE_SHIPPING_OVER_INR ? 0 : SHIPPING_FLAT_INR;
  const totalInr = subtotalInr + shippingInr;

  const addr = body.shippingAddress;
  const now = new Date();
  const order = await Order.create({
    userId: req.userId,
    orderNumber: genOrderNumber(),
    items,
    subtotalInr,
    shippingInr,
    totalInr,
    shippingAddress: { ...addr, email: addr.email || undefined },
    status: 'pending',
    statusHistory: [{ status: 'pending', at: now }],
    payment: {
      method: razorpayConfigured() ? 'razorpay' : 'mock',
      status: 'pending',
      amountInr: totalInr,
    },
  });

  // Mateo Sitare redemption: hold points against this order. The eligible base
  // excludes formula (IMS Act). The hold is CONFIRMED on payment or RELEASED on
  // failure/cancel so points and money can never diverge.
  const eligibleInr = eligibleSubtotalInr(items);
  const reservation = await reserveForOrder({
    userId: req.userId!,
    orderId: order.id,
    requestedPoints: body.redeemPoints ?? 0,
    eligibleSubtotalInr: eligibleInr,
  });
  const chargeInr = totalInr - reservation.discountInr;
  order.payment.amountInr = chargeInr;
  order.sitare = {
    pointsRedeemed: reservation.reservedPoints,
    discountInr: reservation.discountInr,
    eligibleSubtotalInr: eligibleInr,
    reservationId: reservation.reservationId,
    earnedPoints: 0,
  };
  await order.save();

  if (razorpayConfigured()) {
    try {
      const rzp = await createRazorpayOrder(chargeInr, order.orderNumber);
      order.payment.razorpayOrderId = rzp.id;
      await order.save();
      res.status(201).json({
        order: publicOrder(order),
        razorpay: { keyId: env.RAZORPAY_KEY_ID, orderId: rzp.id, amount: rzp.amount, currency: rzp.currency },
      });
    } catch (err) {
      console.error('Razorpay order creation failed:', err);
      order.payment.status = 'failed';
      await order.save();
      // Never reached the gateway — give the held points back.
      await releaseReservation(order.id).catch((e) => console.error('release failed:', e));
      res.status(502).json({ error: 'Could not start payment right now. Please try again.' });
    }
    return;
  }

  // Mock path — mark paid + confirmed immediately.
  order.payment.status = 'paid';
  order.payment.paidAt = now;
  order.status = 'confirmed';
  order.statusHistory.push({ status: 'confirmed', at: now, note: 'Payment received (mock)' });
  await confirmReservation(order.id);
  const earned = await earnOrder(order);
  if (order.sitare) order.sitare.earnedPoints = earned;
  await order.save();
  void notifyAdminsOfNewOrder(order).catch((e) => console.error('notifyAdmins failed:', e));
  res.status(201).json({ order: publicOrder(order), mock: true, earnedPoints: earned });
});

// Verify a Razorpay payment and confirm the order. The signature is the trust
// boundary — without a valid one the order is never marked paid.
router.post('/orders/:id/verify', requireAuth, async (req, res) => {
  const { id } = req.params;
  const order = isValidObjectId(id) ? await Order.findById(id) : null;
  if (!order || order.userId.toString() !== req.userId) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (order.payment.status === 'paid') {
    res.json({ order: publicOrder(order) });
    return;
  }
  // A cancelled order must not be silently resurrected by a late payment callback.
  if (order.status === 'cancelled') {
    res.status(409).json({ error: 'This order was cancelled and can no longer be confirmed.' });
    return;
  }
  const { razorpayPaymentId, razorpaySignature } = verifySchema.parse(req.body);
  const ok = order.payment.razorpayOrderId
    ? verifyPaymentSignature(order.payment.razorpayOrderId, razorpayPaymentId, razorpaySignature)
    : false;
  if (!ok) {
    order.payment.status = 'failed';
    await order.save();
    // Payment didn't verify — return any held Sitare to the wallet.
    await releaseReservation(order.id).catch((e) => console.error('release failed:', e));
    res.status(400).json({ error: 'Payment verification failed' });
    return;
  }
  const now = new Date();
  order.payment.status = 'paid';
  order.payment.razorpayPaymentId = razorpayPaymentId;
  order.payment.paidAt = now;
  order.status = 'confirmed';
  order.statusHistory.push({ status: 'confirmed', at: now, note: 'Payment received' });
  await confirmReservation(order.id);
  const earned = await earnOrder(order);
  if (order.sitare) order.sitare.earnedPoints = earned;
  await order.save();
  void notifyAdminsOfNewOrder(order).catch((e) => console.error('notifyAdmins failed:', e));
  res.json({ order: publicOrder(order) });
});

router.get('/orders', requireAuth, async (req, res) => {
  const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(100);
  res.json({ orders: orders.map((o) => publicOrder(o)) });
});

router.get('/orders/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const order = isValidObjectId(id) ? await Order.findById(id) : null;
  if (!order || order.userId.toString() !== req.userId) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json({ order: publicOrder(order) });
});

// ── Admin ────────────────────────────────────────────────────────────────────
router.get('/admin/orders', requireAuth, requireRole('admin'), async (req, res) => {
  const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
  const filter: { status?: OrderStatus } = {};
  if (statusParam && statusParam !== 'all' && (ORDER_STATUSES as string[]).includes(statusParam)) {
    filter.status = statusParam as OrderStatus;
  }
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(300).populate('userId', 'name email');
  res.json({
    orders: orders.map((o) => {
      const u = o.userId as unknown as { name?: string; email?: string } | null;
      return { ...publicOrder(o as HydratedDocument<IOrder>), customer: { name: u?.name ?? '—', email: u?.email ?? '' } };
    }),
  });
});

router.get('/admin/orders/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const order = isValidObjectId(id) ? await Order.findById(id).populate('userId', 'name email') : null;
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const u = order.userId as unknown as { name?: string; email?: string } | null;
  res.json({ order: { ...publicOrder(order as HydratedDocument<IOrder>), customer: { name: u?.name ?? '—', email: u?.email ?? '' } } });
});

router.patch('/admin/orders/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const order = isValidObjectId(id) ? await Order.findById(id) : null;
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const body = adminUpdateSchema.parse(req.body);
  if (body.status && body.status !== order.status) {
    order.status = body.status;
    order.statusHistory.push({ status: body.status, at: new Date(), note: body.note });
  }
  if (body.tracking) {
    order.tracking = {
      carrier: body.tracking.carrier || order.tracking.carrier,
      trackingNumber: body.tracking.trackingNumber || order.tracking.trackingNumber,
      url: body.tracking.url || order.tracking.url,
    };
  }
  await order.save();
  // Cancelling an order returns any still-held redemption and claws back the
  // earned ★ (prevents a buy→earn→cancel farm). Both are no-ops if inapplicable.
  if (body.status === 'cancelled') {
    await releaseReservation(order.id).catch((e) => console.error('release failed:', e));
    await reverse({ dedupeKey: `earn:order:${order.id}`, reason: 'order_cancelled' }).catch((e) => console.error('reverse failed:', e));
  }
  res.json({ order: publicOrder(order) });
});

// Admin can permanently delete an order (e.g. to clear test/cancelled orders).
// This removes the record entirely — distinct from the "cancelled" status, which
// keeps it for accounting.
router.delete('/admin/orders/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const order = isValidObjectId(id) ? await Order.findById(id) : null;
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  // Return any held redemption and claw back earned ★ before removing the record.
  await releaseReservation(order.id).catch((e) => console.error('release failed:', e));
  await reverse({ dedupeKey: `earn:order:${order.id}`, reason: 'order_deleted' }).catch((e) => console.error('reverse failed:', e));
  await order.deleteOne();
  res.json({ ok: true, id });
});

router.get('/admin/notifications', requireAuth, requireRole('admin'), async (_req, res) => {
  const [notifications, unread] = await Promise.all([
    AdminNotification.find().sort({ createdAt: -1 }).limit(50),
    AdminNotification.countDocuments({ read: false }),
  ]);
  res.json({
    unread,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      orderId: n.orderId,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
    })),
  });
});

router.post('/admin/notifications/read', requireAuth, requireRole('admin'), async (req, res) => {
  const ids = Array.isArray((req.body as { ids?: unknown })?.ids)
    ? ((req.body as { ids: unknown[] }).ids.filter((x) => typeof x === 'string') as string[])
    : null;
  await AdminNotification.updateMany(ids ? { _id: { $in: ids.filter(isValidObjectId) } } : {}, { $set: { read: true } });
  const unread = await AdminNotification.countDocuments({ read: false });
  res.json({ ok: true, unread });
});

export default router;
