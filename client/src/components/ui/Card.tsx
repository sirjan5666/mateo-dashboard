import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-[var(--card-radius)] border border-stone-200/60 bg-[var(--surface-card)] shadow-soft', className)}
      {...props}
    />
  );
}
