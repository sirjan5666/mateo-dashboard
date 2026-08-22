import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  AlertTriangle,
  Baby,
  Check,
  Heart,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { listTeeth, markTooth, unmarkTooth } from '../api/teeth';
import type { TeethResponse, ToothLogEntry } from '../api/teeth';
import { getBaby } from '../api/babies';
import type { Baby as BabyType } from '../api/babies';
import { ApiError } from '../api/client';
import { formatAge, formatDateIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DatePicker } from '../components/ui/DatePicker';
import { Skeleton } from '../components/ui/Skeleton';
import { TrackerInsight } from '../components/TrackerInsight';
import { cn } from '../lib/cn';
import { useScrollReveal } from '../lib/gsap';

/* ── Tooth data (standard pediatric reference) ─────────────────────── */

interface ToothDef {
  id: string;
  label: string;
  shortLabel: string;
  jaw: 'upper' | 'lower';
  /** Typical appearance window (months). */
  startMonth: number;
  endMonth: number;
}

const TEETH: ToothDef[] = [
  // Upper jaw (from the child's perspective: right to left visually)
  { id: 'upper_second_molar_right', label: 'Upper Right Second Molar', shortLabel: 'E', jaw: 'upper', startMonth: 23, endMonth: 33 },
  { id: 'upper_first_molar_right', label: 'Upper Right First Molar', shortLabel: 'D', jaw: 'upper', startMonth: 13, endMonth: 19 },
  { id: 'upper_canine_right', label: 'Upper Right Canine', shortLabel: 'C', jaw: 'upper', startMonth: 16, endMonth: 23 },
  { id: 'upper_lateral_incisor_right', label: 'Upper Right Lateral Incisor', shortLabel: 'B', jaw: 'upper', startMonth: 9, endMonth: 13 },
  { id: 'upper_central_incisor_right', label: 'Upper Right Central Incisor', shortLabel: 'A', jaw: 'upper', startMonth: 8, endMonth: 12 },
  { id: 'upper_central_incisor_left', label: 'Upper Left Central Incisor', shortLabel: 'A', jaw: 'upper', startMonth: 8, endMonth: 12 },
  { id: 'upper_lateral_incisor_left', label: 'Upper Left Lateral Incisor', shortLabel: 'B', jaw: 'upper', startMonth: 9, endMonth: 13 },
  { id: 'upper_canine_left', label: 'Upper Left Canine', shortLabel: 'C', jaw: 'upper', startMonth: 16, endMonth: 23 },
  { id: 'upper_first_molar_left', label: 'Upper Left First Molar', shortLabel: 'D', jaw: 'upper', startMonth: 13, endMonth: 19 },
  { id: 'upper_second_molar_left', label: 'Upper Left Second Molar', shortLabel: 'E', jaw: 'upper', startMonth: 23, endMonth: 33 },
  // Lower jaw
  { id: 'lower_second_molar_left', label: 'Lower Left Second Molar', shortLabel: 'E', jaw: 'lower', startMonth: 23, endMonth: 33 },
  { id: 'lower_first_molar_left', label: 'Lower Left First Molar', shortLabel: 'D', jaw: 'lower', startMonth: 13, endMonth: 19 },
  { id: 'lower_canine_left', label: 'Lower Left Canine', shortLabel: 'C', jaw: 'lower', startMonth: 16, endMonth: 23 },
  { id: 'lower_lateral_incisor_left', label: 'Lower Left Lateral Incisor', shortLabel: 'B', jaw: 'lower', startMonth: 10, endMonth: 16 },
  { id: 'lower_central_incisor_left', label: 'Lower Left Central Incisor', shortLabel: 'A', jaw: 'lower', startMonth: 6, endMonth: 10 },
  { id: 'lower_central_incisor_right', label: 'Lower Right Central Incisor', shortLabel: 'A', jaw: 'lower', startMonth: 6, endMonth: 10 },
  { id: 'lower_lateral_incisor_right', label: 'Lower Right Lateral Incisor', shortLabel: 'B', jaw: 'lower', startMonth: 10, endMonth: 16 },
  { id: 'lower_canine_right', label: 'Lower Right Canine', shortLabel: 'C', jaw: 'lower', startMonth: 16, endMonth: 23 },
  { id: 'lower_first_molar_right', label: 'Lower Right First Molar', shortLabel: 'D', jaw: 'lower', startMonth: 13, endMonth: 19 },
  { id: 'lower_second_molar_right', label: 'Lower Right Second Molar', shortLabel: 'E', jaw: 'lower', startMonth: 23, endMonth: 33 },
];

const UPPER_TEETH = TEETH.filter((t) => t.jaw === 'upper');
const LOWER_TEETH = TEETH.filter((t) => t.jaw === 'lower');

