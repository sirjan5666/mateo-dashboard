import { decryptOptional } from './crypto/fieldCipher.js';

/**
 * Invoice line items live in `Invoice.itemsEnc` as an ENCRYPTED JSON array —
 * service descriptions can reveal care details, so they are never queryable in
 * the database. Anything that needs them decrypts here, in memory.
 *
 * Shared by the billing routes (which return the items for one invoice the
 * doctor already owns) and the reports route (which returns only aggregate
 * service counts, never a row). A bad/missing payload yields an empty list
 * rather than throwing: a single unreadable invoice must not fail a whole
 * report.
 */
export interface LineItem {
  description: string;
  amount: number;
}

export function parseInvoiceItems(enc: string): LineItem[] {
  const json = decryptOptional(enc || undefined);
  if (!json) return [];
  try {
    const arr: unknown = JSON.parse(json);
    return Array.isArray(arr) ? (arr as LineItem[]) : [];
  } catch {
    return [];
  }
}
