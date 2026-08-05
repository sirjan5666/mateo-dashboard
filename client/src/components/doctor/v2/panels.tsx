import { useState } from 'react';
import { Link } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  FilePlus2,
  Maximize2,
  MoreHorizontal,
  Search,
  Share2,
  Syringe,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  ALERTS,
  CARE_STATUS_META,
  RECENT_PATIENTS,
  SCHEDULE,
  SCHEDULE_STATUS_META,
} from '../../../data/doctorDashboard';
import { Chip, LinkArrow, Panel, PanelHead } from './kit';
import { cn } from '../../../lib/cn';

// ── Today's Schedule ─────────────────────────────────────────────────────────

export function TodaysSchedule() {
  return (
    <Panel className="flex flex-col">
      <PanelHead
        icon={CalendarClock}
        title="Today's Schedule (8 May)"
        right={<LinkArrow to="/doctor/appointments" label="View all" />}
      />

      <ul className="px-5 pb-4 pt-3">
        {SCHEDULE.map((row, i) => {
          const meta = SCHEDULE_STATUS_META[row.status];
          return (
            <li
              key={row.time}
              className={cn('flex h-[30px] items-center gap-2.5', i > 0 && 'border-t border-[#F4F6FA]')}
            >
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: meta.fg }} />
              <span className="w-[70px] shrink-0 text-xs font-bold tabular-nums text-[#0F172A]">{row.time}</span>
              <Link
                to="/doctor/patients"
                className="shrink-0 text-xs font-semibold text-[#0F172A] hover:text-[#3B4FE0] hover:underline"
              >
                {row.patient}
              </Link>
              <span className="shrink-0 text-xs font-medium text-[#64748B]">{row.age}</span>
              <span className="hidden min-w-0 flex-1 truncate text-xs font-medium text-[#64748B] sm:block">{row.type}</span>
              <span className="ml-auto shrink-0">
                <Chip label={meta.label} bg={meta.bg} fg={meta.fg} pulse={meta.pulse} />
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ── Alerts & Reminders ───────────────────────────────────────────────────────

const ALERT_ICONS: Record<string, LucideIcon> = { AlertCircle, AlertTriangle, CalendarCheck };

export function AlertsReminders() {
  return (
    <Panel className="flex flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <BellRing className="h-4 w-4 shrink-0 text-[#EF4444]" />
        <h2 className="font-display text-[15px] font-bold leading-5 tracking-[-0.01em] text-[#0F172A]">Alerts &amp; Reminders</h2>
        <span className="ml-auto">
          <LinkArrow to="/doctor/appointments" label="View all" />
        </span>
      </div>

      <ul className="space-y-2 px-5 pb-5 pt-3">
        {ALERTS.map((a) => {
          const Icon = ALERT_ICONS[a.icon] ?? AlertCircle;
          return (
            <li key={a.id}>
              <Link
                to={a.to}
                className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 transition-opacity hover:opacity-90"
                style={{ background: a.tint, borderLeft: `3px solid ${a.accent}` }}
              >
                <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full" style={{ background: a.accent }}>
                  <Icon className="h-[11px] w-[11px] text-white" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold" style={{ color: a.accent }}>
                    {a.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-[#64748B]">{a.note}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8]" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ── Recent Patients ──────────────────────────────────────────────────────────

/**
 * The 3-dot menu, per the brief: no Edit, no Archive, no "Open record".
 * The two ⤢ entries open the vaccination / growth peek popups (specs 07–08).
 */
const ROW_MENU: { label: string; icon: LucideIcon; color?: string; divider?: boolean }[] = [
  { label: 'View patient', icon: User },
  { label: 'Book consultation', icon: CalendarPlus },
  { label: 'Generate prescription', icon: FilePlus2 },
  { label: 'Vaccination record', icon: Syringe, color: '#14B8A6', divider: true },
  { label: 'Growth record', icon: TrendingUp, color: '#0EA5E9' },
  { label: 'Share summary', icon: Share2, divider: true },
];

const PEEK_LABELS = new Set(['Vaccination record', 'Growth record']);

function RowMenu({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="menu"
      className="absolute right-0 top-[calc(100%+4px)] z-30 w-[240px] rounded-[12px] border border-[#ECEEF4] bg-white p-1.5 shadow-[0_24px_64px_-20px_rgba(10,27,77,.35)]"
    >
      {ROW_MENU.map((item) => (
        <div key={item.label}>
          {item.divider && <div className="my-1.5 border-t border-[#F1F3F9]" />}
          <button
            type="button"
            role="menuitem"
            onClick={onClose}
            className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium text-[#0F172A] transition-colors hover:bg-[#F6F7FB]"
          >
            <item.icon className="h-4 w-4 shrink-0" style={{ color: item.color ?? '#64748B' }} />
            <span className="flex-1 truncate">{item.label}</span>
            {PEEK_LABELS.has(item.label) && <Maximize2 className="h-3 w-3 shrink-0 text-[#94A3B8]" />}
          </button>
        </div>
      ))}
    </div>
  );
}

export function RecentPatients() {
  const [openRow, setOpenRow] = useState<string | null>(null);

  return (
    <Panel className="flex flex-col">
      <PanelHead
        icon={Users}
        title="Recent Patients"
        right={
          <>
            <label className="relative hidden md:block">
              <span className="sr-only">Search recent patients</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="search"
                placeholder="Search…"
                className="h-8 w-[160px] rounded-[8px] border border-[#E2E6F0] bg-white pl-8 pr-2.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#4F63F5] focus:outline-none"
              />
            </label>
            <LinkArrow to="/doctor/patients" label="Track patients" />
          </>
        }
      />

      <div className="px-5 pb-4 pt-2">
        <table className="w-full">
          <caption className="sr-only">Recent patients and their current status</caption>
          <tbody>
            {RECENT_PATIENTS.map((p, i) => {
              const meta = CARE_STATUS_META[p.status];
              return (
                <tr key={p.pid} className={cn('h-[38px]', i > 0 && 'border-t border-[#F4F6FA]')}>
                  <td className="py-1">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[10px] font-bold"
                        style={{ background: p.tint, color: p.fg }}
                      >
                        {p.initials}
                      </span>
                      <Link to="/doctor/patients" className="truncate text-xs font-semibold text-[#0F172A] hover:text-[#3B4FE0] hover:underline">
                        {p.name}
                      </Link>
                      <span className="hidden shrink-0 text-xs font-medium text-[#64748B] sm:inline">{p.age}</span>
                      <span aria-hidden="true" className="hidden text-xs text-[#94A3B8] sm:inline">
                        •
                      </span>
                      <span className="hidden shrink-0 text-xs font-medium text-[#64748B] sm:inline">{p.gender}</span>
                    </div>
                  </td>
                  <td className="hidden py-1 lg:table-cell">
                    <Chip label={meta.label} bg={meta.bg} fg={meta.fg} />
                  </td>
                  <td className="py-1 text-right text-xs font-medium tabular-nums text-[#475569]">{p.date}</td>
                  <td className="hidden py-1 pl-3 text-right text-xs font-medium tabular-nums text-[#475569] sm:table-cell">{p.time}</td>
                  <td className="w-9 py-1 pl-1">
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`Actions for ${p.name}`}
                        aria-haspopup="menu"
                        aria-expanded={openRow === p.pid}
                        onClick={() => setOpenRow((r) => (r === p.pid ? null : p.pid))}
                        className="grid h-7 w-7 place-items-center rounded-[6px] text-[#94A3B8] transition-colors hover:bg-[#F1F3F9] hover:text-[#475569]"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openRow === p.pid && (
                        <>
                          <button
                            type="button"
                            aria-label="Close menu"
                            className="fixed inset-0 z-20 cursor-default"
                            onClick={() => setOpenRow(null)}
                          />
                          <RowMenu onClose={() => setOpenRow(null)} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
