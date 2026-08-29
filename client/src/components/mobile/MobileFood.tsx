import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Apple, ArrowLeft, ChevronDown, Leaf, MoreHorizontal, Plus, RefreshCw, Sparkles, Trash2, UtensilsCrossed } from 'lucide-react';
import { addFood, deleteFood, listFood } from '../../api/food';
import type { FoodAmount, FoodLog, FoodResponse, MealType } from '../../api/food';
import { formatTimeIST, todayInputValueIST, toDateInputValueIST } from '../../lib/age';
import { avatarUrl } from '../../lib/avatars';
import { askAssistantLink } from '../../lib/assistant';
import { useBabies } from '../../lib/useBabies';
import { Avatar } from '../ui/Avatar';
import { BottomSheet } from '../ui/BottomSheet';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { AssistantMark } from '../assistant/AssistantMark';
import { cn } from '../../lib/cn';

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];
const AMOUNTS: { value: FoodAmount; label: string }[] = [
  { value: 'tasted', label: 'Just tasted' },
  { value: 'some', label: 'Ate some' },
  { value: 'full', label: 'Full meal' },
];
const AMOUNT_LABEL: Record<FoodAmount, string> = { tasted: 'Just tasted', some: 'Ate some', full: 'Full meal' };
const FOOD_GROUPS = ['Grains', 'Dal & legumes', 'Vegetables', 'Fruits', 'Dairy', 'Egg & non-veg'];

const FOOD = { fg: 'var(--cat-food)', bg: 'var(--cat-food-bg)', text: 'var(--cat-food-text)' };

const REACTION = {
  none: { label: 'OK', bg: 'var(--status-ontrack-bg)', fg: 'var(--status-ontrack-text)' },
  mild: { label: 'Mild', bg: 'var(--status-duesoon-bg)', fg: 'var(--status-duesoon-text)' },
  concerning: { label: 'Watch', bg: 'var(--status-overdue-bg)', fg: 'var(--status-overdue-text)' },
};

