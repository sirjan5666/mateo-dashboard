import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '../../lib/cn';

/**
 * Mobile bottom sheet — slides up from the bottom edge, with a drag handle,
 * swipe-to-dismiss, backdrop tap-to-close, Escape, and body-scroll lock. Respects
 * the device home-indicator inset (--safe-bottom).
 *
 * Deliberately theme-neutral (the parent "playful" theme), unlike the existing
 * `Drawer`, which pins itself to the pro/clinical theme. Use this for every
 * parent-app add/edit/filter/switcher flow the mobile brief turns into a sheet.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Swipe-to-dismiss: track downward drag on the handle; release past a
  // threshold closes, otherwise it springs back. All state is set from pointer
  // handlers (never during render).
  const onPointerDown = (e: ReactPointerEvent) => {
    dragStart.current = e.clientY;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (dragStart.current == null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    if (dragStart.current == null) return;
    const shouldClose = dragY > 110;
    dragStart.current = null;
    setDragging(false);
    setDragY(0);
    if (shouldClose) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#0a101a]/45 animate-[bsFadeIn_0.2s_ease-out]"
      />
      <div
        data-lenis-prevent
        className={cn(
          'relative flex max-h-[90vh] w-full max-w-[520px] flex-col rounded-t-[26px] bg-[var(--surface-card)] shadow-lift will-change-transform animate-[bsSlideUp_0.26s_cubic-bezier(0.22,1,0.36,1)]',
          className,
        )}
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="h-1.5 w-11 rounded-full bg-stone-300" />
        </div>

        {(title || description) && (
          <div className="shrink-0 px-5 pb-2 pt-1 text-center">
            {title && <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{description}</p>}
          </div>
        )}

        <div
          className={cn('min-h-0 flex-1 overflow-y-auto px-5 pt-2', contentClassName)}
          style={{ paddingBottom: 'calc(1.25rem + var(--safe-bottom))' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
