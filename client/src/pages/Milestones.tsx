import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  Flag,
  Footprints,
  Lock,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { listMilestones, markMilestone, unmarkMilestone } from '../api/milestones';
import type { MilestoneDomain, MilestoneItem, MilestoneStatus, MilestonesResponse } from '../api/milestones';
import { getBaby } from '../api/babies';
import type { Baby } from '../api/babies';
import { getJourney, type Journey } from '../api/journey';
import { JourneyNowCard } from '../components/journey/JourneyNowCard';
import { ApiError } from '../api/client';
import { useLang } from '../i18n/context';
import { askAssistantLink } from '../lib/assistant';
import { formatAge, formatDateIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Pill } from '../components/ui/Pill';
import { Skeleton } from '../components/ui/Skeleton';
import { ProgressRing } from '../components/ui/ProgressRing';
import type { Tone } from '../components/ui/tones';
import { TrackerInsight } from '../components/TrackerInsight';
import { MascotHero } from '../components/ui/MascotHero';
import { cn } from '../lib/cn';
import { useScrollReveal, celebrate } from '../lib/gsap';

// A real photo for each milestone that has one (7 of the 8); "babbling" has no
// true photo and falls back to a domain-tinted emoji tile. Each photo genuinely
// depicts its own milestone — never a stand-in.
const MILESTONE_PHOTO: Record<string, string> = {
  social_smile: '/milestones/social_smile.jpg',
  rolling: '/milestones/rolling.jpg',
  sitting: '/milestones/sitting.jpg',
  crawling: '/milestones/crawling.jpg',
  standing_alone: '/milestones/standing_alone.jpg',
  first_words: '/milestones/first_words.jpg',
  walking_alone: '/milestones/walking_alone.jpg',
};

const DOMAIN: Record<MilestoneDomain, { label: string; emoji: string; dot: string; bar: string; tint: string; pill: string }> = {
  motor: { label: 'Movement', emoji: '🤸', dot: '#25c281', bar: 'linear-gradient(90deg,#5fd0a6,#25c281)', tint: 'linear-gradient(180deg,#eafaf2,#fff)', pill: 'bg-emerald-50 text-emerald-700' },
  social: { label: 'Social', emoji: '😊', dot: '#ff8fb1', bar: 'linear-gradient(90deg,#ffb3cd,#ff6f9c)', tint: 'linear-gradient(180deg,#ffeff5,#fff)', pill: 'bg-pink-50 text-pink-700' },
  language: { label: 'Language', emoji: '💬', dot: '#6c8bff', bar: 'linear-gradient(90deg,#9db4ff,#4d8cff)', tint: 'linear-gradient(180deg,#eef3ff,#fff)', pill: 'bg-blue-50 text-blue-700' },
};

const STATUS: Record<MilestoneStatus, { tone: Tone; label: string }> = {
  achieved: { tone: 'emerald', label: 'Reached' },
  inwindow: { tone: 'sky', label: 'Right on track' },
  upcoming: { tone: 'stone', label: 'Coming up' },
  watch: { tone: 'amber', label: 'Worth a mention' },
};

function windowText(start: number, end: number): string {
  return `typically ${Math.round(start)}–${Math.round(end)} months`;
}

type DomainFilter = 'all' | MilestoneDomain;

