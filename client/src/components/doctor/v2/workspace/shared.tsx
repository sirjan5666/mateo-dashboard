import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Baby, CalendarDays, CalendarPlus, CheckSquare, ChevronRight, ClipboardList,
  Droplet, FileText, FilePlus, FlaskConical, LayoutTemplate, Loader2, Mail, MessageSquare, Pill, Pin,
  PhoneCall, Ruler, Scale, Scissors, Search, Settings, Share2, ScanLine, Stethoscope, Syringe,
  TestTube, UploadCloud, Users, Wind, CircleCheck, Download,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDateIST, formatTimeIST } from '../../../../lib/age';
import { cn } from '../../../../lib/cn';

export const CARD =
  'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
export const H2 = 'font-display text-[15.5px] font-bold tracking-[-0.01em] text-[#0F172A]';
export const SELECT =
  'h-[42px] appearance-none rounded-[10px] border border-[#E4E8F1] bg-white pl-3.5 pr-9 text-[13px] font-semibold text-[#334155] focus:border-[#3B4FE0] focus:outline-none';

/** Every lucide glyph the workspace tabs reference, resolved by name. */
export const WS_ICONS: Record<string, LucideIcon> = {
  AlertTriangle, Baby, CalendarDays, CalendarPlus, CheckSquare, CircleCheck, ClipboardList, Download,
  Droplet, FileText, FilePlus, FlaskConical, LayoutTemplate, Mail, MessageSquare, Pill, Pin,
  PhoneCall, Ruler, Scale, Scissors, Search, Settings, Share2, ScanLine, Stethoscope, Syringe,
  TestTube, UploadCloud, Users, Wind,
};

/**
 * What every workspace tab is given. The patient and its template record are
 * fetched ONCE by PatientWorkspace and passed down, so no two tabs can show a
 * different name, age or allergy list for the same child.
 */
export interface WorkspacePanelProps {
  patientId: string;
  patientName: string;
  dob?: string | null;
  sex?: string;
  /** The doctor's own template fields, in their configured order. */
  templateFields?: { key: string; label: string }[];
  /** Values recorded against those fields. Keys are template-defined. */
  fields?: Record<string, unknown>;
}

/** Template values are `unknown` — render only what is actually printable. */
export function fieldText(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

/**
 * One loader for every workspace tab. Returns the fetched value plus a `reload`
 * the panels call after a write, so a table and its summary rail can never drift.
 *
 * The async work is inlined in the effect (never a setState before an await) —
 * react-hooks/set-state-in-effect is an error in this repo, not a warning.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: React.DependencyList) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null, error: null, loading: true,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // `fn` is a fresh closure every render, so it cannot be a dependency — the
  // caller's `deps` are what should re-fetch. Keep the newest closure in a ref
  // and key the effect off the serialised deps instead.
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const key = JSON.stringify(deps);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const value = await fnRef.current();
        if (!cancelled) setState({ data: value, error: null, loading: false });
      } catch (e: unknown) {
        if (!cancelled) setState({ data: null, error: e instanceof Error ? e.message : 'Could not load this data', loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  return { ...state, reload };
}

/** Spinner / error / empty, in the panels' own voice. Returns null when there is content. */
export function PanelState({ loading, error, empty, emptyText }: {
  loading?: boolean; error?: string | null; empty?: boolean; emptyText?: string;
}) {
  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-[11px] bg-[#F7F8FC] px-6 py-10 text-[13px] font-medium text-[#64748B]">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="rounded-[11px] border border-[#F5C2C2] bg-[#FDF2F2] px-6 py-8 text-center text-[13px] font-medium text-[#B42318]">
        {error}
      </p>
    );
  }
  if (empty) {
    return (
      <p className="rounded-[11px] bg-[#F7F8FC] px-6 py-10 text-center text-[13px] font-medium text-[#64748B]">
        {emptyText ?? 'Nothing recorded yet.'}
      </p>
    );
  }
  return null;
}

/** Dates and times are stored UTC and shown in Asia/Kolkata (CLAUDE.md). */
export const wsDate = (iso: string | null | undefined) => (iso ? formatDateIST(iso) : '—');
export const wsTime = (iso: string | null | undefined) => (iso ? formatTimeIST(iso) : '');

