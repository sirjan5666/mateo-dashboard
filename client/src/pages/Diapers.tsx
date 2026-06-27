import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Baby, Info, ShieldCheck, Trash2 } from 'lucide-react';
import { addDiaper, deleteDiaper, listDiapers } from '../api/diapers';
import type { DiaperKind, DiaperResponse, StoolColor, StoolConsistency } from '../api/diapers';
import { ApiError } from '../api/client';
import { formatDateIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { DatePicker } from '../components/ui/DatePicker';
import { inputCls } from '../components/ui/field';
import { TrackerInsight } from '../components/TrackerInsight';
import { cn } from '../lib/cn';

const KINDS: { value: DiaperKind; label: string }[] = [
  { value: 'wet', label: 'Wet' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'mixed', label: 'Both' },
  { value: 'dry', label: 'Dry' },
];
const KIND_LABEL: Record<DiaperKind, string> = { wet: 'Wet', dirty: 'Dirty', mixed: 'Wet + dirty', dry: 'Dry' };
const CONSISTENCIES: StoolConsistency[] = ['soft', 'normal', 'firm', 'watery'];
const COLORS: StoolColor[] = ['yellow', 'brown', 'green', 'black', 'red', 'pale'];
const CONCERNING: StoolColor[] = ['black', 'red', 'pale'];
const COLOR_HEX: Record<StoolColor, string> = { yellow: '#eab308', brown: '#92704a', green: '#16a34a', black: '#1f2937', red: '#dc2626', pale: '#d6d3d1' };

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-amber-50 px-4 py-3">
      <p className="text-[2rem] font-extrabold leading-none text-stone-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-stone-500">{label}</p>
    </div>
  );
}

export default function Diapers() {
  const { id } = useParams();
  const [data, setData] = useState<DiaperResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loggedAt, setLoggedAt] = useState(todayInputValueIST());
  const [kind, setKind] = useState<DiaperKind>('wet');
  const [consistency, setConsistency] = useState<StoolConsistency | null>(null);
  const [color, setColor] = useState<StoolColor | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (id === undefined) return;
    setData(await listDiapers(id));
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    listDiapers(id)
      .then((d) => !cancelled && setData(d))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const hasStool = kind === 'dirty' || kind === 'mixed';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (id === undefined) return;
    setError(null);
    setSaving(true);
    try {
      await addDiaper(id, {
        loggedAt,
        kind,
        consistency: hasStool && consistency ? consistency : undefined,
        color: hasStool && color ? color : undefined,
        notes: notes.trim() || undefined,
      });
      setConsistency(null);
      setColor(null);
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
      await deleteDiaper(id, logId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setDeletingId(null);
    }
  }

  const logs = data?.logs ?? null;
  const summary = data?.summary ?? null;

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-50">
          <Baby className="h-6 w-6 text-amber-600" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Diapers</h1>
          <p className="text-sm text-stone-500">Wet &amp; dirty nappies — a simple signal of feeding and hydration.</p>
        </div>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      <div className="mt-5">
        {summary === null ? (
          <Card className="p-5"><Skeleton className="h-20 w-full" /></Card>
        ) : (
          <Card className="flex gap-3 p-5">
            <StatTile label="Wet today" value={String(summary.wetToday)} />
            <StatTile label="Dirty today" value={String(summary.dirtyToday)} />
            <StatTile label="Avg / day (7d)" value={summary.avgPerDay > 0 ? String(summary.avgPerDay) : '—'} />
          </Card>
        )}
      </div>

      {id && logs !== null && <TrackerInsight babyId={id} tracker="diapers" hasData={logs.length > 0} signature={logs.length} className="mt-5" />}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-bold text-stone-800">Log a change</h2>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <div>
                <label htmlFor="loggedAt" className="block text-sm font-medium text-stone-700">Date</label>
                <DatePicker id="loggedAt" required value={loggedAt} max={todayInputValueIST()} onChange={setLoggedAt} className={inputCls} />
              </div>
              <div>
                <span className="block text-sm font-medium text-stone-700">Type</span>
                <div className="mt-1 inline-flex flex-wrap gap-0.5 rounded-xl bg-stone-100 p-0.5">
                  {KINDS.map((o) => (
                    <button key={o.value} type="button" aria-pressed={kind === o.value} onClick={() => setKind(o.value)} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', kind === o.value ? 'bg-white text-stone-900 shadow-soft' : 'text-stone-500 hover:text-stone-700')}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {hasStool && (
                <>
                  <div>
                    <span className="block text-sm font-medium text-stone-700">Consistency</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {CONSISTENCIES.map((c) => (
                        <button key={c} type="button" aria-pressed={consistency === c} onClick={() => setConsistency((p) => (p === c ? null : c))} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors', consistency === c ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50')}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-stone-700">Colour</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {COLORS.map((c) => (
                        <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor((p) => (p === c ? null : c))} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors', color === c ? 'border-stone-400 bg-stone-100 text-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50')}>
                          <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: COLOR_HEX[c] }} />
                          {c}
                        </button>
                      ))}
                    </div>
                    {color && CONCERNING.includes(color) && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Black, red or very pale stool is worth showing your pediatrician. This is a gentle heads-up, not a diagnosis.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-stone-700">Notes (optional)</label>
                <textarea id="notes" maxLength={1000} rows={2} placeholder="Rash / strained…" value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(inputCls, 'resize-none')} />
              </div>
              <Button type="submit" disabled={saving} className="w-full">{saving ? 'Saving…' : 'Add change'}</Button>
            </form>
          </Card>

          <p className="mt-3 flex items-start gap-2 text-xs text-stone-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Far fewer wet nappies than usual can mean your baby needs more feeds or fluids — mention any sudden change to your pediatrician. This log is not a diagnosis.
          </p>
        </div>

        <div className="lg:col-span-3">
          {logs === null ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>)}</div>
          ) : logs.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-3xl bg-amber-50"><Baby className="h-8 w-8 text-amber-600" /></span>
              <h3 className="mt-4 font-bold text-stone-800">No nappies logged yet</h3>
              <p className="mt-1 max-w-xs text-sm text-stone-500">Log wet and dirty changes to keep an eye on your baby&apos;s rhythm.</p>
            </Card>
          ) : (
            <ol className="space-y-3">
              {logs.map((l) => (
                <li key={l.id}>
                  <Card className="flex items-center gap-3 p-4">
                    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50"><Baby className="h-4 w-4 text-amber-600" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-stone-800">{KIND_LABEL[l.kind]}</span>
                        {l.consistency && <span className="text-xs capitalize text-stone-500">{l.consistency}</span>}
                        {l.color && (
                          <span className="inline-flex items-center gap-1 text-xs capitalize text-stone-500">
                            <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ backgroundColor: COLOR_HEX[l.color] }} />
                            {l.color}
                          </span>
                        )}
                        {l.concerning && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Show your doctor</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">{formatDateIST(l.loggedAt)}</p>
                      {l.notes && <p className="mt-1 text-sm text-stone-700">{l.notes}</p>}
                    </div>
                    <button onClick={() => void handleDelete(l.id)} disabled={deletingId === l.id} aria-label="Delete nappy log" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
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
