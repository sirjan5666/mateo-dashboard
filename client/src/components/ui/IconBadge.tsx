import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { toneBadge } from './tones';
import type { Tone } from './tones';

const BOX = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
};
const ICON = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };

export function IconBadge({
  icon: Icon,
  tone = 'emerald',
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center justify-center', BOX[size], toneBadge[tone], className)}>
      <Icon className={ICON[size]} strokeWidth={2} />
    </span>
  );
}
