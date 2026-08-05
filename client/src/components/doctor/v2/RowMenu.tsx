import { useEffect, useRef, useState } from 'react';
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

/**
 * A `MoreVertical` trigger with a popover menu. Closes on outside click, on
 * Escape, and after any item is chosen; focus returns to the trigger.
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
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

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

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-[calc(100%+6px)] z-40 w-[184px] rounded-[12px] border border-[#ECEEF4] bg-white p-1.5 shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
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
        </div>
      )}
    </div>
  );
}
