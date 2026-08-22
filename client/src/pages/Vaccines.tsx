import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Droplets,
  HeartPulse,
  Info,
  MessageCircleHeart,
  PartyPopper,
  Plus,
  Printer,
  ShieldCheck,
  Stethoscope,
  Syringe,
  TrendingUp,
  Undo2,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { askAssistantLink } from '../lib/assistant';
import { gsap, useScrollReveal, celebrate, prefersReducedMotion } from '../lib/gsap';
import { getBaby } from '../api/babies';
import type { Baby } from '../api/babies';
import { listVaccines, setVaccineAdministered, addCustomVaccine } from '../api/vaccines';
import type { DoseStatus, VaccineDose, VaccineSummary } from '../api/vaccines';
import { getNotificationPreferences } from '../api/notificationPrefs';
import type { NotificationPreferences } from '../api/notificationPrefs';
import { ApiError } from '../api/client';
import { useT } from '../i18n/context';
import { dayDiffIST, formatAge, formatDateIST, toDateInputValueIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { DatePicker } from '../components/ui/DatePicker';
import { Skeleton } from '../components/ui/Skeleton';
import { ProgressRing } from '../components/ui/ProgressRing';
import { buttonClass } from '../components/ui/buttonStyles';
import { DoseStatusPill } from '../components/vaccines/DoseStatusPill';
import { TrackerInsight } from '../components/TrackerInsight';
import { MascotHero } from '../components/ui/MascotHero';
import { cn } from '../lib/cn';

function groupByAge(doses: VaccineDose[]): { ageLabel: string; doses: VaccineDose[] }[] {
  const groups: { ageLabel: string; doses: VaccineDose[] }[] = [];
  for (const dose of doses) {
    const last = groups[groups.length - 1];
    if (last && last.ageLabel === dose.ageLabel) last.doses.push(dose);
    else groups.push({ ageLabel: dose.ageLabel, doses: [dose] });
  }
  return groups;
}

function byDueDate(a: VaccineDose, b: VaccineDose): number {
  return a.dueDate.localeCompare(b.dueDate);
}

// Oral vaccines (drops) show a droplet; everything else an injection. Purely a
// friendly visual cue derived from the vaccine name — no clinical meaning.
function isOralVaccine(name: string): boolean {
  return /\b(opv|oral polio|rota)/i.test(name);
}

type FilterKey = 'all' | DoseStatus;
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'done', label: 'Given' },
  { key: 'due', label: 'Due now' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
];

