import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { buttonClass } from './buttonStyles';

/**
 * Something-went-wrong state with a retry. Deliberately calm (coral, not alarm)
 * to match the app's gentle tone.
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We couldn’t load this just now. Please try again.',
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <span className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-1 max-w-[34ch] text-sm text-[var(--muted-foreground)]">{description}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={cn(buttonClass('secondary', 'md'), 'mt-5')}>
          Try again
        </button>
      )}
    </div>
  );
}
