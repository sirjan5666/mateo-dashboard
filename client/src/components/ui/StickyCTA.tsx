import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Sticky bottom action bar for mobile forms and flows — the primary CTA stays in
 * the thumb zone instead of forcing a scroll back to the top. Fixed to the
 * viewport bottom on mobile (respecting the home-indicator inset); flows inline
 * on desktop (lg) where a fixed bar would be odd.
 *
 * Pages using it must reserve space at the end of their content so the last
 * fields aren't hidden behind the bar — pair with `pb-28` (or similar) on the
 * scroll content, or the `<StickyCTA.Spacer />` helper below.
 */
export function StickyCTA({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/70 bg-[var(--surface-card)]/95 px-4 pt-3 backdrop-blur-md',
        'lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:backdrop-blur-none',
        className,
      )}
      style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
    >
      <div className="mx-auto flex max-w-[520px] items-center gap-3 lg:max-w-none lg:px-0">{children}</div>
    </div>
  );
}

/** Reserves the height a fixed StickyCTA occupies, so page content clears it. */
StickyCTA.Spacer = function StickyCTASpacer() {
  return <div aria-hidden className="h-24 lg:hidden" />;
};
