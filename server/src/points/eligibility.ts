// Formula exclusion — the SINGLE source of truth for what Sitare may touch.
//
// IMS Act 1992 (CLAUDE.md hard rule 4): a points/reward currency is an
// "inducement", which is forbidden for infant milk substitutes. So formula
// (brand === 'neucomed') NEVER earns ★ and is NEVER part of the redeemable base.
// Every earn/redeem call routes its rupee amounts through here so the carve-out
// can't drift between call sites.

import type { IOrderItem } from '../models/Order.js';

/** A shop line item is eligible for Sitare only if it is NOT infant formula. */
export function isEligibleItem(item: Pick<IOrderItem, 'brand'>): boolean {
  return item.brand !== 'neucomed';
}

/** Subtotal (₹) of the eligible, non-formula lines only. */
export function eligibleSubtotalInr(items: Pick<IOrderItem, 'brand' | 'priceInr' | 'quantity'>[]): number {
  return items
    .filter(isEligibleItem)
    .reduce((sum, i) => sum + i.priceInr * i.quantity, 0);
}

/** True if any line is formula — used to show the "formula excluded" note in the UI. */
export function hasFormula(items: Pick<IOrderItem, 'brand'>[]): boolean {
  return items.some((i) => !isEligibleItem(i));
}
