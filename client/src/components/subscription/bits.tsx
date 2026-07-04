import { Link } from 'react-router';
import { Crown, Lock } from 'lucide-react';
import { useT } from '../../i18n/context';
import { cn } from '../../lib/cn';

/** Small amber "Paid" tag shown beside locked features (nav items, cards). */
export function PaidBadge({ className }: { className?: string }) {
  const t = useT();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-amber-800',
        className,
      )}
    >
      <Crown className="h-2.5 w-2.5" />
      {t('paid.badge')}
    </span>
  );
}

/**
 * Frosted lock veil for dashboard cards whose data sits behind the plan.
 * Wrap the card content: `<div className="relative">{content}<LockedOverlay/></div>`.
 * The underlying card renders its empty/skeleton state (no real data reaches
 * unsubscribed clients — the server returns none), so the blur is cosmetic.
 */
export function LockedOverlay({ label = 'Subscribe to unlock' }: { label?: string }) {
  return (
    <Link
      to="/subscribe"
      aria-label={label}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-white/55 backdrop-blur-[3px] transition-colors hover:bg-white/45"
    >
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-stone-500 shadow-soft">
        <Lock className="h-4.5 w-4.5" />
      </span>
      <span className="rounded-full bg-stone-900/80 px-3 py-1 text-xs font-bold text-white">{label}</span>
    </Link>
  );
}
