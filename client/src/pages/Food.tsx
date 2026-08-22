import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { AlertTriangle, Apple, ArrowLeft, Baby, CheckCircle2, ChevronDown, Clock, Leaf, MessageCircleHeart, ShieldAlert, ShieldCheck, Sparkles, Trash2, UtensilsCrossed } from 'lucide-react';
import { askAssistantLink } from '../lib/assistant';
import { addFood, deleteFood, listFood } from '../api/food';
import type { FoodAmount, FoodReaction, FoodResponse, FoodTexture, MealType } from '../api/food';
import { getBaby, updateBaby } from '../api/babies';
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

// ---------------------------------------------------------------------------
// #25 — Dietary preference
// ---------------------------------------------------------------------------
type DietaryPref = 'all' | 'vegetarian' | 'jain';

// ---------------------------------------------------------------------------
// #23 — Age-specific safe feeding guidance (ranges are [min, max) in months)
// ---------------------------------------------------------------------------
const AGE_SAFE_FEEDING: { range: string; minMonth: number; maxMonth: number; points: string[] }[] = [
  {
    range: '6–7 months',
    minMonth: 6,
    maxMonth: 8,
    points: [
      'Single-ingredient purées only — one new food at a time, wait 3 days before introducing another',
      'No added salt, sugar, or honey (botulism risk before 12 months)',
      'Start with iron-rich foods: ragi porridge, moong dal, mashed rice with dal',
      'Breast milk remains the primary nutrition — solids are a gentle addition',
      'Texture should be smooth and thin enough to drip off a spoon',
    ],
  },
  {
    range: '8–9 months',
    minMonth: 8,
    maxMonth: 10,
    points: [
      'Move to mashed and lumpy textures — no need to purée everything smooth now',
      'Introduce soft finger foods: banana pieces, steamed carrot sticks, soft idli pieces',
      'Begin introducing protein: well-cooked egg yolk, mashed dal, soft paneer',
      'Still no salt, sugar, or honey',
      'Offer water in a sippy cup with meals',
    ],
  },
  {
    range: '10–12 months',
    minMonth: 10,
    maxMonth: 12,
    points: [
      'Family foods (soft-cooked, mild spices) are fine — chop small, avoid hard pieces',
      'Encourage self-feeding with soft finger foods — expect mess, it builds motor skills',
      'Honey is STILL unsafe until 12 months (botulism risk)',
      'Three meals + 1–2 snacks daily, alongside breastfeeding',
      'Avoid whole nuts, whole grapes, popcorn, hard raw vegetables (choking hazards)',
    ],
  },
  {
    range: '12–18 months',
    minMonth: 12,
    maxMonth: 18,
    points: [
      'Most family foods are now safe — keep mildly spiced and cut small',
      'Boiled or pasteurised cow’s milk can be a drink now (not before 12 months)',
      'Honey is safe after 12 months in small amounts',
      'Continue avoiding choking hazards: whole nuts, whole grapes, popcorn, hard candy',
      'Encourage eating with the family — toddlers learn by watching',
    ],
  },
  {
    range: '18–24 months',
    minMonth: 18,
    maxMonth: 25,
    points: [
      'Regular family meals with minor modifications (less salt/spice, smaller pieces)',
      'Self-feeding with a spoon and cup — messy but important for development',
      'Offer a wide variety: grains, dal, vegetables, fruits, dairy, eggs/meat',
      'Limit sugary snacks and packaged food — fresh and homemade is best',
      'If a picky eater, keep offering rejected foods without pressure — it takes 10–15 exposures',
    ],
  },
];

function safeFeedingForAge(ageMonths: number) {
  return AGE_SAFE_FEEDING.find((s) => ageMonths >= s.minMonth && ageMonths < s.maxMonth) ?? null;
}

// ---------------------------------------------------------------------------
// #24 — Age-appropriate recipe suggestions
// ---------------------------------------------------------------------------
interface Recipe {
  name: string;
  ingredients: string;
  steps: string;
  dietaryNote?: 'non-veg' | 'egg';
}

