import {
  BarChart3,
  BriefcaseMedical,
  CalendarDays,
  Check,
  FileText,
  IndianRupee,
  Monitor,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULES, MODULE_DESCRIPTIONS, PERMISSION_LABEL, SUBUSER_MODULE_IDS } from '../../../../data/team';
import type { ModuleId, PermissionState } from '../../../../data/team';
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

const STATES: PermissionState[] = ['full', 'limited', 'none'];

/**
 * `noneColor` is a per-row override. The reference mockup paints the Pharmacy
 * row's selected "None" radio green rather than grey — reproduced here, but as a
 * prop so it can be normalised in one place without touching this component.
 */
export function PermissionRadio({
  state,
  selected,
  noneColor,
}: {
  state: PermissionState;
  selected: boolean;
  noneColor?: string;
}) {
  if (!selected) {
    return <span aria-hidden="true" className="inline-block h-[18px] w-[18px] rounded-full border-[1.5px] border-[#C7CEDB]" />;
  }
  if (state === 'full') {
    return (
      <span aria-hidden="true" className="inline-grid h-[18px] w-[18px] place-items-center rounded-full bg-[#16A34A]">
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
      </span>
    );
  }
  const ring = state === 'limited' ? '#1D6FF2' : (noneColor ?? '#C7CEDB');
  const dot = state === 'limited' ? '#1D6FF2' : (noneColor ?? '#B4BECD');
  return (
    <span
      aria-hidden="true"
      className="inline-grid h-[18px] w-[18px] place-items-center rounded-full border-2"
      style={{ borderColor: ring }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
    </span>
  );
}

function ModuleLabel({ id }: { id: ModuleId }) {
  const m = MODULES.find((x) => x.id === id)!;
  const Icon = ICONS[m.icon] ?? Monitor;
  return (
    <span className="flex items-center gap-3">
      <Icon className="h-[17px] w-[17px] shrink-0" style={{ color: m.iconColor }} />
      <span className="text-[13px] font-semibold text-[#0F172A]">{m.label}</span>
    </span>
  );
}

export function PermissionSummaryTable({
  permissions,
  onChange,
}: {
  permissions: Record<ModuleId, PermissionState>;
  onChange: (module: ModuleId, state: PermissionState) => void;
}) {
  const rows = SUBUSER_MODULE_IDS;

  return (
    <>
      {/* ── md+ : the table ─────────────────────────────────────────────── */}
      <div className="mt-3.5 hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-0">
          <caption className="sr-only">Module permissions for the selected role</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[30%] rounded-tl-[9px] bg-[#F7F8FC] py-3 pl-4 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                Module
              </th>
              {STATES.map((s) => (
                <th key={s} scope="col" className="w-[11%] bg-[#F7F8FC] px-1 py-3 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                  {s}
                </th>
              ))}
              <th scope="col" className="w-[37%] rounded-tr-[9px] bg-[#F7F8FC] py-3 pl-3 pr-4 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((id) => {
              const current = permissions[id];
              return (
                <tr key={id} className="group">
                  <th scope="row" className="h-[46px] border-t border-[#F1F3F9] pl-4 text-left font-normal group-hover:bg-[#FAFBFF]">
                    <ModuleLabel id={id} />
                  </th>
                  {STATES.map((s) => (
                    <td key={s} className="h-[46px] border-t border-[#F1F3F9] text-center group-hover:bg-[#FAFBFF]">
                      <label className="inline-flex cursor-pointer items-center justify-center p-1">
                        <input
                          type="radio"
                          name={`perm-${id}`}
                          value={s}
                          checked={current === s}
                          onChange={() => onChange(id, s)}
                          className="peer sr-only"
                        />
                        <span className="rounded-full ring-offset-2 peer-focus-visible:ring-2 peer-focus-visible:ring-[#4F63F5]">
                          <PermissionRadio state={s} selected={current === s} noneColor={id === 'pharmacy' ? '#0E8A43' : undefined} />
                        </span>
                        <span className="sr-only">{PERMISSION_LABEL[s]}</span>
                      </label>
                    </td>
                  ))}
                  <td className="h-[46px] border-t border-[#F1F3F9] py-2 pl-3 pr-4 text-[13px] text-[#475569] group-hover:bg-[#FAFBFF]">
                    {MODULE_DESCRIPTIONS[id][current]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── < md : one stacked block per module ─────────────────────────── */}
      <div className="mt-3.5 flex flex-col gap-2 md:hidden">
        {rows.map((id) => {
          const current = permissions[id];
          return (
            <fieldset key={id} className="rounded-[12px] border border-[#ECEEF4] p-3">
              <legend className="sr-only">{MODULES.find((m) => m.id === id)!.label}</legend>
              <ModuleLabel id={id} />
              <p className="mt-1 text-[12.5px] text-[#475569]">{MODULE_DESCRIPTIONS[id][current]}</p>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                {STATES.map((s) => (
                  <label
                    key={s}
                    className={cn(
                      'flex cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border px-2 py-1.5 text-[12px] font-semibold capitalize transition-colors',
                      current === s ? 'border-[#6366F1] bg-[#F5F5FF] text-[#3B4FE0]' : 'border-[#E4E8F1] text-[#64748B]',
                    )}
                  >
                    <input
                      type="radio"
                      name={`perm-m-${id}`}
                      value={s}
                      checked={current === s}
                      onChange={() => onChange(id, s)}
                      className="sr-only"
                    />
                    <PermissionRadio state={s} selected={current === s} noneColor={id === 'pharmacy' ? '#0E8A43' : undefined} />
                    {s}
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
