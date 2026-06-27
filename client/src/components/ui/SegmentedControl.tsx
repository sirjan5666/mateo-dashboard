import { cn } from '../../lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

// Pill-style segmented filter with optional counts. The active segment lifts onto
// a white pill; counts sit in a small chip. Keyboard-accessible (role="tablist").
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label="Filter" className={cn('inline-flex gap-1 rounded-full bg-stone-100 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors',
              active ? 'bg-white text-violet-700 shadow-soft' : 'text-stone-500 hover:text-stone-700',
            )}
          >
            {o.label}
            {o.count != null && (
              <span
                className={cn(
                  'inline-grid min-w-5 place-items-center rounded-full px-1.5 text-[0.7rem] font-extrabold',
                  active ? 'bg-violet-100 text-violet-700' : 'bg-white text-stone-400',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
