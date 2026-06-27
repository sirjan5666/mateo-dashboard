import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Apple, ArrowLeft, Baby, CheckCircle2, Leaf, ShieldAlert, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { addFood, deleteFood, listFood } from '../api/food';
import type { FoodAmount, FoodReaction, FoodResponse, FoodTexture, MealType } from '../api/food';
import { listAllergies } from '../api/allergies';
import type { Allergy } from '../api/allergies';
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

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];
const TEXTURES: { value: FoodTexture; label: string }[] = [
  { value: 'puree', label: 'Purée' },
  { value: 'mashed', label: 'Mashed' },
  { value: 'finger', label: 'Finger food' },
  { value: 'family', label: 'Family food' },
];
const AMOUNTS: { value: FoodAmount; label: string }[] = [
  { value: 'tasted', label: 'Just tasted' },
  { value: 'some', label: 'Ate some' },
  { value: 'full', label: 'Full meal' },
];
const REACTIONS: { value: FoodReaction; label: string }[] = [
  { value: 'none', label: 'No reaction' },
  { value: 'mild', label: 'Mild' },
  { value: 'concerning', label: 'Concerning' },
];
const FOOD_GROUPS = ['Grains', 'Dal & legumes', 'Vegetables', 'Fruits', 'Dairy', 'Egg & non-veg'];

const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const TEXTURE_LABEL: Record<FoodTexture, string> = { puree: 'Purée', mashed: 'Mashed', finger: 'Finger food', family: 'Family food' };
const AMOUNT_LABEL: Record<FoodAmount, string> = { tasted: 'Just tasted', some: 'Ate some', full: 'Full meal' };
const REACTION_TONE: Record<FoodReaction, Tone> = { none: 'emerald', mild: 'amber', concerning: 'rose' };
const REACTION_LABEL: Record<FoodReaction, string> = { none: 'No reaction', mild: 'Mild reaction', concerning: 'Concerning' };

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

