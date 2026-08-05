import { Users } from 'lucide-react';
import {
  ACTIVE_TODAY_SHOWN,
  ACTIVE_TODAY_TOTAL,
  PENDING_INVITATIONS,
  ROLES,
  TOTAL_ACCOUNTS,
} from '../../../../data/team';

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/**
 * Initials avatars rather than photographs: the app has no real member photos,
 * and inventing stock faces for named staff would misrepresent real people.
 */
function AvatarStack() {
  const overflow = ACTIVE_TODAY_TOTAL - ACTIVE_TODAY_SHOWN.length;
  return (
    <div className="mt-3 flex items-center">
      {ACTIVE_TODAY_SHOWN.map((m, i) => (
        <span
          key={m.name}
          title={`${m.name} · ${m.role}`}
          style={{ background: m.tint, color: m.fg, marginLeft: i === 0 ? 0 : -9 }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-2 ring-white"
        >
          {initials(m.name)}
          <span className="sr-only">{m.name}</span>
        </span>
      ))}
      {overflow > 0 && (
        <span
          aria-label={`${overflow} more team members active today`}
          className="ml-2 grid h-6 items-center rounded-full bg-[#E4EBFD] px-2 text-[11.5px] font-bold text-[#2563EB]"
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export function TeamOverviewRail() {
  return (
    <aside className="w-full shrink-0 px-[18px] py-5 xl:w-[232px]">
      <h3 className="font-display text-[15px] font-bold tracking-[-0.01em] text-[#0F172A]">Team Overview</h3>

      {/* Total */}
      <div className="mt-3.5 flex items-center gap-3 rounded-[12px] bg-[#F0EEFD] px-3.5 py-4">
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-[#DDD6FE]">
          <Users className="h-[21px] w-[21px] text-[#6D5AE0]" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#5B4BE0]">Total Team Members</p>
          <p className="mt-0.5 font-display text-[26px] font-extrabold leading-none tracking-[-0.02em] text-[#1E1B4B] tabular-nums">
            {TOTAL_ACCOUNTS}
          </p>
          {/* Not all staff hold an account — see the note in data/team.ts. */}
          <p className="mt-1 text-[11.5px] font-medium text-[#7C6FE8]">With access · all locations</p>
        </div>
      </div>

      {/* Breakdown */}
      <ul className="mt-4">
        {ROLES.map((r) => (
          <li key={r.id} className="flex h-7 items-center gap-2.5">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.dot }} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#334155]">{r.plural}</span>
            <span className="text-[13px] font-bold tabular-nums text-[#0F172A]">{r.count}</span>
          </li>
        ))}
      </ul>

      <div className="my-3.5 h-px bg-[#F1F3F9]" />

      {/* Active today */}
      <div className="flex items-center gap-2">
        <h4 className="text-[13.5px] font-bold text-[#0F172A]">Active Today</h4>
        <span className="ml-auto rounded-[7px] bg-[#E0F5EA] px-[9px] py-[3px] text-[11.5px] font-bold tabular-nums text-[#12A150]">
          {ACTIVE_TODAY_TOTAL}
        </span>
      </div>
      <AvatarStack />

      <div className="my-4 h-px bg-[#F1F3F9]" />

      {/* Pending invitations */}
      <div className="flex items-center gap-2">
        <h4 className="text-[13.5px] font-bold text-[#0F172A]">Pending Invitations</h4>
        <span className="ml-auto rounded-[7px] bg-[#FDECD3] px-[9px] py-[3px] text-[11.5px] font-bold tabular-nums text-[#D97706]">
          {PENDING_INVITATIONS.length}
        </span>
      </div>

      <ul className="mt-3.5 flex flex-col gap-3.5">
        {PENDING_INVITATIONS.map((inv) => (
          <li key={inv.name}>
            <p className="text-[13px] font-bold text-[#0F172A]">{inv.name}</p>
            <p className="mt-[3px] flex items-center gap-2">
              <span className="text-xs font-medium text-[#64748B]">{inv.role}</span>
              <span className="ml-auto text-[11.5px] font-medium text-[#94A3B8]">{inv.elapsed}</span>
            </p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        aria-label="View all invitations"
        onClick={() => console.log('[Clinic OS] View All Invitations')}
        className="mt-[18px] h-[42px] w-full rounded-[10px] border border-[#DDE3F5] bg-[#F5F7FF] text-[13.5px] font-bold text-[#3B4FE0] transition-colors hover:bg-[#EAEEFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
      >
        View All Invitations
      </button>
    </aside>
  );
}
