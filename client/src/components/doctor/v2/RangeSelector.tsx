import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/cn';

/**
 * The date-range control shared by the dashboard and the reports page.
 *
 * A segmented picker — Today (a day), 7 days (a week), 30 days (a month),
 * All time, and Custom (any range) — so both pages filter their data the same
 * way and read the same. `null` means all time; every other preset is an actual
 * {from,to} pair the analytics endpoints already accept.
 */
export type DateRange = { from: string; to: string } | null;
export type RangePreset = 'today' | '7d' | '30d' | 'all' | 'custom';

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

/** Local calendar date as YYYY-MM-DD; the server re-anchors it to IST. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** The concrete range a preset resolves to today. `custom` has no fixed range. */
export function rangeForPreset(id: RangePreset): DateRange {
  const to = ymd(new Date());
  if (id === 'today') return { from: to, to };
  if (id === '7d') return { from: ymd(daysAgo(6)), to };
  if (id === '30d') return { from: ymd(daysAgo(29)), to };
  return null; // 'all' and (until picked) 'custom'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
};

export function RangeSelector({
  preset,
  range,
  onChange,
}: {
  preset: RangePreset;
  range: DateRange;
  onChange: (preset: RangePreset, range: DateRange) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState(range?.from ?? ymd(daysAgo(29)));
  const [to, setTo] = useState(range?.to ?? ymd(new Date()));
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customOpen) return undefined;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setCustomOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCustomOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [customOpen]);

  function pick(id: RangePreset) {
    if (id === 'custom') { setCustomOpen((o) => !o); return; }
    setCustomOpen(false);
    onChange(id, rangeForPreset(id));
  }

  function applyCustom() {
    // Guard against a reversed range — swap rather than reject.
    const [a, b] = from <= to ? [from, to] : [to, from];
    setCustomOpen(false);
    onChange('custom', { from: a, to: b });
  }

  const customLabel = preset === 'custom' && range ? `${short(range.from)} – ${short(range.to)}` : 'Custom';

  return (
    <div className="relative flex items-center">
      <div role="group" aria-label="Date range" className="flex items-center gap-1 rounded-[11px] border border-[#E2E6F0] bg-white p-1">
        {PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={active}
              onClick={() => pick(p.id)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[12.5px] font-semibold transition-colors',
                active ? 'bg-[#4F46E5] text-white shadow-[0_6px_14px_-8px_rgba(79,70,229,.9)]' : 'text-[#475569] hover:bg-[#F1F3F9]',
              )}
            >
              {p.id === 'custom' && <CalendarDays className="h-[14px] w-[14px]" />}
              {p.id === 'custom' ? customLabel : p.label}
              {p.id === 'custom' && <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', customOpen && 'rotate-180')} />}
            </button>
          );
        })}
      </div>

      {customOpen && (
        <div ref={popRef} className="absolute right-0 top-[calc(100%+8px)] z-40 w-[268px] rounded-[12px] border border-[#ECEEF4] bg-white p-3.5 shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]">
          <p className="mb-2 text-[12px] font-bold text-[#334155]">Custom range</p>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="text-[11px] font-semibold text-[#64748B]">
              From
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
                className="mt-1 h-9 w-full rounded-[8px] border border-[#E4E8F1] px-2 text-[12.5px] tabular-nums text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
            </label>
            <label className="text-[11px] font-semibold text-[#64748B]">
              To
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)}
                className="mt-1 h-9 w-full rounded-[8px] border border-[#E4E8F1] px-2 text-[12.5px] tabular-nums text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setCustomOpen(false)}
              className="h-9 rounded-[8px] border border-[#E2E6F0] px-3.5 text-[12.5px] font-bold text-[#334155] hover:bg-[#F7F8FC]">Cancel</button>
            <button type="button" onClick={applyCustom}
              className="h-9 rounded-[8px] bg-[#4F46E5] px-4 text-[12.5px] font-bold text-white hover:bg-[#4338CA]">Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
