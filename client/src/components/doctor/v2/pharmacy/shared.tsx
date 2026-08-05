import {
  AlertTriangle, ArrowLeftRight, Banknote, Boxes, CalendarClock, CalendarDays, ClipboardCheck,
  CreditCard, Download, Droplet, FileText, FlaskConical, IndianRupee, Minus, Pill, Plus, Printer,
  ShieldCheck, ShoppingCart, Smartphone, Wallet, Wind, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../../lib/cn';

export const CARD =
  'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
export const H2 = 'font-display text-[15.5px] font-bold tracking-[-0.01em] text-[#0F172A]';
export const TH =
  'h-[42px] border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]';
export const INPUT =
  'h-11 w-full rounded-[10px] border border-[#E4E8F1] bg-white px-3.5 text-[13.5px] font-medium text-[#0F172A] placeholder:font-normal placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none';
export const LABEL = 'mb-[7px] block text-[12.5px] font-bold text-[#334155]';
export const PRIMARY_BTN =
  'flex items-center justify-center gap-2 rounded-[10px] text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] transition-[filter] hover:brightness-105';
export const PRIMARY_BG = 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)';
export const GHOST_BTN =
  'flex items-center justify-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white transition-colors hover:bg-[#F7F8FC]';
export const OUTLINE_BTN =
  'flex items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[#C7CEF5] bg-white text-[#3B4FE0] transition-colors hover:bg-[#F5F7FF]';

export const PH_ICONS: Record<string, LucideIcon> = {
  AlertTriangle, ArrowLeftRight, Banknote, Boxes, CalendarClock, CalendarDays, ClipboardCheck,
  CreditCard, Download, Droplet, FileText, FlaskConical, IndianRupee, Minus, Pill, Plus, Printer,
  ShieldCheck, ShoppingCart, Smartphone, Wallet, Wind, XCircle,
};

/** Tinted rounded tile with a glyph — the pharmacy tables' product marker. */
export function Tile({ icon, tint, fg, size = 30, glyph = 15, radius = 8 }: {
  icon: string; tint: string; fg: string; size?: number; glyph?: number; radius?: number;
}) {
  const Icon = PH_ICONS[icon] ?? Pill;
  return (
    <span aria-hidden="true" className="grid shrink-0 place-items-center"
      style={{ background: tint, width: size, height: size, borderRadius: radius }}>
      <Icon style={{ width: glyph, height: glyph, color: fg }} />
    </span>
  );
}

export function Chip({ label, bg, fg, className }: { label: string; bg: string; fg: string; className?: string }) {
  return (
    <span className={cn('inline-block shrink-0 rounded-[7px] px-3 py-[5px] text-[11.5px] font-bold', className)}
      style={{ background: bg, color: fg }}>
      {label}
    </span>
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

/** Money with a screen-reader-only unit, so "384.83" is never read as a bare number. */
export function Money({ value, symbol = true, className }: { value: string; symbol?: boolean; className?: string }) {
  return (
    <span className={className}>
      <span aria-hidden="true">{symbol ? `₹${value}` : value}</span>
      <span className="sr-only">{value} rupees</span>
    </span>
  );
}

/** The `− [n] +` control used by both the purchase and billing item tables. */
export function QtyStepper({ value, onChange, name }: { value: number; onChange: (n: number) => void; name: string }) {
  return (
    <span className="inline-flex items-center">
      <button type="button" aria-label={`Decrease quantity of ${name}`} disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        className="grid h-7 w-7 place-items-center rounded-l-[8px] border border-[#E2E6F0] text-[#334155] transition-colors hover:bg-[#F7F8FC] disabled:cursor-not-allowed disabled:opacity-40">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input type="number" value={value} aria-label={`Quantity of ${name}`}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="h-7 w-11 border-y border-[#E2E6F0] bg-white text-center text-[12.5px] font-bold text-[#0F172A] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
      <button type="button" aria-label={`Increase quantity of ${name}`} onClick={() => onChange(value + 1)}
        className="grid h-7 w-7 place-items-center rounded-r-[8px] border border-[#E2E6F0] text-[#334155] transition-colors hover:bg-[#F7F8FC]">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/** The Mateo mark + wordmark used on both printed documents. */
export function MateoMark() {
  return (
    <span className="flex items-start gap-2.5">
      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-lg font-extrabold text-white"
        style={{ background: 'linear-gradient(135deg, #7C5CFF 0%, #3B82F6 100%)' }}>
        M
      </span>
      <span>
        <span className="block font-display text-[19px] font-extrabold leading-none tracking-tight text-[#0F172A]">Mateo</span>
        <span className="mt-1 block text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#12A150]">Children&rsquo;s Clinic</span>
      </span>
    </span>
  );
}

/** A `label : value` row for the invoice/receipt meta blocks. */
export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="w-[74px] shrink-0 text-[11px] font-medium text-[#64748B]">{label}</dt>
      <dd aria-hidden="true" className="text-[11px] font-medium text-[#64748B]">:</dd>
      <dd className="min-w-0 text-[11px] font-bold text-[#0F172A]">{value}</dd>
    </div>
  );
}

/** The green "change to return" strip, shared by three surfaces. */
export function ChangeStrip({ value, size = 'lg' }: { value: string; size?: 'sm' | 'lg' }) {
  return (
    <p className={cn('flex items-center gap-2 rounded-[9px] bg-[#ECFAF1]', size === 'lg' ? 'px-[13px] py-[11px]' : 'px-3 py-2')}>
      <span className={cn('font-bold uppercase text-[#0F7A46]', size === 'lg' ? 'text-[11.5px]' : 'text-[10.5px]')}>
        Change to Return
      </span>
      <span className={cn('ml-auto font-extrabold text-[#12A150]', size === 'lg' ? 'text-[15px]' : 'text-[13px]')}>
        <span aria-hidden="true">₹ {value}</span>
        <span className="sr-only">{value} rupees</span>
      </span>
    </p>
  );
}

/** The WhatsApp glyph — lucide has no brand marks. */
export function WhatsAppIcon({ size = 16, color = '#25D366' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true" className="shrink-0">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.22-8.24 8.22z" />
    </svg>
  );
}
