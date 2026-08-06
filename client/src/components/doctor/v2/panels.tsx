import { Link } from 'react-router';
import { AlertCircle, AlertTriangle, BellRing, CalendarCheck, CalendarClock, ChevronRight, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Chip, LinkArrow, Panel, PanelHead } from './kit';
import { cn } from '../../../lib/cn';

// ── Today's Schedule ─────────────────────────────────────────────────────────

export interface ScheduleRow {
  id: string;
  patientId: string;
  patientName: string;
  start: string;
  status: string;
}

const APPT_STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  scheduled: { label: 'Scheduled', bg: '#E4EBFD', fg: '#2B6FF0' },
  completed: { label: 'Completed', bg: '#DCF7E6', fg: '#12A150' },
  cancelled: { label: 'Cancelled', bg: '#F1F3F9', fg: '#64748B' },
  no_show: { label: 'No show', bg: '#FDE2E2', fg: '#E03131' },
};

/** Today's real appointments. Empty is shown as empty, never as a sample day. */
export function TodaysSchedule({ rows }: { rows: ScheduleRow[] }) {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return (
    <Panel className="flex flex-col">
      <PanelHead
        icon={CalendarClock}
        title={`Today's Schedule (${today})`}
        right={<LinkArrow to="/doctor/appointments" label="View all" />}
      />

      {rows.length === 0 ? (
        <p className="px-5 pb-5 pt-3 text-xs text-[#64748B]">No appointments booked for today.</p>
      ) : (
        <ul className="px-5 pb-4 pt-3">
          {rows.map((row, i) => {
            const meta = APPT_STATUS_META[row.status] ?? APPT_STATUS_META.scheduled;
            const time = new Date(row.start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            return (
              <li key={row.id} className={cn('flex h-[30px] items-center gap-2.5', i > 0 && 'border-t border-[#F4F6FA]')}>
                <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: meta.fg }} />
                <span className="w-[76px] shrink-0 text-xs font-bold tabular-nums text-[#0F172A]">{time}</span>
                <Link
                  to={`/doctor/patients/${row.patientId}`}
                  className="min-w-0 flex-1 truncate text-xs font-semibold text-[#0F172A] hover:text-[#3B4FE0] hover:underline"
                >
                  {row.patientName}
                </Link>
                <span className="ml-auto shrink-0">
                  <Chip label={meta.label} bg={meta.bg} fg={meta.fg} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ── Alerts & Reminders ───────────────────────────────────────────────────────

const ALERT_ICONS: Record<string, LucideIcon> = { AlertCircle, AlertTriangle, CalendarCheck };

export interface RecentRow {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
}

/** The doctor's most recently touched patients, straight from the overview. */
export function RecentPatients({ rows }: { rows: RecentRow[] }) {
  const initials = (n: string) => n.trim().split(/s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return (
    <Panel className="flex flex-col">
      <PanelHead icon={Users} title="Recent Patients" right={<LinkArrow to="/doctor/patients" label="All patients" />} />
      {rows.length === 0 ? (
        <p className="px-5 pb-5 pt-3 text-xs text-[#64748B]">No patients yet.</p>
      ) : (
        <div className="px-5 pb-4 pt-2">
          <table className="w-full">
            <caption className="sr-only">Recently updated patients</caption>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={cn('h-[38px]', i > 0 && 'border-t border-[#F4F6FA]')}>
                  <td className="py-1">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[#EEF2FF] text-[10px] font-bold text-[#3B4FE0]">
                        {initials(r.name)}
                      </span>
                      <Link to={`/doctor/patients/${r.id}`} className="truncate text-xs font-semibold text-[#0F172A] hover:text-[#3B4FE0] hover:underline">
                        {r.name}
                      </Link>
                    </div>
                  </td>
                  <td className="py-1 text-right text-xs font-medium text-[#64748B]">
                    {new Date(r.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ── Alerts & Reminders ───────────────────────────────────────────────────────

export interface AlertRow {
  id: string;
  icon: string;
  accent: string;
  tint: string;
  title: string;
  note: string;
  to: string;
}

/**
 * Real signals only — low stock, unpaid invoices, unread messages, today's
 * remaining appointments. An empty list means there is genuinely nothing to
 * flag, so the panel says so rather than inventing a reminder.
 */
export function AlertsReminders({ alerts }: { alerts: AlertRow[] }) {
  return (
    <Panel className="flex flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <BellRing className="h-4 w-4 shrink-0 text-[#EF4444]" />
        <h2 className="font-display text-[15px] font-bold leading-5 tracking-[-0.01em] text-[#0F172A]">Alerts &amp; Reminders</h2>
        <span className="ml-auto">
          <LinkArrow to="/doctor/appointments" label="View all" />
        </span>
      </div>

      {alerts.length === 0 && (
        <p className="px-5 pb-5 pt-3 text-xs text-[#64748B]">Nothing needs attention right now.</p>
      )}

      <ul className="space-y-2 px-5 pb-5 pt-3">
        {alerts.map((a) => {
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
