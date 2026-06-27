// Static product catalog for the Mateo + Neucomed storefront.
//
// Products are static reference data (no admin CRUD), so they live here rather
// than in MongoDB. Orders snapshot the product fields they need, and checkout
// re-prices every line from THIS catalog — the client price is never trusted.
//
// IMS Act 1992 compliance (see CLAUDE.md hard rule 4): the Neucomed line is
// infant formula / infant milk substitute. Its copy here is deliberately
// FACTUAL — no superiority/idealizing claims, no "premium/best start" marketing
// — and every item carries the statutory notice + a medical-supervision flag.
// There are NO discounts or promotional prices anywhere (the Act forbids
// inducements to buy formula). Prices are PLACEHOLDER MRPs (whole INR) — replace
// with the real MRP before going live.

export type Brand = 'mateo' | 'neucomed';

export interface ShopProduct {
  id: string; // stable slug, used in URLs / cart / order line items
  brand: Brand;
  name: string;
  tagline: string;
  priceInr: number; // whole rupees (MRP). Razorpay amount = priceInr * 100 (paise).
  image: string; // filename served from client/public/shop/
  description: string;
  highlights: string[];
  ingredients?: string;
  // Infant-formula-only fields:
  type?: string;
  ageRange?: string;
  sizes?: string[];
  directions?: string;
  storage?: string;
  warning?: string; // IMS Act statutory notice — rendered prominently
  medicalSupervision?: boolean; // true => "use only on a doctor's advice"
}

export const BRANDS: Record<Brand, { name: string; blurb: string }> = {
  mateo: {
    name: 'Mateo',
    blurb: 'Gentle, dermatologically tested baby skincare — pH 5.5 and tear-free.',
  },
  neucomed: {
    name: 'Neucomed',
    blurb: 'Neucomil infant nutrition. Mother’s milk is best — these are for use only on a healthcare professional’s advice.',
  },
};

// Shown on the Neucomed section gate + banners (IMS Act statutory warning).
export const NEUCOMED_NOTICE =
  'IMPORTANT NOTICE: Mother’s milk is best for your baby. Infant milk substitutes should be used only on the advice of a doctor or healthcare professional, and prepared and used exactly as directed — incorrect preparation can harm your baby.';

