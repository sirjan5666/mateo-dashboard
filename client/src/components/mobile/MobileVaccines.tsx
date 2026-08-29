import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Circle, Clock, Plus, RefreshCw, ShieldCheck, Syringe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { addCustomVaccine, listVaccines, setVaccineAdministered } from '../../api/vaccines';
import type { DoseStatus, VaccineDose, VaccineSummary } from '../../api/vaccines';
import { dayDiffIST, formatDateIST, todayInputValueIST } from '../../lib/age';
import { avatarUrl } from '../../lib/avatars';
import { useBabies } from '../../lib/useBabies';
import { Avatar } from '../ui/Avatar';
import { BottomSheet } from '../ui/BottomSheet';
import { ErrorState } from '../ui/ErrorState';
import { cn } from '../../lib/cn';

const VAC = { fg: 'var(--cat-vaccine)', bg: 'var(--cat-vaccine-bg)', text: 'var(--cat-vaccine-text)' };

const STATUS: Record<DoseStatus, { label: string; bg: string; fg: string; Icon: LucideIcon }> = {
  done: { label: 'On time', bg: 'var(--status-ontrack-bg)', fg: 'var(--status-ontrack-text)', Icon: CheckCircle2 },
  due: { label: 'Due soon', bg: 'var(--status-duesoon-bg)', fg: 'var(--status-duesoon-text)', Icon: Clock },
  overdue: { label: 'Overdue', bg: 'var(--status-overdue-bg)', fg: 'var(--status-overdue-text)', Icon: AlertCircle },
  upcoming: { label: 'Upcoming', bg: 'var(--status-info-bg)', fg: 'var(--status-info-text)', Icon: Circle },
};

function relDue(iso: string): string {
  const d = dayDiffIST(iso);
  if (d === 0) return 'today';
  if (d > 0) return `in ${d} day${d === 1 ? '' : 's'}`;
  const a = Math.abs(d);
  return `${a} day${a === 1 ? '' : 's'} ago`;
}

function StatPill({ icon: Icon, tone, value, label }: { icon: LucideIcon; tone: DoseStatus | 'total'; value: number; label: string }) {
  const c = tone === 'total' ? { bg: 'var(--status-info-bg)', fg: 'var(--status-info-text)' } : STATUS[tone];
  return (
    <div className="flex flex-1 flex-col items-center rounded-2xl px-1 py-2.5" style={{ backgroundColor: c.bg }}>
      <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: c.fg }}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="mt-1 font-display text-xl font-bold leading-none" style={{ color: c.fg }}>
        {value}
      </span>
    </div>
  );
}

/**
 * Mobile Vaccines tracker (design spec) — wired to the real IAP schedule (dose
 * status, given/due dates, age labels) and summary counts. Tap a dose to view
 * and mark it given; "Add Vaccine / Record" logs a custom vaccine. Desktop keeps
 * its existing Vaccines page.
 */
