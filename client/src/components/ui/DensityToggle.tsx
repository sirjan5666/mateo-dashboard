import { LayoutList, List } from 'lucide-react';
import { cn } from '../../lib/cn';
import { toggleDensity, useDensity } from '../../lib/density';

/** Comfortable/Compact density switch for the pro panels (persisted per doctor). */
export function DensityToggle({ className }: { className?: string }) {
  const density = useDensity();
  const compact = density === 'compact';
  return (
    <button
      type="button"
      onClick={() => toggleDensity()}
      aria-label={compact ? 'Switch to comfortable density' : 'Switch to compact density'}
      title={compact ? 'Comfortable view' : 'Compact view'}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]',
        className,
      )}
    >
      {compact ? <LayoutList className="h-4 w-4" /> : <List className="h-4 w-4" />}
    </button>
  );
}
