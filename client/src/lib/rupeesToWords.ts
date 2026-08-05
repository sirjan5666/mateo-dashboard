/**
 * Indian-numbering amount-in-words, for pharmacy invoices.
 *
 * 384.83 → "Three Hundred Eighty Four Rupees and Eighty Three Paise Only."
 * Groups by thousand / lakh / crore, not by the Western thousand / million.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** 0–99. */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? `${t} ${o}` : t;
}

/** 0–999. */
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/** Whole rupees to words, without the "Rupees" suffix. */
export function numberToWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

/**
 * Full invoice line. Paise are rounded to two places first so that floating
 * point noise (384.8299999) can never render as "Eighty Two Paise".
 */
export function rupeesToWords(amount: number): string {
  const total = Math.round(amount * 100);
  const rupees = Math.floor(total / 100);
  const paise = total % 100;
  const head = `${numberToWords(rupees)} Rupees`;
  return paise ? `${head} and ${twoDigits(paise)} Paise Only.` : `${head} Only.`;
}
