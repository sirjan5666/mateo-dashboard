import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Check, ShieldCheck, Star } from 'lucide-react';
import { listMilestones, markMilestone, unmarkMilestone } from '../api/milestones';
import type { MilestoneItem, MilestoneStatus, MilestonesResponse } from '../api/milestones';
import { ApiError } from '../api/client';
import { formatDateIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Pill } from '../components/ui/Pill';
import { Skeleton } from '../components/ui/Skeleton';
import type { Tone } from '../components/ui/tones';
import { TrackerInsight } from '../components/TrackerInsight';
import { MascotHero } from '../components/ui/MascotHero';
import { cn } from '../lib/cn';
import { useScrollReveal, celebrate } from '../lib/gsap';

const STATUS: Record<MilestoneStatus, { tone: Tone; label: string }> = {
  achieved: { tone: 'emerald', label: 'Reached' },
  inwindow: { tone: 'sky', label: 'Right on track' },
  upcoming: { tone: 'stone', label: 'Coming up' },
  watch: { tone: 'amber', label: 'Worth a mention' },
};

const DOMAIN_LABEL: Record<string, string> = { motor: 'Movement', social: 'Social', language: 'Language' };

function windowText(start: number, end: number): string {
  return `typically ${Math.round(start)}–${Math.round(end)} months`;
}

export default function Milestones() {
  const { id } = useParams();
  const [data, setData] = useState<MilestonesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (id === undefined) return;
    setData(await listMilestones(id));
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    listMilestones(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function toggle(m: MilestoneItem, el?: HTMLElement) {
    if (id === undefined) return;
    setPendingId(m.id);
    setError(null);
    // Reaching a milestone is worth celebrating; do it on the way up only.
    if (!m.achieved) celebrate(el ?? null);
    try {
      if (m.achieved) await unmarkMilestone(id, m.id);
      else await markMilestone(id, m.id, todayInputValueIST());
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setPendingId(null);
    }
  }

  const items = data?.milestones ?? null;
  const summary = data?.summary ?? null;
  const pct = summary && summary.total > 0 ? Math.round((summary.achieved / summary.total) * 100) : 0;

  const pageRef = useScrollReveal<HTMLDivElement>([items]);

  return (
    <div ref={pageRef}>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: 'var(--cat-milestone-bg)' }}>
          <Star className="h-6 w-6" style={{ color: 'var(--cat-milestone-text)' }} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Milestones</h1>
          <p className="text-sm text-stone-500">Celebrate each new step, at your baby&apos;s own pace</p>
        </div>
      </header>

      <MascotHero
        className="mt-5"
        mascot="/lion-milestones.png"
        alt="A little lion holding a gold medal"
        eyebrow="Every first counts"
        eyebrowColor="var(--cat-milestone-text)"
        title="Cheering on every step"
        description="Tick off each new skill as it comes. These are typical ranges, never a race — every baby grows at their own pace."
      />

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* Progress */}
      <div className="mt-5">
        {summary === null ? (
          <Card className="p-5"><Skeleton className="h-16 w-full" /></Card>
        ) : (
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-stone-800">{summary.achieved} of {summary.total} reached</h2>
              {summary.watch > 0 && <Pill tone="amber">{summary.watch} worth a mention</Pill>}
            </div>
            <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--secondary)' }}>
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, backgroundColor: 'var(--cat-milestone)' }} />
            </div>
          </Card>
        )}
      </div>

      {id && items !== null && <TrackerInsight babyId={id} tracker="milestones" hasData={items.length > 0} signature={summary?.achieved} className="mt-5" />}

      {/* List */}
      <div className="mt-5">
        {items === null ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>
            ))}
          </div>
        ) : (
          <ol className="space-y-3">
            {items.map((m) => {
              const cfg = STATUS[m.status];
              const pending = pendingId === m.id;
              return (
                <li key={m.id} data-reveal="">
                  <Card className={cn('flex items-start gap-3 p-4 transition-colors', m.achieved && 'bg-[var(--cat-milestone-bg)]')}>
                    <button
                      type="button"
                      onClick={(e) => void toggle(m, e.currentTarget)}
                      disabled={pending}
                      aria-pressed={m.achieved}
                      aria-label={m.achieved ? `Mark ${m.label} as not yet reached` : `Mark ${m.label} as reached`}
                      className={cn(
                        'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-50',
                        m.achieved ? 'border-transparent text-white' : 'border-stone-300 text-transparent hover:border-stone-400',
                      )}
                      style={m.achieved ? { backgroundColor: 'var(--cat-milestone)' } : undefined}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-stone-800">{m.label}</span>
                        <Pill tone={cfg.tone}>{cfg.label}</Pill>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{DOMAIN_LABEL[m.domain]}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-stone-600">{m.description}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {windowText(m.windowStartMonth, m.windowEndMonth)}
                        {m.achieved && m.achievedOn && <> · reached {formatDateIST(m.achievedOn)}</>}
                        {m.source === 'WHO' && <span className="ml-1 text-stone-400">· WHO</span>}
                      </p>
                      {m.status === 'watch' && !m.achieved && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Most babies reach this by now. Every baby is different — but it&apos;s worth a gentle mention to your pediatrician.
                        </p>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-stone-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Every baby develops at their own pace — these are typical ranges, not a test or a diagnosis. If anything worries you, your
        pediatrician is the right person to ask.
      </p>
    </div>
  );
}
