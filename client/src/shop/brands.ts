import type { Brand } from '../api/shop';

// Brand display metadata for the storefront browse hierarchy (mirrors the
// server BRANDS map in data/shop-catalog.ts). Neucomed stays behind the IMS-Act
// gate + is presented factually — no rewards, no promotions.
export const BRAND_LABEL: Record<Brand, string> = {
  mateo: 'Mateo',
  neucomed: 'Neucomed',
};

export const BRAND_BLURB: Record<Brand, string> = {
  mateo: 'Gentle, dermatologically tested baby skincare — pH 5.5 and tear-free.',
  neucomed: 'Neucomil infant nutrition. Mother’s milk is best — for use only on a healthcare professional’s advice.',
};
