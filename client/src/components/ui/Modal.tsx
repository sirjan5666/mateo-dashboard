import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Card } from './Card';
import { cn } from '../../lib/cn';

// Simple overlay modal built on Card. Escape + backdrop close when dismissable.
// Mobile renders as a bottom sheet; desktop centers it.
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  dismissable = true,
}: {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  dismissable?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;
  const max = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => dismissable && onClose?.()}
    >
      <Card
        className={cn('max-h-[90vh] w-full overflow-y-auto rounded-b-none p-6 sm:rounded-[26px]', max)}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || (dismissable && onClose)) && (
          <div className="mb-3 flex items-start justify-between gap-3">
            {title && <h2 className="font-display text-xl font-semibold text-stone-900">{title}</h2>}
            {dismissable && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        {children}
      </Card>
    </div>,
    document.body,
  );
}
