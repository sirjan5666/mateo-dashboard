import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertCircle, Bell, Check, CheckCircle2, ChevronDown, ChevronRight, Clock, Info, Plus, Send, ShieldCheck, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Overview, OverviewBaby } from '../../api/overview';
import type { Growth } from '../../api/growth';
import { getWalletBalance } from '../../api/wallet';
import { formatAgeCompact, formatDateIST, greetingIST } from '../../lib/age';
import { avatarUrl } from '../../lib/avatars';
import { askAssistantLink } from '../../lib/assistant';
import { formatStars } from '../../lib/sitare';
import { Avatar } from '../ui/Avatar';
import { BottomSheet } from '../ui/BottomSheet';
import { AssistantMark } from '../assistant/AssistantMark';
import { SitareCoin } from '../sitare/SitareBits';
import { BabyJourneyCard } from '../journey/BabyJourneyCard';
import { cn } from '../../lib/cn';

const STATUS = {
  ontrack: { bg: 'var(--status-ontrack-bg)', fg: 'var(--status-ontrack-text)' },
  duesoon: { bg: 'var(--status-duesoon-bg)', fg: 'var(--status-duesoon-text)' },
  overdue: { bg: 'var(--status-overdue-bg)', fg: 'var(--status-overdue-text)' },
  info: { bg: 'var(--status-info-bg)', fg: 'var(--status-info-text)' },
};

function GlanceChip({ tone, icon: Icon, label, value, sub }: { tone: keyof typeof STATUS; icon: LucideIcon; label: string; value: number; sub: string }) {
  const c = STATUS[tone];
  return (
    <div className="flex flex-col rounded-2xl px-2 py-2.5" style={{ backgroundColor: c.bg }}>
      <Icon className="h-4 w-4" style={{ color: c.fg }} />
      <span className="mt-1.5 font-display text-xl font-bold leading-none" style={{ color: c.fg }}>
        {value}
      </span>
      <span className="mt-1 text-[10px] font-semibold leading-tight" style={{ color: c.fg }}>
        {label}
      </span>
      <span className="text-[9px] leading-tight text-[var(--muted-foreground)]">{sub}</span>
    </div>
  );
}

function RecoRow({ icon: Icon, tint, tintFg, eyebrow, eyebrowColor, title, sub, cta, to }: { icon: LucideIcon; tint: string; tintFg: string; eyebrow: string; eyebrowColor: string; title: string; sub: string; cta: string; to: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: tint, color: tintFg }}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wide" style={{ color: eyebrowColor }}>
          {eyebrow}
        </span>
        <span className="block truncate font-display text-[15px] font-semibold text-[var(--foreground)]">{title}</span>
        <span className="block truncate text-xs text-[var(--muted-foreground)]">{sub}</span>
      </span>
      <Link to={to} className="shrink-0 rounded-full bg-[var(--brand-purple-deep)] px-4 py-2 text-xs font-bold text-white">
        {cta}
      </Link>
    </div>
  );
}

/**
 * Mobile Home — the curated, thumb-first dashboard (design spec: notification
 * header, rich baby switcher, Today-at-a-glance, First-2000-Days journey,
 * Recommended-for-you, Ask Dai Maa). All from existing data; no invented
 * metrics. Rendered by Dashboard below lg; desktop keeps its bento.
 */
