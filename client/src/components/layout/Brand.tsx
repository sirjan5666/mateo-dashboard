import { cn } from '../../lib/cn';

// The official Mateo wordmark (teal "mateo" + pink butterfly). One source used by
// the sidebar, Login and Signup. The PNG lives in client/public/.
export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <img
      src="/mateo-logo.png"
      alt="Mateo"
      width={560}
      height={216}
      draggable={false}
      className={cn('w-auto select-none', compact ? 'h-7' : 'h-9', className)}
    />
  );
}
