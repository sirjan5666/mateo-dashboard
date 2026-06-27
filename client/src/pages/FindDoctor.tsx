import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Globe,
  IndianRupee,
  MapPin,
  Paperclip,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
} from 'lucide-react';
import { getDoctorReviews, getDoctorSlots, listDoctors } from '../api/doctors';
import type { DaySlots, DoctorAvailability, DoctorListing, DoctorReview } from '../api/doctors';
import { listBabies } from '../api/babies';
import type { Baby } from '../api/babies';
import { bookConsultation, checkConcern } from '../api/consultations';
import type { ConcernCheck } from '../api/consultations';
import { ApiError } from '../api/client';
import { dayDiffIST, formatAge, formatDateIST, formatTimeIST, istHour, relativePastIST, relativeUpcomingIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Skeleton } from '../components/ui/Skeleton';
import { buttonClass } from '../components/ui/buttonStyles';
import { inputCls } from '../components/ui/field';
import { cn } from '../lib/cn';
import { prefersReducedMotion } from '../lib/gsap';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REASON_MAX = 1000; // matches the server's reason zod cap

// ── Small honest derivations from real listing fields (no fabricated data) ──

// "10:00" → "10am" / "10:30 am" — compact, for the availability range chip.
function hhmmCompact(s: string): string {
  const [hRaw, m] = s.split(':');
  let h = Number(hRaw);
  if (Number.isNaN(h)) return s;
  const mer = h < 12 ? 'am' : 'pm';
  h = h % 12 || 12;
  return m && m !== '00' ? `${h}:${m} ${mer}` : `${h}${mer}`;
}

// Collapse weekly availability into "Mon–Fri · 10am–5pm" / "Mon, Wed, Fri · 10am–1pm".
function availabilitySummary(av: DoctorAvailability): string {
  const range = `${hhmmCompact(av.startTime)}–${hhmmCompact(av.endTime)}`;
  const days = [...new Set(av.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (days.length === 0) return range;
  const runs: [number, number][] = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && d === last[1] + 1) last[1] = d;
    else runs.push([d, d]);
  }
  const label = runs
    .map(([a, b]) => (a === b ? WEEKDAYS[a] : b === a + 1 ? `${WEEKDAYS[a]}, ${WEEKDAYS[b]}` : `${WEEKDAYS[a]}–${WEEKDAYS[b]}`))
    .join(', ');
  return `${label} · ${range}`;
}

// "Today · 10:00 am" / "Tomorrow · 10:00 am" / "21 Jun · 10:00 am" — keeps the time
// (relativeUpcomingIST drops it past tomorrow), for the CTA + sticky-bar recap.
function slotLabel(iso: string): string {
  const d = dayDiffIST(iso);
  const day = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : formatDateIST(iso);
  return `${day} · ${formatTimeIST(iso)}`;
}

type Period = 'morning' | 'afternoon' | 'evening';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
];
function slotPeriod(iso: string): Period {
  const h = istHour(iso); // IST hour — never the raw UTC hour
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const verifiedOf = (d: { registrationNo: string }) => Boolean(d.registrationNo && d.registrationNo.trim());

function Rating({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) return <span className="shrink-0 text-xs font-medium text-stone-400">New</span>;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-stone-700">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {avg} <span className="font-normal text-stone-400">({count})</span>
    </span>
  );
}

// 5 grey stars with a width-clamped amber overlay — honest to one decimal, never rounded up.
function StarMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="relative inline-flex" aria-hidden="true">
      <span className="flex text-stone-200">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="h-4 w-4 fill-current" />
        ))}
      </span>
      <span className="absolute inset-0 flex overflow-hidden text-amber-400" style={{ width: `${pct}%` }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="h-4 w-4 shrink-0 fill-current" />
        ))}
      </span>
    </span>
  );
}