export function MobileHome({
  data,
  baby,
  growth,
  subscribed,
  firstName,
  onSelectBaby,
}: {
  data: Overview;
  baby: OverviewBaby;
  growth: Growth | null;
  subscribed: boolean;
  firstName: string;
  onSelectBaby: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sitare, setSitare] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getWalletBalance()
      .then((d) => alive && setSitare(d.balance))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const v = baby.vaccines;
  const weightLog = [...(growth?.logs ?? [])].reverse().find((l) => l.weightG != null);
  const weightKg = weightLog ? Number((weightLog.weightG! / 1000).toFixed(1)) : null;
  const others = data.babies.filter((b) => b.id !== baby.id);
  const overdue = v.overdue;

  const nd = baby.nextDue;
  const ndStatus = nd?.status === 'overdue' ? 'overdue' : nd?.status === 'due' ? 'due soon' : 'upcoming';
  const ndColor = nd?.status === 'overdue' ? STATUS.overdue.fg : nd?.status === 'due' ? STATUS.duesoon.fg : STATUS.info.fg;

  const ask = () => {
    navigate(q.trim() ? askAssistantLink(baby.id, q) : `/babies/${baby.id}/chat`);
  };

  return (
    <div className="-mt-8 flex flex-col gap-4">
      {/* Header: wordmark + notifications */}
      <header className="flex items-center justify-between" style={{ paddingTop: 'calc(0.5rem + var(--safe-top))' }}>
        <img src="/mateo-logo.png" alt="MateoCare" className="h-8 object-contain" draggable={false} />
        <button
          type="button"
          onClick={() => navigate(`/babies/${baby.id}/vaccines`)}
          aria-label={overdue > 0 ? `${overdue} items need attention` : 'Notifications'}
          className="relative grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-card)] shadow-soft ring-1 ring-stone-200/60"
        >
          <Bell className="h-5 w-5 text-[var(--foreground)]" />
          {overdue > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {overdue > 9 ? '9+' : overdue}
            </span>
          )}
        </button>
      </header>

      {/* Baby switcher row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSwitcherOpen(true)}
          className="flex min-h-[52px] flex-1 items-center gap-2.5 rounded-full bg-[var(--surface-card)] py-1.5 pl-1.5 pr-3 shadow-soft ring-1 ring-stone-200/60"
        >
          <Avatar name={baby.name} src={avatarUrl(baby.avatar)} size="md" />
          <span className="min-w-0 text-left">
            <span className="block truncate font-display text-[15px] font-semibold leading-tight text-[var(--foreground)]">{baby.name}</span>
            <span className="block truncate text-xs text-[var(--muted-foreground)]">
              {formatAgeCompact(baby.dob)}
              {weightKg != null && ` · ${weightKg} kg`}
            </span>
          </span>
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
        </button>
        {others.slice(0, 2).map((b) => (
          <button key={b.id} type="button" onClick={() => onSelectBaby(b.id)} aria-label={`Switch to ${b.name}`} className="shrink-0 rounded-full ring-2 ring-[var(--surface-app)]">
            <Avatar name={b.name} src={avatarUrl(b.avatar)} size="md" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => navigate('/babies/new')}
          aria-label="Add baby"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--brand-purple-tint)] text-[var(--brand-purple-deep)] shadow-soft"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {!subscribed && (
        <Link to="/subscribe" className="block rounded-[26px] px-5 py-4 text-white shadow-card" style={{ background: 'linear-gradient(120deg,#7c5cfc,#9c6cf9 45%,#ff7ac0)' }}>
          <p className="font-display text-base font-bold">Unlock every tracker & Dai Maa</p>
          <p className="mt-0.5 text-sm text-white/85">See plans →</p>
        </Link>
      )}

      {/* Greeting hero */}
      <div className="relative overflow-hidden rounded-[26px] bg-[var(--surface-card)] p-5 shadow-soft ring-1 ring-stone-200/60">
        <div className="max-w-[72%]">
          <h1 className="font-display text-xl font-bold leading-tight text-[var(--foreground)]">
            {greetingIST()}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Here’s how {baby.name} is doing today.</p>
        </div>
        <img src="/giraffe-growth.png" alt="" className="pointer-events-none absolute -bottom-2 right-0 h-24 w-24 object-contain" draggable={false} />
      </div>

      {/* Today at a glance */}
      <section className="rounded-[26px] bg-[var(--surface-card)] p-4 shadow-soft ring-1 ring-stone-200/60">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[var(--foreground)]">Today at a glance</h2>
          <Link to={`/babies/${baby.id}/vaccines`} className="text-sm font-semibold text-[var(--brand-purple-deep)]">
            See all
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <GlanceChip tone="ontrack" icon={CheckCircle2} label="On track" value={v.done} sub="Done" />
          <GlanceChip tone="duesoon" icon={Clock} label="Due soon" value={v.due} sub="This week" />
          <GlanceChip tone="overdue" icon={AlertCircle} label="Overdue" value={v.overdue} sub="Action" />
          <GlanceChip tone="info" icon={Info} label="Upcoming" value={v.upcoming} sub="Later" />
        </div>
      </section>

      {/* First 2000 Days journey (existing card) */}
      <BabyJourneyCard baby={baby} />

      {/* Recommended for you */}
      <section className="rounded-[26px] bg-[var(--surface-card)] px-4 py-2 shadow-soft ring-1 ring-stone-200/60">
        <div className="border-b border-stone-100 pb-2 pt-2">
          <h2 className="font-display text-base font-semibold text-[var(--foreground)]">Recommended for you</h2>
          <p className="text-xs text-[var(--muted-foreground)]">Based on {baby.name}’s age &amp; last updates</p>
        </div>
        <div className="divide-y divide-stone-100">
          {nd && (
            <RecoRow
              icon={AlertCircle}
              tint={STATUS.overdue.bg}
              tintFg={STATUS.overdue.fg}
              eyebrow={`Vaccine ${ndStatus}`}
              eyebrowColor={ndColor}
              title={`${nd.vaccineName} · ${nd.doseLabel}`}
              sub={`Due on ${formatDateIST(nd.dueDate)}`}
              cta="View"
              to={`/babies/${baby.id}/vaccines`}
            />
          )}
          <RecoRow
            icon={TrendingUp}
            tint={STATUS.ontrack.bg}
            tintFg={STATUS.ontrack.fg}
            eyebrow="Growth check-in"
            eyebrowColor={STATUS.ontrack.fg}
            title="Log weight"
            sub={weightLog ? `Last logged ${formatDateIST(weightLog.loggedAt)}` : 'No entries yet'}
            cta="Log now"
            to={`/babies/${baby.id}/growth`}
          />
        </div>
      </section>

      {/* Ask Dai Maa */}
      <section className="rounded-[26px] p-5 shadow-soft ring-1 ring-stone-200/60" style={{ background: 'linear-gradient(135deg,#f1e8ff,#faf1ff)' }}>
        <div className="flex items-center gap-3">
          <AssistantMark size={44} variant="tile" circle />
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--foreground)]">Ask Dai Maa anything</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Get trusted guidance, anytime.</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-soft">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ask();
            }}
            placeholder="Type your question…"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[var(--foreground)] placeholder:text-stone-400 focus:outline-none"
          />
          <button type="button" onClick={ask} aria-label="Ask Dai Maa" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-purple-deep)] text-white">
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs leading-snug text-[var(--muted-foreground)]">AI guidance, not a diagnosis. For medical concerns, talk to a doctor.</p>
      </section>

      {/* Footer: trust + Sitare */}
      <div className="flex items-start gap-3 rounded-[22px] bg-[var(--surface-card)] p-4 shadow-soft ring-1 ring-stone-200/60">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-purple-tint)] text-[var(--brand-purple-deep)]">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <p className="text-xs leading-snug text-[var(--muted-foreground)]">
          <span className="font-bold text-[var(--brand-purple-deep)]">Safe · Supportive · Science-backed.</span> Mateo never diagnoses or prescribes. For urgent or red-flag symptoms, please seek medical care.
        </p>
      </div>

      <Link to="/rewards" className="flex items-center gap-3 rounded-[22px] p-4 shadow-soft ring-1 ring-amber-200/60" style={{ backgroundColor: 'var(--sitare-bg)' }}>
        <SitareCoin size={30} />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-bold text-[var(--sitare-deep)]">Mateo Credits (Sitare)</span>
          <span className="block text-xs text-[var(--sitare-deep)]/80">You have {sitare == null ? '—' : formatStars(sitare)} Sitare</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--sitare-deep)]" />
      </Link>

      {/* Baby switcher sheet */}
      <BottomSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} title="Your babies" description="Switch who you're tracking">
        <ul className="space-y-2">
          {data.babies.map((b) => {
            const active = b.id === baby.id;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!active) onSelectBaby(b.id);
                    setSwitcherOpen(false);
                  }}
                  className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left', active ? 'bg-[var(--brand-purple-tint)]' : 'hover:bg-[var(--surface-sunken)]')}
                >
                  <Avatar name={b.name} src={avatarUrl(b.avatar)} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[15px] font-semibold text-[var(--foreground)]">{b.name}</span>
                    <span className="block truncate text-xs text-[var(--muted-foreground)]">{formatAgeCompact(b.dob)}</span>
                  </span>
                  {active && <Check className="h-5 w-5 shrink-0 text-[var(--brand-purple-deep)]" />}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => {
            setSwitcherOpen(false);
            navigate('/babies/new');
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-dashed border-stone-300 px-3 py-3 text-left font-semibold text-[var(--brand-purple-deep)] hover:bg-[var(--surface-sunken)]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--brand-purple-tint)]">
            <Plus className="h-5 w-5" />
          </span>
          Add another baby
        </button>
      </BottomSheet>
    </div>
  );
}
