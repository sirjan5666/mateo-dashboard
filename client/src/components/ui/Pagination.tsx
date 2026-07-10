import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

// Compact page list: 1 … p-1 p p+1 … last (no more than ~7 buttons).
function pageRange(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(pageCount - 1, page + 1);
  if (lo > 2) out.push('gap');
  for (let i = lo; i <= hi; i += 1) out.push(i);
  if (hi < pageCount - 1) out.push('gap');
  out.push(pageCount);
  return out;
}

/** Record-count label (left) + numbered page controls (right). Renders nothing
 *  when there is a single page and no total label to show. */
export function Pagination({
  page,
  pageCount,
  onChange,
  totalLabel,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  totalLabel?: string;
  className?: string;
}) {
  if (pageCount <= 1 && !totalLabel) return null;
  const btn = 'grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-semibold tabular-nums transition-colors';
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-1 pt-3', className)}>
      {totalLabel && <span className="text-xs tabular-nums text-stone-500">{totalLabel}</span>}
      {pageCount > 1 && (
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className={cn(btn, 'border border-[var(--hairline)] text-stone-600 hover:bg-[var(--surface-sunken)] disabled:opacity-40 disabled:hover:bg-transparent')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageRange(page, pageCount).map((p, i) =>
            p === 'gap' ? (
              <span key={`g${i}`} className="px-1 text-stone-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(btn, p === page ? 'bg-[var(--primary)] text-white' : 'text-stone-600 hover:bg-[var(--surface-sunken)]')}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
            className={cn(btn, 'border border-[var(--hairline)] text-stone-600 hover:bg-[var(--surface-sunken)] disabled:opacity-40 disabled:hover:bg-transparent')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
