import { api } from './client';

export type SubscriptionPlanKey = 'monthly' | 'yearly';

export interface SubscriptionState {
  active: boolean;
  source: 'mateo' | 'purchase' | 'doctor';
  plan?: SubscriptionPlanKey;
  activatedAt?: string;
  expiresAt?: string;
}

export interface SubscriptionPlanInfo {
  amountInr: number;
  days: number;
  label: string;
}

export function getSubscription() {
  return api<{
    subscription: SubscriptionState;
    plans: Record<SubscriptionPlanKey, SubscriptionPlanInfo>;
    razorpayConfigured: boolean;
  }>('/subscription');
}

// Mirrors the shop checkout contract: either a razorpay order to hand to
// Checkout.js, or `mock: true` with the plan already active (dev fallback).
export function checkoutSubscription(plan: SubscriptionPlanKey) {
  return api<{
    razorpay?: { keyId: string; orderId: string; amount: number; currency: string };
    subscription?: SubscriptionState;
    mock?: boolean;
  }>('/subscription/checkout', { method: 'POST', body: JSON.stringify({ plan }) });
}

export function verifySubscription(razorpayPaymentId: string, razorpaySignature: string) {
  return api<{ subscription: SubscriptionState }>('/subscription/verify', {
    method: 'POST',
    body: JSON.stringify({ razorpayPaymentId, razorpaySignature }),
  });
}
