import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { tonePill } from './tones';
import type { Tone } from './tones';

export function Pill({
  tone = 'stone',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tonePill[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
