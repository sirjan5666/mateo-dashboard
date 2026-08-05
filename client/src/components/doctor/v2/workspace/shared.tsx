import {
  AlertTriangle, Baby, CalendarDays, CalendarPlus, CheckSquare, ChevronRight, ClipboardList,
  Droplet, FileText, FilePlus, FlaskConical, LayoutTemplate, Mail, MessageSquare, Pill, Pin,
  PhoneCall, Ruler, Scale, Scissors, Search, Settings, Share2, ScanLine, Stethoscope, Syringe,
  TestTube, UploadCloud, Users, Wind, CircleCheck, Download,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
  items: { icon: string; label: string }[];
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
                onClick={() => console.log('[Clinic OS]', q.label)}
                className="flex h-12 w-full items-center gap-3.5 px-5 text-left transition-colors hover:bg-[#FAFBFF]"
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
