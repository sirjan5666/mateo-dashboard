import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { listBabies, type Baby } from '../api/babies';
import { rememberActiveBaby, useActiveBabyId } from './activeBaby';

// A tiny shared cache so the several mobile surfaces that need the baby list
// (Home header, baby switcher, Trackers hub) don't each fire their own request
// on mount. Revalidates in the background; `invalidateBabies()` forces a refetch
// after an add/edit/delete.
let cache: Baby[] | null = null;
let inflight: Promise<Baby[]> | null = null;
const subscribers = new Set<(b: Baby[]) => void>();

function fetchBabies(): Promise<Baby[]> {
  if (!inflight) {
    inflight = listBabies()
      .then((d) => {
        cache = d.babies;
        for (const s of subscribers) s(d.babies);
        return d.babies;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drop the cache and refetch — call after a baby is added, edited or removed. */
export function invalidateBabies(): void {
  cache = null;
  void fetchBabies();
}

export interface UseBabies {
  babies: Baby[];
  loading: boolean;
  error: boolean;
  activeBabyId: string | null;
  activeBaby: Baby | null;
  selectBaby: (id: string) => void;
  refresh: () => void;
}

export function useBabies(): UseBabies {
  const [babies, setBabies] = useState<Baby[]>(() => cache ?? []);
  const [loading, setLoading] = useState(cache == null);
  const [error, setError] = useState(false);
  const persistedId = useActiveBabyId();
  const location = useLocation();
  const navigate = useNavigate();
  // When you're viewing a specific baby's tracker (/babies/:id/:seg), that baby
  // IS the context — the header must match the page, mirroring the Sidebar.
  const routeMatch = /^\/babies\/([^/]+)\/([^/]+)/.exec(location.pathname);
  const routeBabyId = routeMatch?.[1] ?? null;
  const routeSeg = routeMatch?.[2] ?? null;

  useEffect(() => {
    subscribers.add(setBabies);
    let cancelled = false;
    // loading/error are seeded from the cache in the useState initializers; the
    // fetch resolves them asynchronously (never a synchronous setState here).
    fetchBabies()
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      subscribers.delete(setBabies);
    };
  }, []);

  // Resolve the active baby, in priority order (mirrors the Sidebar): the baby in
  // the current tracker URL, then the persisted choice, then the first baby.
  const activeBabyId =
    (routeBabyId && babies.some((b) => b.id === routeBabyId)
      ? routeBabyId
      : persistedId && babies.some((b) => b.id === persistedId)
        ? persistedId
        : babies[0]?.id) ?? null;
  const activeBaby = babies.find((b) => b.id === activeBabyId) ?? null;

  // Remember the choice; and when switching from inside a tracker page, take the
  // new baby to the SAME tracker so the context follows you.
  const selectBaby = useCallback(
    (id: string) => {
      rememberActiveBaby(id);
      if (routeBabyId && routeSeg && routeBabyId !== id) {
        navigate(`/babies/${id}/${routeSeg}`);
      }
    },
    [routeBabyId, routeSeg, navigate],
  );
  const refresh = useCallback(() => invalidateBabies(), []);

  return { babies, loading, error, activeBabyId, activeBaby, selectBaby, refresh };
}
