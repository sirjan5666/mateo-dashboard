import { Navigate, Outlet, useLocation } from 'react-router';
import { useSubscribed } from '../../lib/subscription';

/**
 * Layout route around the paid features (trackers, Dai Maa, report). Unsubscribed
 * parents are sent to the subscribe page; everyone else falls through. The
 * server independently 402s the underlying APIs, so this is UX, not security.
 */
export function RequireSubscribed() {
  const subscribed = useSubscribed();
  const location = useLocation();
  if (!subscribed) return <Navigate to="/subscribe" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
