import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, CalendarClock, Check, MessageCircleHeart, PartyPopper, ShieldCheck, Syringe, Undo2 } from 'lucide-react';
import { askAssistantLink } from '../lib/assistant';
import { gsap, useScrollReveal, celebrate, prefersReducedMotion } from '../lib/gsap';
import { getBaby } from '../api/babies';
import type { Baby } from '../api/babies';
import { listVaccines, setVaccineAdministered } from '../api/vaccines';
import type { VaccineDose, VaccineSummary } from '../api/vaccines';
import { ApiError } from '../api/client';
import { dayDiffIST, formatAge, formatDateIST, toDateInputValueIST, todayInputValueIST } from '../lib/age';
import { upToDatePct } from '../lib/vaccineStats';
import { Card } from '../components/ui/Card';
import { DatePicker } from '../components/ui/DatePicker';
import { Skeleton } from '../components/ui/Skeleton';
import { StatTally } from '../components/ui/StatTally';
import { ProgressBar } from '../components/ui/ProgressBar';
import { buttonClass } from '../components/ui/buttonStyles';
import { DoseStatusPill } from '../components/vaccines/DoseStatusPill';
import { TrackerInsight } from '../components/TrackerInsight';
import { MascotHero } from '../components/ui/MascotHero';

function groupByAge(doses: VaccineDose[]): { ageLabel: string; doses: VaccineDose[] }[] {
  const groups: { ageLabel: string; doses: VaccineDose[] }[] = [];
  for (const dose of doses) {
    const last = groups[groups.length - 1];
    if (last && last.ageLabel === dose.ageLabel) last.doses.push(dose);
    else groups.push({ ageLabel: dose.ageLabel, doses: [dose] });
  }
  return groups;
}

