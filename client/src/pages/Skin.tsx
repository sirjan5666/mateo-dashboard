import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Droplets, ImagePlus, ShieldCheck, Trash2 } from 'lucide-react';
import { addSkin, deleteSkin, listSkin } from '../api/skin';
import type { SkinLog, SkinSeverity } from '../api/skin';
import { ApiError } from '../api/client';
import { formatDateIST, toDateInputValueIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';
import { Skeleton } from '../components/ui/Skeleton';
import { DatePicker } from '../components/ui/DatePicker';
import { inputCls } from '../components/ui/field';
import type { Tone } from '../components/ui/tones';
import { TrackerInsight } from '../components/TrackerInsight';
import { MascotHero } from '../components/ui/MascotHero';
import { cn } from '../lib/cn';
import { useScrollReveal } from '../lib/gsap';

const SEVERITY: Record<SkinSeverity, { tone: Tone; label: string; activeText: string; guide: string }> = {
  mild: {
    tone: 'emerald',
    label: 'Mild',
    activeText: 'text-emerald-700',
    guide:
      'Gentle, fragrance-free moisturising usually settles mild dryness. Mateo’s baby skincare range is made for this, alongside the usual gentle care.',
  },
  moderate: {
    tone: 'amber',
    label: 'Moderate',
    activeText: 'text-amber-700',
    guide:
      'Keep an eye on it. If it spreads, lingers, or your baby seems uncomfortable, mention it to your pediatrician.',
  },
  concerning: {
    tone: 'rose',
    label: 'Concerning',
    activeText: 'text-rose-700',
    guide:
      'We’d suggest showing this to your pediatrician soon — especially with any fever, spreading, or a rash that doesn’t fade when pressed.',
  },
};

const SEVERITIES: SkinSeverity[] = ['mild', 'moderate', 'concerning'];

export default function Skin() {
  const { id } = useParams();
  const [logs, setLogs] = useState<SkinLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loggedAt, setLoggedAt] = useState(todayInputValueIST());
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<SkinSeverity>('mild');
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (id === undefined) return;
    setLogs((await listSkin(id)).logs);
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    listSkin(id)
      .then((d) => {
        if (!cancelled) setLogs(d.logs);
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
    setError(null);
    setSaving(true);
    const form = new FormData();
    form.append('loggedAt', loggedAt);
    form.append('area', area.trim());
    form.append('description', description.trim());
    form.append('severity', severity);
    if (photo) form.append('photo', photo);
    try {
      await addSkin(id, form);
      setArea('');
      setDescription('');
      setSeverity('mild');
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = '';
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
      await deleteSkin(id, logId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setDeletingId(null);
    }
  }

  // Days that already have a skin entry — shown as dots in the date picker.
  const loggedDays = useMemo(() => {
    const map: Record<string, string> = {};
    for (const log of logs ?? []) map[toDateInputValueIST(log.loggedAt)] = 'var(--cat-skin)';
    return map;
  }, [logs]);

  const pageRef = useScrollReveal<HTMLDivElement>([logs]);

  return (
    <div ref={pageRef}>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: 'var(--cat-skin-bg)' }}>
          <Droplets className="h-6 w-6" style={{ color: 'var(--cat-skin-text)' }} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Skin</h1>
          <p className="text-sm text-stone-500">A photo timeline of skin observations</p>
        </div>
      </header>

      <MascotHero
        className="mt-5"
        mascot="/elephant-skin.png"
        alt="A baby elephant having a bubble bath"
        eyebrow="Soft &amp; happy skin"
        eyebrowColor="var(--cat-skin-text)"
        title="Keep an eye, gently"
        description="Note what you see — dryness, bumps, a rash — and add a photo. A simple timeline helps you and your doctor spot patterns."
      />

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {id && logs !== null && <TrackerInsight babyId={id} tracker="skin" hasData={logs.length > 0} signature={logs.length} className="mt-5" />}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-bold text-stone-800">New observation</h2>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <div>
                <label htmlFor="loggedAt" className="block text-sm font-medium text-stone-700">
                  Date
                </label>
                <DatePicker id="loggedAt" required value={loggedAt} max={todayInputValueIST()} onChange={setLoggedAt} markers={loggedDays} className={inputCls} />
              </div>
              <div>
                <label htmlFor="area" className="block text-sm font-medium text-stone-700">
                  Area
                </label>
                <input id="area" type="text" required maxLength={60} placeholder="e.g. cheeks, scalp, diaper area" value={area} onChange={(e) => setArea(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-stone-700">
                  What do you see?
                </label>
                <textarea id="description" required maxLength={1000} rows={3} placeholder="Dry, flaky patches; a few small red bumps; etc." value={description} onChange={(e) => setDescription(e.target.value)} className={cn(inputCls, 'resize-none')} />
              </div>
              <div>
                <span className="block text-sm font-medium text-stone-700">How does it look?</span>
                <div className="mt-1 inline-flex rounded-xl bg-stone-100 p-0.5">
                  {SEVERITIES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                        severity === s ? cn('bg-white shadow-soft', SEVERITY[s].activeText) : 'text-stone-500 hover:text-stone-700',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-sm font-medium text-stone-700">Photo (optional)</span>
                <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-stone-300 px-3 py-2.5 text-sm text-stone-500 hover:bg-stone-50">
                  <ImagePlus className="h-4 w-4" />
                  <span className="truncate">{photo ? photo.name : 'Add a photo (JPEG/PNG/WebP, ≤5 MB)'}</span>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Saving…' : 'Add observation'}
              </Button>
            </form>
          </Card>

          <p className="mt-3 flex items-start gap-2 text-xs text-stone-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Tracking skin helps you and your doctor spot patterns. This isn’t a diagnosis — see a
            pediatrician for anything that worries you, spreads, or comes with a fever.
          </p>
        </div>

        <div className="lg:col-span-3">
          {logs === null ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-24 w-full" />
                </Card>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-3xl" style={{ backgroundColor: 'var(--cat-skin-bg)' }}>
                <Droplets className="h-8 w-8" style={{ color: 'var(--cat-skin-text)' }} />
              </span>
              <h3 className="mt-4 font-bold text-stone-800">No observations yet</h3>
              <p className="mt-1 max-w-xs text-sm text-stone-500">Add your first note (and a photo) to start your baby’s skin timeline.</p>
            </Card>
          ) : (
            <ol className="space-y-3">
              {logs.map((log) => {
                const cfg = SEVERITY[log.severity];
                return (
                  <li key={log.id} data-reveal="">
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Pill tone={cfg.tone}>{cfg.label}</Pill>
                            <span className="text-sm font-medium text-stone-800">{log.area}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-stone-500">{formatDateIST(log.loggedAt)}</p>
                        </div>
                        <button
                          onClick={() => void handleDelete(log.id)}
                          disabled={deletingId === log.id}
                          aria-label="Delete observation"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {log.photoUrl && (
                        <img src={log.photoUrl} alt={`Skin observation: ${log.area}`} loading="lazy" className="mt-3 max-h-64 w-full rounded-xl border border-stone-100 object-cover" />
                      )}

                      <p className="mt-3 text-sm text-stone-700">{log.description}</p>
                      <p className={cn('mt-2 rounded-lg px-3 py-2 text-xs', log.severity === 'concerning' ? 'bg-rose-50 text-rose-700' : log.severity === 'moderate' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800')}>
                        {cfg.guide}
                      </p>
                    </Card>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