export default function Milestones() {
  const { id } = useParams();
  const { lang } = useLang();
  const [baby, setBaby] = useState<Baby | null>(null);
  const [data, setData] = useState<MilestonesResponse | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DomainFilter>('all');

  const load = useCallback(async () => {
    if (id === undefined) return;
    setData(await listMilestones(id));
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([getBaby(id), listMilestones(id)])
      .then(([b, d]) => {
        if (cancelled) return;
        setBaby(b.baby);
        setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // The age-driven journey band — best-effort; the checklist stands on its own if it fails.
  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    getJourney(id, lang)
      .then((j) => {
        if (!cancelled) setJourney(j);
      })
      .catch(() => {
        /* non-fatal — just hide the band */
      });
    return () => {
      cancelled = true;
    };
  }, [id, lang]);

  async function toggle(m: MilestoneItem, el?: HTMLElement) {
    if (id === undefined) return;
    setPendingId(m.id);
    setError(null);
    if (!m.achieved) celebrate(el ?? null); // celebrate on the way up only
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

  const ordered = items ? [...items].sort((a, b) => a.windowStartMonth - b.windowStartMonth) : [];
  const counts = {
    achieved: summary?.achieved ?? 0,
    inwindow: (items ?? []).filter((m) => m.status === 'inwindow').length,
    upcoming: (items ?? []).filter((m) => m.status === 'upcoming').length,
    watch: summary?.watch ?? 0,
  };
  const nextUp =
    ordered.find((m) => !m.achieved && m.status === 'inwindow') ??
    ordered.find((m) => !m.achieved && m.status === 'upcoming') ??
    ordered.find((m) => !m.achieved) ??
    null;
  const recent = (items ?? [])
    .filter((m) => m.achieved && m.achievedOn)
    .sort((a, b) => (b.achievedOn ?? '').localeCompare(a.achievedOn ?? ''))
    .slice(0, 4);
  const cards = filter === 'all' ? ordered : ordered.filter((m) => m.domain === filter);

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
          <h1 className="text-2xl font-extrabold text-stone-900">Baby Milestone Tracker</h1>
          <p className="text-sm text-stone-500">{baby ? `${baby.name} · ${formatAge(baby.dob)}` : 'Celebrate every little first'}</p>
        </div>
      </header>

      <MascotHero
        className="mt-5"
        mascot="/milestones/hero.png"
        alt="A happy baby learning to stand"
        eyebrow="Every first counts"
        eyebrowColor="var(--cat-milestone-text)"
        title="Cheering on every step"
        description="Tick off each new skill as it comes. These are typical ranges, never a race — every baby grows at their own pace."
      />

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* Age-driven journey band — this month's developmental checkpoint. */}
      {journey && id && (
        <JourneyNowCard
          journey={journey}
          focus="milestone"
          accent="milestone"
          className="mt-5"
          action={
            <Link
              to={askAssistantLink(
                id,
                `We're around the "${journey.milestoneCheck.current?.theme ?? journey.current.theme}" stage. What should I look for now, and when is it worth talking to a doctor?`,
              )}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white"
              style={{ background: 'var(--cat-assistant)' }}
            >
              <MessageCircleHeart className="h-4 w-4" /> Ask Dai Maa about this
            </Link>
          }
        />
      )}

      {items === null || summary === null ? (
        <MilestonesSkeleton />
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* ── Main column ── */}
          <div className="min-w-0 space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-reveal="">
              <SummaryCard tone="emerald" icon={Trophy} value={counts.achieved} label="Reached" hint={`${pct}% of ${summary.total}`} />
              <SummaryCard tone="sky" icon={Sparkles} value={counts.inwindow} label="Right on track" hint="In their window now" />
              <SummaryCard tone="violet" icon={CalendarClock} value={counts.upcoming} label="Coming up" hint="Still ahead" />
              <SummaryCard tone="amber" icon={Flag} value={counts.watch} label="Worth a mention" hint={counts.watch > 0 ? 'Ask your pediatrician' : 'All on track'} />
            </div>

            {id && (
              <Link
                to={askAssistantLink(id, `What developmental milestones should I expect around my baby's age, and how can I gently encourage them?`)}
                className="inline-flex items-center gap-1.5 text-sm font-bold"
                style={{ color: 'var(--cat-assistant)' }}
              >
                <MessageCircleHeart className="h-4 w-4" /> Milestone questions? Ask Dai Maa
              </Link>
            )}

            {id && <TrackerInsight babyId={id} tracker="milestones" hasData={items.length > 0} signature={summary.achieved} />}

            {/* Timeline — the whole journey, in age order */}
            <Card className="p-5" data-reveal="">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="font-bold text-stone-800">Milestone timeline</h2>
                  <p className="text-xs text-stone-500">Every step, from first smile to first steps</p>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">birth → ~18 months</span>
              </div>
              <div className="-mx-1 overflow-x-auto pb-1">
                <ol className="flex min-w-max gap-1 px-1">
                  {ordered.map((m, i) => (
                    <TimelineNode key={m.id} m={m} last={i === ordered.length - 1} />
                  ))}
                </ol>
              </div>
            </Card>

            {/* Domain filter */}
            <div className="flex flex-wrap items-center gap-2" data-reveal="">
              {(['all', 'motor', 'social', 'language'] as DomainFilter[]).map((key) => {
                const count = key === 'all' ? ordered.length : ordered.filter((m) => m.domain === key).length;
                if (count === 0) return null;
                const active = filter === key;
                const label = key === 'all' ? 'All' : DOMAIN[key].label;
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
                      active ? 'text-white shadow-sm' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100',
                    )}
                    style={active ? { backgroundColor: 'var(--cat-milestone-text)' } : undefined}
                  >
                    {key !== 'all' && <span aria-hidden>{DOMAIN[key as MilestoneDomain].emoji}</span>}
                    {label}
                    <span className={cn('text-xs font-bold', active ? 'text-white/80' : 'text-stone-400')}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Milestone cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-reveal="">
              {cards.map((m) => (
                <MilestoneCard key={m.id} m={m} pending={pendingId === m.id} onToggle={toggle} showAsk={Boolean(id)} askHref={id ? askAssistantLink(id, `My baby hasn't reached "${m.label}" yet. Is that okay at their age, and what can I do to gently help?`) : '#'} />
              ))}
            </div>
          </div>

          {/* ── Right rail ── */}
          <aside className="space-y-5 lg:sticky lg:top-6">
            <ProgressCard pct={pct} summary={summary} items={items} />
            {nextUp && <NextMilestoneCard m={nextUp} askHref={id ? askAssistantLink(id, `What can I do to gently encourage my baby toward "${nextUp.label}"?`) : '#'} />}
            <RecentCard recent={recent} />
            <TipsCard />
          </aside>
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs text-stone-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Every baby develops at their own pace — these are typical ranges, not a test or a diagnosis. If anything worries you, your
        pediatrician is the right person to ask.
      </p>
    </div>
  );
}

/* ── KPI card ─────────────────────────────────────────────────────────── */

const KPI_TONES = {
  emerald: { chip: 'bg-emerald-100 text-emerald-700', tint: '#e8f8f0' },
  sky: { chip: 'bg-sky-100 text-sky-700', tint: '#e8f2ff' },
  violet: { chip: 'bg-violet-100 text-violet-700', tint: '#f1e9ff' },
  amber: { chip: 'bg-amber-100 text-amber-700', tint: '#fff3d6' },
} as const;

function SummaryCard({ tone, icon: Icon, value, label, hint }: { tone: keyof typeof KPI_TONES; icon: LucideIcon; value: number; label: string; hint: string }) {
  const t = KPI_TONES[tone];
  return (
    <Card className="pop-hover p-4" style={{ background: `linear-gradient(135deg, ${t.tint} 0%, var(--surface-card) 72%)` }}>
      <span className={cn('grid h-9 w-9 place-items-center rounded-xl', t.chip)}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 display-num text-3xl font-bold text-stone-900">{value}</p>
      <p className="text-sm font-semibold text-stone-700">{label}</p>
      <p className="mt-0.5 truncate text-xs text-stone-500">{hint}</p>
    </Card>
  );
}

/* ── photo / emoji tile ───────────────────────────────────────────────── */

// Photos are pre-normalized to a square canvas with the baby trimmed + centered
// (~92%), so object-cover on any square/circular frame shows the whole baby with
// no awkward cropping. "babbles" has no photo → a domain-tinted emoji tile.
function MilestonePhoto({ m, className, objectPos = 'center' }: { m: MilestoneItem; className?: string; objectPos?: string }) {
  const src = MILESTONE_PHOTO[m.id];
  const d = DOMAIN[m.domain];
  if (src) {
    return (
      <div className={cn('overflow-hidden bg-white', className)}>
        <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: objectPos }} loading="lazy" />
      </div>
    );
  }
  return (
    <div className={cn('grid place-items-center', className)} style={{ background: d.tint }}>
      <span className="text-4xl" aria-hidden>
        {d.emoji}
      </span>
    </div>
  );
}

/* ── timeline node ────────────────────────────────────────────────────── */

function TimelineNode({ m, last }: { m: MilestoneItem; last: boolean }) {
  const achieved = m.status === 'achieved';
  const current = m.status === 'inwindow';
  return (
    <li className="relative flex w-[92px] shrink-0 flex-col items-center text-center">
      {/* connector */}
      {!last && <span aria-hidden className="absolute left-1/2 top-8 h-[3px] w-full" style={{ background: achieved ? '#25c281' : '#ece7f5' }} />}
      <span
        className="relative z-10 grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-white"
        style={{
          border: `3px solid ${achieved ? '#25c281' : current ? 'var(--cat-milestone)' : '#ece7f5'}`,
          boxShadow: current ? '0 0 0 5px rgba(255,201,60,.18)' : undefined,
        }}
      >
        <MilestonePhoto m={m} className="h-full w-full" objectPos="center 14%" />
        {achieved && (
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
        {!achieved && !current && (
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-stone-300 text-white ring-2 ring-white">
            <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
          </span>
        )}
      </span>
      <span className={cn('mt-2 text-[11.5px] font-bold leading-tight', current ? 'text-[color:var(--cat-milestone-text)]' : 'text-stone-700')}>{m.label}</span>
      <span className="text-[10.5px] font-medium text-stone-400">{Math.round(m.windowStartMonth)}–{Math.round(m.windowEndMonth)} mo</span>
      {current && <span className="mt-1 rounded-full bg-[color:var(--cat-milestone-bg)] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[color:var(--cat-milestone-text)]">Now</span>}
    </li>
  );
}

/* ── milestone card (with the mark/unmark toggle preserved) ───────────── */

function MilestoneCard({ m, pending, onToggle, showAsk, askHref }: { m: MilestoneItem; pending: boolean; onToggle: (m: MilestoneItem, el?: HTMLElement) => void; showAsk: boolean; askHref: string }) {
  const d = DOMAIN[m.domain];
  const cfg = STATUS[m.status];
  return (
    <Card className={cn('flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-md', m.achieved && 'ring-1 ring-emerald-200')}>
      <div className="relative">
        <MilestonePhoto m={m} className="aspect-square" />
        <span className={cn('absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold', d.pill)}>{d.label}</span>
        <span className="absolute right-2.5 top-2.5">
          <Pill tone={cfg.tone}>{cfg.label}</Pill>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold text-stone-800">{m.label}</h3>
        <p className="mt-0.5 text-[11.5px] font-bold" style={{ color: 'var(--cat-milestone-text)' }}>{windowText(m.windowStartMonth, m.windowEndMonth)}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{m.description}</p>

        {m.status === 'watch' && !m.achieved && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Most babies reach this by now. Every baby is different — but it&apos;s worth a gentle mention to your pediatrician.
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-3">
          <button
            type="button"
            onClick={(e) => onToggle(m, e.currentTarget)}
            disabled={pending}
            aria-pressed={m.achieved}
            aria-label={m.achieved ? `Mark ${m.label} as not yet reached` : `Mark ${m.label} as reached`}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors disabled:opacity-50',
              m.achieved ? 'text-white' : 'text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50',
            )}
            style={m.achieved ? { backgroundColor: 'var(--cat-milestone-text)' } : undefined}
          >
            {m.achieved ? (
              <>
                <Check className="h-4 w-4" strokeWidth={3} /> Reached{m.achievedOn ? ` · ${formatDateIST(m.achievedOn)}` : ''}
              </>
            ) : (
              'Mark as reached'
            )}
          </button>
          {showAsk && !m.achieved && (m.status === 'inwindow' || m.status === 'watch') && (
            <Link
              to={askHref}
              aria-label={`Ask Dai Maa about ${m.label}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-stone-200 hover:bg-stone-50"
              style={{ color: 'var(--cat-assistant)' }}
            >
              <MessageCircleHeart className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ── rail: progress ring + per-domain breakdown ───────────────────────── */

function ProgressCard({ pct, summary, items }: { pct: number; summary: { achieved: number; total: number }; items: MilestoneItem[] }) {
  const domains: MilestoneDomain[] = ['motor', 'social', 'language'];
  return (
    <Card className="p-5">
      <div className="flex flex-col items-center text-center">
        <ProgressRing value={pct} size={140} stroke={13} trackClass="text-amber-100" barClass="text-amber-400">
          <span className="display-num text-3xl font-bold text-stone-900">{pct}%</span>
          <span className="text-[11px] font-semibold text-stone-500">reached</span>
        </ProgressRing>
        <p className="mt-2 text-sm font-semibold text-stone-700">{summary.achieved} of {summary.total} milestones</p>
      </div>
      <div className="mt-5 space-y-3.5">
        {domains.map((dk) => {
          const d = DOMAIN[dk];
          const total = items.filter((m) => m.domain === dk).length;
          const done = items.filter((m) => m.domain === dk && m.achieved).length;
          const w = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <div key={dk}>
              <div className="mb-1 flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-semibold text-stone-700">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.dot }} /> {d.label}
                </span>
                <span className="text-xs font-bold text-stone-500">{done}/{total}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${w}%`, background: d.bar }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── rail: next milestone ─────────────────────────────────────────────── */

function NextMilestoneCard({ m, askHref }: { m: MilestoneItem; askHref: string }) {
  return (
    <Card className="overflow-hidden p-0">
      <MilestonePhoto m={m} className="aspect-square" />
      <div className="p-4">
        <span className="eyebrow" style={{ color: 'var(--cat-milestone-text)' }}>Next up</span>
        <h3 className="mt-1 text-lg font-bold text-stone-800">{m.label}</h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">{m.description}</p>
        <div className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold" style={{ background: 'var(--cat-milestone-bg)', color: 'var(--cat-milestone-text)' }}>
          <CalendarClock className="h-4 w-4" /> {windowText(m.windowStartMonth, m.windowEndMonth)}
        </div>
        <Link to={askHref} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold text-white" style={{ background: 'var(--cat-assistant)' }}>
          <MessageCircleHeart className="h-4 w-4" /> Ways to encourage it
        </Link>
      </div>
    </Card>
  );
}

/* ── rail: recent achievements ────────────────────────────────────────── */

function RecentCard({ recent }: { recent: MilestoneItem[] }) {
  if (recent.length === 0) return null;
  return (
    <Card className="p-5">
      <h3 className="mb-3 font-bold text-stone-800">Recent wins 🎉</h3>
      <ul className="space-y-2.5">
        {recent.map((m) => (
          <li key={m.id} className="flex items-center gap-3">
            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-stone-100">
              <MilestonePhoto m={m} className="h-full w-full" objectPos="center 12%" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-stone-800">{m.label}</span>
              {m.achievedOn && <span className="text-xs text-stone-500">Reached {formatDateIST(m.achievedOn)}</span>}
            </span>
            <Check className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={3} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── rail: gentle stage tips ──────────────────────────────────────────── */

const TIPS = ['Give plenty of floor & tummy time', 'Talk, read and sing through the day', 'Offer safe things to reach and explore', 'Celebrate every little try, not just the win'];

function TipsCard() {
  return (
    <Card className="p-5">
      <h3 className="mb-3 flex items-center gap-2 font-bold text-stone-800">
        <Footprints className="h-4 w-4" style={{ color: 'var(--cat-milestone-text)' }} /> Ways to help
      </h3>
      <ul className="space-y-2.5">
        {TIPS.map((t) => (
          <li key={t} className="flex items-start gap-2.5 text-[13px] font-medium leading-snug text-stone-600">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-600">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {t}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-stone-400">
        <ChevronRight className="h-3 w-3" /> General guidance — never a substitute for your pediatrician.
      </p>
    </Card>
  );
}

/* ── loading ──────────────────────────────────────────────────────────── */

function MilestonesSkeleton() {
  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-20 w-full" /></Card>
          ))}
        </div>
        <Card className="p-5"><Skeleton className="h-24 w-full" /></Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-0"><Skeleton className="h-64 w-full" /></Card>
          ))}
        </div>
      </div>
      <div className="space-y-5">
        <Card className="p-5"><Skeleton className="h-56 w-full" /></Card>
        <Card className="p-5"><Skeleton className="h-40 w-full" /></Card>
      </div>
    </div>
  );
}