export default function Vaccines() {
  const { id } = useParams();
  const [baby, setBaby] = useState<Baby | null>(null);
  const [doses, setDoses] = useState<VaccineDose[] | null>(null);
  const [summary, setSummary] = useState<VaccineSummary | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState<Record<string, string>>({});
  const [brandDraft, setBrandDraft] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showAddCustom, setShowAddCustom] = useState(false);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([getBaby(id), listVaccines(id)])
      .then(([b, v]) => {
        if (cancelled) return;
        setBaby(b.baby);
        setDoses(v.doses);
        setSummary(v.summary);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Notification preferences power the honest "how we'll remind you" band. Best
  // effort — a failure just leaves the reassurance copy without live channel state.
  useEffect(() => {
    let cancelled = false;
    getNotificationPreferences()
      .then((r) => {
        if (!cancelled) setPrefs(r.preferences);
      })
      .catch(() => {
        /* ignore — the band falls back to generic copy */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function update(doseId: string, administeredOn: string | null, brand?: string) {
    setSavingId(doseId);
    setError(null);
    try {
      await setVaccineAdministered(doseId, administeredOn, brand);
      // Refetch the whole list so EVERY dose's status AND the summary are recomputed
      // by the server against one "today" — a single-dose optimistic patch would
      // leave siblings stale and let the client-side tally disagree with the server.
      if (id) {
        const v = await listVaccines(id);
        setDoses(v.doses);
        setSummary(v.summary);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setSavingId(null);
    }
  }

  // Cascade cards in as they scroll into view; re-runs once doses load.
  const pageRef = useScrollReveal<HTMLDivElement>([doses]);

  const pending = (doses ?? []).filter((d) => d.status === 'due' || d.status === 'upcoming').sort(byDueDate);
  const overdue = (doses ?? []).filter((d) => d.status === 'overdue').sort(byDueDate);
  const nextDose = pending[0] ?? null;
  const pct = summary && summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

  const filtered = filter === 'all' ? doses ?? [] : (doses ?? []).filter((d) => d.status === filter);

  return (
    <div ref={pageRef}>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: 'var(--cat-vaccine-bg)' }}>
          <Syringe className="h-6 w-6" style={{ color: 'var(--cat-vaccine-text)' }} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Baby Vaccination Tracker</h1>
          {baby && (
            <p className="text-sm text-stone-500">
              {baby.name} · {formatAge(baby.dob)}
            </p>
          )}
        </div>
      </header>

      <MascotHero
        className="mt-5"
        mascot="/baby-vaccines.png"
        alt="A smiling baby with a teddy bear beside a medical shield, syringe and vaccine vial"
        eyebrow="Protected &amp; on track"
        eyebrowColor="var(--cat-vaccine-text)"
        title="Little one, big protection"
        description="Every shot is a shield — track the schedule, catch up on anything due, and we’ll gently nudge you before each new one."
      />

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {doses === null || summary === null ? (
        <VaccinesSkeleton />
      ) : (
        <>
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            {/* ── Main column ── */}
            <div className="min-w-0 space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-reveal="">
                <SummaryCard tone="violet" icon={CalendarDays} value={summary.total} label="Total vaccines" hint="In the schedule" />
                <SummaryCard tone="emerald" icon={CheckCircle2} value={summary.done} label="Completed" hint={`${pct}% of schedule`} />
                <SummaryCard
                  tone="amber"
                  icon={Clock}
                  value={summary.due + summary.upcoming}
                  label="Upcoming"
                  hint={nextDose ? `Next: ${formatDateIST(nextDose.dueDate)}` : 'Nothing scheduled'}
                />
                <SummaryCard
                  tone="rose"
                  icon={AlertTriangle}
                  value={summary.overdue}
                  label="Overdue"
                  hint={summary.overdue > 0 ? 'Needs attention' : 'All on time'}
                />
              </div>

              {/* Forward-looking "what needs attention" band */}
              <NextUpCard doses={doses} babyName={baby?.name} />

              {id && (
                <Link
                  to={askAssistantLink(id, `What vaccines are due for my baby around now, and what should I know about after-effects or catching up if we're a bit behind?`)}
                  className="inline-flex items-center gap-1.5 text-sm font-bold"
                  style={{ color: 'var(--cat-assistant)' }}
                >
                  <MessageCircleHeart className="h-4 w-4" /> Vaccine questions? Ask Dai Maa
                </Link>
              )}

              {id && <TrackerInsight babyId={id} tracker="vaccines" hasData={doses.length > 0} signature={summary.done} />}

              {/* Filters + print */}
              <div className="flex flex-wrap items-center gap-2" data-reveal="">
                {FILTERS.map((f) => {
                  const count = f.key === 'all' ? doses.length : doses.filter((d) => d.status === f.key).length;
                  if (f.key !== 'all' && count === 0) return null;
                  const active = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
                        active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100',
                      )}
                    >
                      {f.label}
                      <span className={cn('text-xs font-bold', active ? 'text-white/80' : 'text-stone-400')}>{count}</span>
                    </button>
                  );
                })}
                <button onClick={() => setShowAddCustom(true)} className={buttonClass('secondary', 'sm', 'ml-auto')}>
                  <Plus className="h-4 w-4" /> Add vaccine
                </button>
                <button
                  onClick={() => window.print()}
                  className={buttonClass('secondary', 'sm')}
                >
                  <Printer className="h-4 w-4" /> Print
                </button>
              </div>

              {/* Timeline */}
              {filtered.length === 0 ? (
                <Card className="p-8 text-center text-sm text-stone-500" data-reveal="">
                  No {FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} vaccines right now.
                </Card>
              ) : (
                <div className="relative pl-7">
                  {/* Continuous timeline rail behind the age groups */}
                  <span aria-hidden="true" className="absolute bottom-2 left-[9px] top-2 w-px bg-stone-200" />
                  <div className="space-y-7">
                    {groupByAge(filtered).map((group) => (
                      <section key={group.ageLabel} className="relative">
                        <span
                          aria-hidden="true"
                          className="absolute -left-7 top-1 grid h-[18px] w-[18px] place-items-center rounded-full ring-4 ring-[var(--surface-app)]"
                          style={{ backgroundColor: 'var(--cat-vaccine)' }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                        <h2 className="mb-2.5 text-sm font-bold uppercase tracking-wide text-stone-500">{group.ageLabel}</h2>
                        <div className="space-y-2.5">
                          {group.doses.map((dose) => (
                            <DoseRow
                              key={dose.id}
                              dose={dose}
                              saving={savingId === dose.id}
                              minDate={baby ? toDateInputValueIST(baby.dob) : undefined}
                              draft={dateDraft[dose.id] ?? todayInputValueIST()}
                              brandDraft={brandDraft[dose.id] ?? ''}
                              onDraftChange={(v) => setDateDraft((prev) => ({ ...prev, [dose.id]: v }))}
                              onBrandChange={(v) => setBrandDraft((prev) => ({ ...prev, [dose.id]: v }))}
                              onMark={(d, b) => void update(dose.id, d, b)}
                              onUndo={() => void update(dose.id, null)}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right rail ── */}
            <aside className="space-y-5 lg:sticky lg:top-6">
              <ProgressCard pct={pct} summary={summary} />
              <NextVaccineCard nextDose={nextDose} overdue={overdue[0] ?? null} />
              <BenefitsCard />
              <ImportantNoteCard />
            </aside>
          </div>

          {/* Honest reminder band */}
          <ReminderBand prefs={prefs} />

          {/* Vaccine info section (#14) */}
          <VaccineInfoSection />

          {showAddCustom && id && (
            <AddCustomVaccineModal
              babyId={id}
              minDate={baby ? toDateInputValueIST(baby.dob) : undefined}
              onClose={() => setShowAddCustom(false)}
              onAdded={async () => {
                setShowAddCustom(false);
                const v = await listVaccines(id);
                setDoses(v.doses);
                setSummary(v.summary);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

const SUMMARY_TONES = {
  violet: { chip: 'bg-violet-100 text-violet-700', tint: 'var(--cat-assistant-bg)' },
  emerald: { chip: 'bg-green-100 text-green-700', tint: 'var(--status-ontrack-bg)' },
  amber: { chip: 'bg-amber-100 text-amber-700', tint: 'var(--status-duesoon-bg)' },
  rose: { chip: 'bg-rose-100 text-rose-700', tint: 'var(--status-overdue-bg)' },
} as const;

function SummaryCard({
  tone,
  icon: Icon,
  value,
  label,
  hint,
}: {
  tone: keyof typeof SUMMARY_TONES;
  icon: LucideIcon;
  value: number;
  label: string;
  hint: string;
}) {
  const t = SUMMARY_TONES[tone];
  return (
    <Card
      className="pop-hover p-4"
      style={{ background: `linear-gradient(135deg, ${t.tint} 0%, var(--surface-card) 72%)` }}
    >
      <span className={cn('grid h-9 w-9 place-items-center rounded-xl', t.chip)}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 display-num text-3xl font-bold text-stone-900">{value}</p>
      <p className="text-sm font-semibold text-stone-700">{label}</p>
      <p className="mt-0.5 truncate text-xs text-stone-500">{hint}</p>
    </Card>
  );
}

// Distinct vaccine names from a set of doses (e.g. "BCG, Hepatitis B, OPV").
function vaccineNames(doses: VaccineDose[], max = 3): string {
  const names = [...new Set(doses.map((d) => d.vaccineName))];
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

// The forward-looking headline: overdue (act now) → due now → next upcoming → all done.
// Purely derived from dose status/dates; safety-relevant states get the most weight.
function NextUpCard({ doses, babyName }: { doses: VaccineDose[]; babyName?: string }) {
  const who = babyName || 'your baby';
  const overdue = doses.filter((d) => d.status === 'overdue').sort(byDueDate);
  const due = doses.filter((d) => d.status === 'due').sort(byDueDate);
  const upcoming = doses.filter((d) => d.status === 'upcoming').sort(byDueDate);

  let tone: { bg: string; text: string; icon: LucideIcon };
  let title: string;
  let body: string;

  if (overdue.length > 0) {
    const days = Math.abs(dayDiffIST(overdue[0].dueDate));
    tone = { bg: 'var(--status-overdue-bg)', text: '#b91c1c', icon: AlertTriangle };
    title = `Catch up: ${vaccineNames(overdue)}`;
    body = `Overdue since ${formatDateIST(overdue[0].dueDate)} (about ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}). It’s not too late — check with your pediatrician to catch up safely.`;
  } else if (due.length > 0) {
    tone = { bg: 'var(--cat-vaccine-bg)', text: 'var(--cat-vaccine-text)', icon: CalendarClock };
    title = `Due now: ${vaccineNames(due)}`;
    body = `${who}’s next ${due.length === 1 ? 'shot is' : 'shots are'} ready to be given. Book a visit, then mark it below.`;
  } else if (upcoming.length > 0) {
    const next = upcoming[0];
    const d = dayDiffIST(next.dueDate);
    const when = d <= 0 ? 'soon' : d < 14 ? `in ${d} day${d === 1 ? '' : 's'}` : `in about ${Math.round(d / 7)} weeks`;
    const sameDay = upcoming.filter((u) => u.ageLabel === next.ageLabel);
    tone = { bg: 'var(--cat-vaccine-bg)', text: 'var(--cat-vaccine-text)', icon: CalendarClock };
    title = `Next up: ${vaccineNames(sameDay)}`;
    body = `Around ${next.ageLabel} · due ${formatDateIST(next.dueDate)} (${when}). We’ll remind you when it’s time.`;
  } else {
    tone = { bg: 'var(--status-ontrack-bg)', text: 'var(--status-ontrack-text)', icon: PartyPopper };
    title = 'All caught up!';
    body = `Every scheduled vaccine for ${who} is done. 🎉 We’ll let you know when the next one comes around.`;
  }

  const Icon = tone.icon;
  return (
    <Card className="flex items-start gap-3 p-5" data-reveal="" style={{ backgroundColor: tone.bg }}>
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/70">
        <Icon className="h-5 w-5" style={{ color: tone.text }} />
      </span>
      <div className="min-w-0">
        <h2 className="font-bold" style={{ color: tone.text }}>{title}</h2>
        <p className="mt-0.5 text-sm text-stone-700">{body}</p>
      </div>
    </Card>
  );
}

function DoseRow({
  dose,
  saving,
  minDate,
  draft,
  brandDraft,
  onDraftChange,
  onBrandChange,
  onMark,
  onUndo,
}: {
  dose: VaccineDose;
  saving: boolean;
  minDate?: string;
  draft: string;
  brandDraft: string;
  onDraftChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onMark: (date: string, brand?: string) => void;
  onUndo: () => void;
}) {
  const t = useT();
  const isDone = dose.status === 'done';
  const rowRef = useRef<HTMLDivElement>(null);
  const prevStatus = useRef(dose.status);
  const oral = isOralVaccine(dose.vaccineName);

  // When a dose newly becomes "given", give a little pop + confetti — finishing
  // a dose is a genuine win for a parent. Skips the very first render (data load)
  // and honours reduced motion.
  useEffect(() => {
    if (prevStatus.current !== 'done' && dose.status === 'done') {
      if (!prefersReducedMotion() && rowRef.current) {
        gsap.fromTo(
          rowRef.current,
          { scale: 0.97 },
          { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' },
        );
        celebrate(rowRef.current);
      }
    }
    prevStatus.current = dose.status;
  }, [dose.status]);

  return (
    <div ref={rowRef} data-reveal="">
      <Card className="pop-hover p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: 'var(--cat-vaccine-bg)' }}
          >
            {oral ? (
              <Droplets className="h-5 w-5" style={{ color: 'var(--cat-vaccine-text)' }} />
            ) : (
              <Syringe className="h-5 w-5" style={{ color: 'var(--cat-vaccine-text)' }} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-stone-800">
                  {dose.vaccineName} <span className="font-normal text-stone-500">· {dose.doseLabel}</span>
                </h3>
                {dose.protectsAgainst && (
                  <p className="mt-0.5 text-sm text-stone-500">{t('vax.protects')} {dose.protectsAgainst}</p>
                )}
              </div>
              <DoseStatusPill status={dose.status} />
            </div>

            <p className="mt-2 text-sm text-stone-500">
              {isDone && dose.administeredOn
                ? `Given ${formatDateIST(dose.administeredOn)}${dose.brand ? ` · ${dose.brand}` : ''}`
                : `Due ${formatDateIST(dose.dueDate)}`}
              {dose.isCustom && <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700">Custom</span>}
            </p>

            {dose.notes && <p className="mt-1 text-sm text-stone-500">{dose.notes}</p>}

            <div className="mt-3 border-t border-stone-100 pt-3">
              {isDone ? (
                <button
                  onClick={onUndo}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700 disabled:opacity-60"
                >
                  <Undo2 className="h-4 w-4" />
                  {saving ? t('vax.saving') : t('vax.undo')}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm text-stone-500" htmlFor={`date-${dose.id}`}>
                    {t('vax.givenOn')}
                  </label>
                  <DatePicker
                    id={`date-${dose.id}`}
                    value={draft}
                    min={minDate}
                    max={todayInputValueIST()}
                    onChange={onDraftChange}
                    className="w-44 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <input
                    type="text"
                    placeholder={t('vax.brandPlaceholder')}
                    value={brandDraft}
                    onChange={(e) => onBrandChange(e.target.value)}
                    className="w-36 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button onClick={() => onMark(draft, brandDraft || undefined)} disabled={saving} className={buttonClass('primary', 'sm')}>
                    <Check className="h-4 w-4" />
                    {saving ? t('vax.saving') : t('vax.markGiven')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

const LEGEND_KEYS: { key: DoseStatus; tKey: string; dot: string }[] = [
  { key: 'done', tKey: 'vax.given', dot: 'bg-green-500' },
  { key: 'due', tKey: 'vax.dueNow', dot: 'bg-amber-500' },
  { key: 'overdue', tKey: 'vax.overdue', dot: 'bg-rose-500' },
  { key: 'upcoming', tKey: 'vax.upcoming', dot: 'bg-stone-300' },
];

function ProgressCard({ pct, summary }: { pct: number; summary: VaccineSummary }) {
  const t = useT();
  const counts: Record<DoseStatus, number> = {
    done: summary.done,
    due: summary.due,
    overdue: summary.overdue,
    upcoming: summary.upcoming,
  };
  return (
    <Card className="p-5" data-reveal="">
      <h3 className="font-display text-lg font-semibold text-stone-900">Vaccination progress</h3>
      <div className="mt-4 flex items-center gap-5">
        <ProgressRing value={pct} size={116} stroke={11} trackClass="text-emerald-100" barClass="text-emerald-500">
          <span className="display-num text-2xl font-bold text-stone-900">{pct}%</span>
          <span className="text-[11px] font-semibold text-stone-500">complete</span>
        </ProgressRing>
        <ul className="flex-1 space-y-1.5">
          {LEGEND_KEYS.map((l) => (
            <li key={l.key} className="flex items-center gap-2 text-sm">
              <span className={cn('h-2.5 w-2.5 rounded-full', l.dot)} />
              <span className="text-stone-600">{t(l.tKey)}</span>
              <span className="ml-auto font-bold text-stone-800">{counts[l.key]}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-xs text-stone-500">Share of the full schedule already given.</p>
    </Card>
  );
}

function NextVaccineCard({ nextDose, overdue }: { nextDose: VaccineDose | null; overdue: VaccineDose | null }) {
  // Prefer the soonest pending dose; if there's nothing pending but something is
  // overdue, surface the catch-up. Otherwise everything is done.
  const focus = nextDose ?? overdue;
  const isCatchUp = !nextDose && !!overdue;

  return (
    <Card className="overflow-hidden p-5" data-reveal="">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-stone-900">
          {isCatchUp ? 'Catch up next' : 'Next vaccine'}
        </h3>
        <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: 'var(--cat-vaccine-bg)' }}>
          <Syringe className="h-[18px] w-[18px]" style={{ color: 'var(--cat-vaccine-text)' }} />
        </span>
      </div>

      {focus ? (
        <>
          <p className="mt-3 text-base font-bold text-stone-900">{focus.vaccineName}</p>
          <p className="text-sm text-stone-500">{focus.doseLabel}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 text-sm font-medium text-stone-700">
              <CalendarClock className="h-4 w-4 text-stone-400" />
              {formatDateIST(focus.dueDate)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-stone-50 px-2.5 py-1.5 text-sm font-medium text-stone-700">
              {focus.ageLabel}
            </span>
          </div>
          <Link to="/find-doctor" className={buttonClass('primary', 'md', 'mt-4 w-full')}>
            <Stethoscope className="h-4 w-4" /> Book a visit
          </Link>
        </>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-sm text-stone-600">
          <PartyPopper className="h-5 w-5 text-green-500" />
          Everything scheduled is done. We’ll flag the next one when it’s due.
        </div>
      )}
    </Card>
  );
}

const BENEFITS: { icon: LucideIcon; text: string }[] = [
  { icon: ShieldCheck, text: 'Protects against serious childhood diseases' },
  { icon: HeartPulse, text: 'Builds your baby’s natural immunity' },
  { icon: TrendingUp, text: 'Supports healthy growth & development' },
  { icon: Users, text: 'Helps keep your family & community safe' },
];

function BenefitsCard() {
  return (
    <Card className="p-5" data-reveal="">
      <h3 className="font-display text-lg font-semibold text-stone-900">Why vaccinations matter</h3>
      <ul className="mt-3 space-y-3">
        {BENEFITS.map((b) => (
          <li key={b.text} className="flex items-start gap-3 text-sm text-stone-600">
            <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: 'var(--cat-vaccine-bg)' }}>
              <b.icon className="h-4 w-4" style={{ color: 'var(--cat-vaccine-text)' }} />
            </span>
            {b.text}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ImportantNoteCard() {
  return (
    <Card className="p-5" data-reveal="" style={{ backgroundColor: 'var(--status-info-bg)' }}>
      <div className="flex items-center gap-2">
        <Info className="h-5 w-5" style={{ color: 'var(--status-info-text)' }} />
        <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--status-info-text)' }}>
          Important note
        </h3>
      </div>
      <p className="mt-2 text-sm text-stone-700">
        Carry your baby’s vaccination card to every visit. This schedule follows general IAP guidance and is
        not medical advice — your pediatrician may adjust the timing or doses for your baby. Always confirm
        with them.
      </p>
      <Link to="/find-doctor" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: 'var(--status-info-text)' }}>
        <Stethoscope className="h-4 w-4" /> Talk to a doctor
      </Link>
    </Card>
  );
}

function ReminderBand({ prefs }: { prefs: NotificationPreferences | null }) {
  // Only the channels the app can actually deliver on — the in-app dashboard is
  // always on; email and WhatsApp reflect the parent's real saved preferences.
  const channels: { label: string; on: boolean; note: string }[] = [
    { label: 'Dashboard', on: true, note: 'Always on' },
    { label: 'Email', on: prefs?.emailEnabled ?? true, note: (prefs?.emailEnabled ?? true) ? 'On' : 'Off' },
    { label: 'WhatsApp', on: prefs?.whatsappEnabled ?? false, note: prefs?.whatsappEnabled ? 'On' : 'Off' },
  ];
  return (
    <Card className="mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" data-reveal="">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: 'var(--cat-vaccine-bg)' }}>
          <ShieldCheck className="h-5 w-5" style={{ color: 'var(--cat-vaccine-text)' }} />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold text-stone-900">Never miss a vaccine</h3>
          <p className="text-sm text-stone-500">We’ll flag every due and overdue vaccine here and on your dashboard.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {channels.map((c) => (
          <span
            key={c.label}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold',
              c.on ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-500',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', c.on ? 'bg-green-500' : 'bg-stone-300')} />
            {c.label}
            <span className="text-xs font-medium opacity-70">{c.note}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

// ── #12: Add Custom Vaccine modal ───────────────────────────────────────────
function AddCustomVaccineModal({
  babyId,
  minDate,
  onClose,
  onAdded,
}: {
  babyId: string;
  minDate?: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayInputValueIST());
  const [brand, setBrand] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await addCustomVaccine(babyId, { vaccineName: name.trim(), administeredOn: date, brand: brand.trim() || undefined });
      onAdded();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not add vaccine');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md space-y-4 p-6" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-stone-900">Add a vaccine</h2>
        <p className="text-sm text-stone-500">Record a vaccine that is not part of the standard IAP schedule.</p>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Vaccine name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chickenpox / Varicella"
            className="h-11 w-full rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Date given *</label>
            <DatePicker value={date} min={minDate} max={todayInputValueIST()} onChange={setDate}
              className="h-11 w-full rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Brand</label>
            <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Optional"
              className="h-11 w-full rounded-xl border border-stone-300 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={buttonClass('secondary', 'md')}>Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving || !name.trim()} className={buttonClass('primary', 'md')}>
            {saving ? 'Adding…' : 'Add vaccine'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ── #14: Vaccine educational info ───────────────────────────────────────────
const VACCINE_INFO: { name: string; protects: string; about: string; painless?: boolean; postCare: string }[] = [
  { name: 'BCG', protects: 'Tuberculosis (TB)', about: 'Given at birth — a small injection in the upper arm that leaves a tiny scar. Protects against severe forms of childhood TB.', postCare: 'A small bump may form at the injection site. This is normal and can take weeks to heal. Do not apply any ointment.' },
  { name: 'Hepatitis B', protects: 'Hepatitis B virus infection', about: 'A series of 3-4 doses starting at birth. Prevents liver infection that can become chronic.', postCare: 'Mild soreness at the site is common. Fever is rare.' },
  { name: 'OPV', protects: 'Polio (oral drops)', about: 'Oral drops — painless! Given alongside injectable polio vaccine (IPV) for full protection.', postCare: 'No side effects expected from oral drops. Avoid feeding for 30 minutes after the drops.' },
  { name: 'DTwP/DTaP', protects: 'Diphtheria, Tetanus, Pertussis (whooping cough)', about: 'A combination vaccine given in 3 primary doses plus boosters. DTaP (acellular/painless) causes fewer side effects than DTwP (whole-cell).', painless: true, postCare: 'Mild fever and fussiness are common for 1-2 days. A warm compress can ease soreness at the site.' },
  { name: 'IPV', protects: 'Polio (injectable)', about: 'An injection that works together with OPV drops to provide complete polio protection.', postCare: 'Mild redness at the injection site. No significant side effects.' },
  { name: 'PCV', protects: 'Pneumococcal disease (pneumonia, meningitis)', about: 'Protects against bacterial infections that can cause pneumonia, ear infections and meningitis in young children.', postCare: 'Mild fever and irritability may occur. Give paracetamol only if recommended by your doctor.' },
  { name: 'Rotavirus', protects: 'Severe diarrhoea caused by Rotavirus', about: 'Oral drops — painless! Prevents the most common cause of severe diarrhoea in babies under 5.', postCare: 'Mild loose stools may occur. Contact your doctor if you notice severe vomiting or bloody stools.' },
  { name: 'Influenza', protects: 'Seasonal influenza (flu)', about: 'Recommended from 6 months. Two doses in the first year, then one dose annually.', postCare: 'Mild soreness, low-grade fever for a day. The vaccine does NOT cause flu.' },
  { name: 'MMR', protects: 'Measles, Mumps, Rubella', about: 'Two doses — first around 9 months, booster at 15-18 months. Highly effective at preventing all three diseases.', postCare: 'Mild fever or rash may appear 7-12 days after the shot. This is the immune system responding — not an infection.' },
  { name: 'Typhoid Conjugate Vaccine', protects: 'Typhoid fever', about: 'A single dose given between 6-9 months of age with a booster later.', postCare: 'Mild fever and site pain may occur for a day.' },
  { name: 'Varicella', protects: 'Chickenpox', about: 'Two doses recommended. Prevents chickenpox and its complications including skin infections and pneumonia.', postCare: 'A mild rash with a few spots may appear 1-3 weeks later. Keep the area clean.' },
  { name: 'Hepatitis A', protects: 'Hepatitis A virus infection', about: 'Two doses starting at 12 months, 6 months apart. Prevents liver infection spread through contaminated food/water.', postCare: 'Mild soreness at the site. Serious reactions are very rare.' },
];

function VaccineInfoSection() {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  return (
    <Card className="mt-6 p-5" data-reveal="">
      <h3 className="font-display text-lg font-semibold text-stone-900">Know your vaccines</h3>
      <p className="mt-1 text-sm text-stone-500">Tap any vaccine to learn more about what it protects against, what to expect, and post-vaccination care.</p>
      <div className="mt-4 space-y-2">
        {VACCINE_INFO.map((v, i) => (
          <div key={v.name} className="overflow-hidden rounded-xl border border-stone-200">
            <button type="button" onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-stone-50">
              <div className="flex items-center gap-2.5">
                <Syringe className="h-4 w-4" style={{ color: 'var(--cat-vaccine-text)' }} />
                <span className="text-sm font-semibold text-stone-800">{v.name}</span>
              </div>
              <ChevronDown className={cn('h-4 w-4 text-stone-400 transition-transform', expandedIdx === i && 'rotate-180')} />
            </button>
            {expandedIdx === i && (
              <div className="space-y-2 border-t border-stone-100 bg-stone-50/50 px-4 py-3 text-sm text-stone-700">
                <p><strong>Protects against:</strong> {v.protects}</p>
                <p>{v.about}</p>
                {v.painless && (
                  <p className="flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Painless option available — ask your pediatrician about DTaP.
                  </p>
                )}
                <p><strong>After the vaccine:</strong> {v.postCare}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function VaccinesSkeleton() {
  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="mt-3 h-8 w-12" />
              <Skeleton className="mt-2 h-4 w-20" />
            </Card>
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-56" />
              <Skeleton className="mt-3 h-8 w-48" />
            </Card>
          ))}
        </div>
      </div>
      <div className="space-y-5">
        <Card className="p-5">
          <Skeleton className="h-28 w-full" />
        </Card>
        <Card className="p-5">
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    </div>
  );
}
