import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { dismissToast, useToasts } from '../../lib/toast';
import type { ToastItem } from '../../lib/toast';
import { toneBadge } from './tones';
import type { Tone } from './tones';

const TOAST_ICON: Record<Tone, LucideIcon> = {
  emerald: CheckCircle2,
  amber: AlertTriangle,
  rose: AlertTriangle,
  sky: Info,
  violet: Info,
  stone: Info,
};

function ToastRow({ t }: { t: ToastItem }) {
  const Icon = TOAST_ICON[t.tone];
  useEffect(() => {
    if (t.duration <= 0) return;
    const timer = setTimeout(() => dismissToast(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration]);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface-card)] px-3.5 py-3 shadow-lift">
      <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg', toneBadge[t.tone])}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="flex-1 pt-1 text-sm font-medium text-[var(--foreground)]">{t.message}</p>
      <button
        type="button"
        onClick={() => dismissToast(t.id)}
        aria-label="Dismiss notification"
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-sunken)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Renders the live toast stack. Mount once in the shell; fire with `toast()`. */
export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return createPortal(
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastRow key={t.id} t={t} />
      ))}
    </div>,
    document.body,
  );
}
