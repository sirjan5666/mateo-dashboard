import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { addAllergy, deleteAllergy, listAllergies } from '../api/allergies';
import type { Allergy, AllergySeverity } from '../api/allergies';
import { ApiError } from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { inputCls } from '../components/ui/field';
import { TrackerInsight } from '../components/TrackerInsight';
import { cn } from '../lib/cn';

const SEVERITIES: { value: AllergySeverity; label: string }[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
];
const SEV_STYLE: Record<AllergySeverity, string> = {
  mild: 'bg-amber-50 text-amber-700',
  moderate: 'bg-orange-50 text-orange-700',
  severe: 'bg-rose-50 text-rose-700',
};

export default function Allergies() {
  const { id } = useParams();
  const [items, setItems] = useState<Allergy[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [severity, setSeverity] = useState<AllergySeverity>('mild');
  const [reaction, setReaction] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (id === undefined) return;
    setItems((await listAllergies(id)).allergies);
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    listAllergies(id)
      .then((d) => !cancelled && setItems(d.allergies))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (id === undefined || !name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await addAllergy(id, { name: name.trim(), severity, reaction: reaction.trim() || undefined, notes: notes.trim() || undefined });
      setName('');
      setReaction('');
      setNotes('');
      setSeverity('mild');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(allergyId: string) {
    if (id === undefined) return;
    setDeletingId(allergyId);
    try {
      await deleteAllergy(id, allergyId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-50">
          <ShieldAlert className="h-6 w-6 text-rose-600" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Allergies</h1>
          <p className="text-sm text-stone-500">Known allergies — we&apos;ll warn you in the food log and share them with your doctor.</p>
        </div>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {id && items !== null && items.length > 0 && <TrackerInsight babyId={id} tracker="allergies" hasData={items.length > 0} signature={items.length} className="mt-5" />}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-bold text-stone-800">Add an allergy</h2>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <div>
                <label htmlFor="aname" className="block text-sm font-medium text-stone-700">Allergen</label>
                <input id="aname" required maxLength={100} placeholder="e.g. Peanut, Egg, Cow's milk" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <span className="block text-sm font-medium text-stone-700">Severity</span>
                <div className="mt-1 inline-flex gap-0.5 rounded-xl bg-stone-100 p-0.5">
                  {SEVERITIES.map((s) => (
                    <button key={s.value} type="button" aria-pressed={severity === s.value} onClick={() => setSeverity(s.value)} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', severity === s.value ? 'bg-white text-stone-900 shadow-soft' : 'text-stone-500 hover:text-stone-700')}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="areaction" className="block text-sm font-medium text-stone-700">Reaction (optional)</label>
                <input id="areaction" maxLength={200} placeholder="e.g. hives, vomiting" value={reaction} onChange={(e) => setReaction(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="anotes" className="block text-sm font-medium text-stone-700">Notes (optional)</label>
                <textarea id="anotes" maxLength={500} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(inputCls, 'resize-none')} />
              </div>
              <Button type="submit" disabled={saving} className="w-full">{saving ? 'Saving…' : 'Add allergy'}</Button>
            </form>
          </Card>

          <p className="mt-3 flex items-start gap-2 text-xs text-stone-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            For a serious allergic reaction (trouble breathing, swelling, widespread rash) seek emergency care immediately. This list is for reference, not a diagnosis.
          </p>
        </div>

        <div className="lg:col-span-3">
          {items === null ? (
            <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>)}</div>
          ) : items.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-3xl bg-rose-50"><ShieldAlert className="h-8 w-8 text-rose-600" /></span>
              <h3 className="mt-4 font-bold text-stone-800">No allergies recorded</h3>
              <p className="mt-1 max-w-xs text-sm text-stone-500">Add any known allergies so we can warn you when logging foods and keep your doctor informed.</p>
            </Card>
          ) : (
            <ol className="space-y-3">
              {items.map((a) => (
                <li key={a.id}>
                  <Card className="flex items-start gap-3 p-4">
                    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50"><ShieldAlert className="h-4 w-4 text-rose-600" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-stone-800">{a.name}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', SEV_STYLE[a.severity])}>{a.severity}</span>
                      </div>
                      {a.reaction && <p className="mt-0.5 text-sm text-stone-600">Reaction: {a.reaction}</p>}
                      {a.notes && <p className="mt-0.5 text-sm text-stone-500">{a.notes}</p>}
                    </div>
                    <button onClick={() => void handleDelete(a.id)} disabled={deletingId === a.id} aria-label={`Delete ${a.name}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
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
