import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { useDensity } from '../../lib/density';

/**
 * Density-aware data table primitives for the pro panels. Compose
 * <Table><THead>…</THead><TBody>…</TBody></Table>. The row padding follows the
 * global Comfortable/Compact density. Wrapper scrolls horizontally on narrow
 * screens so columns never get crushed.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full min-w-[34rem] border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-[var(--hairline)] last:border-0',
        onClick && 'cursor-pointer transition-colors hover:bg-[var(--surface-sunken)]',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TH({ children, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      className={cn(
        'whitespace-nowrap px-3 py-2 text-left text-[0.7rem] font-bold uppercase tracking-wide text-[var(--muted-foreground)]',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({ children, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  const density = useDensity();
  return (
    <td {...rest} className={cn('px-3 align-middle tabular', density === 'compact' ? 'py-1.5' : 'py-3', className)}>
      {children}
    </td>
  );
}
