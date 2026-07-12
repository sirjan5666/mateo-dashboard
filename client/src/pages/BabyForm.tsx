import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, Baby as BabyIcon, Check, ChevronDown, ChevronUp, HeartHandshake, Ruler, ShieldCheck, Smile, Trash2 } from 'lucide-react';
import { createBaby, deleteBaby, getBaby, updateBaby } from '../api/babies';
import type { BabyInput, BloodGroup, FeedingType } from '../api/babies';
import { ApiError } from '../api/client';
import { toDateInputValueIST, todayInputValueIST } from '../lib/age';
import { avatarsForSex, avatarUrl } from '../lib/avatars';
import { Card } from '../components/ui/Card';
import { DatePicker } from '../components/ui/DatePicker';
import { BrandTile } from '../components/ui/BrandTile';
import { cn } from '../lib/cn';

// Shared field styling — 48px, soft lavender hairline, brand-violet focus ring.
const fieldCls =
  'h-12 w-full rounded-xl border-[1.5px] border-stone-200 bg-white px-3.5 text-[0.95rem] font-medium text-stone-900 transition-colors placeholder:font-normal placeholder:text-stone-400 hover:border-stone-300 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15';

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// The API stores birth weight in grams, but parents think in kilograms
// (e.g. "3.2 kg"), so the field is kg and we convert on the way in/out.
function kgToGrams(value: string): number | undefined {
  const kg = parseOptionalNumber(value);
  return kg === undefined ? undefined : Math.round(kg * 1000);
}

