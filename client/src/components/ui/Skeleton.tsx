import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('animate-pulse rounded-lg bg-stone-200/70', className)} style={style} />;
}
