import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Lightweight hover/focus tooltip. Wraps its trigger; shows on hover and on
 * keyboard focus (so it's reachable without a mouse). role=tooltip + aria-
 * describedby for screen readers. For rich content use a Popover instead.
 */
export function Tooltip({
  label,
  children,
  side = 'top',
  className,
}: {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--panel-sidebar)] px-2 py-1 text-xs font-medium text-white shadow-lift',
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
