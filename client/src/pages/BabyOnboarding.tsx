import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  Baby as BabyIcon,
  Bell,
  Check,
  HeartHandshake,
  Mail,
  MessageCircle,
  Milk,
  Moon,
  Ruler,
  ShieldCheck,
  Syringe,
  UtensilsCrossed,
} from 'lucide-react';
import { createBaby, updateBaby } from '../api/babies';
import { addGrowthLog } from '../api/growth';
import { listVaccines, setVaccineAdministered, type VaccineDose } from '../api/vaccines';
import { addSleep } from '../api/sleep';
import { updateNotificationPreferences, type NotificationLanguage } from '../api/notificationPrefs';
import { ApiError } from '../api/client';
import { ageInMonths, toDateInputValueIST, todayInputValueIST } from '../lib/age';
import { avatarsForSex, avatarUrl } from '../lib/avatars';
import { Card } from '../components/ui/Card';
import { DatePicker } from '../components/ui/DatePicker';
import { BrandTile } from '../components/ui/BrandTile';
import { cn } from '../lib/cn';

const fieldCls =
  'h-12 w-full rounded-xl border-[1.5px] border-stone-200 bg-white px-3.5 text-[0.95rem] font-medium text-stone-900 transition-colors placeholder:font-normal placeholder:text-stone-400 hover:border-stone-300 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15';

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
function kgToGrams(value: string): number | undefined {
  const kg = parseOptionalNumber(value);
  return kg === undefined ? undefined : Math.round(kg * 1000);
}

// The wizard steps, in order. Kept as data so the progress dots + titles stay in sync.
const STEPS = [
  { key: 'basics', title: 'Your baby', icon: BabyIcon },
  { key: 'growth', title: 'Measurements', icon: Ruler },
  { key: 'vaccines', title: 'Vaccinations', icon: Syringe },
  { key: 'feeding', title: 'Feeding', icon: UtensilsCrossed },
  { key: 'sleep', title: 'Sleep', icon: Moon },
  { key: 'notify', title: 'Reminders', icon: Bell },
] as const;

