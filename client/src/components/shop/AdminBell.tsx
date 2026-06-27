import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bell } from 'lucide-react';
import { adminListNotifications } from '../../api/shop';

// Admin-only: a small new-order indicator in the topbar. Polls once on mount.
export function AdminBell() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let cancelled = false;
    adminListNotifications()
      .then((d) => !cancelled && setUnread(d.unread))
      .catch(() => {
        /* ignore — bell just shows no badge */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Link
      to="/shop/admin/orders"
      aria-label={unread > 0 ? `Shop orders, ${unread} new` : 'Shop orders'}
      title="Shop orders"
      className="relative grid h-9 w-9 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-100"
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[0.6rem] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