const STAGE_RECIPES: { stageRange: string; minMonth: number; maxMonth: number; recipes: Recipe[] }[] = [
  {
    stageRange: '6–8 months',
    minMonth: 6,
    maxMonth: 9,
    recipes: [
      {
        name: 'Ragi (Finger Millet) Porridge',
        ingredients: '2 tbsp ragi flour, 1 cup water, a pinch of jaggery (optional, after 8 months)',
        steps: 'Mix ragi flour with a little cold water to make a smooth paste. Boil the remaining water, add the paste while stirring constantly, and cook on low heat for 5–7 minutes until thick and smooth. Cool before serving.',
      },
      {
        name: 'Moong Dal Purée',
        ingredients: '2 tbsp yellow moong dal, 1 cup water, a pinch of turmeric',
        steps: 'Wash and pressure-cook moong dal with water and turmeric for 3–4 whistles. Mash until completely smooth, adding breastmilk or water to thin if needed.',
      },
      {
        name: 'Carrot & Sweet Potato Mash',
        ingredients: '1 small carrot, 1 small sweet potato, water',
        steps: 'Peel and chop carrot and sweet potato. Steam or boil until very soft (about 15 minutes). Mash together with a fork until smooth, adding cooking water to reach a thin consistency.',
      },
      {
        name: 'Apple & Pear Stew',
        ingredients: '1 small apple, 1 small pear, 2 tbsp water',
        steps: 'Peel, core, and chop the fruits. Simmer in water on low heat for 8–10 minutes until very soft. Mash with a fork to a smooth consistency. Serve at room temperature.',
      },
      {
        name: 'Soft Khichdi',
        ingredients: '1 tbsp rice, 1 tbsp moong dal, 1 cup water, pinch of turmeric',
        steps: 'Wash rice and dal. Pressure-cook with water and turmeric for 4 whistles until very soft. Mash well with a spoon and thin with water if needed.',
      },
    ],
  },
  {
    stageRange: '9–11 months',
    minMonth: 9,
    maxMonth: 12,
    recipes: [
      {
        name: 'Vegetable Khichdi',
        ingredients: '1 tbsp rice, 1 tbsp moong dal, finely chopped carrot, potato, and spinach, pinch of turmeric and cumin',
        steps: 'Wash rice and dal. Add chopped vegetables, turmeric, and cumin. Pressure-cook with water for 3–4 whistles. Mash lightly — leave some texture for the lumpy stage.',
      },
      {
        name: 'Egg Bhurji (Scrambled Egg)',
        ingredients: '1 egg, pinch of turmeric, tiny bit of ghee',
        steps: 'Beat the egg with turmeric. Heat ghee in a pan, pour in the egg, and scramble on low heat until fully cooked through. Mash into small, soft pieces for baby.',
        dietaryNote: 'egg',
      },
      {
        name: 'Banana Oat Pancakes',
        ingredients: '1 ripe banana, 2 tbsp oats (powdered), 1 tbsp curd',
        steps: 'Mash the banana, mix with powdered oats and curd to form a thick batter. Cook small pancakes on a lightly greased tawa on low heat until golden on both sides. Cut into small finger-food strips.',
      },
      {
        name: 'Soft Idli with Dal',
        ingredients: 'Idli batter (homemade or fresh), thin moong dal',
        steps: 'Steam small idlis until soft. Break into small pieces. Serve with thin, warm moong dal for dipping or mixing.',
      },
      {
        name: 'Paneer & Peas Mash',
        ingredients: '2 tbsp crumbled paneer, 2 tbsp boiled peas, pinch of cumin',
        steps: 'Boil peas until very soft. Lightly mash peas (leave some texture). Mix with crumbled paneer and a pinch of roasted cumin powder. Serve warm.',
      },
    ],
  },
  {
    stageRange: '12–24 months',
    minMonth: 12,
    maxMonth: 25,
    recipes: [
      {
        name: 'Mini Paratha Rolls',
        ingredients: 'Whole-wheat dough, grated paneer or mashed potato, mild spices, ghee',
        steps: 'Mix grated paneer (or mashed potato) with a pinch of cumin and turmeric. Stuff into small parathas. Cook on a tawa with a little ghee until golden. Cut into small triangles or rolls.',
      },
      {
        name: 'Chicken & Vegetable Soft Stew',
        ingredients: '2 tbsp minced chicken, chopped carrot, potato, peas, pinch of turmeric and cumin',
        steps: 'Cook minced chicken with turmeric in a little water until fully done. Add chopped vegetables and simmer until everything is very soft. Mash lightly and serve with soft rice.',
        dietaryNote: 'non-veg',
      },
      {
        name: 'Roti Pizza Bites',
        ingredients: '1 soft roti, 1 tbsp tomato purée (no salt), grated paneer, finely chopped veggies',
        steps: 'Spread tomato purée on roti. Top with finely chopped veggies and grated paneer. Warm on a tawa with a lid until paneer softens. Cut into small, easy-to-hold pieces.',
      },
      {
        name: 'Dal-Rice Bowl with Ghee',
        ingredients: 'Soft-cooked rice, any dal (masoor/moong/toor), a drop of ghee, mashed veggies',
        steps: 'Mix soft rice with well-cooked dal. Add a drop of ghee and mashed seasonal vegetables. Mash to the texture your toddler prefers — some lumps are fine.',
      },
      {
        name: 'Banana & Ragi Halwa',
        ingredients: '1 ripe banana, 1 tbsp ragi flour, 1 tsp ghee, a pinch of cardamom',
        steps: 'Roast ragi flour in ghee on low heat for 2 minutes. Add mashed banana and a little water. Cook while stirring for 3–4 minutes until thick. Add cardamom powder and serve warm.',
      },
    ],
  },
];