export default function Food() {
  const { id } = useParams();
  const [data, setData] = useState<FoodResponse | null>(null);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [loggedAt, setLoggedAt] = useState(todayInputValueIST());
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [foodName, setFoodName] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
  const [texture, setTexture] = useState<FoodTexture>('mashed');
  const [amount, setAmount] = useState<FoodAmount>('some');
  const [reaction, setReaction] = useState<FoodReaction>('none');
  const [isNewFood, setIsNewFood] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (id === undefined) return;
    setData(await listFood(id));
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    listFood(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });
    listAllergies(id)
      .then((d) => {
        if (!cancelled) setAllergies(d.allergies);
      })
      .catch(() => {
        /* allergy warnings are best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Warn if the typed food name contains a known allergen.
  const matchedAllergen = useMemo(() => {
    const f = foodName.trim().toLowerCase();
    if (!f) return null;
    return allergies.find((a) => a.name && f.includes(a.name.toLowerCase()))?.name ?? null;
  }, [foodName, allergies]);

  function toggleGroup(g: string) {
    setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  function useIdea(item: string, group: string) {
    // Normalise long stage keys like "Egg & non-veg (if your family eats it)"
    // to the canonical chip label so the form selection lines up.
    const normalised = group.split(' (')[0];
    setFoodName(item);
    setGroups((prev) => (prev.includes(normalised) ? prev : [...prev, normalised]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (id === undefined) return;
    setError(null);
    setSaving(true);
    try {
      await addFood(id, {
        loggedAt,
        mealType,
        foodName: foodName.trim(),
        foodGroups: groups,
        texture,
        amount,
        reaction,
        isNewFood,
        notes: notes.trim() || undefined,
      });
      setFoodName('');
      setGroups([]);
      setReaction('none');
      setIsNewFood(false);
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
      await deleteFood(id, logId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setDeletingId(null);
    }
  }

  const guidance = data?.guidance ?? null;
  const logs = data?.logs ?? null;

  // Days that already have a meal logged — shown as dots in the date picker.
  const loggedDays = useMemo(() => {
    const map: Record<string, string> = {};
    for (const log of data?.logs ?? []) map[toDateInputValueIST(log.loggedAt)] = 'var(--cat-food)';
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
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: 'var(--cat-food-bg)' }}>
          <Apple className="h-6 w-6" style={{ color: 'var(--cat-food-text)' }} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Food</h1>
          <p className="text-sm text-stone-500">A gentle log of meals, textures and reactions — homemade and brand-neutral</p>
        </div>
      </header>

      <MascotHero
        className="mt-5"
        mascot="/tiger-food.png"
        alt="A happy tiger cub eating from a bowl"
        eyebrow="One taste at a time"
        eyebrowColor="var(--cat-food-text)"
        title="Happy, healthy mealtimes"
        description="Log meals, textures and reactions as your baby grows into solids — homemade-first and brand-neutral, the way we like it."
      />

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* Age-aware guidance banner */}
      <div className="mt-5">
        {guidance === null ? (
          <Card className="p-5">
            <Skeleton className="h-24 w-full" />
          </Card>
        ) : guidance.underSix ? (
          <UnderSixBanner guidance={guidance} />
        ) : (
          <StageBanner guidance={guidance} onUseIdea={useIdea} />
        )}
      </div>

      {id && logs !== null && <TrackerInsight babyId={id} tracker="food" hasData={logs.length > 0} signature={logs.length} className="mt-5" />}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Log form */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-bold text-stone-800">Log a meal</h2>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <div>
                <label htmlFor="loggedAt" className="block text-sm font-medium text-stone-700">
                  Date
                </label>
                <DatePicker id="loggedAt" required value={loggedAt} max={todayInputValueIST()} onChange={setLoggedAt} markers={loggedDays} className={inputCls} />
              </div>
              <div>
                <span id="seg-meal" className="block text-sm font-medium text-stone-700">Meal</span>
                <Segmented options={MEAL_TYPES} value={mealType} onChange={setMealType} labelId="seg-meal" />
              </div>
              <div>
                <label htmlFor="foodName" className="block text-sm font-medium text-stone-700">
                  What did baby eat?
                </label>
                <input id="foodName" type="text" required maxLength={120} placeholder="e.g. mashed banana, soft khichdi" value={foodName} onChange={(e) => setFoodName(e.target.value)} className={inputCls} />
                {matchedAllergen && (
                  <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Heads up — your baby is allergic to <b>{matchedAllergen}</b>. Please avoid foods containing it.</span>
                  </p>
                )}
              </div>
              <div>
                <span className="block text-sm font-medium text-stone-700">Food groups</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {FOOD_GROUPS.map((g) => {
                    const on = groups.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGroup(g)}
                        aria-pressed={on}
                        className={cn('rounded-full border px-3 py-1 text-xs font-semibold transition-colors', on ? 'text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50')}
                        style={on ? { backgroundColor: 'var(--cat-food)', borderColor: 'var(--cat-food)' } : undefined}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <span id="seg-texture" className="block text-sm font-medium text-stone-700">Texture</span>
                <Segmented options={TEXTURES} value={texture} onChange={setTexture} labelId="seg-texture" />
              </div>
              <div>
                <span id="seg-amount" className="block text-sm font-medium text-stone-700">How much?</span>
                <Segmented options={AMOUNTS} value={amount} onChange={setAmount} labelId="seg-amount" />
              </div>
              <div>
                <span id="seg-reaction" className="block text-sm font-medium text-stone-700">Any reaction?</span>
                <Segmented options={REACTIONS} value={reaction} onChange={setReaction} labelId="seg-reaction" />
                {reaction === 'concerning' && (
                  <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    If your baby has a rash, swelling around the lips or face, vomiting, or any trouble breathing after a food, treat it as
                    urgent and see a doctor right away.
                  </p>
                )}
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={isNewFood} onChange={(e) => setIsNewFood(e.target.checked)} className="h-4 w-4 rounded border-stone-300" style={{ accentColor: 'var(--cat-food)' }} />
                  First time trying this food (watch for reactions over the next few days)
                </label>
              </div>
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-stone-700">
                  Notes (optional)
                </label>
                <textarea id="notes" maxLength={1000} rows={2} placeholder="Loved it / refused / a little rash after…" value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(inputCls, 'resize-none')} />
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Saving…' : 'Add meal'}
              </Button>
            </form>
          </Card>

          <p className="mt-3 flex items-start gap-2 text-xs text-stone-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Feeding guidance here is brand-neutral and homemade-first — never formula or brands. This isn&apos;t medical advice; your
            pediatrician is the right guide for your baby&apos;s nutrition.
          </p>

          <SafeFeedingCard guidance={guidance} />
        </div>

        {/* Timeline */}
        <div className="lg:col-span-3">
          {logs === null ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-16 w-full" />
                </Card>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-3xl" style={{ backgroundColor: 'var(--cat-food-bg)' }}>
                <Apple className="h-8 w-8" style={{ color: 'var(--cat-food-text)' }} />
              </span>
              <h3 className="mt-4 font-bold text-stone-800">No meals logged yet</h3>
              <p className="mt-1 max-w-xs text-sm text-stone-500">When your baby is ready for solids, log the first taste here to start their feeding journey.</p>
            </Card>
          ) : (
            <ol className="space-y-3">
              {logs.map((log) => (
                <li key={log.id} data-reveal="">
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-stone-800">{log.foodName}</span>
                          {log.isNewFood && (
                            <Pill tone="violet">
                              <Sparkles className="h-3 w-3" /> New food
                            </Pill>
                          )}
                          {log.reaction !== 'none' && <Pill tone={REACTION_TONE[log.reaction]}>{REACTION_LABEL[log.reaction]}</Pill>}
                        </div>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {MEAL_LABEL[log.mealType]} · {TEXTURE_LABEL[log.texture]} · {AMOUNT_LABEL[log.amount]} · {formatDateIST(log.loggedAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => void handleDelete(log.id)}
                        disabled={deletingId === log.id}
                        aria-label="Delete meal"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {log.foodGroups.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {log.foodGroups.map((g) => (
                          <span key={g} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: 'var(--cat-food-bg)', color: 'var(--cat-food-text)' }}>
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                    {log.notes && <p className="mt-2 text-sm text-stone-700">{log.notes}</p>}
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

function UnderSixBanner({ guidance }: { guidance: NonNullable<FoodResponse['guidance']> }) {
  const u = guidance.underSixMonths;
  return (
    <Card className="p-5" style={{ borderColor: 'var(--cat-food)', backgroundColor: 'var(--cat-food-bg)' }}>
      <div className="flex items-center gap-2">
        <Baby className="h-5 w-5" style={{ color: 'var(--cat-food)' }} />
        <h2 className="font-bold text-stone-900">{u.headline} — recommended until 6 months</h2>
      </div>
      <p className="mt-2 text-sm text-stone-700">{u.guidance}</p>
      <div className="mt-3">
        <p className="text-sm font-semibold text-stone-800">Signs your baby may be ready for solids (around 6 months):</p>
        <ul className="mt-1.5 space-y-1">
          {u.readiness.map((r) => (
            <li key={r} className="flex items-start gap-2 text-sm text-stone-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--cat-food)' }} />
              {r}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-stone-600">{u.readinessNote}</p>
      </div>
      <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-stone-600">{u.ifNotBreastfeeding}</p>
    </Card>
  );
}

function StageBanner({
  guidance,
  onUseIdea,
}: {
  guidance: NonNullable<FoodResponse['guidance']>;
  onUseIdea: (item: string, group: string) => void;
}) {
  const stage = guidance.stage;
  if (!stage) {
    return (
      <Card className="p-5">
        <p className="text-sm text-stone-700">{guidance.feedingNote}</p>
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Leaf className="h-5 w-5" style={{ color: 'var(--cat-food)' }} />
          <h2 className="font-bold text-stone-900">Feeding ideas for {stage.label}</h2>
        </div>
        <Pill tone="stone">{guidance.ageMonths} months old</Pill>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-stone-700 sm:grid-cols-3">
        <p>
          <span className="font-semibold text-stone-800">Texture:</span> {stage.texture}
        </p>
        <p>
          <span className="font-semibold text-stone-800">How often:</span> {stage.frequency}
        </p>
        <p>
          <span className="font-semibold text-stone-800">How much:</span> {stage.amount}
        </p>
      </div>
      <div className="mt-4 space-y-2.5">
        {Object.entries(stage.ideas).map(([group, items]) => (
          <div key={group}>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{group}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {items.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onUseIdea(item, group)}
                  aria-label={`Use ${item} in the meal log`}
                  title="Use this idea in the log form"
                  className="rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'var(--cat-food-bg)', color: 'var(--cat-food-text)' }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-1 border-t border-stone-100 pt-3">
        {stage.tips.map((t) => (
          <li key={t} className="flex items-start gap-2 text-xs text-stone-600">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--cat-food)' }} />
            {t}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SafeFeedingCard({ guidance }: { guidance: FoodResponse['guidance'] | null }) {
  if (!guidance) return null;
  return (
    <Card className="mt-3 p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-rose-500" />
        <h2 className="font-bold text-stone-800">Safe feeding</h2>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Never feed</p>
      <ul className="mt-1 space-y-1.5">
        {guidance.neverFeed.map((n) => (
          <li key={n.item} className="text-xs text-stone-600">
            <span className="font-semibold text-stone-800">{n.item}</span> — {n.why}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Hygiene &amp; safety</p>
      <ul className="mt-1 space-y-1">
        {guidance.safety.slice(0, 5).map((s) => (
          <li key={s} className="flex items-start gap-2 text-xs text-stone-600">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-stone-400" />
            {s}
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">{guidance.feedingNote}</p>
    </Card>
  );
}
