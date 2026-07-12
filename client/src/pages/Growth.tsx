import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Activity, ArrowLeft, Info, MessageCircleHeart, Trash2, TrendingUp } from 'lucide-react';
import { gsap, prefersReducedMotion } from '../lib/gsap';
import { addGrowthLog, deleteGrowthLog, getGrowth } from '../api/growth';
import type { Growth, Indicator } from '../api/growth';
import { getJourney, type Journey } from '../api/journey';
import { JourneyNowCard } from '../components/journey/JourneyNowCard';
import { ApiError } from '../api/client';
import { useLang } from '../i18n/context';
import { askAssistantLink } from '../lib/assistant';
import { formatAge, formatDateIST, toDateInputValueIST, todayInputValueIST, correctedAgeLabel } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { DatePicker } from '../components/ui/DatePicker';
import { inputCls } from '../components/ui/field';
import { GrowthChart } from '../components/growth/GrowthChart';
import { TrackerInsight } from '../components/TrackerInsight';
import { MascotHero } from '../components/ui/MascotHero';
import { cn } from '../lib/cn';

const INDICATORS: { key: Indicator; label: string }[] = [
  { key: 'weight', label: 'Weight' },
  { key: 'length', label: 'Length' },
  { key: 'head', label: 'Head' },
];