/**
 * The spec gives every row a coloured tile. Real records carry no colour, so one
 * is derived from a stable key — same label always gets the same swatch, and no
 * colour is ever stored as if it were data.
 */
const SWATCHES = [
  { tint: '#E4EBFD', fg: '#2B6FF0' },
  { tint: '#DCF7E6', fg: '#12A150' },
  { tint: '#FDECD3', fg: '#E8890B' },
  { tint: '#EDE9FE', fg: '#6D5AE0' },
  { tint: '#FDE2E2', fg: '#EF4444' },
] as const;

export function swatch(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return SWATCHES[h % SWATCHES.length];
}

/** Donut slices need a percentage; derive it so it always matches the counts. */
export function withPct<T extends { count: number }>(rows: T[]): (T & { pct: number })[] {
  const total = rows.reduce((t, r) => t + r.count, 0);
  return rows.map((r) => ({ ...r, pct: total ? Math.round((r.count / total) * 100) : 0 }));
}

export function ViewAll({ label = 'View All', onClick }: { label?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ml-auto text-[12.5px] font-bold text-[#3B4FE0] hover:underline">
      {label}
    </button>
  );
}

export function FooterLink({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-4 flex items-center gap-[7px] text-[12.5px] font-bold text-[#3B4FE0] hover:underline">
      {label}
      <ChevronRight className="h-[15px] w-[15px]" />
    </button>
  );
}

/** The Quick Actions rail card, shared by specs 17, 19, 21 and 22. */
export function QuickActionsCard({
  items,
  chevron = true,
}: {
  /** An item without `onSelect` renders disabled rather than pretending to work. */
  items: { icon: string; label: string; onSelect?: () => void }[];
  chevron?: boolean;
}) {
  return (
    <section className={`${CARD} pb-3.5 pt-[18px]`}>
      <h2 className={cn(H2, 'px-5')}>Quick Actions</h2>
      <ul className="mt-3">
        {items.map((q) => {
          const Icon = WS_ICONS[q.icon] ?? FileText;
          return (
            <li key={q.label}>
              <button
                type="button"
                aria-label={q.label}
                disabled={!q.onSelect}
                onClick={q.onSelect}
                className="flex h-12 w-full items-center gap-3.5 px-5 text-left transition-colors hover:bg-[#FAFBFF] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
              >
                <Icon className="h-[18px] w-[18px] shrink-0 text-[#3B4FE0]" />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#334155]">{q.label}</span>
                {chevron && <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#CBD5E1]" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Disabled-arrow pagination used by every workspace table (all single-page). */
export function SinglePagePager({ label }: { label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-[#ECEEF4] px-[22px] pt-4">
      <p className="text-[12.5px] font-medium text-[#64748B]">{label}</p>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" disabled aria-label="Previous page" className="grid h-9 w-9 place-items-center rounded-[9px] border border-[#E2E6F0] text-[#64748B] opacity-45">
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <button type="button" aria-current="page" className="grid h-9 w-9 place-items-center rounded-[9px] border-[1.5px] border-[#6366F1] bg-white text-[13px] font-semibold text-[#3B4FE0]">
          1
        </button>
        <button type="button" disabled aria-label="Next page" className="grid h-9 w-9 place-items-center rounded-[9px] border border-[#E2E6F0] text-[#64748B] opacity-45">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Em dash plus the hidden text that gives it meaning. */
export function Dash({ say }: { say: string }) {
  return (
    <>
      <span aria-hidden="true" className="text-[#94A3B8]">—</span>
      <span className="sr-only">{say}</span>
    </>
  );
}

/** A tinted rounded tile with a glyph — the workspace's most repeated motif. */
export function Tile({ icon, tint, fg, size = 34, glyph = 17, radius = 9 }: {
  icon: string; tint: string; fg: string; size?: number; glyph?: number; radius?: number;
}) {
  const Icon = WS_ICONS[icon] ?? FileText;
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center"
      style={{ background: tint, width: size, height: size, borderRadius: radius }}
    >
      <Icon style={{ width: glyph, height: glyph, color: fg }} />
    </span>
  );
}

/** The "Completed" / "Paid" style chip used across the workspace tables. */
export function Chip({ label, bg, fg, className }: { label: string; bg: string; fg: string; className?: string }) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-[7px] px-3 py-[5px] text-[11.5px] font-bold', className)}
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}
