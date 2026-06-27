import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye } from 'lucide-react';
import { useAuth } from '../auth/context';

// Full-width bar pinned to the very top while an admin is impersonating a user,
// with a one-click return to the admin's own session. It spans above the panel
// sidebar/topbar; the shells reserve `--imp-bar-h` of space (toggled via the
// `is-impersonating` body class) so nothing is hidden behind it.
export function ImpersonationBanner() {
  const { user, stopImpersonating } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const active = !!user?.impersonating;

  // Reserve top space app-wide (and free it on exit) only while impersonating.
  useEffect(() => {
    document.body.classList.toggle('is-impersonating', active);
    return () => document.body.classList.remove('is-impersonating');
  }, [active]);

  if (!active) return null;

  async function back() {
    setBusy(true);
    try {
      await stopImpersonating();
      navigate('/', { replace: true }); // admin's own home is the dashboard; there's no /admin route
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] flex h-11 items-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-sm font-medium text-white shadow-md lg:px-6"
      role="status"
    >
      <Eye className="h-4 w-4 shrink-0" />
      <span className="truncate">
        Viewing as <strong className="font-bold">{user.name}</strong>
        <span className="hidden text-white/80 sm:inline"> · signed in as Admin</span>
      </span>
      <button
        type="button"
        onClick={() => void back()}
        disabled={busy}
        className="ml-auto shrink-0 rounded-lg bg-white/25 px-3 py-1 text-xs font-bold transition-colors hover:bg-white/40 disabled:opacity-50"
      >
        {busy ? '…' : 'Return to admin'}
      </button>
    </div>
  );
}