function ordinal(n: number): string {
  const v = n % 100;
  const s = ['th', 'st', 'nd', 'rd'];
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function metricText(log: { metrics: Growth['logs'][number]['metrics'] }, indicator: Indicator): string | null {
  const m = log.metrics[indicator];
  if (!m) return null;
  const unit = indicator === 'weight' ? 'kg' : 'cm';
  return `${m.value} ${unit} · ${ordinal(Math.max(1, Math.round(m.percentile)))}`;
}

export default function Growth() {
  const { id } = useParams();
  const { lang } = useLang();
  const [data, setData] = useState<Growth | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<Indicator>('weight');

  const [loggedAt, setLoggedAt] = useState(todayInputValueIST());
  const [weightKg, setWeightKg] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [headCm, setHeadCm] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Manual refetch used after add/delete.
  const load = useCallback(async () => {
    if (id === undefined) return;
    try {
      setData(await getGrowth(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    }
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    getGrowth(id)
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

  // Age-driven journey band — best-effort; the chart stands on its own if it fails.
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (id === undefined) return;
    const weightG = weightKg.trim() ? Math.round(parseFloat(weightKg) * 1000) : undefined;
    const lengthVal = lengthCm.trim() ? parseFloat(lengthCm) : undefined;
    const headVal = headCm.trim() ? parseFloat(headCm) : undefined;
    if (weightG === undefined && lengthVal === undefined && headVal === undefined) {
      setFormError('Add at least one measurement (weight, length or head).');
      return;
    }
    setFormError(null);
    setError(null);
    setSaving(true);
    try {
      await addGrowthLog(id, { loggedAt, weightG, lengthCm: lengthVal, headCircCm: headVal });
      setWeightKg('');
      setLengthCm('');
      setHeadCm('');
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(logId: string) {
    if (id === undefined) return;
    setDeletingId(logId);
    try {
      await deleteGrowthLog(id, logId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setDeletingId(null);
    }
  }

  const baby = data?.baby;
  const minDate = baby ? toDateInputValueIST(baby.dob) : undefined;
  const logsDesc = data ? [...data.logs].slice().reverse() : [];

  // Re-reveal the chart on first load and each time the indicator switches.
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chartRef.current;
    if (!el || prefersReducedMotion()) return;
    const tween = gsap.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto', immediateRender: false });
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: 'opacity,transform' });
    };
  }, [indicator, data?.logs.length]);

  // Days that already have a measurement — shown as dots in the date picker.
  const loggedDays = useMemo(() => {
    const map: Record<string, string> = {};
    for (const log of data?.logs ?? []) map[toDateInputValueIST(log.loggedAt)] = 'var(--cat-growth)';
    return map;
  }, [data]);

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: 'var(--cat-growth-bg)' }}>
          <Activity className="h-6 w-6" style={{ color: 'var(--cat-growth-text)' }} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Growth</h1>
          {baby && (
            <p className="text-sm text-stone-500">
              {baby.name} · {formatAge(baby.dob)}
              {correctedAgeLabel(baby.dob, baby.gestationalAgeWeeks) && (
                <span className="ml-1.5 rounded-full bg-violet-50 px-2 py-0.5 text-[11.5px] font-bold text-violet-700">
                  {correctedAgeLabel(baby.dob, baby.gestationalAgeWeeks)}
                </span>
              )}
            </p>
          )}
        </div>
      </header>

      <MascotHero
        className="mt-5"
        mascot="/giraffe-growth.png"
        alt="A friendly giraffe beside a height chart"
        eyebrow="Every centimetre counts"
        eyebrowColor="var(--cat-growth-text)"
        title={baby ? `Watch ${baby.name} grow, week by week` : 'Watch your baby grow, week by week'}
        description="Log weight, length and head size — we’ll plot it against the WHO healthy range so you see the trend, not just a number."
      />

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* Age-driven journey band — the expected growth snapshot for this baby's age,
          so the page shows what to look for, not just a blank form. */}
      {journey && id && (
        <JourneyNowCard
          journey={journey}
          focus="growth"
          accent="growth"
          babyName={baby?.name}
          className="mt-5"
          action={
            <Link
              to={askAssistantLink(id, `We're at the "${journey.current.theme}" stage. Is ${baby?.name ?? 'my baby'}'s growth on track for their age, and what should I watch for?`)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white"
              style={{ background: 'var(--cat-assistant)' }}
            >
              <MessageCircleHeart className="h-4 w-4" /> Ask Dai Maa about this
            </Link>
          }
        />
      )}

      {data === null ? (
        <GrowthSkeleton />
      ) : (
        <>
          {data.insights.length > 0 && (
            <Card className="mt-5 border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Info className="h-4 w-4" />
                A gentle heads-up
              </div>
              <ul className="mt-2 space-y-1.5 text-sm text-stone-700">
                {data.insights.map((ins, i) => (
                  <li key={i}>{ins.message}</li>
                ))}
              </ul>
            </Card>
          )}

          {id && <TrackerInsight babyId={id} tracker="growth" hasData={data.logs.length > 0} signature={data.logs.length} className="mt-5" />}

          <Card className="mt-5 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-bold text-stone-800">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Percentile chart
              </h2>
              <div className="inline-flex rounded-xl bg-stone-100 p-0.5">
                {INDICATORS.map((ind) => (
                  <button
                    key={ind.key}
                    onClick={() => setIndicator(ind.key)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      indicator === ind.key ? 'bg-white text-emerald-700 shadow-soft' : 'text-stone-500 hover:text-stone-700',
                    )}
                  >
                    {ind.label}
                  </button>
                ))}
              </div>
            </div>

            <div ref={chartRef}>
              <GrowthChart bands={data.bands[indicator]} logs={data.logs} indicator={indicator} />
            </div>

            <p className="mt-3 flex items-start gap-2 text-xs text-stone-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Percentiles compare your baby to the WHO healthy reference population — they are not targets.
              A steady curve matters more than any single number. Share any concerns with your pediatrician.
            </p>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-bold text-stone-800">Add a measurement</h2>
              <form onSubmit={handleSubmit} className="mt-3 space-y-3">
                <div>
                  <label htmlFor="loggedAt" className="block text-sm font-medium text-stone-700">
                    Date
                  </label>
                  <DatePicker
                    id="loggedAt"
                    required
                    value={loggedAt}
                    min={minDate}
                    max={todayInputValueIST()}
                    onChange={setLoggedAt}
                    markers={loggedDays}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="weightKg" className="block text-xs text-stone-500">
                      Weight (kg)
                    </label>
                    <input id="weightKg" type="number" step="0.01" min="0" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="lengthCm" className="block text-xs text-stone-500">
                      Length (cm)
                    </label>
                    <input id="lengthCm" type="number" step="0.1" min="0" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="headCm" className="block text-xs text-stone-500">
                      Head (cm)
                    </label>
                    <input id="headCm" type="number" step="0.1" min="0" value={headCm} onChange={(e) => setHeadCm(e.target.value)} className={inputCls} />
                  </div>
                </div>
                {formError && <p className="text-sm text-rose-600">{formError}</p>}
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? 'Saving…' : 'Add measurement'}
                </Button>
              </form>
            </Card>

            <Card className="p-5">
              <h2 className="font-bold text-stone-800">History</h2>
              {logsDesc.length === 0 ? (
                <p className="mt-3 text-sm text-stone-500">No measurements yet. Add your baby’s first one to see their curve.</p>
              ) : (
                <ul className="mt-3 divide-y divide-stone-100">
                  {logsDesc.map((log) => (
                    <li key={log.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-800">{formatDateIST(log.loggedAt)}</p>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-500">
                          {INDICATORS.map((ind) => {
                            const t = metricText(log, ind.key);
                            return t ? <span key={ind.key}>{ind.label}: {t}</span> : null;
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => void handleDelete(log.id)}
                        disabled={deletingId === log.id}
                        aria-label="Delete measurement"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function GrowthSkeleton() {
  return (
    <div className="mt-5 space-y-6">
      <Card className="p-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-72 w-full" />
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <Skeleton className="h-32 w-full" />
        </Card>
        <Card className="p-5">
          <Skeleton className="h-32 w-full" />
        </Card>
      </div>
    </div>
  );
}
