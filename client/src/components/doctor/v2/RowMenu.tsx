import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/cn';

export interface RowMenuItem {
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  /** Greyed out and unclickable — e.g. "Set as Primary" on the current primary. */
  disabled?: boolean;
  onSelect: () => void;
}

const MENU_W = 184;
/** Gap between the trigger and the menu, and the margin kept off the viewport edge. */
const GAP = 6;

/**
 * A `MoreVertical` trigger with a popover menu. Closes on outside click, on
 * Escape, and after any item is chosen; focus returns to the trigger.
 *
 * The menu is PORTALLED to the body and positioned in viewport coordinates.
 * Absolute positioning inside the row looked equivalent and was not: every table
 * that uses this sits in an `overflow-x-auto` scroller, which clips its children,
 * so the menu on the last rows was cut off by the card edge. A portal has no
 * clipping ancestor to be trapped by.
 */
export function RowMenu({
  items,
  label,
  size = 26,
  bordered = false,
  align = 'right',
}: {
  items: RowMenuItem[];
  label: string;
  size?: number;
  bordered?: boolean;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    /** Anchored to the trigger, then nudged back inside the viewport. */
    const place = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      if (!t) return;
      const h = menuRef.current?.offsetHeight ?? 0;
      const below = window.innerHeight - t.bottom;
      // Flip above the trigger when the last rows of a table have no room below.
      const top = h > 0 && below < h + GAP * 2 && t.top > h + GAP
        ? t.top - h - GAP
        : t.bottom + GAP;
      const wanted = align === 'right' ? t.right - MENU_W : t.left;
      const left = Math.min(Math.max(GAP, wanted), window.innerWidth - MENU_W - GAP);
      setPos({ top, left });
    };

    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    // Capture, so scrolling the table's own scroller moves the menu with the row.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setPos(null);
          setOpen((o) => !o);
        }}
        style={{ width: size, height: size }}
        className={cn(
          'grid place-items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-1',
          bordered ? 'rounded-[10px] border border-[#E2E6F0] bg-white text-[#334155] hover:bg-[#F7F8FC]' : 'rounded-[7px] text-[#94A3B8] hover:bg-[#F1F3F9]',
        )}
      >
        <MoreVertical style={{ width: bordered ? 18 : 17, height: bordered ? 18 : 17 }} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            width: MENU_W,
            // Hidden for the first paint only: the flip-up decision needs the
            // menu's real height, which does not exist until it is in the DOM.
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="fixed z-[120] rounded-[12px] border border-[#ECEEF4] bg-white p-1.5 shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                item.onSelect();
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
                item.danger ? 'text-[#B91C1C] hover:bg-[#FEF2F2]' : 'text-[#0F172A] hover:bg-[#F6F7FB]',
                item.disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent',
              )}
            >
              {item.icon && <item.icon className={cn('h-4 w-4 shrink-0', item.danger ? 'text-[#EF4444]' : 'text-[#64748B]')} />}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