export default function Vaccines() {
  const { id } = useParams();
  const [baby, setBaby] = useState<Baby | null>(null);
  const [doses, setDoses] = useState<VaccineDose[] | null>(null);
  const [summary, setSummary] = useState<VaccineSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState<Record<string, string>>({});

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

  async function update(doseId: string, administeredOn: string | null) {
    setSavingId(doseId);
    setError(null);
    try {
      await setVaccineAdministered(doseId, administeredOn);
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

  const onTrack = summary ? upToDatePct(summary) : 0;

  // Cascade dose cards in as they scroll into view; re-runs once doses load.
  const pageRef = useScrollReveal<HTMLDivElement>([doses]);

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
          <h1 className="text-2xl font-extrabold text-stone-900">Vaccinations</h1>
          {baby && (
            <p className="text-sm text-stone-500">
              {baby.name} · {formatAge(baby.dob)}
            </p>
          )}
        </div>
      </header>

      <MascotHero
        className="mt-5"
        mascot="/lion-vaccines.png"
        alt="A superhero lion holding a vaccine and a shield"
        eyebrow="Protected &amp; on track"
        eyebrowColor="var(--cat-vaccine-text)"
        title="Little one, big protection"
        description="Every shot is a shield — we’ll gently remind you before each new one is due."
      />

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {doses === null ? (
        <VaccinesSkeleton />
      ) : (
        <>
          {summary && (
            <Card className="mt-5 p-5" data-reveal="">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTally value={summary.done} label="Given" tone="emerald" />
                <StatTally value={summary.due} label="Due now" tone="amber" />
                <StatTally value={summary.overdue} label="Overdue" tone="rose" />
                <StatTally value={summary.upcoming} label="Upcoming" tone="stone" />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <ProgressBar value={onTrack} className="flex-1" />
                <span className="text-xs font-semibold text-stone-500">{onTrack}% up to date</span>
              </div>
            </Card>
          )}

          {/* Forward-looking "next up" band — turns the schedule into a journey:
              what needs attention now, or what's coming, at a glance. */}
          <NextUpCard doses={doses} babyName={baby?.name} />

          {id && (
            <div className="mt-3">
              <Link
                to={askAssistantLink(id, `What vaccines are due for my baby around now, and what should I know about after-effects or catching up if we're a bit behind?`)}
                className="inline-flex items-center gap-1.5 text-sm font-bold"
                style={{ color: 'var(--cat-assistant)' }}
              >
                <MessageCircleHeart className="h-4 w-4" /> Vaccine questions? Ask Dai Maa
              </Link>
            </div>
          )}

          {id && <TrackerInsight babyId={id} tracker="vaccines" hasData={doses.length > 0} signature={summary?.done} className="mt-5" />}

          <div className="mt-7 space-y-8">
            {groupByAge(doses).map((group) => (
              <section key={group.ageLabel}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-500">
                  {group.ageLabel}
                  <span className="h-px flex-1 bg-stone-200" />
                </h2>
                <div className="space-y-3">
                  {group.doses.map((dose) => (
                    <DoseRow
                      key={dose.id}
                      dose={dose}
                      saving={savingId === dose.id}
                      minDate={baby ? toDateInputValueIST(baby.dob) : undefined}
                      draft={dateDraft[dose.id] ?? todayInputValueIST()}
                      onDraftChange={(v) => setDateDraft((prev) => ({ ...prev, [dose.id]: v }))}
                      onMark={(d) => void update(dose.id, d)}
                      onUndo={() => void update(dose.id, null)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-8 flex items-start gap-2 rounded-xl bg-stone-100 px-4 py-3 text-xs text-stone-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
            This schedule follows general IAP guidance and is not medical advice. Your pediatrician may
            adjust timing or doses for your baby — always confirm with them.
          </p>
        </>
      )}
    </div>
  );
}

// Distinct vaccine names from a set of doses (e.g. "BCG, Hepatitis B, OPV").
function vaccineNames(doses: VaccineDose[], max = 3): string {
  const names = [...new Set(doses.map((d) => d.vaccineName))];
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

function byDueDate(a: VaccineDose, b: VaccineDose): number {
  return a.dueDate.localeCompare(b.dueDate);
}

// The forward-looking headline: overdue (act now) → due now → next upcoming → all done.
// Purely derived from dose status/dates; safety-relevant states get the most weight.
function NextUpCard({ doses, babyName }: { doses: VaccineDose[]; babyName?: string }) {
  const who = babyName || 'your baby';
  const overdue = doses.filter((d) => d.status === 'overdue').sort(byDueDate);
  const due = doses.filter((d) => d.status === 'due').sort(byDueDate);
  const upcoming = doses.filter((d) => d.status === 'upcoming').sort(byDueDate);

  let tone: { bg: string; text: string; icon: typeof CalendarClock };
  let title: string;
  let body: string;

  if (overdue.length > 0) {
    const days = Math.abs(dayDiffIST(overdue[0].dueDate));
    tone = { bg: 'var(--cat-vaccine-bg)', text: '#b91c1c', icon: AlertTriangle };
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
    tone = { bg: 'var(--cat-vaccine-bg)', text: 'var(--cat-vaccine-text)', icon: PartyPopper };
    title = 'All caught up!';
    body = `Every scheduled vaccine for ${who} is done. 🎉 We’ll let you know when the next one comes around.`;
  }

  const Icon = tone.icon;
  return (
    <Card className="mt-5 flex items-start gap-3 p-5" data-reveal="" style={{ backgroundColor: tone.bg }}>
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
  onDraftChange,
  onMark,
  onUndo,
}: {
  dose: VaccineDose;
  saving: boolean;
  minDate?: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onMark: (date: string) => void;
  onUndo: () => void;
}) {
  const isDone = dose.status === 'done';
  const rowRef = useRef<HTMLDivElement>(null);
  const prevStatus = useRef(dose.status);

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
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-stone-800">
            {dose.vaccineName} <span className="font-normal text-stone-500">· {dose.doseLabel}</span>
          </h3>
          {dose.protectsAgainst && (
            <p className="mt-0.5 text-sm text-stone-500">Protects against {dose.protectsAgainst}</p>
          )}
        </div>
        <DoseStatusPill status={dose.status} />
      </div>

      <p className="mt-2 text-sm text-stone-500">
        {isDone && dose.administeredOn
          ? `Given ${formatDateIST(dose.administeredOn)}`
          : `Due ${formatDateIST(dose.dueDate)}`}
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
            {saving ? 'Saving…' : 'Undo'}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-stone-500" htmlFor={`date-${dose.id}`}>
              Given on
            </label>
            <DatePicker
              id={`date-${dose.id}`}
              value={draft}
              min={minDate}
              max={todayInputValueIST()}
              onChange={onDraftChange}
              className="w-44 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button onClick={() => onMark(draft)} disabled={saving} className={buttonClass('primary', 'sm')}>
              <Check className="h-4 w-4" />
              {saving ? 'Saving…' : 'Mark as given'}
            </button>
          </div>
        )}
      </div>
    </Card>
    </div>
  );
}

function VaccinesSkeleton() {
  return (
    <div className="mt-5 space-y-6">
      <Card className="p-5">
        <Skeleton className="h-16 w-full" />
      </Card>
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
  );
}
