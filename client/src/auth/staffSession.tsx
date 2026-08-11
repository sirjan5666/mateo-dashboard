import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { staffMe, staffRefresh } from '../api/staffAuth';
import type { StaffSelf } from '../api/staffAuth';

/**
 * Who is actually using the doctor panel.
 *
 * The auth cookie's subject is the DOCTOR for staff and doctor alike — that is
 * what lets staff use the panel unchanged — so `useAuth().user` is the doctor
 * either way. This context answers the other question: is a staff member behind
 * this session, and what may they do?
 *
 * The permission list is advisory. It hides what a role cannot use so the panel
 * is not full of buttons that 403; the SERVER is the guarantee. Nothing here is
 * a security boundary.
 */

interface StaffSessionValue {
  /** null when the doctor themselves is signed in. */
  staff: StaffSelf | null;
  roleName: string | null;
  /** True for the practice owner — every `can()` returns true. */
  owner: boolean;
  /**
   * True when the OWNER is viewing the panel as this staff member, rather than
   * the staff member being signed in themselves. Drives the exit banner.
   */
  viewAs: boolean;
  loading: boolean;
  can: (module: string, action: string) => boolean;
  /** True if the role may do ANYTHING in the module — for hiding whole sections. */
  canSee: (module: string) => boolean;
  reload: () => Promise<void>;
}

const StaffSessionCtx = createContext<StaffSessionValue>({
  staff: null,
  roleName: null,
  owner: true,
  viewAs: false,
  loading: false,
  can: () => true,
  canSee: () => true,
  reload: async () => undefined,
});

export function useStaffSession(): StaffSessionValue {
  return useContext(StaffSessionCtx);
}

export function StaffSessionProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [staff, setStaff] = useState<StaffSelf | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [owner, setOwner] = useState(true);
  const [viewAs, setViewAs] = useState(false);
  const [actions, setActions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    const r = await staffMe();
    const isOwner = r.owner === true || !r.staff;
    setOwner(isOwner);
    setStaff(r.staff ?? null);
    setViewAs(r.viewAs === true);
    const role: unknown = r.role;
    setRoleName(typeof role === 'string' ? role : (role as { name?: string } | null)?.name ?? null);
    setActions(new Set(r.permissions ?? []));
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch {
        // A staff access cookie lasts 30 minutes; a page opened after that is
        // recoverable from the refresh token before giving up on the session.
        try {
          await staffRefresh();
          if (!cancelled) await load();
        } catch {
          if (!cancelled) {
            setOwner(true);
            setStaff(null);
            setViewAs(false);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, load]);

  /**
   * A staff access cookie expires every 30 minutes, so it is renewed while the
   * tab is open. Without this a doctor's assistant would be signed out mid-shift.
   */
  useEffect(() => {
    if (!enabled || owner) return undefined;
    const t = setInterval(() => {
      void staffRefresh().catch(() => undefined);
    }, 10 * 60_000);
    return () => clearInterval(t);
  }, [enabled, owner]);

  const value = useMemo<StaffSessionValue>(() => ({
    staff,
    roleName,
    owner,
    viewAs,
    loading,
    can: (module, action) => owner || actions.has(`${module}:${action}`),
    canSee: (module) => owner || [...actions].some((a) => a.startsWith(`${module}:`)),
    reload: load,
  }), [staff, roleName, owner, viewAs, loading, actions, load]);

  return <StaffSessionCtx.Provider value={value}>{children}</StaffSessionCtx.Provider>;
}
