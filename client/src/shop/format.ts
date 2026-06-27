import type { OrderStatus } from '../api/shop';
import type { Tone } from '../components/ui/tones';

/** Whole-rupee display, e.g. 1299 → "₹1,299". */
export function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Awaiting payment', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'violet' },
  packed: { label: 'Packed', tone: 'sky' },
  shipped: { label: 'Shipped', tone: 'sky' },
  delivered: { label: 'Delivered', tone: 'emerald' },
  cancelled: { label: 'Cancelled', tone: 'rose' },
};
