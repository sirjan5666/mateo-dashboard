import { api } from './client';

// Product reviews — mirrors server/src/routes/reviews.ts.

export interface ProductReview {
  id: string;
  rating: number;
  title: string;
  body: string;
  reviewerName: string;
  verified: boolean;
  mine: boolean;
  helpfulCount: number;
  photoUrl: string | null;
  createdAt: string;
}

export interface RatingSummary {
  average: number;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface ReviewsResponse {
  rating: RatingSummary;
  reviews: ProductReview[];
  page: number;
  total: number;
  hasMore: boolean;
  reviewable: boolean; // false for formula
  canReview: boolean; // verified buyer, not yet reviewed
  alreadyReviewed: boolean;
  reward: number; // ★ for a 4-5★ review
  rewardMinStars: number;
}

export function listReviews(productId: string, page = 1) {
  return api<ReviewsResponse>(`/shop/products/${encodeURIComponent(productId)}/reviews?page=${page}`);
}

// Create a review. Uses multipart so an optional photo can ride along — so we do
// NOT go through the JSON `api()` helper (which forces application/json).
export async function createReview(
  productId: string,
  input: { rating: number; title: string; body: string; photo?: File | null },
): Promise<{ review: ProductReview; awarded: number }> {
  const fd = new FormData();
  fd.append('rating', String(input.rating));
  fd.append('title', input.title);
  fd.append('body', input.body);
  if (input.photo) fd.append('photo', input.photo);
  const res = await fetch(`/api/shop/products/${encodeURIComponent(productId)}/reviews`, {
    method: 'POST',
    body: fd,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Could not post your review');
  }
  return res.json();
}

export function markReviewHelpful(productId: string, reviewId: string) {
  return api<{ ok: true; helpfulCount: number; already?: boolean }>(
    `/shop/products/${encodeURIComponent(productId)}/reviews/${reviewId}/helpful`,
    { method: 'POST' },
  );
}

export function deleteReview(productId: string, reviewId: string) {
  return api<{ ok: true }>(`/shop/products/${encodeURIComponent(productId)}/reviews/${reviewId}`, {
    method: 'DELETE',
  });
}
