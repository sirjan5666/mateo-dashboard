// Razorpay integration — fetch-based (no SDK dependency), mirroring how the AI
// provider talks to DeepSeek over plain HTTP. Two things happen here:
//   1. createRazorpayOrder() — server creates the order (amount lives on the
//      server, never the client) and returns the Razorpay order id for Checkout.
//   2. verifyPaymentSignature() — after the user pays, Checkout returns a
//      signature; we recompute the HMAC and compare in constant time before we
//      ever mark an order paid. This is the security boundary: a client claiming
//      "paid" is meaningless without a signature that matches our key secret.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/** True only when both keys are present; otherwise checkout uses the mock path. */
export function razorpayConfigured(): boolean {
  return !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
}

/**
 * Create a Razorpay order for `amountInr` whole rupees. `receipt` is our own
 * reference (the Mongo order id) so the two systems can be reconciled.
 */
export async function createRazorpayOrder(amountInr: number, receipt: string): Promise<RazorpayOrder> {
  if (!razorpayConfigured()) throw new Error('Razorpay is not configured');
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`${env.RAZORPAY_API_BASE.replace(/\/$/, '')}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: Math.round(amountInr * 100), // Razorpay works in paise
      currency: 'INR',
      receipt,
      payment_capture: 1,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Razorpay order create ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id: string; amount: number; currency: string };
  return { id: data.id, amount: data.amount, currency: data.currency };
}

/**
 * Verify a Checkout success payload. Razorpay signs `${orderId}|${paymentId}`
 * with HMAC-SHA256 keyed by the secret; we recompute and compare in constant
 * time. Returns false on any mismatch or malformed input.
 */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!env.RAZORPAY_KEY_SECRET || !orderId || !paymentId || !signature) return false;
  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
