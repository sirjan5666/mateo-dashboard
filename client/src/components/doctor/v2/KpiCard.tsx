import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Activity, ArrowRight, ArrowUp, CalendarClock, IndianRupee, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Kpi } from '../../../data/doctorDashboard';
import { useActiveLocation } from '../../../lib/doctorLocation';

const ICONS: Record<string, LucideIcon> = { CalendarClock, Activity, Users, IndianRupee, Wallet };

const CARD_CLS =
  'group relative flex flex-col overflow-hidden rounded-[14px] border border-[#ECEEF4] bg-white pb-3.5 pl-5 pr-5 pt-[18px] shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)] transition-shadow duration-200 hover:shadow-[0_12px_28px_-14px_rgba(16,24,40,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2';

/**
 * A dashboard KPI. By default the whole card is the link (§5.3 drill-down
 * contract) and the footer row is decoration that follows the hover.
 *
 * When a `control` is supplied (e.g. the Total Patients period filter) the card
 * renders as a plain container instead — a `<select>` is interactive content and
 * cannot legally nest inside an `<a>` — and the drill-down becomes an explicit
 * link in the footer.
 */
export function KpiCard({ kpi, overallNote, control }: { kpi: Kpi; overallNote?: boolean; control?: ReactNode }) {
  const { clinics } = useActiveLocation();
  const clinicCount = clinics.length;
  const Icon = ICONS[kpi.icon] ?? Users;
  const solid = kpi.tile === 'solid';

  const body = (
    <>
      {/* 3px accent rail flush to the top edge */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: kpi.accent }} />

      <div className="flex items-start gap-3.5">
        <span
          className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[12px]"
          style={{ background: solid ? kpi.accent : kpi.tint }}
        >
          <Icon className="h-[22px] w-[22px]" style={{ color: solid ? '#FFFFFF' : kpi.accent }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="block text-[13px] font-semibold leading-[18px] text-[#64748B]">{kpi.label}</span>
            {control}
          </span>
          <span className="mt-0.5 block font-display text-[30px] font-extrabold leading-9 tracking-[-0.02em] text-[#0F172A] tabular-nums">
            {kpi.value}
          </span>
        </span>
      </div>

      <div className="mt-2.5 flex min-h-[18px] items-center gap-1.5 text-xs font-medium text-[#64748B]">
        {kpi.delta ? (
          <>
            <ArrowUp className="h-3.5 w-3.5 text-[#16A34A]" strokeWidth={2.5} />
            <span className="font-bold text-[#16A34A]">{kpi.delta}</span>
            <span>{kpi.deltaNote}</span>
          </>
        ) : (
          <>
            {kpi.live && (
              <span className="relative flex h-[7px] w-[7px] shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22D3EE] opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-[#22D3EE]" />
              </span>
            )}
            <span>{kpi.statusNote}</span>
          </>
        )}
      </div>

      {overallNote && <span className="mt-1 block text-[11px] font-medium text-[#64748B]">across {clinicCount} clinic{clinicCount === 1 ? '' : 's'}</span>}

      <span aria-hidden="true" className="mt-3 block h-px bg-[#F1F3F9]" />
    </>
  );

  // Card with an interactive control: plain container + explicit drill-down link.
  if (control) {
    return (
      <div className={CARD_CLS}>
        {body}
        <Link to={kpi.to} className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:underline" style={{ color: kpi.accent }}>
          {kpi.linkLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      </div>
    );
  }

  return (
    <Link to={kpi.to} className={CARD_CLS}>
      {body}
      <span aria-hidden="true" className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: kpi.accent }}>
        {kpi.linkLabel}
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