function SummaryPill({ icon: Icon, tint, tintFg, value, label }: { icon: typeof Leaf; tint: string; tintFg: string; value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col rounded-2xl px-2.5 py-2.5" style={{ backgroundColor: tint }}>
      <Icon className="h-4 w-4" style={{ color: tintFg }} />
      <span className="mt-1.5 font-display text-lg font-bold leading-none" style={{ color: tintFg }}>
        {value}
      </span>
      <span className="mt-1 text-[10px] font-medium leading-tight text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}

/**
 * Mobile Food tracker (design spec) — wired to the real food model (meals, snacks,
 * food groups, texture, amount, reaction, new-food). Fluid logging and breastfeed
 * timing don't exist in the backend and are NOT fabricated; the summary uses real
 * metrics (Meals / Snacks / New foods / Diversity). Breastfeeding-first + IMS
 * compliance preserved. Desktop keeps its existing Food page.
 */
export function MobileFood() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { activeBaby, babies, selectBaby } = useBabies();
  const baby = activeBaby ?? babies.find((b) => b.id === id) ?? null;

  const [resp, setResp] = useState<FoodResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'all' | 'meals' | 'snacks'>('all');
  const [showAll, setShowAll] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // No synchronous setState here — the effect calls this, so all state changes
  // happen in the async callbacks (loading/error are seeded by useState; a manual
  // refresh flips `loading` from its own click handler).
  const load = useCallback(() => {
    return listFood(id)
      .then((d) => {
        setResp(d);
        setError(false);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const logs = useMemo(() => resp?.logs ?? [], [resp]);
  const isToday = (iso: string) => toDateInputValueIST(iso) === todayInputValueIST();
  const todays = logs.filter((l) => isToday(l.loggedAt));
  const meals = todays.filter((l) => l.mealType !== 'snack').length;
  const snacks = todays.filter((l) => l.mealType === 'snack').length;
  const newFoods = todays.filter((l) => l.isNewFood).length;
  const diversity = new Set(todays.flatMap((l) => l.foodGroups)).size;

  const base = showAll ? logs : todays;
  const shown = filter === 'all' ? base : filter === 'meals' ? base.filter((l) => l.mealType !== 'snack') : base.filter((l) => l.mealType === 'snack');

  const underSix = resp?.guidance.underSix ?? false;

  async function remove(logId: string) {
    await deleteFood(id, logId).catch(() => {});
    await load();
  }

  return (
    <div className="-mt-8 flex flex-col gap-4">
      {/* Header: back · baby switcher · refresh */}
      <header className="flex items-center gap-2" style={{ paddingTop: 'calc(0.5rem + var(--safe-top))' }}>
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--surface-card)] shadow-soft ring-1 ring-stone-200/60">
          <ArrowLeft className="h-5 w-5 text-[var(--foreground)]" />
        </button>
        {baby && (
          <button type="button" onClick={() => setSwitcherOpen(true)} className="flex min-h-[44px] flex-1 items-center gap-2.5 rounded-full bg-[var(--surface-card)] py-1.5 pl-1.5 pr-3 shadow-soft ring-1 ring-stone-200/60">
            <Avatar name={baby.name} src={avatarUrl(baby.avatar)} size="sm" />
            <span className="min-w-0 flex-1 text-left font-display text-[15px] font-semibold text-[var(--foreground)]">{baby.name}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          </button>
        )}
        <button type="button" onClick={() => { setLoading(true); void load(); }} aria-label="Refresh" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--surface-card)] shadow-soft ring-1 ring-stone-200/60">
          <RefreshCw className={cn('h-5 w-5 text-[var(--foreground)]', loading && 'animate-spin')} />
        </button>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-[26px] p-5 shadow-soft ring-1 ring-stone-200/60" style={{ backgroundColor: FOOD.bg }}>
        <div className="max-w-[70%]">
          <h1 className="font-display text-2xl font-bold" style={{ color: FOOD.text }}>
            Food
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Good food today, stronger tomorrow.</p>
        </div>
        <img src="/tiger-food.png" alt="" className="pointer-events-none absolute -bottom-1 right-0 h-28 w-28 object-contain" draggable={false} />
      </div>

      {error ? (
        <ErrorState onRetry={load} />
      ) : loading && !resp ? (
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-[26px] bg-stone-200/70" />
          <div className="h-40 animate-pulse rounded-[26px] bg-stone-200/70" />
        </div>
      ) : (
        <>
          {/* Today's summary — real metrics (no fabricated fluid) */}
          <section className="rounded-[26px] bg-[var(--surface-card)] p-4 shadow-soft ring-1 ring-stone-200/60">
            <h2 className="mb-3 font-display text-base font-semibold text-[var(--foreground)]">Today’s summary</h2>
            <div className="flex gap-2">
              <SummaryPill icon={UtensilsCrossed} tint="var(--status-ontrack-bg)" tintFg="var(--status-ontrack-text)" value={String(meals)} label="Meals today" />
              <SummaryPill icon={Apple} tint={FOOD.bg} tintFg={FOOD.text} value={String(snacks)} label="Snacks today" />
              <SummaryPill icon={Sparkles} tint="var(--cat-assistant-bg)" tintFg="var(--cat-assistant-text)" value={String(newFoods)} label="New foods" />
              <SummaryPill icon={Leaf} tint="var(--cat-record-bg)" tintFg="var(--cat-record-text)" value={`${diversity}/6`} label="Food groups" />
            </div>
          </section>

          {/* Breastfeeding-first compliance note */}
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: FOOD.bg }}>
            <Leaf className="mt-0.5 h-5 w-5 shrink-0" style={{ color: FOOD.text }} />
            <p className="text-sm leading-snug" style={{ color: FOOD.text }}>
              <span className="font-bold">Breast milk is best for babies.</span> Continue breastfeeding along with nutritious foods.
            </p>
          </div>

          {underSix ? (
            <div className="rounded-[26px] bg-[var(--surface-card)] p-5 text-center shadow-soft ring-1 ring-stone-200/60">
              <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">{resp?.guidance.underSixMonths.headline ?? 'Breast milk is all your baby needs right now'}</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{resp?.guidance.underSixMonths.guidance}</p>
            </div>
          ) : (
            <>
              {/* Food log */}
              <section className="rounded-[26px] bg-[var(--surface-card)] p-4 shadow-soft ring-1 ring-stone-200/60">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold text-[var(--foreground)]">{showAll ? 'Food log' : 'Today’s food log'}</h2>
                  <button type="button" onClick={() => setShowAll((s) => !s)} className="text-sm font-semibold text-[var(--brand-purple-deep)]">
                    {showAll ? 'Today only' : 'See all'}
                  </button>
                </div>
                {/* Segmented filter */}
                <div className="mb-3 flex gap-1 rounded-full bg-[var(--surface-sunken)] p-1">
                  {(['all', 'meals', 'snacks'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={cn('flex-1 rounded-full py-1.5 text-sm font-semibold capitalize transition-colors', filter === f ? 'bg-[var(--surface-card)] text-[var(--foreground)] shadow-soft' : 'text-[var(--muted-foreground)]')}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {shown.length === 0 ? (
                  <EmptyState icon={UtensilsCrossed} title="No food logged yet" description="Start by adding today’s first meal or snack." />
                ) : (
                  <ul className="space-y-1">
                    {shown.map((l) => (
                      <FoodRow key={l.id} log={l} onDelete={() => void remove(l.id)} />
                    ))}
                  </ul>
                )}
              </section>

              {/* Add Food */}
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-purple-deep)] font-display text-base font-bold text-white shadow-card"
              >
                <Plus className="h-5 w-5" /> Add food / drink
              </button>
            </>
          )}

          {/* Dai Maa card */}
          <section className="flex items-center gap-3 rounded-[26px] p-4 shadow-soft ring-1 ring-stone-200/60" style={{ background: 'linear-gradient(135deg,#f1e8ff,#faf1ff)' }}>
            <AssistantMark size={44} variant="tile" circle />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-bold text-[var(--foreground)]">Not sure what to feed next?</p>
              <p className="text-xs text-[var(--muted-foreground)]">Ask Dai Maa for simple, age-wise food ideas and guidance.</p>
            </div>
            <button type="button" onClick={() => navigate(askAssistantLink(id, 'What foods should I try next for my baby?'))} className="shrink-0 rounded-full bg-[var(--brand-purple-deep)] px-3.5 py-2 text-xs font-bold text-white">
              Ask
            </button>
          </section>
        </>
      )}

      {baby && (
        <BottomSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} title="Your babies" description="Switch who you're tracking">
          <ul className="space-y-2">
            {babies.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (b.id !== baby.id) selectBaby(b.id);
                    setSwitcherOpen(false);
                  }}
                  className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left', b.id === baby.id ? 'bg-[var(--brand-purple-tint)]' : 'hover:bg-[var(--surface-sunken)]')}
                >
                  <Avatar name={b.name} src={avatarUrl(b.avatar)} size="md" />
                  <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-[var(--foreground)]">{b.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}

      <AddFoodSheet open={sheetOpen} onClose={() => setSheetOpen(false)} babyName={baby?.name ?? 'your baby'} onSaved={() => { setSheetOpen(false); void load(); }} babyId={id} />
    </div>
  );
}

