import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, MessageCircleHeart, Moon, ShieldCheck, Sun, Trash2 } from 'lucide-react';
import { askAssistantLink } from '../lib/assistant';
import { addSleep, deleteSleep, formatDuration, listSleep } from '../api/sleep';
import type { SleepKind, SleepQuality, SleepResponse } from '../api/sleep';
import { ApiError } from '../api/client';
import { formatDateIST, toDateInputValueIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';
import { TrackerInsight } from '../components/TrackerInsight';
import { MascotHero } from '../components/ui/MascotHero';
import { Skeleton } from '../components/ui/Skeleton';
import { DatePicker } from '../components/ui/DatePicker';
import { inputCls } from '../components/ui/field';
import type { Tone } from '../components/ui/tones';
import { cn } from '../lib/cn';
import { useScrollReveal } from '../lib/gsap';

const KINDS: { value: SleepKind; label: string }[] = [
  { value: 'night', label: 'Night sleep' },
  { value: 'nap', label: 'Nap' },
];
const QUALITIES: { value: SleepQuality; label: string }[] = [
  { value: 'settled', label: 'Settled' },
  { value: 'restless', label: 'Restless' },
  { value: 'unsettled', label: 'Woke often' },
];
const QUALITY_TONE: Record<SleepQuality, Tone> = { settled: 'emerald', restless: 'amber', unsettled: 'rose' };
const QUALITY_LABEL: Record<SleepQuality, string> = { settled: 'Settled', restless: 'Restless', unsettled: 'Woke often' };

function Segmented<T extends string>({
  options,
  value,
  onChange,
  labelId,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  labelId?: string;
}) {
  return (
    <div role="group" aria-labelledby={labelId} className="mt-1 inline-flex flex-wrap gap-0.5 rounded-xl bg-stone-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            value === o.value ? 'bg-white text-stone-900 shadow-soft' : 'text-stone-500 hover:text-stone-700',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// The typical-sleep-for-age band + a gentle read on how logging compares. Never a
// target: outside the range is framed calmly, with a nudge to a pediatrician only
// if it feels off (CLAUDE.md — patterns, not pressure).
function ExpectedSleepCard({ reference, avgMinutes }: { reference: NonNullable<SleepResponse['reference']>; avgMinutes: number }) {
  const minMin = reference.minHours * 60;
  const maxMin = reference.maxHours * 60;
  const hasAvg = avgMinutes > 0;
  const status: 'in' | 'under' | 'over' | 'none' = !hasAvg ? 'none' : avgMinutes < minMin ? 'under' : avgMinutes > maxMin ? 'over' : 'in';

  const line: Record<typeof status, string> = {
    none: 'Log a nap or a night to see how your baby compares to what’s typical.',
    in: `Based on what you’ve logged (${formatDuration(avgMinutes)}/day), ${reference.label.toLowerCase()} sleep is right in the typical range. 🌙`,
    under: `You’ve logged about ${formatDuration(avgMinutes)}/day, a little under the typical range. Every baby is different — if it feels off, mention it to your pediatrician.`,
    over: `You’ve logged about ${formatDuration(avgMinutes)}/day, a touch over the typical range — often just a growth spurt or busy days.`,
  };

  return (
    <Card className="mt-4 p-5" style={{ backgroundColor: 'var(--cat-sleep-bg)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Moon className="h-5 w-5" style={{ color: 'var(--cat-sleep-text)' }} />
          <h2 className="font-bold text-stone-900">Typical sleep now · {reference.label}</h2>
        </div>
        <Pill tone="violet">{reference.minHours}–{reference.maxHours} h a day</Pill>
      </div>
      <p className="mt-2 text-sm text-stone-700">{reference.note}</p>
      <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-stone-700">{line[status]}</p>
    </Card>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-2xl px-4 py-3" style={{ backgroundColor: 'var(--cat-sleep-bg)' }}>
      <p className="text-[2rem] font-extrabold leading-none" style={{ color: 'var(--foreground)' }}>{value}</p>
      <p className="mt-1 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
    </div>
  );
}

export default function Sleep() {
  const { id } = useParams();
  const [data, setData] = useState<SleepResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loggedAt, setLoggedAt] = useState(todayInputValueIST());
  const [kind, setKind] = useState<SleepKind>('night');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [quality, setQuality] = useState<SleepQuality>('settled');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (id === undefined) return;
    setData(await listSleep(id));
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    listSleep(id)
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (id === undefined) return;
    const durationMin = (parseInt(hours || '0', 10) || 0) * 60 + (parseInt(minutes || '0', 10) || 0);
    if (durationMin < 1) {
      setError('Please enter how long the sleep lasted.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addSleep(id, { loggedAt, kind, durationMin, quality, notes: notes.trim() || undefined });
      setHours('');
      setMinutes('');
      setQuality('settled');
      setNotes('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(logId: string) {
    if (id === undefined) return;
    setDeletingId(logId);
    try {
      await deleteSleep(id, logId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setDeletingId(null);
    }
  }

  const logs = data?.logs ?? null;
  const summary = data?.summary ?? null;

  // Days that already have sleep logged — shown as dots in the date picker.
  const loggedDays = useMemo(() => {
    const map: Record<string, string> = {};
    for (const log of data?.logs ?? []) map[toDateInputValueIST(log.loggedAt)] = 'var(--cat-sleep)';
    return map;
  }, [data]);

  const pageRef = useScrollReveal<HTMLDivElement>([logs]);

  return (
    <div ref={pageRef}>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: 'var(--cat-sleep-bg)' }}>
          <Moon className="h-6 w-6" style={{ color: 'var(--cat-sleep-text)' }} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Sleep</h1>
          <p className="text-sm text-stone-500">A gentle log of naps and night sleep</p>
        </div>
      </header>

      <MascotHero
        className="mt-5"
        mascot="/bear-sleep.png"
        alt="A teddy bear sleeping on a cloud"
        eyebrow="Sweet dreams"
        eyebrowColor="var(--cat-sleep-text)"
        title="Rest easy, little one"
        description="Log naps and night sleep to spot your baby’s rhythm. Every baby sleeps differently — this is for patterns, never pressure."
      />

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* Today summary */}
      <div className="mt-5">
        {summary === null ? (
          <Card className="p-5"><Skeleton className="h-20 w-full" /></Card>
        ) : (
          <Card className="flex gap-3 p-5">
            <StatTile label="Slept today" value={summary.todayMinutes > 0 ? formatDuration(summary.todayMinutes) : '—'} />
            <StatTile label="Naps today" value={String(summary.todayNaps)} />
            <StatTile label="Avg / day (7d)" value={summary.avgPerDayMinutes > 0 ? formatDuration(summary.avgPerDayMinutes) : '—'} />
          </Card>
        )}
      </div>

      {/* Age-driven expectation: typical total sleep for this age, so the tracker
          shows what's normal — gently — even before much is logged. */}
      {data?.reference && <ExpectedSleepCard reference={data.reference} avgMinutes={summary?.avgPerDayMinutes ?? 0} />}
      {data?.reference && id && (
        <div className="mt-3">
          <Link
            to={askAssistantLink(id, `What's a typical sleep pattern at my baby's age, and how can I gently help them sleep better?`)}
            className="inline-flex items-center gap-1.5 text-sm font-bold"
            style={{ color: 'var(--cat-assistant)' }}
          >
            <MessageCircleHeart className="h-4 w-4" /> Sleep troubles? Ask Dai Maa
          </Link>
        </div>
      )}

      {id && logs !== null && <TrackerInsight babyId={id} tracker="sleep" hasData={logs.length > 0} signature={logs.length} className="mt-5" />}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-bold text-stone-800">Log sleep</h2>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <div>
                <label htmlFor="loggedAt" className="block text-sm font-medium text-stone-700">Date</label>
                <DatePicker id="loggedAt" required value={loggedAt} max={todayInputValueIST()} onChange={setLoggedAt} markers={loggedDays} className={inputCls} />
              </div>
              <div>
                <span id="seg-kind" className="block text-sm font-medium text-stone-700">Type</span>
                <Segmented options={KINDS} value={kind} onChange={setKind} labelId="seg-kind" />
              </div>
              <div>
                <span className="block text-sm font-medium text-stone-700">How long?</span>
                <div className="mt-1 flex items-center gap-2">
                  <input aria-label="Hours" type="number" min={0} max={23} placeholder="0" value={hours} onChange={(e) => setHours(e.target.value)} className={cn(inputCls, 'w-20')} />
                  <span className="text-sm text-stone-500">h</span>
                  <input aria-label="Minutes" type="number" min={0} max={59} placeholder="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={cn(inputCls, 'w-20')} />
                  <span className="text-sm text-stone-500">m</span>
                </div>
              </div>
              <div>
                <span id="seg-quality" className="block text-sm font-medium text-stone-700">How was it?</span>
                <Segmented options={QUALITIES} value={quality} onChange={setQuality} labelId="seg-quality" />
              </div>
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-stone-700">Notes (optional)</label>
                <textarea id="notes" maxLength={1000} rows={2} placeholder="Woke twice for a feed / slept through…" value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(inputCls, 'resize-none')} />
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Saving…' : 'Add sleep'}
              </Button>
            </form>
          </Card>

          <p className="mt-3 flex items-start gap-2 text-xs text-stone-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Every baby&apos;s sleep is different and changes week to week. This log is to help you spot patterns — not a medical
            assessment. Mention any sudden change or concern to your pediatrician.
          </p>
        </div>

        <div className="lg:col-span-3">
          {logs === null ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-4"><Skeleton className="h-14 w-full" /></Card>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-3xl" style={{ backgroundColor: 'var(--cat-sleep-bg)' }}>
                <Moon className="h-8 w-8" style={{ color: 'var(--cat-sleep-text)' }} />
              </span>
              <h3 className="mt-4 font-bold text-stone-800">No sleep logged yet</h3>
              <p className="mt-1 max-w-xs text-sm text-stone-500">Log a nap or last night&apos;s sleep to start seeing your baby&apos;s rhythm.</p>
            </Card>
          ) : (
            <ol className="space-y-3">
              {logs.map((log) => (
                <li key={log.id} data-reveal="">
                  <Card className="flex items-center gap-3 p-4">
                    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: 'var(--cat-sleep-bg)' }}>
                      {log.kind === 'night' ? <Moon className="h-4 w-4" style={{ color: 'var(--cat-sleep)' }} /> : <Sun className="h-4 w-4" style={{ color: 'var(--cat-sleep)' }} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-stone-800">{formatDuration(log.durationMin)}</span>
                        <span className="text-xs text-stone-500">{log.kind === 'night' ? 'Night sleep' : 'Nap'}</span>
                        {log.quality && <Pill tone={QUALITY_TONE[log.quality]}>{QUALITY_LABEL[log.quality]}</Pill>}
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">{formatDateIST(log.loggedAt)}</p>
                      {log.notes && <p className="mt-1 text-sm text-stone-700">{log.notes}</p>}
                    </div>
                    <button
                      onClick={() => void handleDelete(log.id)}
                      disabled={deletingId === log.id}
                      aria-label="Delete sleep log"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