function recipesForAge(ageMonths: number) {
  return STAGE_RECIPES.find((s) => ageMonths >= s.minMonth && ageMonths < s.maxMonth) ?? null;
}

// ---------------------------------------------------------------------------
// #25 — Food introduction timeline
// ---------------------------------------------------------------------------
interface IntroductionItem {
  food: string;
  when: string;
  detail: string;
  icon: string;
  isVeg: boolean;
  isJainSafe: boolean;
}

const INTRODUCTION_GUIDE: IntroductionItem[] = [
  {
    food: 'Eggs',
    when: 'After 6 months',
    detail: 'Start with well-cooked yolk mixed into purée. Introduce white gradually. Egg is an excellent source of iron and protein for babies.',
    icon: '🥚',
    isVeg: false,
    isJainSafe: false,
  },
  {
    food: 'Chicken & fish',
    when: 'After 7–8 months',
    detail: 'Well-cooked, deboned, and finely mashed or minced. Start with mild white fish or soft-cooked chicken. Always ensure it is thoroughly cooked.',
    icon: '🍗',
    isVeg: false,
    isJainSafe: false,
  },
  {
    food: 'Common allergens (peanut, dairy, wheat)',
    when: 'After 6 months, one at a time',
    detail: 'Introduce one new potential allergen at a time and wait 3 days before the next, watching for rash, swelling, vomiting, or breathing changes. Early introduction (not avoidance) may reduce allergy risk.',
    icon: '⚠️',
    isVeg: true,
    isJainSafe: true,
  },
  {
    food: 'Honey',
    when: 'NEVER before 12 months',
    detail: 'Honey can contain Clostridium botulinum spores that cause infant botulism — a serious, potentially life-threatening illness. Safe only after the first birthday.',
    icon: '🍯',
    isVeg: true,
    isJainSafe: true,
  },
  {
    food: 'Cow’s milk (as main drink)',
    when: 'After 12 months',
    detail: 'Before 12 months, breast milk is the main drink. After 12 months, boiled or pasteurised cow’s milk can be offered as a drink. Use in cooking (curd, paneer) is fine earlier.',
    icon: '🥛',
    isVeg: true,
    isJainSafe: true,
  },
  {
    food: 'Nuts & seeds',
    when: 'After 6 months (ground/paste only)',
    detail: 'Ground nut powder or smooth nut paste (peanut, almond) can be mixed into porridge from 6 months. Whole nuts are a choking hazard until 5 years — never give whole.',
    icon: '🥜',
    isVeg: true,
    isJainSafe: true,
  },
  {
    food: 'Root vegetables',
    when: 'After 6 months',
    detail: 'Potato, carrot, beetroot, sweet potato, onion, garlic, and ginger are nutritious first foods. Steam or boil until very soft.',
    icon: '🥕',
    isVeg: true,
    isJainSafe: false,
  },
];

