import { useState } from 'react';
import {
  BarChart3,
  BriefcaseMedical,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  IndianRupee,
  Minus,
  Monitor,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULES, PERMISSION_LABEL, ROLES } from '../../../../data/team';
import type { AppModule, ModuleId, PermissionState, RoleId } from '../../../../data/team';
import { cn } from '../../../../lib/cn';

const ICONS: Record<string, LucideIcon> = {
  Monitor,
  CalendarDays,
  Stethoscope,
  UserRound,
  BarChart3,
  BriefcaseMedical,
  FileText,
  IndianRupee,
  Users,
  ShieldCheck,
  Settings,
};

const BADGE: Record<PermissionState, { bg: string; glyph: LucideIcon }> = {
  full: { bg: '#16A34A', glyph: Check },
  limited: { bg: '#1D6FF2', glyph: Minus },
  none: { bg: '#D8DEE7', glyph: X },
};

/** Colour and glyph are both redundant with the visually-hidden label. */
export function PermissionBadge({ state }: { state: PermissionState }) {
  const { bg, glyph: Glyph } = BADGE[state];
  return (
    <span className="inline-grid h-[22px] w-[22px] place-items-center rounded-full" style={{ background: bg }}>
      <Glyph className="h-3 w-3 text-white" strokeWidth={3} />
      <span className="sr-only">{PERMISSION_LABEL[state]}</span>
    </span>
  );
}

function ModuleCell({ module }: { module: AppModule }) {
  const Icon = ICONS[module.icon] ?? Monitor;
  return (
    <span className="flex items-center gap-3">
      <Icon className="h-[17px] w-[17px] shrink-0" style={{ color: module.iconColor }} />
      <span className="text-[13.5px] font-semibold text-[#0F172A]">{module.label}</span>
    </span>
  );
}

const NEXT_STATE: Record<PermissionState, PermissionState> = { full: 'limited', limited: 'none', none: 'full' };

/**
 * Below md the table is abandoned entirely: a 5-column grid cannot be read on a
 * phone, and horizontal scrolling hides exactly the comparison the matrix exists
 * to show. One collapsible card per module instead.
 */
function ModuleCards({
  permissions,
  editing,
  onCycle,
}: {
  permissions: Record<ModuleId, Record<RoleId, PermissionState>>;
  editing: boolean;
  onCycle: (module: ModuleId, role: RoleId) => void;
}) {
  const [open, setOpen] = useState<ModuleId | null>(MODULES[0].id);

  return (
    <div className="flex flex-col gap-2 px-4 pb-4 md:hidden">
      {MODULES.map((m) => {
        const expanded = open === m.id;
        return (
          <div key={m.id} className="overflow-hidden rounded-[12px] border border-[#ECEEF4]">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : m.id)}
              className="flex w-full items-center gap-3 bg-[#F7F8FC] px-3.5 py-3 text-left"
            >
              <ModuleCell module={m} />
              <ChevronDown
                className={cn('ml-auto h-4 w-4 shrink-0 text-[#64748B] transition-transform duration-200', expanded && 'rotate-180')}
              />
            </button>
            {expanded && (
              <ul className="divide-y divide-[#F1F3F9]">
                {ROLES.map((r) => {
                  const state = permissions[m.id][r.id];
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#334155]">{r.name}</span>
                      {editing ? (
                        <button
                          type="button"
                          onClick={() => onCycle(m.id, r.id)}
                          aria-label={`Change ${r.name} access to ${m.label}. Currently ${PERMISSION_LABEL[state].toLowerCase()}`}
                          className="rounded-full p-1"
                        >
                          <PermissionBadge state={state} />
                        </button>
                      ) : (
                        <PermissionBadge state={state} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PermissionMatrix({
  permissions,
  dimmedExcept,
  editing,
  onCycle,
}: {
  permissions: Record<ModuleId, Record<RoleId, PermissionState>>;
  dimmedExcept: RoleId | null;
  editing: boolean;
  onCycle: (module: ModuleId, role: RoleId) => void;
}) {
  return (
    <>
      <ModuleCards permissions={permissions} editing={editing} onCycle={onCycle} />
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[640px] border-separate border-spacing-0">
        <caption className="sr-only">Role-based module permissions</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 rounded-tl-[10px] bg-[#F7F8FC] py-3 pl-[18px] text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]"
            >
              Modules
            </th>
            {ROLES.map((r, i) => (
              <th
                key={r.id}
                scope="col"
                className={cn(
                  'border-l border-[#F1F3F9] bg-[#F7F8FC] px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.04em] text-[#334155]',
                  i === ROLES.length - 1 && 'rounded-tr-[10px]',
                )}
              >
                {/* Dim on an inner span rather than the th: opacity on table
                    cells is legal but interacts awkwardly with cell borders and
                    backgrounds, which we want to keep at full strength. */}
                <span
                  className="inline-block transition-opacity duration-[180ms]"
                  style={{ opacity: dimmedExcept && dimmedExcept !== r.id ? 0.35 : 1 }}
                >
                  {r.columnLabel}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m) => (
            <tr key={m.id} className="group">
              <th
                scope="row"
                className="sticky left-0 z-10 h-[51px] border-t border-[#F1F3F9] bg-white pl-[18px] pr-3 text-left font-normal group-hover:bg-[#FAFBFF]"
              >
                <ModuleCell module={m} />
              </th>
              {ROLES.map((r) => {
                const state = permissions[m.id][r.id];
                const dimmed = dimmedExcept && dimmedExcept !== r.id;
                return (
                  <td
                    key={r.id}
                    className="h-[51px] border-l border-t border-[#F1F3F9] text-center group-hover:bg-[#FAFBFF]"
                  >
                    <span
                      className="inline-flex transition-opacity duration-[180ms]"
                      style={{ opacity: dimmed ? 0.35 : 1 }}
                    >
                      {editing ? (
                        <button
                          type="button"
                          onClick={() => onCycle(m.id, r.id)}
                          aria-label={`Change ${r.name} access to ${m.label}. Currently ${PERMISSION_LABEL[state].toLowerCase()}. Next: ${PERMISSION_LABEL[NEXT_STATE[state]].toLowerCase()}`}
                          className="rounded-full p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-1 motion-reduce:hover:scale-100"
                        >
                          <PermissionBadge state={state} />
                        </button>
                      ) : (
                        <span title={`${r.name} — ${PERMISSION_LABEL[state]} to ${m.label}`}>
                          <PermissionBadge state={state} />
                        </span>
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

export { NEXT_STATE };