/* ── Teething timeline (standard pediatric reference) ──────────────── */

const TIMELINE = [
  { range: '6–10 months', teeth: 'Lower central incisors', note: 'Usually the first teeth to appear' },
  { range: '8–12 months', teeth: 'Upper central incisors', note: '' },
  { range: '9–13 months', teeth: 'Upper lateral incisors', note: '' },
  { range: '10–16 months', teeth: 'Lower lateral incisors', note: '' },
  { range: '13–19 months', teeth: 'First molars (upper & lower)', note: '' },
  { range: '16–23 months', teeth: 'Canines (upper & lower)', note: '' },
  { range: '23–33 months', teeth: 'Second molars (upper & lower)', note: 'Complete set of 20 primary teeth' },
];

/* ── Dental care tips by age ───────────────────────────────────────── */

const CARE_TIPS = [
  { age: '0–6 months', tip: 'Gently wipe gums with a clean wet cloth after feeds' },
  { age: '6–12 months', tip: 'Start brushing with a soft infant toothbrush (no toothpaste yet) or use a silicone finger brush' },
  { age: '12–18 months', tip: 'Introduce a rice-grain sized amount of fluoride toothpaste, brush twice daily' },
  { age: '18–36 months', tip: 'Pea-sized fluoride toothpaste, brush twice daily. First dental visit recommended by age 1' },
];

/* ── Component ─────────────────────────────────────────────────────── */

