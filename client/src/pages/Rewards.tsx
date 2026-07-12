import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Baby, CalendarClock, Clock, Gift, MessagesSquare, ShoppingBag, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getWalletBalance, getWalletLedger } from '../api/wallet';
import type { LedgerBucket, LedgerEntry, WalletBalance } from '../api/wallet';
import { inr } from '../shop/format';
import { formatStars } from '../lib/sitare';
import { formatDateIST } from '../lib/age';
import { SitareCoin } from '../components/sitare/SitareBits';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/cn';

// Friendly labels for the ledger's source enum (server/src/models/PointsLedger.ts).
const SOURCE_LABEL: Record<string, string> = {
  shop_purchase: 'Shop order',
  product_review: 'Product review',
  tracker_entry: 'Tracker entry',
  community_contribution: 'Community',
  consultation_completed: 'Consultation',
  referral_referrer: 'Referral reward',
  referral_referee: 'Welcome bonus',
  shop_redemption: 'Redeemed on order',
  consultation_redemption: 'Redeemed on consultation',
  expiry: 'Expired',
  reversal: 'Reversed',
  admin_adjust: 'Adjustment',
};

const EARN_WAYS: { icon: LucideIcon; title: string; sub: string }[] = [
  { icon: ShoppingBag, title: 'Shop', sub: '★5 for every ₹100 on skincare' },
  { icon: Star, title: 'Review', sub: '★50 for an honest 4–5★ review' },
  { icon: Baby, title: 'Track', sub: '★5 per entry (up to ★20/day)' },
  { icon: Gift, title: 'Refer a friend', sub: '★200 when they join' },
  { icon: CalendarClock, title: 'Consult', sub: '★100 per completed consultation' },
  { icon: MessagesSquare, title: 'Community', sub: '★10 per post (up to ★30/day)' },
];

const FILTERS: { key: 'all' | LedgerBucket; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'earned', label: 'Earned' },
  { key: 'redeemed', label: 'Redeemed' },
  { key: 'pending', label: 'Pending' },
  { key: 'expired', label: 'Expired' },
];

function inrValue(points: number, perInr: number): number {
  return Math.floor(Math.max(0, points) / perInr);
}

export default function Rewards() {
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [filter, setFilter] = useState<'all' | LedgerBucket>('all');
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    getWalletBalance()
      .then(setWallet)
      .catch(() => setWallet({ balance: 0, reserved: 0, lifetime: 0, expiringSoon: { points: 0, before: '' }, conversion: { pointsPerInr: 10 } }));
  }, []);

  useEffect(() => {
    let alive = true;
    getWalletLedger(filter, 1)
      .then((d) => {
        if (!alive) return;
        setEntries(d.entries);
        setHasMore(d.hasMore);
        setPage(1);
      })
      .catch(() => alive && setEntries([]));
    return () => {
      alive = false;
    };
  }, [filter]);

  function loadMore() {
    setLoadingMore(true);
    getWalletLedger(filter, page + 1)
      .then((d) => {
        setEntries((cur) => [...(cur ?? []), ...d.entries]);
        setPage(page + 1);
        setHasMore(d.hasMore);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }

  const perInr = wallet?.conversion.pointsPerInr ?? 10;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[28px] p-6 text-white sm:p-8" style={{ background: 'linear-gradient(130deg, #7c5cfc 0%, #9d6bff 55%, #f6a91f 140%)' }}>
        <div aria-hidden className="absolute -right-8 -top-10 h-44 w-44 rounded-full" style={{ background: 'rgba(255,255,255,0.14)' }} />
        <div className="relative">
          <p className="text-[12.5px] font-extrabold uppercase tracking-wider text-white/85">Mateo Sitare</p>
          <div className="mt-2 flex items-center gap-3">
            <SitareCoin size={34} />
            <span className="font-display text-5xl font-bold tabular-nums">{wallet ? formatStars(wallet.balance) : '—'}</span>
            <span className="mt-2 text-lg font-semibold text-white/80">Sitare</span>
          </div>
          <p className="mt-1 text-sm text-white/80">
            Worth about <strong>{inr(inrValue(wallet?.balance ?? 0, perInr))}</strong> off your next order or consultation · ★{perInr} = ₹1
          </p>
          {wallet && wallet.reserved > 0 && (
            <p className="mt-1 text-[13px] text-white/75">{formatStars(wallet.reserved)} ★ on hold for an order in progress</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link to="/shop" className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-extrabold text-violet-700">
              <ShoppingBag className="h-4 w-4" /> Shop &amp; redeem
            </Link>
            <Link to="/find-doctor" className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-5 py-2.5 text-sm font-extrabold text-white ring-1 ring-white/40">
              <CalendarClock className="h-4 w-4" /> Book a consult
            </Link>
          </div>
        </div>
      </div>

      {/* Expiring-soon nudge */}
      {wallet && wallet.expiringSoon.points > 0 && (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] font-semibold text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          {formatStars(wallet.expiringSoon.points)} ★ expire on {wallet.expiringSoon.before ? formatDateIST(wallet.expiringSoon.before) : 'soon'} — use them before they go.
        </div>
      )}

      {/* Ways to earn */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-stone-900">Ways to earn</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {EARN_WAYS.map((w) => (
            <div key={w.title} className="flex items-start gap-3 rounded-[20px] bg-white p-4 shadow-soft">
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--sitare-bg)' }}>
                <w.icon className="h-5 w-5" style={{ color: 'var(--sitare-deep)' }} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-[13.5px] font-bold leading-tight text-stone-900">{w.title}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-stone-500">{w.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* History */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-stone-900">Activity</h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn('rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors', filter === f.key ? 'bg-violet-600 text-white' : 'bg-white text-stone-500 shadow-soft hover:text-stone-700')}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <Card className="mt-4 overflow-hidden p-0">
          {entries === null ? (
            <div className="space-y-px">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-none" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <SitareCoin size={40} />
              <p className="text-sm font-semibold text-stone-700">No activity yet</p>
              <p className="max-w-xs text-[13px] text-stone-500">Shop, review, track your baby or refer a friend to start collecting Sitare.</p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {entries.map((e) => {
                const credit = e.amount > 0;
                return (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                      style={{ background: credit ? 'var(--sitare-bg)' : '#f3f0fb' }}
                    >
                      {credit ? <SitareCoin size={18} /> : <ArrowRight className="h-4 w-4 rotate-90 text-violet-500" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-stone-800">{SOURCE_LABEL[e.source] ?? e.source}</p>
                      <p className="text-[12px] text-stone-500">
                        {formatDateIST(e.createdAt)}
                        {e.bucket === 'pending' ? ' · on hold' : ''}
                        {e.bucket === 'expired' ? ' · expired' : ''}
                      </p>
                    </div>
                    <span className={cn('shrink-0 text-sm font-extrabold tabular-nums', credit ? 'text-emerald-600' : 'text-stone-500')}>
                      {credit ? '+' : ''}
                      {formatStars(Math.abs(e.amount))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-full border border-stone-200 bg-white px-5 py-2 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Show more'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
