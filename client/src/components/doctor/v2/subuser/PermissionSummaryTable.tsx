import {
  Activity,
  BarChart3,
  BriefcaseMedical,
  Building2,
  CalendarDays,
  Check,
  FileText,
  Monitor,
  Pill,
  Settings,
  ShieldCheck,
  Stethoscope,
  Syringe,
  UserRound,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CatalogueResponse, PermissionLevel } from '../../../../api/doctorTeam';
import { LEVELS, LEVEL_LABEL, actionsAt } from '../../../../lib/permissions';
import { cn } from '../../../../lib/cn';

/**
 * The permission summary on the Create Sub-User form.
 *
 * Modules, levels and the actions each level unlocks all come from the server's
 * permission catalogue — the same file the API enforces — so what this table
 * promises and what an endpoint allows cannot drift apart.
 */

const ICONS: Record<string, LucideIcon> = {
  dashboard: Monitor,
  patients: UserRound,
  appointments: CalendarDays,
  consultations: Stethoscope,
  prescriptions: Pill,
  growth: BarChart3,
  vaccinations: Syringe,
  billing: FileText,
  pharmacy: BriefcaseMedical,
  reports: Activity,
  locations: Building2,
  team: Users,
  settings: Settings,
  audit: ShieldCheck,
};

/** Only the two the reference mockup tints; the rest are dark navy. */
const ICON_COLOR: Record<string, string> = { pharmacy: '#F97316', billing: '#16A34A' };

function ModuleLabel({ id, label }: { id: string; label: string }) {
  const Icon = ICONS[id] ?? Monitor;
  return (
    <span className="flex items-center gap-3">
      <Icon className="h-[17px] w-[17px] shrink-0" style={{ color: ICON_COLOR[id] ?? '#1E2A5A' }} />
      <span className="text-[13px] font-semibold text-[#0F172A]">{label}</span>
    </span>
  );
}

/** `full` reads as a tick; the rest as a ringed dot, dimmer as access narrows. */
function PermissionRadio({ level, selected }: { level: PermissionLevel; selected: boolean }) {
  if (!selected) {
    return <span aria-hidden="true" className="inline-block h-[18px] w-[18px] rounded-full border-[1.5px] border-[#C7CEDB]" />;
  }
  if (level === 'full') {
    return (
      <span aria-hidden="true" className="inline-grid h-[18px] w-[18px] place-items-center rounded-full bg-[#16A34A]">
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
      </span>
    );
  }
  const hue = level === 'edit' ? '#2B6FF0' : level === 'view' ? '#6366F1' : '#B4BECD';
  return (
    <span
      aria-hidden="true"
      className="inline-grid h-[18px] w-[18px] place-items-center rounded-full border-2"
      style={{ borderColor: hue }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: hue }} />
    </span>
  );
}

export function PermissionSummaryTable({
  modules,
  permissions,
  onChange,
}: {
  modules: CatalogueResponse['modules'];
  permissions: Record<string, PermissionLevel>;
  onChange: (module: string, level: PermissionLevel) => void;
}) {
  return (
    <>
      {/* ── md+ : the table ─────────────────────────────────────────────── */}
      <div className="mt-3.5 hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-0">
          <caption className="sr-only">Module permissions for the selected role</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[28%] rounded-tl-[9px] bg-[#F7F8FC] py-3 pl-4 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                Module
              </th>
              {LEVELS.map((l) => (
                <th key={l} scope="col" className="w-[9%] bg-[#F7F8FC] px-1 py-3 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                  {l}
                </th>
              ))}
              <th scope="col" className="w-[36%] rounded-tr-[9px] bg-[#F7F8FC] py-3 pl-3 pr-4 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                What that allows
              </th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => {
              const current = permissions[m.id] ?? 'none';
              return (
                <tr key={m.id} className="group">
                  <th scope="row" className="h-[46px] border-t border-[#F1F3F9] pl-4 text-left font-normal group-hover:bg-[#FAFBFF]">
                    <ModuleLabel id={m.id} label={m.label} />
                  </th>
                  {LEVELS.map((l) => (
                    <td key={l} className="h-[46px] border-t border-[#F1F3F9] text-center group-hover:bg-[#FAFBFF]">
                      <label className="inline-flex cursor-pointer items-center justify-center p-1">
                        <input
                          type="radio"
                          name={`perm-${m.id}`}
                          value={l}
                          checked={current === l}
                          onChange={() => onChange(m.id, l)}
                          className="peer sr-only"
                        />
                        <span className="rounded-full ring-offset-2 peer-focus-visible:ring-2 peer-focus-visible:ring-[#4F63F5]">
                          <PermissionRadio level={l} selected={current === l} />
                        </span>
                        <span className="sr-only">{LEVEL_LABEL[l]}</span>
                      </label>
                    </td>
                  ))}
                  <td className="h-[46px] border-t border-[#F1F3F9] py-2 pl-3 pr-4 text-[12.5px] text-[#475569] group-hover:bg-[#FAFBFF]">
                    {actionsAt(m, current)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── < md : one stacked block per module ─────────────────────────── */}
      <div className="mt-3.5 flex flex-col gap-2 md:hidden">
        {modules.map((m) => {
          const current = permissions[m.id] ?? 'none';
          return (
            <fieldset key={m.id} className="rounded-[12px] border border-[#ECEEF4] p-3">
              <legend className="sr-only">{m.label}</legend>
              <ModuleLabel id={m.id} label={m.label} />
              <p className="mt-1 text-[12.5px] text-[#475569]">{actionsAt(m, current)}</p>
              <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                {LEVELS.map((l) => (
                  <label
                    key={l}
                    className={cn(
                      'flex cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border px-1.5 py-1.5 text-[12px] font-semibold capitalize transition-colors',
                      current === l ? 'border-[#6366F1] bg-[#F5F5FF] text-[#3B4FE0]' : 'border-[#E4E8F1] text-[#64748B]',
                    )}
                  >
                    <input
                      type="radio"
                      name={`perm-m-${m.id}`}
                      value={l}
                      checked={current === l}
                      onChange={() => onChange(m.id, l)}
                      className="sr-only"
                    />
                    <PermissionRadio level={l} selected={current === l} />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </>
  );
}