export const CATALOG: ShopProduct[] = [
  // ── Mateo skincare ─────────────────────────────────────────────────────────
  {
    id: 'mateo-baby-bar',
    brand: 'mateo',
    name: 'Mateo Baby Bar',
    tagline: 'Tear-free pH 5.5 cleansing bar',
    priceInr: 149,
    image: 'mateo-baby-bar.png',
    description:
      'A mild, tear-free cleansing bar made for delicate baby skin. Its pH 5.5 syndet base cleanses gently without stripping natural oils, while vitamin E, glycerin and milk help keep skin soft and comfortable. Dermatologically tested and free from harsh chemicals.',
    highlights: ['pH 5.5 balanced', 'Tear-free', 'Vitamin E, glycerin & milk', 'Dermatologically tested'],
    ingredients:
      'Syndet base, Alkyl Glyceryl Ether Sulfosuccinate, Stearic acid, Starch, Sodium Cocoyl Isethionate, Sulfosuccinates, Alpha Olefin Sulfonates, Sodium Cocomonoglyceride Sulfate, CAPB, Glycerin, Titanium Dioxide, Milk Powder, BHT, EDTA, Vitamin E, Purified Water, Perfume.',
  },
  {
    id: 'mateo-baby-shampoo',
    brand: 'mateo',
    name: 'Mateo Baby Shampoo',
    tagline: 'Tear-free shampoo for soft, clean hair',
    priceInr: 249,
    image: 'mateo-shampoo.png',
    description:
      'A gentle, tear-free shampoo that cleanses your baby’s hair while locking in natural oils. Made with coconut oil, aloe vera, chamomile and mixed-fruit extracts; pH 5.5 balanced and dermatologically tested for sensitive skin.',
    highlights: ['Tear-free formula', 'pH 5.5 balanced', 'Coconut oil, aloe vera & chamomile', 'Dermatologically tested'],
  },
  {
    id: 'mateo-massage-oil',
    brand: 'mateo',
    name: 'Mateo Baby Massage Oil',
    tagline: 'Cold-pressed oils for a calming massage',
    priceInr: 299,
    image: 'mateo-massage-oil.png',
    description:
      'A nourishing blend of cold-pressed oils — apricot, almond, sesame, wheat germ, evening primrose and soy — for a soothing daily massage that helps keep your baby’s skin soft and supple. Cruelty-free and responsibly sourced.',
    highlights: ['Cold-pressed oils', 'Apricot, almond & sesame', 'Cruelty-free', 'Nourishing & moisturising'],
  },
  {
    id: 'mateo-moisture-lotion',
    brand: 'mateo',
    name: 'Mateo Moisture Lotion',
    tagline: 'Deep hydration with shea butter & milk protein',
    priceInr: 279,
    image: 'mateo-lotion.png',
    description:
      'A moisture-rich body lotion that gives soft, lasting hydration. Shea butter and milk protein nourish and soften, while a pH 5.5 balanced formula helps protect delicate skin from dryness — gentle enough for everyday use, including dry winter skin. Free from sulphates and parabens.',
    highlights: ['Shea butter & milk protein', 'pH 5.5 balanced', 'Sulphate & paraben free', 'Long-lasting hydration'],
  },
  {
    id: 'mateo-rash-cream',
    brand: 'mateo',
    name: 'Mateo Rash-free Cream',
    tagline: 'Soothes & protects against diaper rash',
    priceInr: 249,
    image: 'mateo-rash-cream.png',
    description:
      'A soothing diaper rash-free cream that helps calm redness and irritation and protect delicate skin against moisture and germs. pH 5.5 balanced and free from parabens, sulphates and mineral oil.',
    highlights: ['Soothes irritation', 'pH 5.5 balanced', 'Paraben, sulphate & mineral-oil free', 'For delicate skin'],
  },
  {
    id: 'mateo-tip-to-toe-wash',
    brand: 'mateo',
    name: 'Mateo Tip-to-Toe Wash',
    tagline: 'Gentle head-to-toe wash',
    priceInr: 279,
    image: 'mateo-body-wash.png',
    description:
      'A mild head-to-toe wash that cleanses hair and body in one gentle step. Enriched with jojoba, sweet almond and avocado oils plus vitamin E to protect against dryness. Tear-free and pH 5.5 balanced for sensitive skin.',
    highlights: ['2-in-1 hair & body', 'Tear-free', 'Jojoba, almond & avocado oils', 'pH 5.5 balanced'],
    ingredients: 'Aloe vera juice 10%, Jojoba oil 2%, Sweet Almond oil 2%, Avocado oil 1%, Vitamin E (Tocopheryl Acetate) 3%, Aqua.',
  },

  // ── Neucomed (Neucomil) infant formula ──────────────────────────────────────
  // Factual copy only; statutory warning + medical-supervision on every item.
  {
    id: 'neucomil-stage-1',
    brand: 'neucomed',
    name: 'Neucomil Stage 1',
    tagline: 'Infant formula, 0–6 months',
    priceInr: 650,
    image: 'neucomil-stage-1.png',
    type: 'Infant formula (Stage 1)',
    ageRange: '0–6 months',
    sizes: ['200g', '400g'],
    description:
      'Neucomil Stage 1 is an infant milk substitute for babies aged 0–6 months, for use when breastfeeding is not possible, on the advice of a healthcare professional. It contains milk and soy with a blend of vitamins and minerals including calcium, vitamin D and iron.',
    highlights: ['For 0–6 months', 'Contains milk & soy', 'With calcium, vitamin D & iron', 'Whey-based'],
    directions:
      'Prepare each feed fresh using sterilised utensils and cooled, previously boiled water. Follow the dilution stated on the pack exactly — using more or fewer scoops than directed can harm your baby. Use within 30 minutes and discard any leftover feed. Ask your pediatrician about the right feeding amount.',
    storage:
      'Store the unopened tin at room temperature in a dry place. After opening, use within the period stated on the pack, with the lid tightly closed. Do not refrigerate.',
    ingredients:
      'Milk Powder, Demineralised Whey, Edible vegetable oils (Soy, High-Oleic Sunflower, Coconut), Maltodextrin, Mixed tocopherols, Minerals, Vitamins, Taurine and L-Carnitine. Contains: Milk & Soy.',
    warning: 'IMPORTANT NOTICE: Mother’s milk is best for your baby.',
    medicalSupervision: true,
  },
  {
    id: 'neucomil-advance-stage-1',
    brand: 'neucomed',
    name: 'Neucomil Advance Stage 1',
    tagline: 'Infant formula with added nutrients, 0–6 months',
    priceInr: 750,
    image: 'neucomil-advance-1.png',
    type: 'Infant formula (Advance, Stage 1)',
    ageRange: '0–6 months',
    sizes: ['400g'],
    description:
      'Neucomil Advance Stage 1 is an infant milk substitute for babies aged 0–6 months, for use when breastfeeding is not possible, on the advice of a healthcare professional. It contains milk and soy with added nutrients including DHA, ARA, prebiotics (GOS & FOS) and nucleotides, alongside vitamins and minerals.',
    highlights: ['For 0–6 months', 'With DHA & ARA', 'Prebiotics (GOS & FOS)', 'Contains milk & soy'],
    directions:
      'Mix as directed on the pack (approx. one level scoop ≈ 4.45 g per 30 ml of cooled, boiled water). Prepare each feed fresh with sterilised utensils, use within 30 minutes and discard leftovers. Consult your pediatrician for the right feeding amount.',
    storage:
      'Store the unopened tin at room temperature in a dry place. After opening, use within two weeks or the pack expiry, whichever is sooner. Do not refrigerate.',
    ingredients:
      'Milk Powder, Demineralised Whey, Edible vegetable oils (Soy, High-Oleic Sunflower, Coconut), DHA, ARA, FOS, GOS, Nucleotides, Maltodextrin, Mixed tocopherols, Minerals, Vitamins, Taurine and L-Carnitine. Contains: Milk & Soy.',
    warning: 'IMPORTANT NOTICE: Mother’s milk is best for your baby.',
    medicalSupervision: true,
  },
  {
    id: 'neucomil-lbw',
    brand: 'neucomed',
    name: 'Neucomil LBW',
    tagline: 'Specialised formula for premature / low-birth-weight babies',
    priceInr: 700,
    image: 'neucomil-lbw.png',
    type: 'Infant formula (Low Birth Weight)',
    ageRange: 'Premature / low birth weight',
    sizes: ['400g'],
    description:
      'Neucomil LBW is a specialised infant milk substitute for premature babies (born before 37 weeks) and low-birth-weight babies (under 2.5 kg). It is energy-dense (73 kcal/100 ml) with whey proteins, DHA & ARA, nucleotides, vitamins and minerals. To be used strictly under medical supervision.',
    highlights: ['For premature / LBW babies', 'Energy-dense (73 kcal/100 ml)', 'With DHA & ARA', 'Use under medical supervision'],
    directions:
      'Prepare and feed only as directed by your doctor or hospital. Use sterilised utensils and cooled, boiled water, prepare each feed fresh, use within 30 minutes and discard leftovers.',
    storage:
      'Store the unopened tin at room temperature in a dry place. After opening, use within the period stated on the pack. Do not refrigerate.',
    ingredients:
      'Milk Powder, Demineralised Whey, Edible vegetable oils, DHA, ARA, Nucleotides, Medium Chain Triglycerides (MCT), Amino-acid mix, Maltodextrin, Mixed tocopherols, Minerals, Vitamins, Taurine and L-Carnitine.',
    warning: 'IMPORTANT NOTICE: Mother’s milk is best for your baby. This formula should only be used under medical supervision.',
    medicalSupervision: true,
  },
  {
    id: 'neucomil-lf',
    brand: 'neucomed',
    name: 'Neucomil LF',
    tagline: 'Lactose- & sucrose-free formula for special dietary needs',
    priceInr: 850,
    image: 'neucomil-lf.png',
    type: 'Infant formula (Lactose-Free)',
    ageRange: 'Infants with special dietary needs',
    sizes: ['200g', '400g'],
    description:
      'Neucomil LF is a lactose- and sucrose-free infant milk substitute for babies with lactose intolerance, cow-milk protein allergy, galactosemia, or during diarrhoea due to lactose intolerance. It is based on 100% casein protein with MCTs, nucleotides, vitamins and minerals. Use only under medical supervision.',
    highlights: ['Lactose- & sucrose-free', '100% casein protein', 'With MCTs & nucleotides', 'Use under medical supervision'],
    directions:
      'Use only on your doctor’s advice and prepare exactly as directed. Use sterilised utensils and cooled, boiled water, make each feed fresh, use within 30 minutes and discard leftovers.',
    storage:
      'Store the unopened tin at room temperature in a dry place. After opening, use within the period stated on the pack. Do not refrigerate.',
    ingredients:
      'Lactose-free protein (Whey Protein, Calcium Caseinate), Maltodextrin, Vegetable oils, Medium Chain Triglycerides (MCT), Fructose, Nucleotides, Mixed tocopherols, Minerals, Vitamins, Taurine and L-Carnitine.',
    warning: 'IMPORTANT NOTICE: Mother’s milk is best for your baby. This formula should only be used under medical supervision.',
    medicalSupervision: true,
  },
];

export function listProducts(brand?: Brand): ShopProduct[] {
  return brand ? CATALOG.filter((p) => p.brand === brand) : CATALOG;
}

export function getProduct(id: string): ShopProduct | undefined {
  return CATALOG.find((p) => p.id === id);
}
