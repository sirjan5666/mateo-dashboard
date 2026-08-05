import { ChevronRight, FileSpreadsheet, Pill, Plus, ShieldPlus, Stethoscope, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ROLES } from '../../../../data/team';
import type { Role, RoleId } from '../../../../data/team';
import { cn } from '../../../../lib/cn';

const ICONS: Record<string, LucideIcon> = { ShieldPlus, Stethoscope, UserRound, FileSpreadsheet, Pill };

function RoleTile({ role, selected, onToggle }: { role: Role; selected: boolean; onToggle: () => void }) {
  const Icon = ICONS[role.icon] ?? ShieldPlus;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-[12px] border p-3.5 text-left transition-[background-color,border-color,box-shadow] duration-[180ms]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2',
        selected
          ? 'border-[1.5px] border-[#6366F1] bg-[#F5F5FF]'
          : 'border-[#ECEEF4] bg-white hover:border-[#C7CEDB] hover:shadow-[0_4px_12px_-6px_rgba(16,24,40,.12)]',
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: role.tint }}>
        <Icon className="h-[21px] w-[21px]" style={{ color: role.hue }} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-bold leading-tight text-[#0F172A]">{role.name}</span>
          {role.chip && (
            <span className="rounded-[6px] bg-[#E6E3FF] px-[9px] py-[3px] text-[10.5px] font-bold text-[#5B4BE0]">{role.chip}</span>
          )}
        </span>
        <span className="mt-1 block text-[12.5px] font-normal text-[#64748B]">{role.description}</span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        <span className="grid h-[26px] w-7 place-items-center rounded-[7px] bg-[#F1F3F9] text-[13px] font-bold tabular-nums text-[#334155]">
          {role.count}
        </span>
        <ChevronRight className="h-[18px] w-[18px] text-[#94A3B8]" />
      </span>
    </button>
  );
}

export function UserRolesCard({
  selectedRole,
  onSelectRole,
}: {
  selectedRole: RoleId | null;
  onSelectRole: (id: RoleId | null) => void;
}) {
  return (
    <section className="flex flex-col self-stretch rounded-[14px] border border-[#ECEEF4] bg-white px-[18px] py-5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]">
      <h2 className="font-display text-base font-bold tracking-[-0.01em] text-[#0F172A]">User Roles ({ROLES.length})</h2>
      <p className="mt-1.5 text-[13px] text-[#64748B]">Predefined roles with different access levels</p>

      <div className="mt-4 flex flex-col gap-3">
        {ROLES.map((r) => (
          <RoleTile
            key={r.id}
            role={r}
            selected={selectedRole === r.id}
            onToggle={() => onSelectRole(selectedRole === r.id ? null : r.id)}
          />
        ))}
      </div>

      <button
        type="button"
        aria-label="Add a new role"
        onClick={() => console.log('[Clinic OS] Add New Role')}
        className="mt-3.5 flex h-12 w-full items-center justify-center gap-2.5 rounded-[11px] border-[1.5px] border-dashed border-[#C7CEDB] bg-transparent transition-colors hover:border-[#3B4FE0] hover:bg-[#F5F7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
      >
        <Plus className="h-[18px] w-[18px] text-[#3B4FE0]" />
        <span className="text-[14.5px] font-bold text-[#3B4FE0]">Add New Role</span>
      </button>

      {selectedRole && (
        <p className="mt-4 text-[12px] font-medium text-[#64748B]">
          Showing the {ROLES.find((r) => r.id === selectedRole)?.name} column. Click the role again to show all.
        </p>
      )}
    </section>
  );
}
