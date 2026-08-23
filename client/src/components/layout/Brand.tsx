import { cn } from '../../lib/cn';

// The official MateoCare logo (mother-baby icon + "MateoCare" wordmark). One
// source used by the sidebar, Login and Signup. The PNG lives in client/public/.
export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <img
      src="/mateo-logo.png"
      alt="MateoCare"
      draggable={false}
      className={cn('w-auto select-none', compact ? 'h-8' : 'h-10', className)}
    />
  );
}
