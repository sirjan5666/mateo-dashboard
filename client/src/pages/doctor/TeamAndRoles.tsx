import { useState } from 'react';
import { Link } from 'react-router';
import { Info, LayoutGrid, Pencil, Plus, ShieldPlus, X } from 'lucide-react';
import { PERMISSIONS } from '../../data/team';
import type { ModuleId, PermissionState, RoleId } from '../../data/team';
import { NEXT_STATE, PermissionMatrix } from '../../components/doctor/v2/team/PermissionMatrix';
import { UserRolesCard } from '../../components/doctor/v2/team/UserRolesCard';
import { TeamOverviewRail } from '../../components/doctor/v2/team/TeamOverviewRail';

const CARD =
  'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';

const LEGEND = [
  { color: '#16A34A', label: 'Full Access' },
  { color: '#2563EB', label: 'Limited Access' },
  { color: '#CBD5E1', label: 'No Access' },
];

type Matrix = Record<ModuleId, Record<RoleId, PermissionState>>;

const clone = (m: Matrix): Matrix =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v }])) as Matrix;

export default function TeamAndRoles() {
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [matrix, setMatrix] = useState<Matrix>(() => clone(PERMISSIONS));
  const [draft, setDraft] = useState<Matrix | null>(null);
  const editing = draft !== null;

  const cycle = (module: ModuleId, role: RoleId) => {
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      next[module][role] = NEXT_STATE[d[module][role]];
      return next;
    });
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3.5">
            <span
              className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px]"
              style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}
            >
              <ShieldPlus className="h-5 w-5 text-white" />
            </span>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">
              Team &amp; Roles
            </h1>
          </div>
          <p className="mt-2 text-sm text-[#64748B]">Manage your team members, assign roles and control access permissions.</p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <button
            type="button"
            aria-label="Open permission templates"
            onClick={() => console.log('[Clinic OS] Permission Templates')}
            className="flex h-[46px] items-center gap-2.5 rounded-[11px] border border-[#E2E6F0] bg-white px-5 shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-colors hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
          >
            <LayoutGrid className="h-[18px] w-[18px] text-[#3B4FE0]" />
            <span className="text-[14.5px] font-bold text-[#1E2A5A]">Permission Templates</span>
          </button>

          <Link
            to="/doctor/team/new"
            aria-label="Add a sub-user"
            className="flex h-[46px] items-center gap-2.5 rounded-[11px] px-[22px] text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] transition-[filter] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
            style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}
          >
            <Plus className="h-[18px] w-[18px]" />
            <span className="text-[14.5px] font-bold">Add Sub-User</span>
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[372px_1fr]">
        <UserRolesCard selectedRole={selectedRole} onSelectRole={setSelectedRole} />

        <section className={`${CARD} min-w-0`}>
          {/* Matrix header */}
          <div className="flex flex-wrap items-start gap-4 px-[22px] pb-4 pt-5">
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold tracking-[-0.01em] text-[#0F172A]">Permission Matrix</h2>
              <p className="mt-1.5 text-[13px] text-[#64748B]">View role-based access permissions</p>
            </div>

            <div aria-hidden="true" className="ml-auto flex flex-wrap items-center gap-x-[22px] gap-y-2">
              {LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-2">
                  <span className="h-[9px] w-[9px] rounded-full" style={{ background: l.color }} />
                  <span className="text-[12.5px] font-medium text-[#475569]">{l.label}</span>
                </span>
              ))}
            </div>

            {editing ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="flex h-9 items-center gap-1.5 rounded-[9px] border border-[#E2E6F0] px-3 text-[13.5px] font-bold text-[#475569] transition-colors hover:bg-[#F7F8FC]"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (draft) setMatrix(draft);
                    setDraft(null);
                  }}
                  className="h-9 rounded-[9px] bg-[#3B4FE0] px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-[#2B3FD0]"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Edit permissions"
                onClick={() => setDraft(clone(matrix))}
                className="flex items-center gap-2 text-[13.5px] font-bold text-[#3B4FE0] transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
              >
                <Pencil className="h-4 w-4" />
                Edit Permissions
              </button>
            )}
          </div>

          {/* Matrix + rail */}
          <div className="flex flex-col xl:flex-row">
            <div className="min-w-0 flex-1">
              <PermissionMatrix
                permissions={draft ?? matrix}
                dimmedExcept={editing ? null : selectedRole}
                editing={editing}
                onCycle={cycle}
              />
            </div>
            <div className="border-t border-[#ECEEF4] xl:border-l xl:border-t-0" />
            <TeamOverviewRail />
          </div>
        </section>
      </div>

      {/* Info callout */}
      <div className="mt-5 flex items-center gap-3.5 rounded-[12px] border border-[#DCE6FB] bg-[#EEF3FE] px-5 py-4">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#2563EB]">
          <Info className="h-3.5 w-3.5 text-white" />
        </span>
        <p className="text-[13.5px] font-medium text-[#1E3A8A]">
          Permissions are applied in real-time. Changes to roles or permissions will reflect immediately.
        </p>
      </div>
    </div>
  );
}
