import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Star } from 'lucide-react';
import { getWalletBalance } from '../../api/wallet';
import { formatStars, onSitareRefresh } from '../../lib/sitare';
import { cn } from '../../lib/cn';

// The Sitare ★ coin — a small gold token, visually distinct from purple UI and
// from gold product-rating stars (it's a filled disc, not a bare star).
export function SitareCoin({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-grid shrink-0 place-items-center rounded-full', className)}
      style={{ width: size, height: size, background: 'var(--sitare-gradient)', boxShadow: '0 1px 3px rgba(185,119,12,0.4)' }}
    >
      <Star style={{ width: size * 0.58, height: size * 0.58, color: '#fff' }} fill="#fff" strokeWidth={0} />
    </span>
  );
}

// A ★ N chip, e.g. "Earn ★ 15" on product cards.
export function SitareChip({ points, prefix, className }: { points: number; prefix?: string; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-extrabold', className)}
      style={{ background: 'var(--sitare-bg)', color: 'var(--sitare-deep)' }}
    >
      <SitareCoin size={13} />
      {prefix ? `${prefix} ` : ''}
      {formatStars(points)}
    </span>
  );
}

// Shared balance loader used by the pill + dashboard card. Re-fetches whenever
// refreshSitare() fires (after an order/review/redeem).
export function useSitareBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getWalletBalance()
        .then((d) => alive && setBalance(d.balance))
        .catch(() => alive && setBalance((b) => b ?? 0));
    load();
    const off = onSitareRefresh(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return balance;
}

// The glanceable topbar balance pill → links to the wallet.
export function SitarePill() {
  const balance = useSitareBalance();
  return (
    <Link
      to="/rewards"
      aria-label="Your Mateo Credits"
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] font-extrabold transition-colors"
      style={{ background: 'var(--sitare-bg)', borderColor: '#f2cd85', color: 'var(--sitare-deep)' }}
    >
      <SitareCoin size={16} />
      <span className="tabular-nums">{balance == null ? '—' : formatStars(balance)}</span>
    </Link>
  );
}
