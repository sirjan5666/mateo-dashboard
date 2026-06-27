import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { todayInputValueIST } from '../../lib/age';

/**
 * A themed popover calendar that replaces <input type="date">.
 *
 * Values are 'YYYY-MM-DD' calendar-date strings in Asia/Kolkata, exactly like a
 * native date input — so it's a drop-in swap that keeps every form's logic and
 * the project's UTC-store / IST-display rules intact. All calendar maths work on
 * the y/m/d numbers directly (never new Date(isoString)) to avoid timezone drift.
 */

type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** 'YYYY-MM-DD' lower bound (inclusive). */
  min?: string;
  /** 'YYYY-MM-DD' upper bound (inclusive). */
  max?: string;
  required?: boolean;
  disabled?: boolean;
  /** Applied to the trigger button so existing input styling carries over. */
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
  /** Map of 'YYYY-MM-DD' → CSS colour. Marked days get a small dot (e.g. days
   *  that already have a logged entry in this tracker). */
  markers?: Record<string, string>;
};

const POPOVER_WIDTH = 304;
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

type Parts = { y: number; m: number; d: number };

function parseKey(s: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

/** Shift a 'YYYY-MM-DD' key by whole days (local Date maths; India has no DST). */
function addDays(key: string, delta: number): string {
  const p = parseKey(key);
  if (!p) return key;
  const dt = new Date(p.y, p.m, p.d + delta);
  return toKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

const monthLabelFmt = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
const triggerFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function formatDisplay(key: string): string {
  const p = parseKey(key);
  if (!p) return '';
  return triggerFmt.format(new Date(p.y, p.m, p.d));
}

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  className,
  placeholder = 'Select date',
  'aria-label': ariaLabel,
  markers,
}: DatePickerProps) {
  const todayKey = todayInputValueIST();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // The month currently shown in the grid, and the day with keyboard focus.
  const initial = value && parseKey(value) ? value : todayKey;
  const [view, setView] = useState<{ y: number; m: number }>(() => {
    const p = parseKey(initial)!;
    return { y: p.y, m: p.m };
  });
  const [focusKey, setFocusKey] = useState<string>(initial);

  function isOutOfRange(key: string): boolean {
    if (min && key < min) return true;
    if (max && key > max) return true;
    return false;
  }

  // When the picker opens, jump the view to the selected (or today's) month.
  function openPicker() {
    if (disabled) return;
    const base = value && parseKey(value) ? value : clampToRange(todayKey);
    const p = parseKey(base)!;
    setView({ y: p.y, m: p.m });
    setFocusKey(base);
    setOpen(true);
  }

  function clampToRange(key: string): string {
    if (min && key < min) return min;
    if (max && key > max) return max;
    return key;
  }

  function select(key: string) {
    if (isOutOfRange(key)) return;
    onChange(key);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveFocus(delta: number) {
    const next = addDays(focusKey, delta);
    const p = parseKey(next)!;
    setView({ y: p.y, m: p.m });
    setFocusKey(next);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const dt = new Date(v.y, v.m + delta, 1);
      return { y: dt.getFullYear(), m: dt.getMonth() };
    });
  }

  // 6-week grid starting on the Sunday on/before the 1st of the view month.
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const start = new Date(view.y, view.m, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = toKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
      return {
        key,
        day: dt.getDate(),
        inMonth: dt.getMonth() === view.m,
        isToday: key === todayKey,
        isSelected: key === value,
        outOfRange: isOutOfRange(key),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, value, todayKey, min, max]);

  // Position the portal popover, flipping above the trigger when there's no room.
  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const ph = popoverRef.current?.offsetHeight ?? 360;
      const margin = 8;
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < ph + margin && r.top > spaceBelow;
      const top = openUp ? Math.max(margin, r.top - ph - 6) : r.bottom + 6;
      let left = Math.min(r.left, window.innerWidth - POPOVER_WIDTH - margin);
      left = Math.max(margin, left);
      setPos({ top, left });
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  // Move DOM focus to the active day whenever it changes while open.
  useEffect(() => {
    if (!open) return;
    const el = popoverRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusKey}"]`);
    el?.focus();
  }, [open, focusKey]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function onGridKeyDown(e: ReactKeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        moveFocus(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(-7);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(7);
        break;
      case 'PageUp':
        e.preventDefault();
        shiftMonth(-1);
        break;
      case 'PageDown':
        e.preventDefault();
        shiftMonth(1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        select(focusKey);
        break;
      default:
        break;
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        <span className={cn('truncate', !value && 'text-stone-400')}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-stone-400" />
      </button>

      {/* Mirror input keeps native required-validation working for a custom control. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute h-px w-px -translate-y-2 opacity-0"
        />
      )}

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Choose date"
            style={{
              position: 'fixed',
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: POPOVER_WIDTH,
            }}
            className="z-[60] animate-popin rounded-2xl border border-stone-200 bg-white p-3 shadow-lift"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="grid h-8 w-8 place-items-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-display text-sm font-bold text-stone-800">
                {monthLabelFmt.format(new Date(view.y, view.m, 1))}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="grid h-8 w-8 place-items-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="grid h-8 place-items-center text-[0.7rem] font-bold uppercase tracking-wide text-stone-400"
                >
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5" onKeyDown={onGridKeyDown}>
              {cells.map((c) => {
                const base = 'relative grid h-9 w-9 place-items-center rounded-full text-sm transition-colors';
                const markerColor = markers?.[c.key];
                let style: string;
                if (c.outOfRange) {
                  style = 'cursor-not-allowed text-stone-300';
                } else if (c.isSelected) {
                  style = 'bg-emerald-500 font-bold text-white shadow-soft';
                } else if (c.isToday) {
                  style = 'font-bold text-emerald-700 ring-1 ring-inset ring-emerald-300 hover:bg-emerald-50';
                } else if (c.inMonth) {
                  style = 'text-stone-700 hover:bg-stone-100';
                } else {
                  style = 'text-stone-300 hover:bg-stone-100';
                }
                return (
                  <button
                    key={c.key}
                    type="button"
                    data-day={c.key}
                    tabIndex={c.key === focusKey ? 0 : -1}
                    aria-pressed={c.isSelected}
                    aria-current={c.isToday ? 'date' : undefined}
                    aria-disabled={c.outOfRange || undefined}
                    onClick={() => select(c.key)}
                    className={cn(base, style)}
                  >
                    {c.day}
                    {markerColor && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                        style={{ backgroundColor: c.isSelected ? '#ffffff' : markerColor }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-stone-100 pt-2">
              <button
                type="button"
                onClick={() => select(clampToRange(todayKey))}
                disabled={isOutOfRange(todayKey)}
                className="rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
              >
                Today
              </button>
              {!required && value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100"
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
