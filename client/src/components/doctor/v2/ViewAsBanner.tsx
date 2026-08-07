import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { useStaffSession } from '../../../auth/staffSession';
import { stopViewAs } from '../../../api/staffAuth';

/**
 * Shown while the practice owner is viewing the panel as one of their staff.
 *
 * It is deliberately loud and always present: the whole point of "view as" is
 * that the panel looks like someone else's, so the only thing stopping a doctor
 * from misreading their own clinic is this bar. It reuses the admin banner's
 * `is-impersonating` body class, which every shell already reserves space for.
 */
export function ViewAsBanner() {
  const { staff, roleName, viewAs } = useStaffSession();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('is-impersonating', viewAs);
    return () => document.body.classList.remove('is-impersonating');
  }, [viewAs]);

  if (!viewAs || !staff) return null;

  async function back() {
    setBusy(true);
    try {
      await stopViewAs();
      // A full reload, not a route change: every page in the panel was rendered
      // against the staff member's permissions and has to be built again.
      window.location.assign('/doctor/team');
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      className="no-print fixed inset-x-0 top-0 z-[100] flex h-11 items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-medium text-white shadow-md lg:px-6"
    >
      <Eye aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="truncate">
        Viewing the panel as <strong className="font-bold">{staff.name}</strong>
        <span className="hidden text-white/80 sm:inline"> · {roleName ?? 'Staff'} — you are still signed in as the owner</span>
      </span>
      <button
        type="button"
        onClick={() => void back()}
        disabled={busy}
        className="ml-auto shrink-0 rounded-lg bg-white/25 px-3 py-1 text-xs font-bold transition-colors hover:bg-white/40 disabled:opacity-50"
      >
        {busy ? '…' : 'Back to my account'}
      </button>
    </div>
  );
}