const JAIN_ALTERNATIVES: Record<string, string> = {
  'Onion': 'Use asafoetida (hing) for flavour',
  'Garlic': 'Use cumin and coriander seeds',
  'Potato': 'Use sweet potato, yam, or raw banana',
  'Ginger': 'Use dry ginger powder (saunth) in very small amounts',
  'Beetroot': 'Use pumpkin or red bell pepper for colour',
  'Carrot': 'Use bottle gourd (lauki) or ridge gourd (turai)',
};

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
  const [error, setError] = useState<string | null>(null);
  // Baby's name + feeding baseline (solidsStartedOn), for the solids-start milestone.
  const [babyName, setBabyName] = useState<string>('');
  const [solidsStartedOn, setSolidsStartedOn] = useState<string | null>(null);
  const [confirmingSolids, setConfirmingSolids] = useState(false);

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
  const [dietaryPref, setDietaryPref] = useState<DietaryPref>('all');
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);

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
    getBaby(id)
      .then(({ baby }) => {
        if (cancelled) return;
        setBabyName(baby.name);
        setSolidsStartedOn(baby.solidsStartedOn ?? null);
      })
      .catch(() => {
        /* the solids milestone is a bonus — the log works without it */
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Record that solids have begun (the feeding-journey milestone). Breastfeeding
  // continues alongside — guidance stays homemade-first / IMS-compliant.
  async function confirmSolidsStarted() {
    if (id === undefined) return;
    setConfirmingSolids(true);
    setError(null);
    try {
      const today = todayInputValueIST();
      await updateBaby(id, { solidsStartedOn: today });
      setSolidsStartedOn(today);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setConfirmingSolids(false);
    }
  }

  // IMS Act 1992 (CLAUDE.md rule 4): never normalize infant formula / milk
  // substitutes; feeding stays breastfeeding-first. Mirror of the server-side
  // detector (server/src/ai/compliance.ts) so a typed food name like "Lactogen
  // formula milk" surfaces a gentle, NON-blocking note. Keep in sync with the
  // server list if brands change.
  const mentionsFormula = useMemo(() => {
    const f = foodName.toLowerCase();
    if (!f.trim()) return false;
    return (
      /\bformulas?\b/.test(f) ||
      /\b(infant|breast[-\s]?milk|milk)\s+substitutes?\b/.test(f) ||
      /\b(cerelac|lactogen|nan\s?pro|nanpro|similac|enfamil|dexolac|nestogen|aptamil|farex|nusobee)\b/.test(f)
    );
  }, [foodName]);

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
    if (!window.confirm('Delete this meal? This permanently removes the logged entry and cannot be undone.')) return;
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
        {guidance && id && (
          <div className="mt-3">
            <Link
              to={askAssistantLink(
                id,
                guidance.underSix
                  ? `When and how should I start solids for my baby, and what first foods are safe to try?`
                  : `What foods and roughly how much are right for my baby's age now, and how do I introduce variety and common allergens safely?`,
              )}
              className="inline-flex items-center gap-1.5 text-sm font-bold"
              style={{ color: 'var(--cat-assistant)' }}
            >
              <MessageCircleHeart className="h-4 w-4" /> Feeding questions? Ask Dai Maa
            </Link>
          </div>
        )}
      </div>

      {/* Feeding-journey milestone: at 6 months+, confirm solids have begun. Uses the
          onboarding baseline (solidsStartedOn); breastfeeding continues alongside. */}
      {guidance && !guidance.underSix && (
        <SolidsMilestoneCard
          babyName={babyName}
          ageMonths={guidance.ageMonths}
          solidsStartedOn={solidsStartedOn}
          onConfirm={() => void confirmSolidsStarted()}
          confirming={confirmingSolids}
        />
      )}

      {id && logs !== null && <TrackerInsight babyId={id} tracker="food" hasData={logs.length > 0} signature={logs.length} className="mt-5" />}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Log form */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-bold text-stone-800">Log a meal</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Section: When */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">When</p>
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
              </div>

              <div className="border-t border-stone-100" />

              {/* Section: What */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">What</p>
                <div>
                  <label htmlFor="foodName" className="block text-sm font-medium text-stone-700">
                    What did baby eat?
                  </label>
                  <input id="foodName" type="text" required maxLength={120} placeholder="e.g. mashed banana, soft khichdi" value={foodName} onChange={(e) => setFoodName(e.target.value)} className={inputCls} />
                  {mentionsFormula && (
                    <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Mother&apos;s milk is best for your baby. Breastfeeding (or expressed breastmilk) is recommended through the first year — from 6 months alongside freshly prepared homemade foods. Mateo&apos;s feeding guidance stays brand-neutral and never recommends infant formula or milk substitutes. You can still log this entry.</span>
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
              </div>

              <div className="border-t border-stone-100" />

              {/* Section: How it went */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">How it went</p>
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

      {/* #24 — Recipe suggestions (age-appropriate) */}
      {guidance && !guidance.underSix && (
        <div className="mt-6">
          <RecipeSuggestionsCard
            ageMonths={guidance.ageMonths}
            dietaryPref={dietaryPref}
            expandedRecipe={expandedRecipe}
            onToggle={(name) => setExpandedRecipe((prev) => (prev === name ? null : name))}
          />
        </div>
      )}

      {/* #25 — Food introduction guidance */}
      {guidance && !guidance.underSix && (
        <div className="mt-6">
          <FoodIntroductionCard
            dietaryPref={dietaryPref}
            onChangePref={setDietaryPref}
          />
        </div>
      )}
    </div>
  );
}

// The solids-start milestone card, shown from 6 months. Before it's recorded it's a
// gentle "ready to begin?" nudge; once confirmed it becomes a quiet acknowledgement.
function SolidsMilestoneCard({
  babyName,
  ageMonths,
  solidsStartedOn,
  onConfirm,
  confirming,
}: {
  babyName: string;
  ageMonths: number;
  solidsStartedOn: string | null;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const who = babyName || 'your baby';
  if (solidsStartedOn) {
    return (
      <Card className="mt-4 flex items-center gap-3 p-4" style={{ backgroundColor: 'var(--cat-food-bg)' }}>
        <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: 'var(--cat-food-text)' }} />
        <p className="text-sm text-stone-700">
          <span className="font-semibold text-stone-900">Solids journey began {formatDateIST(solidsStartedOn)}.</span>{' '}
          Keep breastfeeding on demand alongside — food is in addition to milk, not a replacement yet.
        </p>
      </Card>
    );
  }
  return (
    <Card className="mt-4 p-5" style={{ borderColor: 'var(--cat-food)' }}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5" style={{ color: 'var(--cat-food)' }} />
        <h2 className="font-bold text-stone-900">Has {who} started solid foods?</h2>
      </div>
      <p className="mt-2 text-sm text-stone-700">
        {who} is {ageMonths} months old — this is the ideal window to begin first foods, thick and well-mashed,
        while continuing to breastfeed on demand. Start with 2–3 spoonfuls once a day and build up slowly.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={onConfirm} disabled={confirming}>
          {confirming ? 'Saving…' : "Yes, we've started 🎉"}
        </Button>
        <span className="text-xs text-stone-500">Not yet? That’s okay — begin when you see the readiness signs.</span>
      </div>
    </Card>
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
  const ageSpecific = guidance.underSix ? null : safeFeedingForAge(guidance.ageMonths);
  return (
    <Card className="mt-3 p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-rose-500" />
        <h2 className="font-bold text-stone-800">Safe feeding</h2>
        {ageSpecific && <Pill tone="stone">{ageSpecific.range}</Pill>}
      </div>
      {/* #23 — Age-specific safe feeding guidance */}
      {ageSpecific && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cat-food-text)' }}>
            What&apos;s right at {ageSpecific.range}
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {ageSpecific.points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-xs text-stone-700">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" style={{ color: 'var(--cat-food)' }} />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className={cn('text-xs font-semibold uppercase tracking-wide text-stone-500', ageSpecific ? 'mt-4 border-t border-stone-100 pt-3' : 'mt-2')}>
        Never feed
      </p>
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

// ---------------------------------------------------------------------------
// #24 — Recipe suggestions (expandable cards, age-appropriate)
// ---------------------------------------------------------------------------
function RecipeSuggestionsCard({
  ageMonths,
  dietaryPref,
  expandedRecipe,
  onToggle,
}: {
  ageMonths: number;
  dietaryPref: DietaryPref;
  expandedRecipe: string | null;
  onToggle: (name: string) => void;
}) {
  const stageRecipes = recipesForAge(ageMonths);
  if (!stageRecipes) return null;

  const filtered = stageRecipes.recipes.filter((r) => {
    if (dietaryPref === 'all') return true;
    // Vegetarian and Jain exclude non-veg and egg
    return !r.dietaryNote;
  });

  if (filtered.length === 0) return null;

  return (
    <Card className="p-5" data-reveal="">
      <div className="flex items-center gap-2">
        <UtensilsCrossed className="h-5 w-5" style={{ color: 'var(--cat-food)' }} />
        <h2 className="font-bold text-stone-900">Meal ideas for {stageRecipes.stageRange}</h2>
      </div>
      <p className="mt-1 text-sm text-stone-500">Age-appropriate, homemade recipe suggestions — tap to expand</p>
      <div className="mt-3 space-y-2">
        {filtered.map((recipe) => {
          const isOpen = expandedRecipe === recipe.name;
          return (
            <div key={recipe.name} className="rounded-xl border border-stone-100 bg-stone-50/50">
              <button
                type="button"
                onClick={() => onToggle(recipe.name)}
                className="flex w-full items-center justify-between gap-3 p-3 text-left"
              >
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-stone-800">{recipe.name}</span>
                  {recipe.dietaryNote === 'egg' && (
                    <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Egg</span>
                  )}
                  {recipe.dietaryNote === 'non-veg' && (
                    <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Non-veg</span>
                  )}
                </div>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-stone-400 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="border-t border-stone-100 px-3 pb-3 pt-2">
                  <p className="text-xs text-stone-600">
                    <span className="font-semibold text-stone-700">Ingredients:</span> {recipe.ingredients}
                  </p>
                  <p className="mt-1.5 text-xs text-stone-600">{recipe.steps}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-stone-500">
        All recipes are homemade and brand-neutral. Adjust textures and quantities to your baby&apos;s readiness.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// #25 — Food introduction guidance with dietary preference toggle
// ---------------------------------------------------------------------------
function FoodIntroductionCard({
  dietaryPref,
  onChangePref,
}: {
  dietaryPref: DietaryPref;
  onChangePref: (p: DietaryPref) => void;
}) {
  const items = INTRODUCTION_GUIDE.filter((item) => {
    if (dietaryPref === 'all') return true;
    if (dietaryPref === 'vegetarian') return item.isVeg;
    if (dietaryPref === 'jain') return item.isJainSafe;
    return true;
  });

  return (
    <Card className="p-5" data-reveal="">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5" style={{ color: 'var(--cat-food)' }} />
        <h2 className="font-bold text-stone-900">When to introduce foods</h2>
      </div>
      <p className="mt-1 text-sm text-stone-500">A guide to safely introducing key food groups as your baby grows</p>

      {/* Dietary preference toggle */}
      <div className="mt-3">
        <span className="block text-[11px] font-bold uppercase tracking-widest text-stone-400">Dietary preference</span>
        <div className="mt-1.5 inline-flex flex-wrap gap-0.5 rounded-xl bg-stone-100 p-0.5">
          {([
            { value: 'all' as const, label: 'Non-vegetarian' },
            { value: 'vegetarian' as const, label: 'Vegetarian' },
            { value: 'jain' as const, label: 'Jain' },
          ]).map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={dietaryPref === o.value}
              onClick={() => onChangePref(o.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                dietaryPref === o.value ? 'bg-white text-stone-900 shadow-soft' : 'text-stone-500 hover:text-stone-700',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Introduction timeline */}
      <div className="mt-4 space-y-2.5">
        {items.map((item) => {
          const isWarning = item.food === 'Honey';
          return (
            <div
              key={item.food}
              className={cn('rounded-xl border p-3', isWarning ? 'border-rose-200 bg-rose-50/50' : 'border-stone-100')}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-base" aria-hidden="true">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-stone-800">{item.food}</span>
                    <span
                      className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', isWarning ? 'bg-rose-100 text-rose-700' : '')}
                      style={isWarning ? undefined : { backgroundColor: 'var(--cat-food-bg)', color: 'var(--cat-food-text)' }}
                    >
                      {item.when}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-600">{item.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Jain alternatives */}
      {dietaryPref === 'jain' && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold text-stone-800">Jain-friendly alternatives</h3>
          </div>
          <p className="mt-1 text-xs text-stone-600">
            Root vegetables (onion, garlic, potato, ginger) are excluded in Jain dietary practice. Here are nutritious swaps:
          </p>
          <ul className="mt-2 space-y-1.5">
            {Object.entries(JAIN_ALTERNATIVES).map(([item, alt]) => (
              <li key={item} className="flex items-start gap-2 text-xs text-stone-700">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                <span>
                  <span className="font-semibold">{item}:</span> {alt}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">
        Every baby is different. This is general guidance, not a medical prescription. Consult your pediatrician before introducing allergens, especially if there is a family history of allergies.
      </p>
    </Card>
  );
}
