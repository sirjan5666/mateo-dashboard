import { useAuth } from '../auth/context';

/**
 * Paid-plan state for the signed-in user. Server-computed (`user.subscribed`
 * from /auth/me); `undefined` reads as subscribed to match the server's
 * grandfather rule, so only an explicit `false` locks anything. The server
 * enforces the plan separately (402 subscription_required) — this hook only
 * drives what the UI shows.
 */
export function useSubscribed(): boolean {
  const { user } = useAuth();
  return user?.subscribed !== false;
}