export default function Teeth() {
  const { id } = useParams();
  const [baby, setBaby] = useState<BabyType | null>(null);
  const [data, setData] = useState<TeethResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTooth, setSelectedTooth] = useState<ToothDef | null>(null);
  const [dateVal, setDateVal] = useState(todayInputValueIST());
  const [saving, setSaving] = useState(false);
  const [now] = useState(() => new Date());
  const containerRef = useScrollReveal();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [{ baby: b }, t] = await Promise.all([getBaby(id), listTeeth(id)]);
      setBaby(b);
      setData(t);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load');
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    Promise.all([getBaby(id), listTeeth(id)])
      .then(([{ baby: b }, t]) => { if (!cancelled) { setBaby(b); setData(t); } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Failed to load'); });
    return () => { cancelled = true; };
  }, [id]);

  const logMap = new Map<string, ToothLogEntry>();
  if (data) for (const l of data.logs) logMap.set(l.toothId, l);

  async function handleMark() {
    if (!id || !selectedTooth || !dateVal) return;
    setSaving(true);
    try {
      await markTooth(id, selectedTooth.id, dateVal);
      setSelectedTooth(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnmark(logId: string) {
    if (!id) return;
    try {
      await unmarkTooth(id, logId);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete');
    }
  }

  const ageMonths = useMemo(() => {
    if (!baby) return 0;
    return Math.max(0, Math.floor((now.getTime() - new Date(baby.dob).getTime()) / (86_400_000 * 30.4375)));
  }, [now, baby]);

  if (!data || !baby) {
    return (
      <div className="space-y-4 p-4" ref={containerRef}>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-28 pt-4" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold text-stone-900">Teeth &amp; Dental Care</h1>
          <p className="text-sm text-stone-500">{baby.name} &middot; {formatAge(baby.dob)}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* Summary */}
      <Card className="flex items-center gap-4 p-5">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-2xl">
          🦷
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold text-stone-900">{data.appeared}<span className="text-base font-medium text-stone-400">/{data.total}</span></p>
          <p className="text-sm text-stone-500">teeth appeared</p>
        </div>
        {data.appeared === 20 && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Complete!</span>
        )}
      </Card>

      {/* Tooth Map */}
      <Card className="p-5">
        <h2 className="mb-4 font-display text-base font-bold text-stone-800">Tooth Map</h2>
        <p className="mb-3 text-xs text-stone-500">Tap a tooth to log when it appeared. Green = appeared.</p>

        {/* Upper jaw */}
        <div className="mb-1 text-center text-[0.65rem] font-bold uppercase tracking-wide text-stone-400">Upper</div>
        <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
          {UPPER_TEETH.map((t) => {
            const logged = logMap.get(t.id);
            return (
              <button
                key={t.id}
                type="button"
                title={t.label + (logged ? ` (${formatDateIST(logged.appearedOn)})` : '')}
                onClick={() => { setSelectedTooth(t); setDateVal(logged ? logged.appearedOn.slice(0, 10) : todayInputValueIST()); }}
                className={cn(
                  'relative grid h-9 w-9 place-items-center rounded-lg border-2 text-xs font-bold transition',
                  logged
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : t.startMonth <= ageMonths && ageMonths <= t.endMonth
                      ? 'border-amber-300 bg-amber-50 text-amber-700 animate-pulse'
                      : 'border-stone-200 bg-white text-stone-500 hover:border-violet-300 hover:bg-violet-50',
                )}
              >
                {t.shortLabel}
                {logged && <Check className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 p-0.5 text-white" />}
              </button>
            );
          })}
        </div>

        {/* Lower jaw */}
        <div className="mb-1 text-center text-[0.65rem] font-bold uppercase tracking-wide text-stone-400">Lower</div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {LOWER_TEETH.map((t) => {
            const logged = logMap.get(t.id);
            return (
              <button
                key={t.id}
                type="button"
                title={t.label + (logged ? ` (${formatDateIST(logged.appearedOn)})` : '')}
                onClick={() => { setSelectedTooth(t); setDateVal(logged ? logged.appearedOn.slice(0, 10) : todayInputValueIST()); }}
                className={cn(
                  'relative grid h-9 w-9 place-items-center rounded-lg border-2 text-xs font-bold transition',
                  logged
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : t.startMonth <= ageMonths && ageMonths <= t.endMonth
                      ? 'border-amber-300 bg-amber-50 text-amber-700 animate-pulse'
                      : 'border-stone-200 bg-white text-stone-500 hover:border-violet-300 hover:bg-violet-50',
                )}
              >
                {t.shortLabel}
                {logged && <Check className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 p-0.5 text-white" />}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[0.65rem] text-stone-500">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-emerald-400 bg-emerald-50" /> Appeared</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-amber-300 bg-amber-50" /> Expected now</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-stone-200 bg-white" /> Upcoming</span>
        </div>
      </Card>

      {/* Mark/unmark dialog */}
      {selectedTooth && (
        <Card className="border-violet-200 bg-violet-50/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-stone-800">{selectedTooth.label}</h3>
            <button type="button" onClick={() => setSelectedTooth(null)} className="text-stone-400 hover:text-stone-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-2 text-xs text-stone-500">
            Typical window: {selectedTooth.startMonth}–{selectedTooth.endMonth} months
          </p>
          <div className="mb-3">
            <label className="text-xs font-medium text-stone-600">Date appeared</label>
            <DatePicker
              value={dateVal}
              onChange={setDateVal}
              min={baby.dob.slice(0, 10)}
              max={todayInputValueIST()}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" disabled={saving || !dateVal} onClick={handleMark}>
              {logMap.has(selectedTooth.id) ? 'Update' : 'Mark appeared'}
            </Button>
            {logMap.has(selectedTooth.id) && (
              <Button variant="ghost" size="sm" onClick={() => handleUnmark(logMap.get(selectedTooth.id)!.id)}>
                Remove
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Teething Timeline */}
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-stone-800">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Teething Timeline
        </h2>
        <div className="space-y-2">
          {TIMELINE.map((t) => (
            <div key={t.range} className="flex items-start gap-3 rounded-xl bg-stone-50 px-3 py-2.5">
              <span className="mt-0.5 shrink-0 text-xs font-bold text-violet-600">{t.range}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-800">{t.teeth}</p>
                {t.note && <p className="text-xs text-stone-500">{t.note}</p>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-stone-400">Total: 20 primary (baby) teeth by age 2.5–3 years. Every child is different — timing can vary.</p>
      </Card>

      {/* Teething Signs */}
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-stone-800">
          <Baby className="h-4 w-4 text-sky-500" />
          Teething Signs
        </h2>
        <div className="mb-3 space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Common &amp; normal</p>
          {['Increased drooling', 'Gum rubbing or biting', 'Mild fussiness or irritability', 'Low-grade fever (below 38°C)', 'Sleep disruption', 'Decreased appetite'].map((s) => (
            <div key={s} className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              {s}
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-rose-400">See a doctor if</p>
          {['High fever above 38.5°C', 'Diarrhoea or vomiting', 'Rash or unusual skin changes', 'Excessive crying that won’t settle'].map((s) => (
            <div key={s} className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-1.5 text-sm text-rose-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
              {s}
            </div>
          ))}
        </div>
      </Card>

      {/* Dental Care Tips */}
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-stone-800">
          <Heart className="h-4 w-4 text-pink-500" />
          Dental Care Tips by Age
        </h2>
        <div className="space-y-2">
          {CARE_TIPS.map((c) => (
            <div key={c.age} className="rounded-xl border border-stone-100 bg-white px-4 py-3">
              <span className="text-xs font-bold text-pink-600">{c.age}</span>
              <p className="mt-0.5 text-sm text-stone-700">{c.tip}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* AI Insight */}
      <TrackerInsight babyId={id!} tracker="teeth" hasData={data.appeared > 0} />

      {/* Disclaimer */}
      <p className="text-center text-[0.65rem] leading-relaxed text-stone-400">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        Teething timeline is based on standard pediatric references. Every child is unique — consult your paediatrician if you have concerns.
      </p>
    </div>
  );
}
