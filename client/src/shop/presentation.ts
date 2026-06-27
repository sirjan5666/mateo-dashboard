// Presentational metadata for the premium storefront (from the mateo-shop-desktop
// design): a soft image-area tint + a skincare category, keyed by catalog id.
// The server catalog stays the source of truth for name/price/copy — this only
// drives the card tints and the category filter row. Tints reuse the app's
// --cat-*-bg tokens so they stay on-palette.
export const CATEGORIES = ['All', 'Wash', 'Lotion', 'Oil', 'Cream', 'Bar'] as const;
export type ShopCategory = (typeof CATEGORIES)[number];

interface Presentation {
  tint: string;
  category?: Exclude<ShopCategory, 'All'>;
}

const MAP: Record<string, Presentation> = {
  'mateo-moisture-lotion': { tint: '#ede7ff', category: 'Lotion' },
  'mateo-massage-oil': { tint: 'var(--cat-food-bg)', category: 'Oil' },
  'mateo-baby-shampoo': { tint: 'var(--cat-skin-bg)', category: 'Wash' },
  'mateo-tip-to-toe-wash': { tint: 'var(--cat-record-bg)', category: 'Wash' },
  'mateo-rash-cream': { tint: 'var(--cat-growth-bg)', category: 'Cream' },
  'mateo-baby-bar': { tint: 'var(--cat-sleep-bg)', category: 'Bar' },
  'neucomil-stage-1': { tint: 'var(--cat-record-bg)' },
  'neucomil-advance-stage-1': { tint: '#ede7ff' },
  'neucomil-lbw': { tint: 'var(--cat-skin-bg)' },
  'neucomil-lf': { tint: 'var(--cat-food-bg)' },
};

const FALLBACK_TINT = '#ede7ff';

export function tintFor(id: string): string {
  return MAP[id]?.tint ?? FALLBACK_TINT;
}

export function categoryFor(id: string): ShopCategory | undefined {
  return MAP[id]?.category;
}
