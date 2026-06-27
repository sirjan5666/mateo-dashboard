import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Milk, ShieldCheck, Stethoscope, Trash2 } from 'lucide-react';
import { addFeed, deleteFeed, listFeeds } from '../api/feeds';
import type { FeedKind, FeedResponse, FeedSide } from '../api/feeds';
import { ApiError } from '../api/client';
import { formatDateIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { DatePicker } from '../components/ui/DatePicker';
import { inputCls } from '../components/ui/field';
import { TrackerInsight } from '../components/TrackerInsight';
import { cn } from '../lib/cn';

const KINDS: { value: FeedKind; label: string }[] = [
  { value: 'breast', label: 'Breastfeed' },
  { value: 'expressed', label: 'Expressed milk' },
  { value: 'water', label: 'Water' },
  { value: 'other', label: 'Other' },
];
const SIDES: { value: FeedSide; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' },
];
const KIND_LABEL: Record<FeedKind, string> = { breast: 'Breastfeed', expressed: 'Expressed milk', water: 'Water', other: 'Other' };
const SIDE_LABEL: Record<FeedSide, string> = { left: 'Left', right: 'Right', both: 'Both' };

function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mt-1 inline-flex flex-wrap gap-0.5 rounded-xl bg-stone-100 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', value === o.value ? 'bg-white text-stone-900 shadow-soft' : 'text-stone-500 hover:text-stone-700')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-sky-50 px-4 py-3">
      <p className="text-[2rem] font-extrabold leading-none text-stone-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-stone-500">{label}</p>
    </div>
  );
}

export default function Feeds() {
  const { id } = useParams();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loggedAt, setLoggedAt] = useState(todayInputValueIST());
  const [kind, setKind] = useState<FeedKind>('breast');
  const [side, setSide] = useState<FeedSide>('left');
  const [durationMin, setDurationMin] = useState('');
  const [amountMl, setAmountMl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (id === undefined) return;
    setData(await listFeeds(id));
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    listFeeds(id)
      .then((d) => !cancelled && setData(d))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (id === undefined) return;
    setError(null);
    setSaving(true);
    try {
      const dur = durationMin ? parseInt(durationMin, 10) : undefined;
      const amt = amountMl ? parseInt(amountMl, 10) : undefined;
      await addFeed(id, {
        loggedAt,
        kind,
        side: kind === 'breast' ? side : undefined,
        durationMin: kind === 'breast' ? dur : undefined,
        amountMl: kind === 'expressed' || kind === 'water' ? amt : undefined,
        notes: notes.trim() || undefined,
      });
      setDurationMin('');
      setAmountMl('');
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
      await deleteFeed(id, logId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setDeletingId(null);
    }
  }

  const logs = data?.logs ?? null;
  const summary = data?.summary ?? null;

  function detailOf(l: NonNullable<typeof logs>[number]): string {
    if (l.kind === 'breast') return [l.side ? SIDE_LABEL[l.side] : null, l.durationMin ? `${l.durationMin} min` : null].filter(Boolean).join(' · ') || 'Breastfeed';
    if (l.amountMl) return `${l.amountMl} ml`;
    return '';
  }

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-50">
          <Milk className="h-6 w-6 text-sky-600" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Feeds</h1>
          <p className="text-sm text-stone-500">Breastfeeds, expressed milk and water — for the early months.</p>
        </div>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      <div className="mt-5">
        {summary === null ? (
          <Card className="p-5"><Skeleton className="h-20 w-full" /></Card>
        ) : (
          <Card className="flex gap-3 p-5">
            <StatTile label="Feeds today" value={String(summary.feedsToday)} />
            <StatTile label="Nursing today" value={summary.breastMinutesToday > 0 ? `${summary.breastMinutesToday}m` : '—'} />
            <StatTile label="Avg / day (7d)" value={summary.avgPerDay > 0 ? String(summary.avgPerDay) : '—'} />
          </Card>
        )}
      </div>

      {id && logs !== null && <TrackerInsight babyId={id} tracker="feeds" hasData={logs.length > 0} signature={logs.length} className="mt-5" />}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-bold text-stone-800">Log a feed</h2>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <div>
                <label htmlFor="loggedAt" className="block text-sm font-medium text-stone-700">Date</label>
                <DatePicker id="loggedAt" required value={loggedAt} max={todayInputValueIST()} onChange={setLoggedAt} className={inputCls} />
              </div>
              <div>
                <span className="block text-sm font-medium text-stone-700">Type</span>
                <Segmented options={KINDS} value={kind} onChange={setKind} />
              </div>
              {kind === 'breast' && (
                <>
                  <div>
                    <span className="block text-sm font-medium text-stone-700">Side</span>
                    <Segmented options={SIDES} value={side} onChange={setSide} />
                  </div>
                  <div>
                    <label htmlFor="dur" className="block text-sm font-medium text-stone-700">Duration (min)</label>
                    <input id="dur" type="number" min={1} max={240} placeholder="e.g. 15" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className={cn(inputCls, 'w-28')} />
                  </div>
                </>
              )}
              {(kind === 'expressed' || kind === 'water') && (
                <div>
                  <label htmlFor="amt" className="block text-sm font-medium text-stone-700">Amount (ml)</label>
                  <input id="amt" type="number" min={1} max={1000} placeholder="e.g. 60" value={amountMl} onChange={(e) => setAmountMl(e.target.value)} className={cn(inputCls, 'w-28')} />
                </div>
              )}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-stone-700">Notes (optional)</label>
                <textarea id="notes" maxLength={1000} rows={2} placeholder="Fed well / fussy…" value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(inputCls, 'resize-none')} />
              </div>
              <Button type="submit" disabled={saving} className="w-full">{saving ? 'Saving…' : 'Add feed'}</Button>
            </form>
          </Card>

          <p className="mt-3 flex items-start gap-2 text-xs text-stone-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Breastfeeding is best for the early months. This log helps you spot patterns — it is not medical advice. Ask your pediatrician about any feeding concern.
          </p>
          <Link to="/find-doctor?specialization=Lactation" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800">
            <Stethoscope className="h-4 w-4" /> Talk to a lactation consultant
          </Link>
        </div>

        <div className="lg:col-span-3">
          {logs === null ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>)}</div>
          ) : logs.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-3xl bg-sky-50"><Milk className="h-8 w-8 text-sky-600" /></span>
              <h3 className="mt-4 font-bold text-stone-800">No feeds logged yet</h3>
              <p className="mt-1 max-w-xs text-sm text-stone-500">Log a breastfeed, expressed milk or water to start tracking the rhythm.</p>
            </Card>
          ) : (
            <ol className="space-y-3">
              {logs.map((l) => (
                <li key={l.id}>
                  <Card className="flex items-center gap-3 p-4">
                    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50"><Milk className="h-4 w-4 text-sky-600" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-stone-800">{KIND_LABEL[l.kind]}</span>
                        {detailOf(l) && <span className="text-xs text-stone-500">{detailOf(l)}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">{formatDateIST(l.loggedAt)}</p>
                      {l.notes && <p className="mt-1 text-sm text-stone-700">{l.notes}</p>}
                    </div>
                    <button onClick={() => void handleDelete(l.id)} disabled={deletingId === l.id} aria-label="Delete feed" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
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
