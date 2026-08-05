import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/cn';

/** Card shell — the single elevation/shape token for the Clinic OS panel. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-[14px] border border-[#ECEEF4] bg-white',
        'shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Card heading: tinted icon tile + title, with an optional right-hand slot. */
export function PanelHead({
  icon: Icon,
  title,
  tint = '#EEF2FF',
  iconColor = '#3B4FE0',
  solid = false,
  info = false,
  right,
}: {
  icon: LucideIcon;
  title: string;
  tint?: string;
  iconColor?: string;
  solid?: boolean;
  info?: boolean;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-5">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px]"
        style={{ background: solid ? iconColor : tint }}
      >
        <Icon className="h-4 w-4" style={{ color: solid ? '#FFFFFF' : iconColor }} />
      </span>
      <h2 className="font-display text-[15px] font-bold leading-5 tracking-[-0.01em] text-[#0F172A]">{title}</h2>
      {info && (
        <span
          aria-hidden="true"
          className="grid h-[14px] w-[14px] place-items-center rounded-full border border-[#94A3B8] text-[9px] font-bold text-[#94A3B8]"
        >
          i
        </span>
      )}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

/** Static "This Month ▾" style pill (range selectors land with the drill-down screens). */
export function SelectPill({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#E2E6F0] bg-white px-2.5 text-xs font-semibold text-[#475569] transition-colors hover:bg-[#F6F7FB]"
    >
      {label}
      <ChevronDown className="h-3.5 w-3.5 text-[#94A3B8]" />
    </button>
  );
}

/** The "View x →" footer link. */
export function LinkArrow({ to, label, color = '#3B4FE0', className }: { to: string; label: string; color?: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn('group inline-flex items-center gap-1.5 text-xs font-semibold transition-colors', className)}
      style={{ color }}
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Small status chip — text always carries the meaning, never colour alone. */
export function Chip({ label, bg, fg, pulse = false }: { label: string; bg: string; fg: string; pulse?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-[3px] text-[10px] font-semibold"
      style={{ background: bg, color: fg }}
    >
      {pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: fg }} />}
      {label}
    </span>
  );
}

/**
 * Screen-reader table mirroring a chart's data (a11y rule §8).
 *
 * The `sr-only` class must sit on a wrapping <div>, not on the <table>: a table
 * sizes to its content and treats `width: 1px` as a minimum, so an `sr-only`
 * table stays full-width and pushes the page into horizontal scroll on mobile.
 * A block-level wrapper honours the 1px clip and contains it.
 */
export function ChartData({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
