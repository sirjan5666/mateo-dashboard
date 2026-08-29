import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Friendly empty state — a soft mascot/icon medallion, a title, a line of
 * guidance, and an optional primary action. Used across trackers and lists when
 * there's nothing logged yet.
 */
export function EmptyState({
  icon: Icon,
  mascot,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  mascot?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {mascot ? (
        <img src={mascot} alt="" className="mb-4 h-24 w-24 object-contain" draggable={false} />
      ) : Icon ? (
        <span className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-[var(--brand-purple-tint)] text-[var(--brand-purple-deep)]">
          <Icon className="h-7 w-7" />
        </span>
      ) : null}
      <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      {description && <p className="mt-1 max-w-[34ch] text-sm text-[var(--muted-foreground)]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
