import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface DropdownItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
}
export type DropdownEntry = DropdownItem | 'separator';

// Row-action "⋯" menu. The popover is portalled to <body> and fixed-positioned to
// the trigger, so it never gets clipped by a table/card `overflow-hidden`. Uses
// concrete slate/white/rose (not scoped CSS vars) so it looks right rendered
// outside the panel's themed subtree. Closes on outside-click, Escape, or scroll.
export function DropdownMenu({
  items,
  onSelect,
  label = 'Actions',
  align = 'right',
}: {
  items: DropdownEntry[];
  onSelect: (key: string) => void;
  label?: string;
  align?: 'left' | 'right';
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const open = pos !== null;
  const close = () => setPos(null);

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos(align === 'right' ? { top: r.bottom + 4, right: window.innerWidth - r.right } : { top: r.bottom + 4, left: r.left });
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-ddm]')) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onMove = () => close();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-ddm
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close() : openMenu())}
        className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-[var(--surface-sunken)] hover:text-stone-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            data-ddm
            role="menu"
            style={{ position: 'fixed', top: pos.top, left: pos.left, right: pos.right }}
            className="z-50 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          >
            {items.map((it, i) =>
              it === 'separator' ? (
                <div key={`s${i}`} className="my-1 border-t border-slate-100" />
              ) : (
                <button
                  key={it.key}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    close();
                    onSelect(it.key);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition-colors',
                    it.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {it.icon && <it.icon className="h-4 w-4" />}
                  {it.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