function FoodRow({ log, onDelete }: { log: FoodLog; onDelete: () => void }) {
  const [menu, setMenu] = useState(false);
  const r = REACTION[log.reaction];
  const Icon = log.mealType === 'snack' ? Apple : UtensilsCrossed;
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: FOOD.bg, color: FOOD.text }}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-[var(--muted-foreground)]">{formatTimeIST(log.loggedAt)}</span>
        <span className="flex items-center gap-1.5">
          <span className="truncate font-display text-[15px] font-semibold text-[var(--foreground)]">{log.foodName}</span>
          {log.isNewFood && <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--cat-assistant-text)]" />}
        </span>
        <span className="block truncate text-xs text-[var(--muted-foreground)]">{AMOUNT_LABEL[log.amount]}</span>
      </span>
      <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: r.bg, color: r.fg }}>
        {r.label}
      </span>
      <div className="relative shrink-0">
        <button type="button" onClick={() => setMenu((m) => !m)} aria-label="More" className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--surface-sunken)]">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menu && (
          <button type="button" onClick={onDelete} className="absolute right-0 top-9 z-10 flex items-center gap-1.5 rounded-xl bg-[var(--surface-card)] px-3 py-2 text-sm font-semibold text-rose-600 shadow-lift ring-1 ring-stone-200/60">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
      </div>
    </li>
  );
}

function AddFoodSheet({ open, onClose, babyId, babyName, onSaved }: { open: boolean; onClose: () => void; babyId: string; babyName: string; onSaved: () => void }) {
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [foodName, setFoodName] = useState('');
  const [amount, setAmount] = useState<FoodAmount>('some');
  const [groups, setGroups] = useState<string[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [when, setWhen] = useState(todayInputValueIST());
  const [saving, setSaving] = useState(false);

  const toggleGroup = (g: string) => setGroups((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  async function save() {
    if (!foodName.trim() || saving) return;
    setSaving(true);
    try {
      await addFood(babyId, {
        loggedAt: new Date(`${when}T12:00:00`).toISOString(),
        mealType,
        foodName: foodName.trim(),
        foodGroups: groups,
        texture: 'mashed',
        amount,
        reaction: 'none',
        isNewFood: isNew,
      });
      setFoodName('');
      setGroups([]);
      setIsNew(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const field = 'w-full rounded-xl border border-stone-300 bg-[var(--input-background)] px-3 py-2.5 text-[var(--foreground)] focus:border-emerald-500 focus:outline-none';

  return (
    <BottomSheet open={open} onClose={onClose} title={mealType === 'snack' ? 'Add snack' : 'Add meal'}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Type</label>
          <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} className={field}>
            {MEAL_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Food</label>
          <input value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder={`What did ${babyName} eat?`} className={field} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">How much</label>
          <div className="flex gap-2">
            {AMOUNTS.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setAmount(a.value)}
                className={cn('flex-1 rounded-xl border py-2 text-sm font-semibold', amount === a.value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-[var(--muted-foreground)]')}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Food groups</label>
          <div className="flex flex-wrap gap-2">
            {FOOD_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleGroup(g)}
                className={cn('rounded-full border px-3 py-1.5 text-sm font-semibold', groups.includes(g) ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-[var(--muted-foreground)]')}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="h-5 w-5 rounded" />
          <span className="text-sm font-semibold text-[var(--foreground)]">This is a new food</span>
        </label>
        <div>
          <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Date</label>
          <input type="date" value={when} max={todayInputValueIST()} onChange={(e) => setWhen(e.target.value)} className={field} />
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!foodName.trim() || saving}
          className="min-h-[48px] w-full rounded-2xl font-display text-base font-bold text-white shadow-card disabled:opacity-50"
          style={{ backgroundColor: FOOD.fg }}
        >
          {saving ? 'Saving…' : mealType === 'snack' ? 'Save snack' : 'Save meal'}
        </button>
      </div>
    </BottomSheet>
  );
}