const HOUR_OPTIONS = [6, 7, 8, 9, 10, 12, 18, 20, 21];
function hourLabel(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${ampm}`;
}

const LANG_OPTIONS: { value: NotificationLanguage; label: string; hint: string }[] = [
  { value: 'en', label: 'English', hint: 'Day 1: hello world!' },
  { value: 'hi', label: 'हिन्दी', hint: 'शुद्ध हिन्दी में' },
  { value: 'hi-en', label: 'Hinglish', hint: 'Din 1: hello world!' },
];

function MeasureInput({ id, label, unit, step, placeholder, value, onChange }: { id: string; label: string; unit: string; step: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[0.72rem] font-semibold text-stone-600">{label}</label>
      <div className="relative">
        <input id={id} type="number" min="0" step={step} inputMode="decimal" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className={cn(fieldCls, 'pr-9')} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">{unit}</span>
      </div>
    </div>
  );
}

// A soft on/off row for a notification channel.
function Toggle({ on, onClick, icon: Icon, label, sub }: { on: boolean; onClick: () => void; icon: typeof Mail; label: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center gap-3 rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-left transition-all hover:border-stone-300"
      style={{ borderColor: on ? 'var(--primary)' : undefined, background: on ? 'var(--cat-sleep-bg)' : undefined }}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: on ? 'var(--primary)' : 'var(--cat-sleep-bg)', color: on ? '#fff' : 'var(--cat-sleep-text)' }}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-stone-800">{label}</span>
        <span className="block text-[0.72rem] text-stone-500">{sub}</span>
      </span>
      <span aria-hidden className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 border-stone-200 text-white" style={{ borderColor: on ? 'transparent' : undefined, background: on ? 'var(--primary)' : 'transparent' }}>
        {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

export default function BabyOnboarding() {
  const navigate = useNavigate();
  const today = todayInputValueIST();

  const [step, setStep] = useState(0);
  const [babyId, setBabyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [softNote, setSoftNote] = useState<string | null>(null);

  // Step 0 — basics
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [avatar, setAvatar] = useState('');
  const [birthWeightKg, setBirthWeightKg] = useState('');
  const [birthLengthCm, setBirthLengthCm] = useState('');
  const [birthHeadCircCm, setBirthHeadCircCm] = useState('');

  // Step 1 — current measurements
  const [curWeightKg, setCurWeightKg] = useState('');
  const [curLengthCm, setCurLengthCm] = useState('');
  const [curHeadCm, setCurHeadCm] = useState('');

  // Step 2 — vaccines already given
  const [doses, setDoses] = useState<VaccineDose[]>([]);
  const [dosesLoaded, setDosesLoaded] = useState(false);
  const [checkedDoses, setCheckedDoses] = useState<Record<string, boolean>>({});

  // Step 3 — feeding
  const [startedSolids, setStartedSolids] = useState<boolean | null>(null);
  const [solidsDate, setSolidsDate] = useState(today);

  // Step 4 — sleep
  const [sleepH, setSleepH] = useState('');
  const [sleepM, setSleepM] = useState('');

  // Step 5 — notifications
  const [emailOn, setEmailOn] = useState(true);
  const [whatsappOn, setWhatsappOn] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [preferredHour, setPreferredHour] = useState(9);
  const [language, setLanguage] = useState<NotificationLanguage>('en');

  const monthsOld = dob ? ageInMonths(dob) : 0;
  const canStartBasics = name.trim() !== '' && dob !== '' && sex !== '';

  function msg(err: unknown): string {
    return err instanceof ApiError ? err.message : 'Something went wrong, please try again';
  }

  // Load the vaccine doses that could plausibly already be given (window has opened:
  // due or overdue). Best-effort — a not-yet-subscribed parent gets a soft note.
  async function loadDosesIfNeeded(id: string) {
    if (dosesLoaded) return;
    try {
      const { doses: all } = await listVaccines(id);
      setDoses(all.filter((d) => d.status === 'due' || d.status === 'overdue'));
      setDosesLoaded(true);
    } catch {
      setDoses([]);
      setDosesLoaded(true);
      setSoftNote("We couldn't load the vaccine list right now — you can mark doses on the Vaccines page anytime.");
    }
  }

  // Advance to the next step, persisting the current step's data first (best-effort
  // for the optional seed steps; blocking only for the required baby-create step).
  async function next() {
    setError(null);
    setSoftNote(null);
    setBusy(true);
    try {
      const s = STEPS[step].key;

      if (s === 'basics') {
        if (!canStartBasics) {
          setError('Please add a name, date of birth and sex.');
          setBusy(false);
          return;
        }
        // canStartBasics guarantees sex is set; TS narrows it to 'male' | 'female' here.
        const input = {
          name: name.trim(),
          dob,
          sex,
          avatar: avatar || undefined,
          birthWeightG: kgToGrams(birthWeightKg),
          birthLengthCm: parseOptionalNumber(birthLengthCm),
          birthHeadCircCm: parseOptionalNumber(birthHeadCircCm),
        };
        // Creating the baby seeds its vaccine schedule server-side. On Back+edit we
        // update the same baby instead of making a second one.
        const { baby } = babyId ? await updateBaby(babyId, input) : await createBaby(input);
        setBabyId(baby.id);
        await loadDosesIfNeeded(baby.id);
      } else if (s === 'growth' && babyId) {
        const weightG = kgToGrams(curWeightKg);
        const lengthCm = parseOptionalNumber(curLengthCm);
        const headCircCm = parseOptionalNumber(curHeadCm);
        if (weightG !== undefined || lengthCm !== undefined || headCircCm !== undefined) {
          try {
            await addGrowthLog(babyId, { loggedAt: today, weightG, lengthCm, headCircCm });
          } catch (err) {
            setSoftNote(`We saved your baby, but couldn't record the measurement (${msg(err)}). You can add it on the Growth page.`);
          }
        }
      } else if (s === 'vaccines') {
        const toMark = doses.filter((d) => checkedDoses[d.id]);
        if (toMark.length > 0) {
          const results = await Promise.allSettled(
            toMark.map((d) => setVaccineAdministered(d.id, toDateInputValueIST(d.dueDate))),
          );
          if (results.some((r) => r.status === 'rejected')) {
            setSoftNote('Some vaccine marks didn’t save — you can set them on the Vaccines page.');
          }
        }
      } else if (s === 'feeding' && babyId) {
        // Only ≥6mo babies get the solids question; persist the start date if given.
        if (startedSolids === true) {
          try {
            await updateBaby(babyId, { solidsStartedOn: solidsDate });
          } catch (err) {
            setSoftNote(`Couldn't save the feeding start date (${msg(err)}).`);
          }
        }
      } else if (s === 'sleep' && babyId) {
        const durationMin = (parseOptionalNumber(sleepH) ?? 0) * 60 + (parseOptionalNumber(sleepM) ?? 0);
        if (durationMin > 0) {
          try {
            await addSleep(babyId, { loggedAt: today, kind: 'night', durationMin });
          } catch (err) {
            setSoftNote(`Couldn't record last night's sleep (${msg(err)}).`);
          }
        }
      } else if (s === 'notify') {
        try {
          await updateNotificationPreferences({
            emailEnabled: emailOn,
            whatsappEnabled: whatsappOn,
            whatsappNumber: whatsappOn ? whatsappNumber.trim() : '',
            preferredHour,
            language,
          });
        } catch (err) {
          // Non-fatal: finish onboarding regardless; prefs can be set later.
          setSoftNote(`Couldn't save reminder preferences (${msg(err)}).`);
        }
        finish();
        return;
      }

      setStep((n) => Math.min(n + 1, STEPS.length - 1));
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    if (babyId) {
      try {
        localStorage.setItem('mateo:activeBaby', babyId);
      } catch {
        /* ignore storage errors */
      }
    }
    navigate('/');
  }

  function back() {
    setError(null);
    setSoftNote(null);
    setStep((n) => Math.max(n - 1, 0));
  }

  // Optional steps can be skipped without saving anything.
  const canSkip = step > 0 && STEPS[step].key !== 'notify';

  const Current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-4 flex items-center gap-3.5">
        <BrandTile icon={BabyIcon} iconClassName="h-6 w-6" className="h-12 w-12 shrink-0 rounded-2xl shadow-soft" />
        <div className="flex-1">
          <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">Welcome your baby</h1>
          <p className="text-sm text-stone-500">Set the baseline once — every tracker fills itself in from here.</p>
        </div>
        <img src="/bear-mascot.png" alt="" className="animate-float h-16 w-auto shrink-0" />
      </header>

      {/* Progress dots */}
      <ol className="mt-6 flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center">
            <span
              className="h-1.5 w-full rounded-full transition-colors"
              style={{ background: i <= step ? 'var(--primary)' : 'var(--cat-sleep-bg)' }}
            />
          </li>
        ))}
      </ol>

      <Card className="mt-5 p-6 sm:p-7">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--cat-sleep-bg)', color: 'var(--primary)' }}>
            <Current.icon className="h-[19px] w-[19px]" />
          </span>
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-stone-400">Step {step + 1} of {STEPS.length}</p>
            <h2 className="font-display text-lg font-bold text-stone-900">{Current.title}</h2>
          </div>
        </div>

        {/* STEP 0 — basics */}
        {Current.key === 'basics' && (
          <div className="flex flex-col gap-5">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-bold text-stone-800">Baby’s name</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarav" className={fieldCls} />
            </div>
            <div>
              <label htmlFor="dob" className="mb-1.5 block text-sm font-bold text-stone-800">Date of birth</label>
              <DatePicker id="dob" max={today} value={dob} onChange={setDob} placeholder="Select date of birth" className={fieldCls} />
              <p className="mt-1.5 px-0.5 text-xs text-stone-500">We use this to age every tracker — vaccines, growth, milestones.</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-stone-800">Sex</p>
              <div className="flex gap-3">
                {(['female', 'male'] as const).map((val) => {
                  const active = sex === val;
                  const tone = val === 'female' ? 'skin' : 'sleep';
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => { setSex(val); if (avatar && !avatarsForSex(val).includes(avatar)) setAvatar(''); }}
                      className="flex flex-1 items-center gap-3 rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-left transition-all hover:shadow-soft"
                      style={{ borderColor: active ? `var(--cat-${tone}-text)` : undefined, background: active ? `var(--cat-${tone}-bg)` : undefined }}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: active ? `var(--cat-${tone}-text)` : `var(--cat-${tone}-bg)`, color: active ? '#fff' : `var(--cat-${tone}-text)` }}>
                        <BabyIcon className="h-5 w-5" />
                      </span>
                      <span className="font-display text-[1.05rem] font-semibold" style={{ color: active ? `var(--cat-${tone}-text)` : 'var(--text-primary)' }}>{val === 'female' ? 'Girl' : 'Boy'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {sex !== '' && (
              <div>
                <p className="mb-2 text-sm font-bold text-stone-800">Pick an avatar <span className="font-normal text-stone-400">· optional</span></p>
                <div role="radiogroup" aria-label="Baby avatar" className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
                  {avatarsForSex(sex).map((key) => {
                    const active = avatar === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`Avatar ${key}`}
                        onClick={() => setAvatar(active ? '' : key)}
                        className="relative aspect-square overflow-hidden rounded-2xl border-2 bg-white transition-all hover:shadow-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/20"
                        style={{ borderColor: active ? 'var(--primary)' : 'rgb(231 229 228)', transform: active ? 'translateY(-1px)' : undefined }}
                      >
                        <img src={avatarUrl(key) ?? undefined} alt="" className="h-full w-full object-cover" />
                        {active && (
                          <span aria-hidden="true" className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-white shadow-soft" style={{ background: 'var(--primary)' }}>
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <p className="mb-2 text-sm font-bold text-stone-800">Birth measurements <span className="font-normal text-stone-400">· optional, from your discharge summary</span></p>
              <div className="grid grid-cols-3 gap-3">
                <MeasureInput id="bw" label="Weight" unit="kg" step="0.01" placeholder="3.2" value={birthWeightKg} onChange={setBirthWeightKg} />
                <MeasureInput id="bl" label="Length" unit="cm" step="0.1" placeholder="50" value={birthLengthCm} onChange={setBirthLengthCm} />
                <MeasureInput id="bh" label="Head" unit="cm" step="0.1" placeholder="35" value={birthHeadCircCm} onChange={setBirthHeadCircCm} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 1 — current measurements */}
        {Current.key === 'growth' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-stone-600">Add {name || 'your baby'}’s latest weight and height if you have them — it starts the growth chart. You can skip this and add it later.</p>
            <div className="grid grid-cols-3 gap-3">
              <MeasureInput id="cw" label="Weight" unit="kg" step="0.01" placeholder="6.4" value={curWeightKg} onChange={setCurWeightKg} />
              <MeasureInput id="cl" label="Length" unit="cm" step="0.1" placeholder="61" value={curLengthCm} onChange={setCurLengthCm} />
              <MeasureInput id="ch" label="Head" unit="cm" step="0.1" placeholder="40" value={curHeadCm} onChange={setCurHeadCm} />
            </div>
            <p className="rounded-xl bg-stone-50 px-3.5 py-2.5 text-xs text-stone-500">We’ll plot this against WHO percentile bands — never a single “should weigh” number.</p>
          </div>
        )}

        {/* STEP 2 — vaccines already given */}
        {Current.key === 'vaccines' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-stone-600">Tick any vaccines {name || 'your baby'} has <strong>already received</strong>. Everything starts unticked — we never assume a dose was given.</p>
            {!dosesLoaded ? (
              <p className="text-sm text-stone-500">Loading schedule…</p>
            ) : doses.length === 0 ? (
              <p className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">Nothing is due yet — all of {name || 'your baby'}’s vaccines are still ahead. We’ll remind you when each one is coming up. 🌱</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {doses.map((d) => {
                  const on = !!checkedDoses[d.id];
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setCheckedDoses((c) => ({ ...c, [d.id]: !on }))}
                        className="flex w-full items-center gap-3 rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-left transition-all hover:border-stone-300"
                        style={{ borderColor: on ? 'var(--cat-growth-text)' : undefined, background: on ? 'var(--cat-growth-bg)' : undefined }}
                      >
                        <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-stone-300 text-white" style={{ borderColor: on ? 'transparent' : undefined, background: on ? 'var(--cat-growth-text)' : 'transparent' }}>
                          {on && <Check className="h-4 w-4" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-stone-800">{d.vaccineName} · {d.doseLabel}</span>
                          <span className="block text-[0.72rem] text-stone-500">{d.ageLabel}{d.protectsAgainst ? ` · ${d.protectsAgainst}` : ''}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* STEP 3 — feeding */}
        {Current.key === 'feeding' && (
          <div className="flex flex-col gap-4">
            {monthsOld < 6 ? (
              <>
                <div className="flex items-start gap-3 rounded-xl px-4 py-3.5" style={{ background: 'var(--cat-food-bg)' }}>
                  <Milk className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--cat-food-text)' }} />
                  <p className="text-sm" style={{ color: 'var(--cat-food-text)' }}>
                    Under 6 months, breast milk is the only food and drink your baby needs — not even water. We’ll nudge you around the 6-month mark when it’s time to start solids.
                  </p>
                </div>
                <p className="text-xs text-stone-500">Nothing to fill in here for now — just tap Continue.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-stone-600">Has {name || 'your baby'} started eating solid foods yet?</p>
                <div className="flex gap-3">
                  {[{ v: true, l: 'Yes, started' }, { v: false, l: 'Not yet' }].map((o) => {
                    const active = startedSolids === o.v;
                    return (
                      <button
                        key={o.l}
                        type="button"
                        onClick={() => setStartedSolids(o.v)}
                        className="flex-1 rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-700 transition-all"
                        style={{ borderColor: active ? 'var(--cat-food-text)' : undefined, background: active ? 'var(--cat-food-bg)' : undefined, color: active ? 'var(--cat-food-text)' : undefined }}
                      >
                        {o.l}
                      </button>
                    );
                  })}
                </div>
                {startedSolids === true && (
                  <div>
                    <label htmlFor="solids" className="mb-1.5 block text-sm font-bold text-stone-800">Around when did you start? <span className="font-normal text-stone-400">· approximate is fine</span></label>
                    <DatePicker id="solids" max={today} value={solidsDate} onChange={setSolidsDate} className={fieldCls} />
                  </div>
                )}
                <p className="rounded-xl bg-stone-50 px-3.5 py-2.5 text-xs text-stone-500">Feeding guidance stays homemade-first and breastfeeding-friendly — we never recommend formula or brands.</p>
              </>
            )}
          </div>
        )}

        {/* STEP 4 — sleep */}
        {Current.key === 'sleep' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-stone-600">Roughly how long did {name || 'your baby'} sleep last night? Optional — it just gives the sleep tracker a first data point.</p>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label htmlFor="sh" className="mb-1 block text-[0.72rem] font-semibold text-stone-600">Hours</label>
                <input id="sh" type="number" min="0" max="24" inputMode="numeric" placeholder="10" value={sleepH} onChange={(e) => setSleepH(e.target.value)} className={fieldCls} />
              </div>
              <div className="flex-1">
                <label htmlFor="sm" className="mb-1 block text-[0.72rem] font-semibold text-stone-600">Minutes</label>
                <input id="sm" type="number" min="0" max="59" inputMode="numeric" placeholder="30" value={sleepM} onChange={(e) => setSleepM(e.target.value)} className={fieldCls} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5 — notifications */}
        {Current.key === 'notify' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-stone-600">How should we remind you when something’s due — a vaccine, a growth check, a new milestone?</p>
            <div className="flex items-center gap-3 rounded-xl border-2 border-stone-200 bg-stone-50 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ background: 'var(--primary)' }}><Bell className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-stone-800">On your dashboard</span>
                <span className="block text-[0.72rem] text-stone-500">Always on — your daily home for what’s next.</span>
              </span>
            </div>
            <Toggle on={emailOn} onClick={() => setEmailOn((v) => !v)} icon={Mail} label="Email" sub="A note when something needs you." />
            <Toggle on={whatsappOn} onClick={() => setWhatsappOn((v) => !v)} icon={MessageCircle} label="WhatsApp" sub="Reminders on WhatsApp — your number, your baby only." />
            {whatsappOn && (
              <div>
                <label htmlFor="wa" className="mb-1.5 block text-sm font-bold text-stone-800">WhatsApp number</label>
                <input id="wa" type="tel" inputMode="tel" placeholder="+91 98765 43210" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} className={fieldCls} />
              </div>
            )}
            <div>
              <label htmlFor="hour" className="mb-1.5 block text-sm font-bold text-stone-800">Preferred time</label>
              <select id="hour" value={preferredHour} onChange={(e) => setPreferredHour(Number(e.target.value))} className={fieldCls}>
                {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-stone-800">Language for reminders</p>
              <div className="grid grid-cols-3 gap-2">
                {LANG_OPTIONS.map((o) => {
                  const active = language === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setLanguage(o.value)}
                      className="rounded-xl border-2 border-stone-200 bg-white px-3 py-2.5 text-center transition-all"
                      style={{ borderColor: active ? 'var(--primary)' : undefined, background: active ? 'var(--cat-sleep-bg)' : undefined }}
                    >
                      <span className="block text-sm font-bold text-stone-800">{o.label}</span>
                      <span className="block truncate text-[0.66rem] text-stone-500">{o.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        {softNote && <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{softNote}</p>}

        {/* Nav */}
        <div className="mt-6 flex items-center gap-3">
          {step > 0 ? (
            <button type="button" onClick={back} disabled={busy} className="inline-flex h-12 items-center gap-1.5 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <Link to="/" className="inline-flex h-12 items-center rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-600 transition-colors hover:bg-stone-50">Cancel</Link>
          )}
          {canSkip && (
            <button type="button" onClick={() => { setError(null); setSoftNote(null); setStep((n) => Math.min(n + 1, STEPS.length - 1)); }} disabled={busy} className="text-sm font-semibold text-stone-500 hover:text-stone-800 disabled:opacity-50">
              Skip
            </button>
          )}
          <button
            type="button"
            onClick={() => void next()}
            disabled={busy || (step === 0 && !canStartBasics)}
            className="ml-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-bold text-white shadow-soft transition-all hover:shadow-card disabled:opacity-60"
            style={{ background: 'var(--primary)' }}
          >
            {isLast ? <><HeartHandshake className="h-[18px] w-[18px]" /> {busy ? 'Finishing…' : 'Finish'}</> : <>{busy ? 'Saving…' : 'Continue'} <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </Card>

      <div className="mt-4 flex items-center justify-center gap-2 text-[0.78rem] text-stone-500">
        <ShieldCheck className="h-[15px] w-[15px]" style={{ color: 'var(--cat-growth-text)' }} />
        Private to you · You can change any of this later.
      </div>
    </div>
  );
}