function MonthCalendar({
  available,
  slotCounts,
  selected,
  onSelect,
  view,
  onPrev,
  onNext,
  today,
}: {
  available: Set<string>;
  slotCounts: Map<string, number>;
  selected: string | null;
  onSelect: (d: string) => void;
  view: { year: number; month: number };
  onPrev: () => void;
  onNext: () => void;
  today: string;
}) {
  const first = new Date(view.year, view.month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const label = first.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  const dstr = (d: number) => `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-semibold text-stone-800">{label}</p>
        <div className="flex gap-1">
          <button type="button" onClick={onPrev} aria-label="Previous month" className="grid h-7 w-7 place-items-center rounded-lg text-stone-500 hover:bg-stone-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={onNext} aria-label="Next month" className="grid h-7 w-7 place-items-center rounded-lg text-stone-500 hover:bg-stone-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-1 text-[0.65rem] font-bold uppercase text-stone-400">{w[0]}</span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`b${i}`} className="h-10" />;
          const ds = dstr(d);
          const has = available.has(ds);
          const isSel = ds === selected;
          const isToday = ds === today;
          const count = slotCounts.get(ds) ?? 0;
          const dots = count >= 5 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0;
          return (
            <div key={ds} className="flex h-10 flex-col items-center gap-0.5">
              <button
                type="button"
                disabled={!has}
                onClick={() => onSelect(ds)}
                aria-pressed={isSel}
                aria-label={has ? `${count} open ${count === 1 ? 'time' : 'times'} on ${ds}` : undefined}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full text-sm transition-colors',
                  isSel ? 'bg-emerald-600 font-bold text-white shadow-soft' : has ? 'font-semibold text-stone-800 hover:bg-emerald-50' : 'text-stone-300',
                  !isSel && isToday && 'ring-1 ring-emerald-400',
                )}
              >
                {d}
              </button>
              <span className="flex h-1.5 items-center gap-0.5">
                {Array.from({ length: dots }).map((_, k) => (
                  <span key={k} className={cn('h-1 w-1 rounded-full', isSel ? 'bg-emerald-300' : 'bg-emerald-500')} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConcernAlert({ result }: { result: ConcernCheck }) {
  return (
    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5" role="alert">
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600">
          <AlertTriangle className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-rose-800">This may need urgent care now</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-700">{result.response}</p>
        </div>
      </div>
    </div>
  );
}

function DoctorCard({ d, selected, onBook, onProfile }: { d: DoctorListing; selected: boolean; onBook: () => void; onProfile: () => void }) {
  const verified = verifiedOf(d);
  const langs = d.languages.slice(0, 2);
  const moreLangs = d.languages.length - langs.length;
  return (
    <div className={cn('rounded-2xl border p-4 transition-all', selected ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200' : 'pop-hover border-stone-200/70 bg-white hover:border-stone-300')}>
      <div className="flex items-start gap-3">
        <Avatar name={d.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display font-semibold text-stone-900">Dr. {d.name}</h3>
            <Rating avg={d.avgRating} count={d.reviewCount} />
          </div>
          <p className="mt-0.5 line-clamp-1 flex items-center gap-1 text-xs text-stone-500">
            <Stethoscope className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {d.specialization}
              {d.qualifications ? ` · ${d.qualifications}` : ''}
            </span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
              {d.experienceYears > 0 ? `${d.experienceYears}+ yrs` : 'New'}
            </span>
            {d.city && (
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                <MapPin className="h-3 w-3" />
                {d.city}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-0.5 text-sm font-bold text-stone-800">
          <IndianRupee className="h-3.5 w-3.5" />
          {d.consultationFee}
          <span className="ml-0.5 text-xs font-normal text-stone-400">/ visit</span>
        </span>
        {langs.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
            <Globe className="h-3 w-3" />
            {langs.join(', ')}
            {moreLangs > 0 ? ` +${moreLangs}` : ''}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-stone-400">{d.reviewCount > 0 ? `Trusted by ${d.reviewCount} ${d.reviewCount === 1 ? 'parent' : 'parents'}` : 'New on Mateo'}</p>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={onBook} className={buttonClass('primary', 'sm', 'flex-1')}>Book now</button>
        <button type="button" onClick={onProfile} className={buttonClass('secondary', 'sm', 'flex-1')}>View profile</button>
      </div>
    </div>
  );
}

// Honest reviews block: avg+count headline + a testimonial carousel over the
// comment-only reviews. NO fabricated star distribution (only avg+count exist).
function ReviewsBlock({ avgRating, reviewCount, reviews }: { avgRating: number | null; reviewCount: number; reviews: DoctorReview[] }) {
  const [idx, setIdx] = useState(0);
  const has = reviews.length > 0;
  const r = has ? reviews[Math.min(idx, reviews.length - 1)] : null;
  return (
    <div className="mt-5">
      <h3 className="font-display text-sm font-semibold text-stone-900">Reviews</h3>
      <div className="mt-2 flex items-center gap-3">
        {avgRating !== null ? (
          <>
            <span className="font-display text-3xl font-extrabold leading-none text-stone-900">{avgRating.toFixed(1)}</span>
            <div>
              <StarMeter value={avgRating} />
              <p className="mt-0.5 text-xs text-stone-400">
                {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-stone-500">No ratings yet — be the first after your visit.</p>
        )}
      </div>

      {has && r ? (
        <div className="mt-3">
          <div key={idx} className="animate-popin rounded-2xl bg-stone-50 p-4">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cn('h-3.5 w-3.5', n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200')} />
              ))}
            </div>
            {r.comment && <p className="mt-2 text-sm leading-relaxed text-stone-700">“{r.comment}”</p>}
            <p className="mt-2 text-[11px] font-semibold text-stone-400">
              — {r.reviewer} · {relativePastIST(r.createdAt)}
            </p>
          </div>
          {reviews.length > 1 && (
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                aria-label="Previous review"
                className="grid h-8 w-8 place-items-center rounded-full border border-stone-200 text-stone-500 transition-colors hover:bg-stone-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {reviews.length <= 6 ? (
                <div className="flex items-center gap-1">
                  {reviews.map((_, i) => (
                    <span key={i} className={cn('h-1.5 rounded-full transition-all', i === idx ? 'w-4 bg-emerald-500' : 'w-1.5 bg-stone-300')} />
                  ))}
                </div>
              ) : (
                <span className="text-xs font-semibold text-stone-400">
                  {idx + 1} / {reviews.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIdx((i) => Math.min(reviews.length - 1, i + 1))}
                disabled={idx === reviews.length - 1}
                aria-label="Next review"
                className="grid h-8 w-8 place-items-center rounded-full border border-stone-200 text-stone-500 transition-colors hover:bg-stone-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="mt-2 text-center text-[11px] text-stone-400">Showing written reviews</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-stone-500">{reviewCount > 0 ? 'Ratings only — no written reviews yet.' : 'No written reviews yet — be the first after your visit.'}</p>
      )}
    </div>
  );
}

export default function FindDoctor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [doctors, setDoctors] = useState<DoctorListing[] | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<string>(() => params.get('specialization') ?? 'all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => id ?? null);

  const [slotData, setSlotData] = useState<{ id: string; days: DaySlots[] } | null>(null);
  const [reviewData, setReviewData] = useState<{ id: string; reviews: DoctorReview[] } | null>(null);

  const today = useMemo(() => todayInputValueIST(), []);
  const [view, setView] = useState(() => {
    const [y, m] = todayInputValueIST().split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('morning');
  const [slot, setSlot] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);

  const [babyId, setBabyId] = useState(() => params.get('baby') ?? '');
  const [reason, setReason] = useState(() => (params.get('followup') ? 'Follow-up visit' : ''));
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [conflictNote, setConflictNote] = useState<string | null>(null);

  const [concern, setConcern] = useState<ConcernCheck | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listDoctors(), listBabies()])
      .then(([d, b]) => {
        if (cancelled) return;
        setDoctors(d.doctors);
        setBabies(b.babies);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load a doctor's slots + reviews and smart-default to the soonest opening.
  useEffect(() => {
    if (!selectedId) return;
    const sid = selectedId;
    let cancelled = false;
    getDoctorSlots(sid)
      .then((s) => {
        if (cancelled) return;
        setSlotData({ id: sid, days: s.days });
        const firstDay = s.days[0] ?? null;
        const firstDate = firstDay?.date ?? null;
        const firstSlot = firstDay?.slots[0]?.start ?? null;
        setSelectedDate(firstDate);
        setSlot(firstSlot);
        if (firstSlot) setPeriod(slotPeriod(firstSlot));
        if (firstDate) {
          const [y, m] = firstDate.split('-').map(Number);
          setView({ year: y, month: m - 1 });
        }
      })
      .catch(() => {});
    getDoctorReviews(sid)
      .then((r) => !cancelled && setReviewData({ id: sid, reviews: r.reviews }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const text = reason.trim();
    if (text.length < 6) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setChecking(true);
      checkConcern(text, babyId || undefined)
        .then((r) => {
          if (!cancelled) setConcern(r);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [reason, babyId]);

  const specializations = useMemo(() => [...new Set((doctors ?? []).map((d) => d.specialization))].sort(), [doctors]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (doctors ?? [])
      .filter((d) => {
        const matchSpec = filter === 'all' || d.specialization.toLowerCase().includes(filter.toLowerCase());
        const matchQuery = !q || d.name.toLowerCase().includes(q) || d.specialization.toLowerCase().includes(q) || (d.city ?? '').toLowerCase().includes(q);
        const matchVerified = !verifiedOnly || verifiedOf(d);
        return matchSpec && matchQuery && matchVerified;
      })
      .sort((a, b) => Number(verifiedOf(b)) - Number(verifiedOf(a)) || b.experienceYears - a.experienceYears);
  }, [doctors, filter, query, verifiedOnly]);
  const filtersActive = filter !== 'all' || verifiedOnly || query.trim().length > 0;

  const selectedDoctor = useMemo(() => (doctors ?? []).find((d) => d.id === selectedId) ?? null, [doctors, selectedId]);
  const days = slotData && slotData.id === selectedId ? slotData.days : null;
  const reviews = reviewData && reviewData.id === selectedId ? reviewData.reviews : [];
  const slotsLoading = !!selectedId && (!slotData || slotData.id !== selectedId);
  const available = useMemo(() => new Set((days ?? []).map((d) => d.date)), [days]);
  const slotCounts = useMemo(() => new Map((days ?? []).map((d) => [d.date, d.slots.length])), [days]);
  const daySlots = useMemo(() => (days ?? []).find((d) => d.date === selectedDate)?.slots ?? [], [days, selectedDate]);
  const grouped = useMemo(() => {
    const g: Record<Period, { start: string; end: string }[]> = { morning: [], afternoon: [], evening: [] };
    for (const s of daySlots) g[slotPeriod(s.start)].push(s);
    return g;
  }, [daySlots]);
  // Derive the period actually shown: if the user's chosen period has no slots for
  // this date (e.g. after switching dates), fall back to the first that does — done
  // in render, not an effect (no need for one; avoids cascading re-renders).
  const effectivePeriod: Period = grouped[period].length > 0 ? period : PERIODS.find((p) => grouped[p.key].length > 0)?.key ?? period;
  const visibleSlots = grouped[effectivePeriod];

  const emergencyBlock = concern?.triggered === true && concern.severity === 'emergency';
  const nextOpening = days && days.length > 0 ? days[0].slots[0]?.start ?? null : null;

  function selectDoctor(d: DoctorListing, scrollTo?: 'booking-panel' | 'detail-panel') {
    setSelectedId(d.id);
    setSelectedDate(null);
    setSlot(null);
    setBookError(null);
    setConflictNote(null);
    setBioExpanded(false);
    if (scrollTo)
      setTimeout(() => {
        const el = document.getElementById(scrollTo);
        if (!el) return;
        el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        // Move focus into the panel the user asked for so keyboard/SR users land there.
        el.tabIndex = -1;
        el.focus({ preventScroll: true });
      }, 60);
  }

  function pickDate(ds: string) {
    setSelectedDate(ds);
    const first = (days ?? []).find((x) => x.date === ds)?.slots[0]?.start ?? null;
    setSlot(first);
    if (first) setPeriod(slotPeriod(first));
  }

  function onConcernChange(value: string) {
    setReason(value);
    if (value.trim().length < 6) setConcern(null);
  }

  async function handleBook() {
    if (!selectedId || !slot || emergencyBlock || booking) return;
    setBookError(null);
    setConflictNote(null);
    setBooking(true);
    try {
      // Final deterministic red-flag check at confirm time — closes the race where a
      // parent books before the debounced pre-screen resolves. Fails open on a check
      // error (booking a real doctor is itself safe); the server re-checks too.
      const text = reason.trim();
      if (text.length >= 6) {
        try {
          const r = await checkConcern(reason.slice(0, REASON_MAX), babyId || undefined);
          setConcern(r);
          if (r.triggered && r.severity === 'emergency') return; // gate → urgent care
        } catch {
          /* concern check unavailable — proceed; the server backstop re-checks */
        }
      }
      await bookConsultation({ doctorId: selectedId, babyId: babyId || undefined, slotStart: slot, reason: reason.slice(0, REASON_MAX) });
      navigate('/consultations');
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        // Server red-flag backstop fired — surface as the urgent-care alert + gate.
        setConcern({ triggered: true, severity: 'emergency', category: null, response: e.message });
      } else if (e instanceof ApiError && e.status === 409) {
        // Slot taken between load and confirm — refresh and move to the next opening.
        setSlot(null);
        try {
          const s = await getDoctorSlots(selectedId);
          setSlotData({ id: selectedId, days: s.days });
          const firstDay = s.days[0] ?? null;
          const firstSlot = firstDay?.slots[0]?.start ?? null;
          setSelectedDate(firstDay?.date ?? null);
          setSlot(firstSlot);
          if (firstSlot) setPeriod(slotPeriod(firstSlot));
          if (firstDay?.date) {
            const [y, m] = firstDay.date.split('-').map(Number);
            setView({ year: y, month: m - 1 });
          }
          setConflictNote(firstSlot ? 'That time was just taken — we moved you to the next opening.' : 'That time was just taken, and no other slots are open right now.');
        } catch {
          setBookError('That time was just taken. Please pick another.');
        }
      } else {
        setBookError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
      }
    } finally {
      setBooking(false);
    }
  }

  const selectedBaby = babies.find((b) => b.id === babyId) ?? null;
  const chars = reason.length;
  const overCap = chars > REASON_MAX;
  const nearCap = chars > REASON_MAX - 150;

  // Book button disabled state, shared by the booking-panel CTA.
  const bookDisabled = !slot || booking || emergencyBlock;

  // Detail-panel "About" copy (real bio, or an honest fallback from real fields).
  const aboutFull = selectedDoctor
    ? selectedDoctor.bio?.trim() ||
      (selectedDoctor.experienceYears > 0
        ? `${selectedDoctor.specialization} with ${selectedDoctor.experienceYears}+ years caring for little ones.`
        : `${selectedDoctor.specialization} on Mateo.`)
    : '';
  const aboutLong = aboutFull.length > 220;
  const aboutText = aboutLong && !bioExpanded ? `${aboutFull.slice(0, 220).trimEnd()}…` : aboutFull;
  const qualChips = selectedDoctor ? selectedDoctor.qualifications.split(/[,/]+/).map((s) => s.trim()).filter(Boolean) : [];

  return (
    <div className="pb-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50">
          <Stethoscope className="h-6 w-6 text-emerald-600" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-extrabold text-stone-900">Book an appointment</h1>
          <p className="text-sm text-stone-500">Pick a doctor, choose a time, and tell us what’s going on.</p>
        </div>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)_380px]">
        {/* ── Left: Booking appointment ── */}
        <div id="booking-panel" className="order-2 space-y-5 xl:order-none">
          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold text-stone-900">Booking appointment</h2>
            {!selectedDoctor ? (
              <p className="mt-3 text-sm text-stone-500">Select a doctor to see their availability.</p>
            ) : (
              <>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                  <CalendarClock className="h-3 w-3" />
                  {availabilitySummary(selectedDoctor.availability)}
                </span>

                {!slotsLoading && nextOpening && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                      <Sparkles className="h-3.5 w-3.5" />
                      Soonest opening · {relativeUpcomingIST(nextOpening)}
                    </span>
                  </div>
                )}

                <div className="mt-4">
                  <MonthCalendar
                    available={available}
                    slotCounts={slotCounts}
                    selected={selectedDate}
                    onSelect={pickDate}
                    view={view}
                    onPrev={() => setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }))}
                    onNext={() => setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }))}
                    today={today}
                  />
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-400">
                    <span className="inline-flex items-center gap-0.5">
                      <span className="h-1 w-1 rounded-full bg-emerald-500" />
                      <span className="h-1 w-1 rounded-full bg-emerald-500" />
                    </span>
                    Dots show how many times are open
                  </p>
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-stone-700">
                      {selectedDate ? formatDateIST(new Date(`${selectedDate}T12:00:00+05:30`).toISOString()) : 'Pick a date'}
                    </p>
                    {slot && <span className="text-xs font-semibold text-emerald-700">{formatTimeIST(slot)} selected</span>}
                  </div>

                  {slotsLoading ? (
                    <Skeleton className="mt-2 h-24 w-full" />
                  ) : !selectedDate || daySlots.length === 0 ? (
                    <p className="mt-2 text-sm text-stone-500">No open times. Try another date.</p>
                  ) : (
                    <>
                      <div role="group" aria-label="Time of day" className="mt-2 flex w-full gap-1 rounded-full bg-stone-100 p-1">
                        {PERIODS.map((p) => {
                          const cnt = grouped[p.key].length;
                          const active = p.key === effectivePeriod;
                          const empty = cnt === 0;
                          return (
                            <button
                              key={p.key}
                              type="button"
                              aria-pressed={active}
                              aria-disabled={empty}
                              aria-label={empty ? `${p.label}, no times` : undefined}
                              onClick={() => {
                                if (!empty) setPeriod(p.key);
                              }}
                              className={cn(
                                'flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-bold transition-colors',
                                active ? 'bg-white text-violet-700 shadow-soft' : empty ? 'cursor-not-allowed text-stone-400' : 'text-stone-500 hover:text-stone-700',
                              )}
                            >
                              {p.label}
                              <span className={cn('inline-grid min-w-4 place-items-center rounded-full px-1 text-[0.7rem] font-extrabold', active ? 'bg-violet-100 text-violet-800' : 'bg-white text-stone-400')}>{cnt}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div key={`${selectedDate}-${effectivePeriod}`} className="mt-3 grid animate-popin grid-cols-3 gap-2">
                        {visibleSlots.length === 0 ? (
                          <p className="col-span-full text-sm text-stone-500">No {effectivePeriod} slots — try another time of day.</p>
                        ) : (
                          visibleSlots.map((s) => (
                            <button
                              key={s.start}
                              type="button"
                              aria-pressed={slot === s.start}
                              aria-label={`Select ${formatTimeIST(s.start)}`}
                              onClick={() => setSlot(s.start)}
                              className={cn(
                                'rounded-xl border px-2 py-2 text-sm font-medium transition-colors',
                                slot === s.start ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50',
                              )}
                            >
                              {formatTimeIST(s.start)}
                            </button>
                          ))
                        )}
                      </div>
                      <p aria-live="polite" className="sr-only">
                        {visibleSlots.length === 0 ? `No ${effectivePeriod} times` : `${visibleSlots.length} ${effectivePeriod} ${visibleSlots.length === 1 ? 'time' : 'times'} available`}
                      </p>
                    </>
                  )}
                </div>

                {/* Primary booking CTA — sits right where the time is chosen */}
                <div className="mt-5 border-t border-stone-100 pt-4">
                  <Button onClick={() => void handleBook()} disabled={bookDisabled} size="lg" className="w-full">
                    {booking
                      ? 'Booking…'
                      : emergencyBlock
                        ? 'Seek urgent care first'
                        : slot
                          ? `Book ${slotLabel(slot)} · ₹${selectedDoctor.consultationFee}`
                          : `Select a time to book · ₹${selectedDoctor.consultationFee}`}
                  </Button>
                  {emergencyBlock ? (
                    <p className="mt-2 text-center text-xs text-rose-600">Please seek urgent care first.</p>
                  ) : (
                    !slot && <p className="mt-2 text-center text-xs text-stone-400">Pick a date &amp; time above to book.</p>
                  )}
                  <div role="status" aria-live="polite">
                    {conflictNote ? (
                      <p className="mt-2 text-xs font-medium text-amber-700">{conflictNote}</p>
                    ) : (
                      bookError && <p className="mt-2 text-xs font-medium text-rose-600">{bookError}</p>
                    )}
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-stone-400">
                    <ShieldCheck className="h-3 w-3" />
                    Payment is simulated for now — no money is charged.
                  </p>
                </div>
              </>
            )}
          </Card>

          {/* Patient concerns (hosts the deterministic red-flag pre-screen) */}
          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold text-stone-900">Patient concerns</h2>
            <div className="mt-3">
              <label htmlFor="baby" className="block text-sm font-medium text-stone-700">For which baby?</label>
              <select id="baby" value={babyId} onChange={(e) => setBabyId(e.target.value)} className={inputCls}>
                <option value="">Not specified</option>
                {babies.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {selectedBaby && (
                <p className="mt-1 text-xs text-stone-500">
                  {selectedBaby.name} · {formatAge(selectedBaby.dob)}
                </p>
              )}
            </div>
            <div className="mt-3">
              <textarea
                id="reason"
                rows={4}
                value={reason}
                onChange={(e) => onConcernChange(e.target.value)}
                placeholder="Describe the symptoms or reason for the visit…"
                className={cn(inputCls, 'resize-none')}
              />
              <div className="mt-1.5 flex items-center justify-between">
                <button type="button" disabled title="Photo upload coming soon" className="inline-flex cursor-not-allowed items-center gap-1 text-xs text-stone-300">
                  <Paperclip className="h-3.5 w-3.5" />
                  Attach photo
                </button>
                <span className={cn('text-xs tabular-nums', overCap ? 'text-rose-600' : nearCap ? 'text-amber-600' : 'text-stone-400')}>
                  {chars}/{REASON_MAX}
                </span>
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-xs text-stone-400">
                <ShieldCheck className="h-3 w-3" />
                {checking ? 'Checking your note for anything urgent…' : 'We quietly check your note for anything that needs urgent care.'}
              </p>
            </div>
            {concern?.triggered && <ConcernAlert result={concern} />}
          </Card>
        </div>

        {/* ── Center: Doctor list ── */}
        <div id="list-panel" className="order-1 xl:order-none">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-stone-900">Doctor list</h2>
              {doctors && <span className="text-xs font-medium text-stone-400">{shown.length} available</span>}
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, speciality or city" className={cn(inputCls, 'pl-9')} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilter('all')}
                aria-pressed={filter === 'all'}
                className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', filter === 'all' ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50')}
              >
                All
              </button>
              {specializations.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  aria-pressed={filter === s}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', filter === s ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50')}
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setVerifiedOnly((v) => !v)}
                aria-pressed={verifiedOnly}
                className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors', verifiedOnly ? 'border-green-400 bg-green-50 text-green-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50')}
              >
                <ShieldCheck className="h-3 w-3" />
                Verified only
              </button>
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setVerifiedOnly(false);
                    setQuery('');
                  }}
                  className="ml-auto text-xs font-semibold text-stone-400 hover:text-stone-700"
                >
                  Clear filters
                </button>
              )}
            </div>

            {doctors === null ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 min-[1800px]:grid-cols-2">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : shown.length === 0 ? (
              <p className="mt-6 text-center text-sm text-stone-500">
                {doctors.length === 0 ? 'No doctors are available yet. Please check back soon.' : 'No doctors match your search.'}
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 min-[1800px]:grid-cols-2">
                {shown.map((d) => (
                  <DoctorCard
                    key={d.id}
                    d={d}
                    selected={d.id === selectedId}
                    onBook={() => selectDoctor(d, 'booking-panel')}
                    onProfile={() => selectDoctor(d, 'detail-panel')}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Right: Detail doctor ── */}
        <div id="detail-panel" className="order-3 xl:order-none">
          {selectedDoctor ? (
            <Card key={selectedDoctor.id} className="animate-popin overflow-hidden p-0 xl:sticky xl:top-6">
              {/* Hero header — brand wash + overlapping portrait medallion */}
              <div className="relative">
                <div className="h-20 bg-gradient-to-br from-emerald-50 via-violet-50 to-white" />
                <div className="px-5">
                  <div className="-mt-10 flex flex-col items-center text-center">
                    <div className="relative">
                      <Avatar name={selectedDoctor.name} size="xl" className="h-24 w-24 text-3xl ring-4 ring-white" />
                      {verifiedOf(selectedDoctor) && (
                        <span aria-hidden="true" className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-green-500 text-white ring-2 ring-white">
                          <ShieldCheck className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2.5 font-display text-lg font-semibold text-stone-900">Dr. {selectedDoctor.name}</h2>
                    <p className="flex items-center gap-1 text-sm font-medium text-emerald-700">
                      <Stethoscope className="h-3.5 w-3.5" />
                      {selectedDoctor.specialization}
                    </p>
                    {(selectedDoctor.qualifications || verifiedOf(selectedDoctor)) && (
                      <p className="mt-0.5 text-xs text-stone-400">
                        {[selectedDoctor.qualifications, verifiedOf(selectedDoctor) ? 'Reg. on file' : null].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5">
                {/* Credentials stat-strip */}
                <div className="mt-4 grid grid-cols-3 divide-x divide-stone-200/70 rounded-2xl bg-stone-50 p-3 text-center">
                  <div className="px-1">
                    <p className="font-display text-lg font-extrabold leading-none text-stone-900">{selectedDoctor.experienceYears > 0 ? `${selectedDoctor.experienceYears}+` : 'New'}</p>
                    <p className="eyebrow mt-1">yrs exp</p>
                  </div>
                  <div className="px-1">
                    <p className="font-display text-lg font-extrabold leading-none text-stone-900">{selectedDoctor.avgRating !== null ? selectedDoctor.avgRating.toFixed(1) : 'New'}</p>
                    <p className="eyebrow mt-1">rating</p>
                  </div>
                  <div className="px-1">
                    <p className="inline-flex items-center justify-center font-display text-lg font-extrabold leading-none text-stone-900">
                      <IndianRupee className="h-4 w-4" />
                      {selectedDoctor.consultationFee}
                    </p>
                    <p className="eyebrow mt-1">per visit</p>
                  </div>
                </div>

                {/* Availability at a glance */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                    <CalendarClock className="h-3 w-3" />
                    {availabilitySummary(selectedDoctor.availability)}
                  </span>
                  {!slotsLoading &&
                    (nextOpening ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                        <Sparkles className="h-3 w-3" />
                        Next: {relativeUpcomingIST(nextOpening)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">No open times in the next two weeks</span>
                    ))}
                </div>

                {/* Languages + clinic */}
                {(selectedDoctor.languages.length > 0 || selectedDoctor.clinicName || selectedDoctor.city) && (
                  <div className="mt-3 space-y-1.5 text-sm text-stone-600">
                    {selectedDoctor.languages.length > 0 && (
                      <p className="flex flex-wrap items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                        Speaks
                        {selectedDoctor.languages.map((l) => (
                          <span key={l} className="rounded-full border border-stone-200 px-2 py-0.5 text-[11px] text-stone-600">{l}</span>
                        ))}
                      </p>
                    )}
                    {(selectedDoctor.clinicName || selectedDoctor.city) && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                        {[selectedDoctor.clinicName, selectedDoctor.city].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* About / Experience */}
                <div className="mt-4">
                  <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-stone-900">
                    <Award className="h-4 w-4 text-emerald-600" />
                    About
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">
                    {aboutText}
                    {aboutLong && (
                      <button type="button" onClick={() => setBioExpanded((v) => !v)} className="ml-1 font-semibold text-emerald-700 hover:underline">
                        {bioExpanded ? 'Read less' : 'Read more'}
                      </button>
                    )}
                  </p>
                  {qualChips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {qualChips.map((c) => (
                        <span key={c} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">{c}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reviews */}
                <ReviewsBlock key={selectedDoctor.id} avgRating={selectedDoctor.avgRating} reviewCount={selectedDoctor.reviewCount} reviews={reviews} />

                {/* How we vet */}
                <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-stone-50 p-2.5 text-[11px] leading-relaxed text-stone-500">
                  <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                  Every doctor on Mateo lists a medical registration number and qualifications before they appear here.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="hidden p-8 text-center xl:sticky xl:top-6 xl:block">
              <span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-emerald-50">
                <Stethoscope className="h-7 w-7 text-emerald-600" />
              </span>
              <p className="mx-auto mt-3 max-w-xs text-sm text-stone-500">Select a doctor to see their profile, reviews and book a visit.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
