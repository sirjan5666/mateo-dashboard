import { cn } from '../../lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * Underline tab bar for sectioned pages (e.g. the patient detail hub). Keyboard-
 * and screen-reader-friendly (role=tablist/tab + aria-selected). For pill-style
 * status filters use SegmentedControl instead.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-[var(--hairline)]', className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              'relative -mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
              active
                ? 'border-[var(--primary)] text-[var(--foreground)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
          >
            {it.label}
            {typeof it.count === 'number' && (
              <span
                className={cn(
                  'tabular rounded-full px-1.5 text-[0.7rem] font-bold',
                  active ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : 'bg-[var(--surface-sunken)] text-[var(--muted-foreground)]',
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
