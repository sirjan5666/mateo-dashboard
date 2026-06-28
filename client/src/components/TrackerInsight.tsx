import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { getTrackerInsight } from '../api/insights';
import type { InsightStatus, InsightTracker, TrackerInsightResult } from '../api/insights';
import { ApiError } from '../api/client';
import { useLang } from '../i18n/context';
import { Card } from './ui/Card';
import { Skeleton } from './ui/Skeleton';
import { cn } from '../lib/cn';

const DISCLAIMER =
  'mateo.ai shares general guidance, not a diagnosis. For anything that worries you, please see your pediatrician.';

const STATUS: Record<InsightStatus, { label: string; badge: string; dot: string }> = {
  ok: { label: 'Looks on track', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  watch: { label: 'Keep an eye', badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  doctor: { label: "Worth a doctor's view", badge: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
};

type View = 'idle' | 'loading' | 'done' | 'error' | 'disabled';

interface Props {
  babyId: string;
  tracker: InsightTracker;
  /** Whether this tracker has any logged data — gates the (one-time) auto-fetch. */
  hasData: boolean;
  /** Changes when the logged data changes; used to offer a "refresh" after new entries. */
  signature?: string | number;
  className?: string;
}

// "mateo.ai's take" — a small, connected insight card any tracker page can drop in.
// It reads what's logged and says whether it looks on track, plus one suggestion.
export function TrackerInsight({ babyId, tracker, hasData, signature, className }: Props) {
  const { lang } = useLang();
  const [view, setView] = useState<View>('idle');
  const [result, setResult] = useState<TrackerInsightResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedSig, setFetchedSig] = useState<string | number | null>(null);
  const autoTried = useRef(false);
  // Mirror of fetchedSig as a ref so the auto-refetch effect can compare without
  // taking fetchedSig as a dependency (which would cascade off run()'s setState).
  const fetchedSigRef = useRef<string | number | null>(null);

  const run = useCallback(async () => {
    setView('loading');
    setError(null);
    try {
      const r = await getTrackerInsight(babyId, tracker, lang);
      setFetchedSig(signature ?? null);
      fetchedSigRef.current = signature ?? null;
      setResult(r);
      setView(r.enabled ? 'done' : 'disabled');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load a suggestion right now.');
      setView('error');
    }
  }, [babyId, tracker, lang, signature]);

  // Auto-fetch once, as soon as the tracker has data to comment on.
  useEffect(() => {
    if (!hasData || autoTried.current) return;
    autoTried.current = true;
    void run();
  }, [hasData, run]);

  // Re-run automatically when the underlying entries change after the first
  // fetch (e.g. a red-flag entry was deleted): otherwise a stale — possibly
  // emergency — suggestion would linger until a manual refresh. We compare
  // against the ref (not fetchedSig state) so the refetch can't cascade off
  // run()'s own setState; run() resets the ref, so it self-terminates.
  useEffect(() => {
    if (!autoTried.current || !hasData) return;
    const sig = signature ?? null;
    if (sig == null || fetchedSigRef.current == null) return;
    if (sig === fetchedSigRef.current) return;
    void run();
  }, [signature, hasData, run]);

  // Assistant isn't configured server-side → show nothing at all.
  if (view === 'disabled') return null;

  // No data yet: a gentle invitation so the feature is discoverable.
  if (!hasData && view === 'idle') {
    return (
      <Card className={cn('flex items-center gap-3 p-4', className)}>
        <Sparkles className="h-5 w-5 shrink-0" style={{ color: 'var(--cat-assistant)' }} />
        <p className="text-sm text-stone-500">
          Add an entry and <span className="font-semibold text-stone-700">mateo.ai</span> will share a quick suggestion here.
        </p>
      </Card>
    );
  }

  const stale = view === 'done' && signature != null && fetchedSig !== signature;

  return (
    <Card className={cn('overflow-hidden p-0', className)}>
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: 'var(--cat-assistant-bg)' }}>
          <Sparkles className="h-4 w-4" style={{ color: 'var(--cat-assistant-text)' }} />
        </span>
        <h3 className="text-sm font-bold text-stone-800">mateo.ai’s take</h3>
        {view === 'done' && result?.status && (
          <span className={cn('ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', STATUS[result.status].badge)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS[result.status].dot)} />
            {STATUS[result.status].label}
          </span>
        )}
        {(view === 'done' || view === 'error') && (
          <button
            type="button"
            onClick={() => void run()}
            aria-label="Refresh suggestion"
            title="Refresh suggestion"
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600',
              view === 'done' && result?.status ? '' : 'ml-auto',
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="px-4 pb-3 pt-2">
        {view === 'loading' && (
          <div className="space-y-2 py-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        )}

        {view === 'error' && (
          <p className="py-1 text-sm text-stone-500">
            {error} <button onClick={() => void run()} className="font-semibold text-stone-700 underline-offset-2 hover:underline">Try again</button>
          </p>
        )}

        {view === 'done' && result && (
          <>
            {result.observation && <p className="text-sm leading-relaxed text-stone-700">{result.observation}</p>}
            {result.suggestion && (
              <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-stone-800">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--cat-assistant)' }} />
                <span><span className="font-semibold">Suggestion:</span> {result.suggestion}</span>
              </p>
            )}

            {stale && (
              <button
                onClick={() => void run()}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-200"
              >
                <RefreshCw className="h-3 w-3" />
                You’ve logged new entries — refresh
              </button>
            )}

            <p className="mt-3 flex items-start gap-1.5 border-t border-stone-100 pt-2.5 text-[11px] text-stone-500">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
              {DISCLAIMER}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