export function MobileVaccines() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { activeBaby, babies, selectBaby } = useBabies();
  const baby = activeBaby ?? babies.find((b) => b.id === id) ?? null;

  const [doses, setDoses] = useState<VaccineDose[]>([]);
  const [summary, setSummary] = useState<VaccineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useState<'age' | 'date'>('age');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [selected, setSelected] = useState<VaccineDose | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    return listVaccines(id)
      .then((d) => {
        setDoses(d.doses);
        setSummary(d.summary);
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

  const sorted = useMemo(() => [...doses].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)), [doses]);
  const nextDue = sorted.find((d) => d.status !== 'done') ?? null;

  const groups = useMemo(() => {
    const out: { label: string; doses: VaccineDose[] }[] = [];
    const map = new Map<string, { label: string; doses: VaccineDose[] }>();
    for (const d of sorted) {
      let g = map.get(d.ageLabel);
      if (!g) {
        g = { label: d.ageLabel, doses: [] };
        map.set(d.ageLabel, g);
        out.push(g);
      }
      g.doses.push(d);
    }
    return out;
  }, [sorted]);

  return (
    <div className="-mt-8 flex flex-col gap-4">
      {/* Header */}
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
      <div className="relative overflow-hidden rounded-[26px] p-5 shadow-soft ring-1 ring-stone-200/60" style={{ backgroundColor: VAC.bg }}>
        <div className="max-w-[68%]">
          <h1 className="font-display text-2xl font-bold" style={{ color: VAC.text }}>
            Vaccines
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Stay on time, stay protected.</p>
        </div>
        <img src="/lion-vaccines.png" alt="" className="pointer-events-none absolute -bottom-1 right-0 h-28 w-28 object-contain" draggable={false} />
      </div>

      {error ? (
        <ErrorState onRetry={load} />
      ) : loading && !summary ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-[26px] bg-stone-200/70" />
          <div className="h-48 animate-pulse rounded-[26px] bg-stone-200/70" />
        </div>
      ) : (
        <>
          {/* Next due */}
          {nextDue && (
            <button type="button" onClick={() => setSelected(nextDue)} className="flex items-center gap-3 rounded-[26px] bg-[var(--surface-card)] p-4 text-left shadow-soft ring-1 ring-stone-200/60">
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-wide" style={{ color: VAC.text }}>
                  Next due
                </span>
                <span className="block truncate font-display text-lg font-bold text-[var(--foreground)]">
                  {nextDue.vaccineName} · {nextDue.doseLabel}
                </span>
                <span className="block text-sm text-[var(--muted-foreground)]">
                  Due on {formatDateIST(nextDue.dueDate)} ({relDue(nextDue.dueDate)})
                </span>
              </span>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ backgroundColor: VAC.bg, color: VAC.fg }}>
                <Syringe className="h-6 w-6" />
              </span>
            </button>
          )}

          {/* Status pills */}
          {summary && (
            <div className="flex gap-2">
              <StatPill icon={CheckCircle2} tone="done" value={summary.done} label="On track" />
              <StatPill icon={Clock} tone="due" value={summary.due} label="Due soon" />
              <StatPill icon={AlertCircle} tone="overdue" value={summary.overdue} label="Overdue" />
              <StatPill icon={ShieldCheck} tone="total" value={summary.total} label="Total" />
            </div>
          )}

          {/* Schedule */}
          <section className="rounded-[26px] bg-[var(--surface-card)] p-4 shadow-soft ring-1 ring-stone-200/60">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-[var(--foreground)]">Vaccine schedule</h2>
              <div className="flex rounded-full bg-[var(--surface-sunken)] p-1 text-sm font-semibold">
                {(['age', 'date'] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setView(v)} className={cn('rounded-full px-3 py-1 capitalize transition-colors', view === v ? 'bg-[var(--brand-purple-deep)] text-white' : 'text-[var(--muted-foreground)]')}>
                    {v === 'age' ? 'Age' : 'Date'}
                  </button>
                ))}
              </div>
            </div>

            {view === 'age' ? (
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.label}>
                    <p className="mb-1.5 text-xs font-bold text-[var(--muted-foreground)]">{g.label}</p>
                    <div className="space-y-2">
                      {g.doses.map((d) => (
                        <DoseRow key={d.id} dose={d} onTap={() => setSelected(d)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {sorted.map((d) => (
                  <DoseRow key={d.id} dose={d} onTap={() => setSelected(d)} />
                ))}
              </div>
            )}
          </section>

          {/* Add */}
          <button type="button" onClick={() => setAddOpen(true)} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-purple-deep)] font-display text-base font-bold text-white shadow-card">
            <Plus className="h-5 w-5" /> Add vaccine / record
          </button>
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

      <DoseSheet dose={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); void load(); }} />
      <AddVaccineSheet open={addOpen} onClose={() => setAddOpen(false)} babyId={id} onSaved={() => { setAddOpen(false); void load(); }} />
    </div>
  );
}

function DoseRow({ dose, onTap }: { dose: VaccineDose; onTap: () => void }) {
  const s = STATUS[dose.status];
  return (
    <button type="button" onClick={onTap} className="flex w-full items-center gap-3 rounded-2xl bg-[var(--surface-card)] p-3 text-left ring-1 ring-stone-200/60">
      <s.Icon className="h-5 w-5 shrink-0" style={{ color: s.fg }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] font-semibold text-[var(--foreground)]">{dose.vaccineName}{dose.doseLabel ? ` · ${dose.doseLabel}` : ''}</span>
        <span className="block truncate text-xs text-[var(--muted-foreground)]">
          {dose.administeredOn ? `Given on ${formatDateIST(dose.administeredOn)}` : `Due on ${formatDateIST(dose.dueDate)}`}
        </span>
      </span>
      <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: s.bg, color: s.fg }}>
        {s.label}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
    </button>
  );
}

