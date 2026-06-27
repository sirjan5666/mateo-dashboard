import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

// Single source of the playful purple brand-gradient tile (logo mark, avatars,
// page-header icons). Uses the exact design-system --brand-gradient.
// Caller passes size/radius via className.
export function BrandTile({
  icon: Icon,
  iconClassName = 'h-5 w-5',
  className,
  children,
}: {
  icon?: LucideIcon;
  iconClassName?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={cn('brand-gradient inline-flex items-center justify-center text-white', className)}
    >
      {Icon ? <Icon className={iconClassName} strokeWidth={2.2} /> : children}
    </span>
  );
}
