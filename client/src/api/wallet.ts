import { api } from './client';

// Mateo Sitare wallet — mirrors server/src/routes/wallet.ts.

export interface WalletBalance {
  balance: number;
  reserved: number;
  lifetime: number;
  expiringSoon: { points: number; before: string };
  conversion: { pointsPerInr: number };
}

export type LedgerBucket = 'earned' | 'redeemed' | 'pending' | 'expired';

export interface LedgerEntry {
  id: string;
  bucket: LedgerBucket;
  entryType: string;
  source: string;
  amount: number;
  status: string;
  refType: string | null;
  refId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface LedgerPage {
  entries: LedgerEntry[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface RedeemPreview {
  eligibleSubtotalInr: number;
  maxRedeemablePoints: number;
  maxRedeemableInr: number;
  appliedPoints: number;
  discountInr: number;
  payableReductionInr: number;
  balance: number;
  conversion: { pointsPerInr: number };
}

export function getWalletBalance() {
  return api<WalletBalance>('/wallet/balance');
}

export function getWalletLedger(filter: 'all' | LedgerBucket = 'all', page = 1) {
  return api<LedgerPage>(`/wallet/ledger?filter=${filter}&page=${page}`);
}

export interface PreviewCartInput {
  context: 'cart';
  items: { productId: string; quantity: number }[];
  requestedPoints?: number;
}
export interface PreviewConsultInput {
  context: 'consultation';
  feeInr: number;
  requestedPoints?: number;
}

export function previewRedeem(input: PreviewCartInput | PreviewConsultInput) {
  return api<RedeemPreview>('/wallet/preview', { method: 'POST', body: JSON.stringify(input) });
}