function DoseSheet({ dose, onClose, onChanged }: { dose: VaccineDose | null; onClose: () => void; onChanged: () => void }) {
  const [date, setDate] = useState(todayInputValueIST());
  const [brand, setBrand] = useState('');
  const [busy, setBusy] = useState(false);

  const field = 'w-full rounded-xl border border-stone-300 bg-[var(--input-background)] px-3 py-2.5 text-[var(--foreground)] focus:border-emerald-500 focus:outline-none';

  async function mark(administeredOn: string | null) {
    if (!dose || busy) return;
    setBusy(true);
    try {
      await setVaccineAdministered(dose.id, administeredOn, brand.trim() || undefined);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={dose != null} onClose={onClose} title={dose ? dose.vaccineName : ''} description={dose?.doseLabel || undefined}>
      {dose && (
        <div className="space-y-4">
          {dose.protectsAgainst && (
            <p className="rounded-2xl bg-[var(--surface-sunken)] px-3.5 py-2.5 text-sm text-[var(--muted-foreground)]">
              <span className="font-semibold text-[var(--foreground)]">Protects against:</span> {dose.protectsAgainst}
            </p>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Recommended age</span>
            <span className="font-semibold text-[var(--foreground)]">{dose.ageLabel}</span>
          </div>
          {dose.administeredOn ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">Given on</span>
                <span className="font-semibold text-[var(--foreground)]">{formatDateIST(dose.administeredOn)}</span>
              </div>
              <button type="button" onClick={() => void mark(null)} disabled={busy} className="min-h-[48px] w-full rounded-2xl border border-stone-300 font-semibold text-[var(--muted-foreground)] disabled:opacity-50">
                {busy ? '…' : 'Mark as not given'}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Date given</label>
                <input type="date" value={date} max={todayInputValueIST()} onChange={(e) => setDate(e.target.value)} className={field} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Brand <span className="font-normal text-[var(--muted-foreground)]">(optional)</span></label>
                <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Rotasiil" className={field} />
              </div>
              <button type="button" onClick={() => void mark(date)} disabled={busy} className="min-h-[48px] w-full rounded-2xl font-display text-base font-bold text-white shadow-card disabled:opacity-50" style={{ backgroundColor: VAC.fg }}>
                {busy ? 'Saving…' : 'Mark as given'}
              </button>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function AddVaccineSheet({ open, onClose, babyId, onSaved }: { open: boolean; onClose: () => void; babyId: string; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [doseLabel, setDoseLabel] = useState('');
  const [date, setDate] = useState(todayInputValueIST());
  const [brand, setBrand] = useState('');
  const [busy, setBusy] = useState(false);

  const field = 'w-full rounded-xl border border-stone-300 bg-[var(--input-background)] px-3 py-2.5 text-[var(--foreground)] focus:border-emerald-500 focus:outline-none';

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await addCustomVaccine(babyId, { vaccineName: name.trim(), doseLabel: doseLabel.trim() || undefined, administeredOn: date, brand: brand.trim() || undefined });
      setName('');
      setDoseLabel('');
      setBrand('');
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Add vaccine / record" description="Record a vaccine given outside the schedule">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Vaccine name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Typhoid" className={field} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Dose <span className="font-normal text-[var(--muted-foreground)]">(optional)</span></label>
          <input value={doseLabel} onChange={(e) => setDoseLabel(e.target.value)} placeholder="e.g. Dose 1" className={field} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Date given</label>
          <input type="date" value={date} max={todayInputValueIST()} onChange={(e) => setDate(e.target.value)} className={field} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-[var(--foreground)]">Brand <span className="font-normal text-[var(--muted-foreground)]">(optional)</span></label>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Typbar" className={field} />
        </div>
        <button type="button" onClick={() => void save()} disabled={!name.trim() || busy} className="min-h-[48px] w-full rounded-2xl font-display text-base font-bold text-white shadow-card disabled:opacity-50" style={{ backgroundColor: VAC.fg }}>
          {busy ? 'Saving…' : 'Save record'}
        </button>
      </div>
    </BottomSheet>
  );
}