// Big, tappable Girl / Boy choice card — gentle pastel, clear selected state.
function SexCard({ active, tone, label, sublabel, onClick }: { active: boolean; tone: 'skin' | 'sleep'; label: string; sublabel: string; onClick: () => void }) {
  const text = `var(--cat-${tone}-text)`;
  const bg = `var(--cat-${tone}-bg)`;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      className="flex flex-1 items-center gap-3 rounded-xl border-2 border-stone-200 bg-white px-4 py-3.5 text-left transition-all hover:shadow-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/20"
      style={{ borderColor: active ? text : undefined, background: active ? bg : undefined, transform: active ? 'translateY(-1px)' : undefined }}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors" style={{ background: active ? text : bg, color: active ? '#fff' : text }}>
        <BabyIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[1.05rem] font-semibold" style={{ color: active ? text : 'var(--text-primary)' }}>{label}</span>
        <span className="block text-[0.72rem] text-stone-500">{sublabel}</span>
      </span>
      <span aria-hidden="true" className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 border-stone-200 text-white" style={{ borderColor: active ? 'transparent' : undefined, background: active ? text : 'transparent' }}>
        {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

// A compact measurement input with a unit suffix inside.
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

export default function BabyForm() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [avatar, setAvatar] = useState('');
  const [birthWeightKg, setBirthWeightKg] = useState('');
  const [birthLengthCm, setBirthLengthCm] = useState('');
  const [birthHeadCircCm, setBirthHeadCircCm] = useState('');
  const [showMeasures, setShowMeasures] = useState(false);
  const [gestWeeks, setGestWeeks] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [feedingType, setFeedingType] = useState<FeedingType | ''>('');
  const [allergiesText, setAllergiesText] = useState('');
  const [pedName, setPedName] = useState('');
  const [pedPhone, setPedPhone] = useState('');
  const [showBaseline, setShowBaseline] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const today = todayInputValueIST();

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    getBaby(id)
      .then(({ baby }) => {
        if (cancelled) return;
        setName(baby.name);
        setDob(toDateInputValueIST(baby.dob));
        setSex(baby.sex);
        setAvatar(baby.avatar ?? '');
        const w = baby.birthWeightG !== undefined ? String(baby.birthWeightG / 1000) : '';
        const l = baby.birthLengthCm !== undefined ? String(baby.birthLengthCm) : '';
        const h = baby.birthHeadCircCm !== undefined ? String(baby.birthHeadCircCm) : '';
        setBirthWeightKg(w);
        setBirthLengthCm(l);
        setBirthHeadCircCm(h);
        if (w || l || h) setShowMeasures(true); // reveal existing measurements
        setGestWeeks(baby.gestationalAgeWeeks !== undefined ? String(baby.gestationalAgeWeeks) : '');
        setBloodGroup(baby.bloodGroup ?? '');
        setFeedingType(baby.feedingType ?? '');
        setAllergiesText(baby.knownAllergies?.join(', ') ?? '');
        setPedName(baby.pediatricianName ?? '');
        setPedPhone(baby.pediatricianPhone ?? '');
        if (baby.gestationalAgeWeeks || baby.bloodGroup || baby.feedingType || baby.knownAllergies?.length || baby.pediatricianName || baby.pediatricianPhone) {
          setShowBaseline(true); // reveal existing baseline details
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const canSubmit = name.trim() !== '' && dob !== '' && sex !== '';

  // Switching sex swaps the avatar catalog, so drop a selection that no longer
  // belongs to the chosen sex (boy avatars aren't offered for a girl, etc.).
  function chooseSex(next: 'male' | 'female') {
    setSex(next);
    if (avatar && !avatarsForSex(next).includes(avatar)) setAvatar('');
  }

  const avatarChoices = avatarsForSex(sex);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (sex === '') {
      setError('Please choose Girl or Boy.');
      return;
    }
    setError(null);
    setSaving(true);
    const input: BabyInput = {
      name: name.trim(),
      dob,
      sex,
      avatar: avatar || undefined,
      birthWeightG: kgToGrams(birthWeightKg),
      birthLengthCm: parseOptionalNumber(birthLengthCm),
      birthHeadCircCm: parseOptionalNumber(birthHeadCircCm),
      gestationalAgeWeeks: parseOptionalNumber(gestWeeks),
      bloodGroup: bloodGroup || undefined,
      feedingType: feedingType || undefined,
      knownAllergies: allergiesText.trim() ? allergiesText.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      pediatricianName: pedName.trim() || undefined,
      pediatricianPhone: pedPhone.trim() || undefined,
    };
    try {
      if (isEdit) await updateBaby(id, input);
      else await createBaby(input);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (id === undefined) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteBaby(id);
      try {
        if (localStorage.getItem('mateo:activeBaby') === id) localStorage.removeItem('mateo:activeBaby');
      } catch {
        /* ignore storage errors */
      }
      navigate('/');
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      {/* Warm header — gradient baby badge + (on create) the floating mascot */}
      <header className="mt-4 flex items-center gap-3.5">
        <BrandTile icon={BabyIcon} iconClassName="h-6 w-6" className="h-12 w-12 shrink-0 rounded-2xl shadow-soft" />
        <div className="flex-1">
          <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">{isEdit ? 'Edit baby profile' : 'Add your baby'}</h1>
          <p className="text-sm text-stone-500">{isEdit ? 'Update the details below.' : 'A few details so every tracker fits your little one.'}</p>
        </div>
        {!isEdit && <img src="/bear-mascot.png" alt="" className="animate-float h-16 w-auto shrink-0" />}
      </header>

      {loading ? (
        <p className="mt-8 text-sm text-stone-500">Loading…</p>
      ) : (
        <>
          <Card className="mt-6 p-6 sm:p-7">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-bold text-stone-800">Baby’s name</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"><Smile className="h-[18px] w-[18px]" /></span>
                  <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarav" className={cn(fieldCls, 'pl-11')} />
                </div>
              </div>

              <div>
                <label htmlFor="dob" className="mb-1.5 block text-sm font-bold text-stone-800">Date of birth</label>
                <DatePicker id="dob" required max={today} value={dob} onChange={setDob} placeholder="Select date of birth" className={fieldCls} />
                <p className="mt-1.5 px-0.5 text-xs text-stone-500">We use this to age every tracker — vaccines, growth, milestones.</p>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-stone-800">Sex</p>
                <div role="radiogroup" aria-label="Sex" className="flex gap-3">
                  <SexCard active={sex === 'female'} tone="skin" label="Girl" sublabel="She / her" onClick={() => chooseSex('female')} />
                  <SexCard active={sex === 'male'} tone="sleep" label="Boy" sublabel="He / him" onClick={() => chooseSex('male')} />
                </div>
              </div>

              {/* Avatar picker — the catalog follows the chosen sex (girls / boys) */}
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-stone-800">Choose an avatar</p>
                  <span className="text-[0.72rem] text-stone-500">Optional</span>
                </div>
                {sex === '' ? (
                  <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50/70 px-4 py-3 text-[0.8rem] text-stone-500">
                    Pick Girl or Boy above to see avatar options.
                  </p>
                ) : (
                  <div role="radiogroup" aria-label="Baby avatar" className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
                    {avatarChoices.map((key) => {
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
                          style={{
                            borderColor: active ? 'var(--primary)' : 'rgb(231 229 228)',
                            transform: active ? 'translateY(-1px)' : undefined,
                          }}
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
                )}
              </div>

              {/* Optional measurements, tucked behind a calm toggle */}
              <div className="overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-50/70">
                <button type="button" onClick={() => setShowMeasures((s) => !s)} aria-expanded={showMeasures} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--cat-growth-bg)', color: 'var(--cat-growth-text)' }}><Ruler className="h-[17px] w-[17px]" /></span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-stone-800">Birth measurements</span>
                    <span className="block text-[0.72rem] text-stone-500">Optional · from your discharge summary</span>
                  </span>
                  {showMeasures ? <ChevronUp className="h-[18px] w-[18px] text-stone-400" /> : <ChevronDown className="h-[18px] w-[18px] text-stone-400" />}
                </button>
                {showMeasures && (
                  <div className="animate-popin grid grid-cols-3 gap-3 px-4 pb-4 pt-1">
                    <MeasureInput id="birthWeightKg" label="Weight" unit="kg" step="0.01" placeholder="3.2" value={birthWeightKg} onChange={setBirthWeightKg} />
                    <MeasureInput id="birthLengthCm" label="Length" unit="cm" step="0.1" placeholder="50" value={birthLengthCm} onChange={setBirthLengthCm} />
                    <MeasureInput id="birthHeadCircCm" label="Head" unit="cm" step="0.1" placeholder="35" value={birthHeadCircCm} onChange={setBirthHeadCircCm} />
                  </div>
                )}
              </div>

              {/* Baseline details — gestation (→ corrected age), blood group, feeding, allergies, doctor */}
              <div className="overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-50/70">
                <button type="button" onClick={() => setShowBaseline((s) => !s)} aria-expanded={showBaseline} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--cat-record-bg)', color: 'var(--cat-record-text)' }}><HeartHandshake className="h-[17px] w-[17px]" /></span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-stone-800">Baseline details</span>
                    <span className="block text-[0.72rem] text-stone-500">Optional · gestation, blood group, feeding, allergies, doctor</span>
                  </span>
                  {showBaseline ? <ChevronUp className="h-[18px] w-[18px] text-stone-400" /> : <ChevronDown className="h-[18px] w-[18px] text-stone-400" />}
                </button>
                {showBaseline && (
                  <div className="animate-popin flex flex-col gap-3 px-4 pb-4 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <MeasureInput id="gestWeeks" label="Gestation at birth" unit="wks" step="1" placeholder="40" value={gestWeeks} onChange={setGestWeeks} />
                      <div>
                        <label htmlFor="bloodGroup" className="mb-1 block text-[0.72rem] font-semibold text-stone-600">Blood group</label>
                        <select id="bloodGroup" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup | '')} className={fieldCls}>
                          <option value="">Select…</option>
                          {(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'] as const).map((g) => (
                            <option key={g} value={g}>
                              {g === 'unknown' ? 'Not known' : g}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="feedingType" className="mb-1 block text-[0.72rem] font-semibold text-stone-600">Feeding</label>
                      <select id="feedingType" value={feedingType} onChange={(e) => setFeedingType(e.target.value as FeedingType | '')} className={fieldCls}>
                        <option value="">Select…</option>
                        <option value="breastfed">Exclusively breastfed</option>
                        <option value="mixed">Mixed feeding</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="allergies" className="mb-1 block text-[0.72rem] font-semibold text-stone-600">Known allergies · comma-separated</label>
                      <input id="allergies" type="text" value={allergiesText} onChange={(e) => setAllergiesText(e.target.value)} placeholder="e.g. cow’s milk, egg" className={fieldCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="pedName" className="mb-1 block text-[0.72rem] font-semibold text-stone-600">Pediatrician</label>
                        <input id="pedName" type="text" value={pedName} onChange={(e) => setPedName(e.target.value)} placeholder="Dr. name" className={fieldCls} />
                      </div>
                      <div>
                        <label htmlFor="pedPhone" className="mb-1 block text-[0.72rem] font-semibold text-stone-600">Doctor’s phone</label>
                        <input id="pedPhone" type="tel" inputMode="tel" value={pedPhone} onChange={(e) => setPedPhone(e.target.value)} placeholder="For a quick call" className={fieldCls} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className={cn(
                  'mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold text-white shadow-soft transition-all hover:shadow-card disabled:opacity-60',
                  !canSubmit && 'opacity-70',
                )}
                style={{ background: 'var(--primary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--primary)')}
              >
                {!isEdit && <HeartHandshake className="h-[18px] w-[18px]" />}
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add baby'}
              </button>

              <Link to="/" className="self-center text-sm font-bold hover:underline" style={{ color: 'var(--brand-purple-deep)' }}>
                Cancel
              </Link>
            </form>
          </Card>

          {/* Trust line — Mateo handles children's health data; reassure up front */}
          <div className="mt-4 flex items-center justify-center gap-2 text-[0.78rem] text-stone-500">
            <ShieldCheck className="h-[15px] w-[15px]" style={{ color: 'var(--cat-growth-text)' }} />
            Private to you · You can edit or add more babies anytime.
          </div>

          {isEdit && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-rose-800">
                <AlertTriangle className="h-4 w-4" />
                Danger zone
              </h2>
              {!confirmDelete ? (
                <>
                  <p className="mt-1 text-sm text-stone-600">Permanently delete this baby and all of their tracked data.</p>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete {name || 'this baby'}
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-stone-700">
                    This permanently deletes <strong>{name}</strong> and ALL their data — vaccinations, growth, skin, food, sleep,
                    milestones, records, appointments and chats. This can’t be undone.
                  </p>
                  {deleteError && <p className="mt-2 text-sm text-rose-600">{deleteError}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleting ? 'Deleting…' : `Yes, delete ${name}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
