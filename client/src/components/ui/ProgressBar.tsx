import { cn } from '../../lib/cn';

export function ProgressBar({
  value,
  className,
  barClass = 'bg-emerald-500',
}: {
  value: number;
  className?: string;
  barClass?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-stone-200', className)}>
      <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}
