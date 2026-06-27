import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, ShieldCheck, Stethoscope, Thermometer, Trash2 } from 'lucide-react';
import { createSymptom, deleteSymptom, listSymptoms, SYMPTOM_LABEL, SYMPTOM_OPTIONS } from '../api/symptoms';
import type { SymptomEntry, SymptomLevel, SymptomSummary } from '../api/symptoms';
import { ApiError } from '../api/client';
import { formatDateIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { DatePicker } from '../components/ui/DatePicker';
import { inputCls } from '../components/ui/field';
import { TrackerInsight } from '../components/TrackerInsight';
import { MascotHero } from '../components/ui/MascotHero';
import { cn } from '../lib/cn';

const cToF = (c: number) => Math.round(((c * 9) / 5 + 32) * 10) / 10;
const fToC = (f: number) => Math.round(((f - 32) * 5) / 9 * 10) / 10;

const LEVEL_BADGE: Record<SymptomLevel, { label: string; cls: string } | null> = {
  ok: null,
  watch: { label: 'Keep an eye', cls: 'bg-amber-50 text-amber-700' },
  urgent: { label: 'See a doctor', cls: 'bg-rose-50 text-rose-700' },
};

// A tiny dependency-free temperature trend (oldest → newest).
function TempTrend({ logs }: { logs: SymptomEntry[] }) {
  const points = logs
    .filter((l) => typeof l.temperatureC === 'number')
    .slice(0, 14)
    .reverse()
    .map((l) => ({ t: l.temperatureC as number, level: l.level }));
  if (points.length < 2) return null;
  const W = 520;
  const H = 120;
  const pad = 22;
  const lo = Math.min(36, ...points.map((p) => p.t)) - 0.3;
  const hi = Math.max(40, ...points.map((p) => p.t)) + 0.3;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (t: number) => pad + ((hi - t) * (H - pad * 2)) / (hi - lo);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.t).toFixed(1)}`).join(' ');
  const feverY = y(38);
  const dotColor = (lvl: SymptomLevel) => (lvl === 'urgent' ? '#e11d48' : lvl === 'watch' ? '#d97706' : '#0f9d6e');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Temperature trend">
      <line x1={pad} x2={W - pad} y1={feverY} y2={feverY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
      <text x={W - pad} y={feverY - 4} textAnchor="end" fontSize="10" fill="#b45309">fever 38°C</text>
      <path d={line} fill="none" stroke="#9aa3c7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.t)} r="3.5" fill={dotColor(p.level)} />
          <text x={x(i)} y={y(p.t) - 8} textAnchor="middle" fontSize="10" fill="#6b6480">{p.t}</text>
        </g>
      ))}
    </svg>
  );
}

export default function Symptoms() {
  const { id } = useParams();
  const [logs, setLogs] = useState<SymptomEntry[] | null>(null);
  const [summary, setSummary] = useState<SymptomSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loggedAt, setLoggedAt] = useState(todayInputValueIST());
  const [temp, setTemp] = useState('');
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (id === undefined) return;
    const d = await listSymptoms(id);
    setLogs(d.logs);
    setSummary(d.summary);
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    listSymptoms(id)
      .then((d) => {
        if (cancelled) return;
        setLogs(d.logs);
        setSummary(d.summary);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (id === undefined) return;
    const symptoms = [...selected];
    let temperatureC: number | undefined;
    if (temp.trim() !== '') {
      const n = Number(temp);
      if (!Number.isFinite(n)) {
        setError('Please enter a valid temperature.');
        return;
      }
      temperatureC = unit === 'F' ? fToC(n) : Math.round(n * 10) / 10;
    }
    if (temperatureC === undefined && symptoms.length === 0) {
      setError('Add a temperature or pick at least one symptom.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createSymptom(id, { loggedAt, temperatureC, symptoms, notes: notes.trim() || undefined });
      setTemp('');
      setSelected(new Set());
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
      await deleteSymptom(id, logId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setDeletingId(null);
    }
  }

  const common = SYMPTOM_OPTIONS.filter((s) => !s.serious);
  const serious = SYMPTOM_OPTIONS.filter((s) => s.serious);
  const latest = logs?.[0] ?? null;
  const concern = latest && latest.level !== 'ok' ? latest : null;

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-50">
          <Thermometer className="h-6 w-6 text-rose-600" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Fever &amp; symptoms</h1>
          <p className="text-sm text-stone-500">Log temperature and symptoms — we&apos;ll flag anything that needs a doctor.</p>
        </div>
      </header>

      <MascotHero
        className="mt-5"
        mascot="/bear-symptoms.png"
        alt="A bear with a thermometer, feeling poorly"
        eyebrow="Here when they’re poorly"
        eyebrowColor="var(--cat-vaccine-text)"
        title="Feeling under the weather?"
        description="Note a temperature or symptom and we’ll gently tell you whether to watch and wait — or call a doctor. You’re not alone in this."
      />

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* Escalation banner for the most recent concerning entry */}
      {concern && (
        <div
          className={cn(
            'mt-5 rounded-2xl border p-5',
            concern.level === 'urgent' ? 'border-rose-300 bg-rose-50' : 'border-amber-300 bg-amber-50',
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={cn('mt-0.5 h-5 w-5 shrink-0', concern.level === 'urgent' ? 'text-rose-600' : 'text-amber-600')} />
            <div className="min-w-0 flex-1">
              <h2 className={cn('font-bold', concern.level === 'urgent' ? 'text-rose-800' : 'text-amber-800')}>
                {concern.level === 'urgent' ? 'This may need urgent medical care' : 'Keep a close eye on this'}
              </h2>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-stone-700">
                {concern.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-stone-600">
                {concern.level === 'urgent'
                  ? 'Please call your pediatrician now or go to the nearest clinic. This is guidance, not a diagnosis.'
                  : 'Consider checking with your pediatrician. This is guidance, not a diagnosis.'}
              </p>
              <Link to="/find-doctor" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700">
                <Stethoscope className="h-4 w-4" /> Talk to a doctor
              </Link>
            </div>
          </div>
        </div>
      )}

      {id && logs !== null && <TrackerInsight babyId={id} tracker="symptoms" hasData={logs.length > 0} signature={logs.length} className="mt-5" />}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-bold text-stone-800">Add an entry</h2>
            <form onSubmit={handleSubmit} className="mt-3 space-y-4">
              <div>
                <label htmlFor="loggedAt" className="block text-sm font-medium text-stone-700">Date</label>
                <DatePicker id="loggedAt" required value={loggedAt} max={todayInputValueIST()} onChange={setLoggedAt} className={inputCls} />
              </div>

              <div>
                <span className="block text-sm font-medium text-stone-700">Temperature (optional)</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    aria-label="Temperature"
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    placeholder={unit === 'C' ? 'e.g. 38.5' : 'e.g. 101.3'}
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    className={cn(inputCls, 'w-32')}
                  />
                  <div role="group" aria-label="Unit" className="inline-flex gap-0.5 rounded-xl bg-stone-100 p-0.5">
                    {(['C', 'F'] as const).map((u) => (
                      <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', unit === u ? 'bg-white text-stone-900 shadow-soft' : 'text-stone-500 hover:text-stone-700')}>
                        °{u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <span className="block text-sm font-medium text-stone-700">Symptoms</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {common.map((s) => (
                    <button key={s.key} type="button" aria-pressed={selected.has(s.key)} onClick={() => toggle(s.key)} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-colors', selected.has(s.key) ? 'border-purple-400 bg-purple-50 text-purple-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50')}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-rose-500">Serious — flag a doctor</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {serious.map((s) => (
                    <button key={s.key} type="button" aria-pressed={selected.has(s.key)} onClick={() => toggle(s.key)} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-colors', selected.has(s.key) ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-stone-200 text-stone-600 hover:bg-rose-50/50')}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-stone-700">Notes (optional)</label>
                <textarea id="notes" maxLength={1000} rows={2} placeholder="Started this evening, fed less…" value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(inputCls, 'resize-none')} />
              </div>

              <Button type="submit" disabled={saving} className="w-full">{saving ? 'Saving…' : 'Add entry'}</Button>
            </form>
          </Card>

          <p className="mt-3 flex items-start gap-2 text-xs text-stone-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This log helps you spot patterns and decide when to call your doctor. It is not a diagnosis. For anything that worries you, contact your pediatrician.
          </p>
        </div>

        {/* Trend + entries */}
        <div className="lg:col-span-3">
          {logs === null ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="p-4"><Skeleton className="h-14 w-full" /></Card>)}</div>
          ) : logs.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-3xl bg-rose-50">
                <Thermometer className="h-8 w-8 text-rose-600" />
              </span>
              <h3 className="mt-4 font-bold text-stone-800">Nothing logged yet</h3>
              <p className="mt-1 max-w-xs text-sm text-stone-500">Log a temperature or symptom to start tracking how your baby is feeling.</p>
            </Card>
          ) : (
            <>
              {(summary?.latestTempC != null || summary?.maxTemp7dC != null) && (
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-stone-800">Temperature</p>
                    <div className="flex gap-4 text-sm">
                      {summary?.latestTempC != null && <span className="text-stone-600">Latest <b className="text-stone-900">{summary.latestTempC}°C</b></span>}
                      {summary?.maxTemp7dC != null && <span className="text-stone-600">Max (7d) <b className="text-stone-900">{summary.maxTemp7dC}°C</b></span>}
                    </div>
                  </div>
                  <div className="mt-2"><TempTrend logs={logs} /></div>
                </Card>
              )}

              <ol className="mt-3 space-y-3">
                {logs.map((log) => {
                  const badge = LEVEL_BADGE[log.level];
                  return (
                    <li key={log.id}>
                      <Card className="flex items-start gap-3 p-4">
                        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50">
                          <Thermometer className="h-4 w-4 text-rose-500" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {typeof log.temperatureC === 'number' && (
                              <span className="text-sm font-semibold text-stone-800">{log.temperatureC}°C <span className="font-normal text-stone-400">({cToF(log.temperatureC)}°F)</span></span>
                            )}
                            {badge && <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', badge.cls)}>{badge.label}</span>}
                          </div>
                          {log.symptoms.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {log.symptoms.map((k) => (
                                <span key={k} className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{SYMPTOM_LABEL.get(k) ?? k}</span>
                              ))}
                            </div>
                          )}
                          <p className="mt-1 text-xs text-stone-500">{formatDateIST(log.loggedAt)}</p>
                          {log.notes && <p className="mt-1 text-sm text-stone-700">{log.notes}</p>}
                        </div>
                        <button onClick={() => void handleDelete(log.id)} disabled={deletingId === log.id} aria-label="Delete entry" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Card>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
