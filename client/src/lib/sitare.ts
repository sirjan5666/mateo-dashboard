// Mateo Sitare — client helpers + a tiny refresh bus so the nav pill and
// dashboard card can re-pull the balance after an earn/redeem without a global
// store or prop-drilling. Mirrors the imperative toast store pattern.

const listeners = new Set<() => void>();

/** Tell every mounted balance surface to re-fetch (call after earning/redeeming ★). */
export function refreshSitare(): void {
  listeners.forEach((l) => l());
}

export function onSitareRefresh(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** "1,240" — grouped ★ count. */
export function formatStars(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString('en-IN');
}
