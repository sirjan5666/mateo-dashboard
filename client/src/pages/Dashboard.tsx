import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { CSSProperties, ReactNode } from 'react';
import {
  Activity,
  Apple,
  AlertCircle,
  ArrowRight,
  Baby as BabyIcon,
  Calendar,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Droplets,
  Info,
  Moon,
  Pencil,
  Phone,
  Sprout,
  Star,
  Plus,
  Ruler,
  Scale,
  Sparkles,
  Sun,
  Syringe,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/context';
import { useT } from '../i18n/context';
import { useSubscribed } from '../lib/subscription';
import { LockedOverlay } from '../components/subscription/bits';
import { BabyJourneyCard } from '../components/journey/BabyJourneyCard';
import { getOverview } from '../api/overview';
import type { Overview, OverviewBaby, UpcomingItem } from '../api/overview';
import { getGrowth } from '../api/growth';
import type { Growth } from '../api/growth';
import { listSkin } from '../api/skin';
import type { SkinLog } from '../api/skin';
import { listFood } from '../api/food';
import type { FoodLog } from '../api/food';
import { listSleep, formatDuration } from '../api/sleep';
import type { SleepResponse } from '../api/sleep';
import { listMilestones } from '../api/milestones';
import type { MilestonesResponse } from '../api/milestones';
import { listAppointments } from '../api/health';
import type { Appointment } from '../api/health';
import { ApiError } from '../api/client';
import { getWalletBalance } from '../api/wallet';
import { SitareCoin } from '../components/sitare/SitareBits';
import { formatStars, onSitareRefresh } from '../lib/sitare';
import { ageInMonths, correctedAgeLabel, formatAge, formatDateIST, greetingIST, toDateInputValueIST, todayInputValueIST } from '../lib/age';
import { upToDatePct } from '../lib/vaccineStats';
import { avatarUrl } from '../lib/avatars';
import { useEntrance, useHeroParallax, prefersReducedMotion, celebrate } from '../lib/gsap';
import { Skeleton } from '../components/ui/Skeleton';
import { CountUp } from '../components/ui/CountUp';
import { AssistantMark } from '../components/assistant/AssistantMark';
import { useTypewriter } from '../lib/useTypewriter';
import { ASSISTANT_NAME, QUICK_CHIPS, SUGGESTED_QUESTIONS, askAssistantLink } from '../lib/assistant';

type StatusType = 'on-track' | 'due-soon' | 'overdue' | 'info';

const statusConfig: Record<StatusType, { bg: string; color: string; Icon: LucideIcon; label: string }> = {
  'on-track': { bg: 'var(--status-ontrack-bg)', color: 'var(--status-ontrack-text)', Icon: CheckCircle2, label: 'On track' },
  'due-soon': { bg: 'var(--status-duesoon-bg)', color: 'var(--status-duesoon-text)', Icon: Clock, label: 'Due soon' },
  overdue: { bg: 'var(--status-overdue-bg)', color: 'var(--status-overdue-text)', Icon: AlertCircle, label: 'Overdue' },
  info: { bg: 'var(--status-info-bg)', color: 'var(--status-info-text)', Icon: Info, label: 'Reminder' },
};

const NUMERAL: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

// "1st", "2nd", "3rd", "11th", "21st" — for percentile copy.
function ordinal(n: number): string {
  const v = n % 100;
  const s = ['th', 'st', 'nd', 'rd'];
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

const DAY = 86_400_000;
function relativeDays(iso: string): string {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / DAY);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 14) return 'Last week';
  return `${Math.round(d / 7)} weeks ago`;
}

// WHO-style motor milestones by age bucket — informational reference, not tracked.
function milestonesForAge(ageMonths: number): string[] {
  if (ageMonths < 2) return ['Briefly lifts head when on tummy', 'Focuses on faces', 'Startles at loud sounds'];
  if (ageMonths < 4) return ['Holds head steady when upright', 'Pushes up on forearms', 'Smiles back at you', 'Follows things with eyes'];
  if (ageMonths < 6) return ['Holds head steady', 'Pushes up on forearms', 'Coos and babbles back', 'Reaches for toys'];
  if (ageMonths < 9) return ['Rolls over both ways', 'Sits with little support', 'Brings things to mouth', 'Responds to own name'];
  if (ageMonths < 12) return ['Sits without support', 'Crawls or scoots', 'Picks up small objects', 'Babbles "mama/dada"'];
  if (ageMonths < 18) return ['Pulls to stand', 'Stands and cruises', 'Says a few words', 'Waves bye-bye'];
  return ['Walks well', 'Says several words', 'Follows simple instructions', 'Stacks a few blocks'];
}

// ── Shared primitives — one card system across the whole bento ──

function Card({
  children,
  className,
  style,
  accent,
  tier,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  accent?: string; // a single category colour for the left rail
  tier?: 'hero'; // tier-1 cards get a slightly stronger shadow to signal rank
}) {
  return (
    <div
      data-entrance="card"
      className={className}
      style={{
        position: 'relative',
        overflow: accent ? 'hidden' : undefined,
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '26px',
        padding: '1.6rem',
        boxShadow:
          tier === 'hero'
            ? 'var(--shadow-card)'
            : '0 6px 20px -8px rgba(124,92,252,0.18), 0 2px 6px -3px rgba(58,46,99,0.08)',
        ...style,
      }}
    >
      {accent && <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />}
      {children}
    </div>
  );
}

function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="eyebrow" style={{ color: color ?? 'var(--text-muted-color)' }}>
      {children}
    </span>
  );
}

// Embossed category tile — soft gradient + inner highlight, one locked size/radius.
function IconTile({ Icon, bg, color, size = 40 }: { Icon: LucideIcon; bg: string; color: string; size?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: `linear-gradient(135deg, ${bg}, #ffffff)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={Math.round(size * 0.5)} style={{ color }} />
    </div>
  );
}

function StatusChip({ status }: { status: StatusType }) {
  const { bg, color, Icon, label } = statusConfig[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, backgroundColor: bg, color, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

// One header for every card: eyebrow + Fredoka title (left), status + icon-tile (right).
function CardHeader({
  eyebrow,
  eyebrowColor,
  title,
  icon,
  iconBg,
  iconColor,
  status,
}: {
  eyebrow?: string;
  eyebrowColor?: string;
  title: string;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  status?: StatusType;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.15rem' }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div style={{ marginBottom: 4 }}>
            <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
          </div>
        )}
        <h2 style={{ color: 'var(--foreground)', fontSize: '1.0625rem', fontWeight: 600, lineHeight: 1.25 }}>{title}</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {status && <StatusChip status={status} />}
        {icon && iconBg && iconColor && <IconTile Icon={icon} bg={iconBg} color={iconColor} />}
      </div>
    </div>
  );
}

function FooterLink({ to, color, children }: { to: string; color: string; children: ReactNode }) {
  return (
    <Link to={to} style={{ marginTop: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', color, fontSize: '0.825rem', fontWeight: 700 }}>
      {children} <ChevronRight size={14} aria-hidden="true" />
    </Link>
  );
}

// Mateo Sitare rewards balance — FREE feature (not plan-gated). Refreshes when
// an earn/redeem fires elsewhere via the sitare refresh bus.
function PointsCard() {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => getWalletBalance().then((d) => alive && setBalance(d.balance)).catch(() => alive && setBalance((b) => b ?? 0));
    load();
    const off = onSitareRefresh(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return (
    <Card accent="var(--sitare)">
      <CardHeader eyebrow="Rewards" eyebrowColor="var(--sitare-deep)" title="Mateo Credits" icon={Star} iconBg="var(--sitare-bg)" iconColor="var(--sitare-deep)" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SitareCoin size={30} />
        <span style={{ fontSize: '2.15rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.05, ...NUMERAL }}>{balance == null ? '—' : formatStars(balance)}</span>
        <span style={{ marginTop: 8, fontSize: '0.9rem', fontWeight: 700, color: 'var(--muted-foreground)' }}>credits</span>
      </div>
      <p style={{ marginTop: 4, fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>Earn on orders, reviews &amp; tracking — redeem for money off.</p>
      <FooterLink to="/rewards" color="var(--sitare-deep)">View rewards</FooterLink>
    </Card>
  );
}

// "Aaj ka ek kaam" — the single most important thing to do today, so a parent
// sees ONE clear priority, never a pile. Vaccine-driven for now (the most
// time-critical dated tracker); Phase 3's cross-tracker due engine will fold in
// growth / milestone / feeding priorities behind the same card.
function DailyCareCard({ baby }: { baby: OverviewBaby }) {
  const nd = baby.nextDue;
  const overdue = baby.vaccines.overdue > 0 || nd?.status === 'overdue';
  const dueNow = !overdue && (baby.vaccines.due > 0 || nd?.status === 'due');

  let accent: string;
  let iconBg: string;
  let Icon: LucideIcon;
  let eyebrow: string;
  let title: string;
  let body: string;
  let cta: { label: string; to: string } | null = null;

  if (nd && overdue) {
    accent = 'var(--status-overdue-text)';
    iconBg = 'var(--status-overdue-bg)';
    Icon = AlertCircle;
    eyebrow = 'Needs attention today';
    title = `${nd.vaccineName} is overdue`;
    body = `${baby.name}'s ${nd.vaccineName} (${nd.doseLabel}) was due on ${formatDateIST(nd.dueDate)}. Catch-up is easy — book a clinic visit, then tick it off. Late is completely okay.`;
    cta = { label: 'Go to vaccines', to: `/babies/${baby.id}/vaccines` };
  } else if (nd && dueNow) {
    accent = 'var(--status-duesoon-text)';
    iconBg = 'var(--status-duesoon-bg)';
    Icon = CalendarCheck;
    eyebrow = "Today's one thing";
    title = `${nd.vaccineName} is due now`;
    body = `${baby.name}'s ${nd.vaccineName} (${nd.doseLabel}) is due (${formatDateIST(nd.dueDate)}). Plan a clinic time, then mark it done here.`;
    cta = { label: 'Go to vaccines', to: `/babies/${baby.id}/vaccines` };
  } else if (nd) {
    accent = 'var(--brand-purple-deep)';
    iconBg = 'var(--accent)';
    Icon = Calendar;
    eyebrow = "Today's one thing";
    title = 'Nothing urgent today';
    body = `You're on track 💜 Next up is ${nd.vaccineName} on ${formatDateIST(nd.dueDate)} — no rush yet. Enjoy a little moment with ${baby.name}.`;
  } else {
    accent = 'var(--status-ontrack-text)';
    iconBg = 'var(--status-ontrack-bg)';
    Icon = CheckCircle2;
    eyebrow = "Today's one thing";
    title = 'All caught up 🎉';
    body = `${baby.name} is up to date. Enjoy a cuddle today — you're doing wonderfully.`;
  }

  return (
    <Card tier="hero" accent={accent}>
      <CardHeader eyebrow={eyebrow} eyebrowColor={accent} title={title} icon={Icon} iconBg={iconBg} iconColor={accent} />
      <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', lineHeight: 1.6 }}>{body}</p>
      {cta && (
        <FooterLink to={cta.to} color={accent}>
          {cta.label}
        </FooterLink>
      )}
    </Card>
  );
}

function EmptyTile({ icon: Icon, bg, color, text }: { icon: LucideIcon; bg: string; color: string; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: '0.25rem 0', flex: 1 }}>
      <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 15, background: `linear-gradient(135deg, ${bg}, #ffffff)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)', display: 'grid', placeItems: 'center' }}>
        <Icon size={22} style={{ color }} />
      </span>
      <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const subscribed = useSubscribed();
  const [data, setData] = useState<Overview | null>(null);
  const [activeBabyId, setActiveBabyId] = useState<string | null>(null);
  const [growth, setGrowth] = useState<Growth | null>(null);
  const [skin, setSkin] = useState<SkinLog[] | null>(null);
  const [food, setFood] = useState<FoodLog[] | null>(null);
  const [foodUnderSix, setFoodUnderSix] = useState<boolean | null>(null);
  const [sleep, setSleep] = useState<SleepResponse | null>(null);
  const [milestones, setMilestones] = useState<MilestonesResponse | null>(null);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load the overview (all babies) once, then pick the active baby — the last one
  // viewed (remembered in localStorage) if it still exists, else the first.
  useEffect(() => {
    let cancelled = false;
    getOverview()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        const saved = localStorage.getItem('mateo:activeBaby');
        setActiveBabyId(d.babies.find((b) => b.id === saved)?.id ?? d.babies[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the selected baby's snapshots whenever the active baby changes.
  // Unsubscribed parents skip these — the tracker APIs are part of the plan and
  // would 402; the cards render locked instead.
  useEffect(() => {
    if (activeBabyId === null || !subscribed) return;
    let cancelled = false;
    const id = activeBabyId;
    getGrowth(id).then((g) => !cancelled && setGrowth(g)).catch(() => {});
    listSkin(id).then((s) => !cancelled && setSkin(s.logs)).catch(() => {});
    listFood(id)
      .then((f) => {
        if (cancelled) return;
        setFood(f.logs);
        setFoodUnderSix(f.guidance.underSix); // server is the source of truth for the 6-month gate
      })
      .catch(() => {});
    listSleep(id).then((s) => !cancelled && setSleep(s)).catch(() => {});
    listMilestones(id).then((m) => !cancelled && setMilestones(m)).catch(() => {});
    listAppointments(id).then((a) => !cancelled && setAppts(a.appointments)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeBabyId, subscribed]);

  // Orchestrated GSAP entrance — runs once the overview has loaded and the real
  // content (not the skeleton) is mounted. Reduced-motion safe.
  const scope = useEntrance<HTMLDivElement>([data !== null]);

  // Switching babies clears the old snapshots (skeletons) and remembers the choice.
  function selectBaby(id: string) {
    if (id === activeBabyId) return;
    localStorage.setItem('mateo:activeBaby', id);
    setGrowth(null);
    setSkin(null);
    setFood(null);
    setFoodUnderSix(null);
    setSleep(null);
    setMilestones(null);
    setAppts([]);
    setActiveBabyId(id);
  }

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? '';
  const greeting = greetingIST();
  const baby = data?.babies.find((b) => b.id === activeBabyId) ?? data?.babies[0] ?? null;

  if (error) {
    return <Card style={{ background: 'var(--status-overdue-bg)', color: 'var(--status-overdue-text)' }}>{error}</Card>;
  }
  if (data === null) return <DashboardSkeleton />;
  if (!baby) return <EmptyState />;

  return (
    <div ref={scope} className="flex flex-col gap-4">
      {data.babies.length > 1 && <BabySwitcher babies={data.babies} activeId={baby.id} onSelect={selectBaby} />}
      <GreetingHero greeting={greeting} firstName={firstName} baby={baby} appts={appts} />
      {/* The emotional headline under the hero: where this child is on the
          first-2000-days arc. Pure props — works for locked accounts too. */}
      <BabyJourneyCard baby={baby} />
      {!subscribed && <SubscribeBanner />}
      {subscribed && <AskAssistantBar babyId={baby.id} />}

      {/* "Aaj ka ek kaam" — one clear priority for today, above the bento. */}
      {subscribed && (
        <div className="mb-4">
          <DailyCareCard baby={baby} />
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_312px]">
        <div className="flex flex-col gap-4">
          <Lockable locked={!subscribed}>
            <WellbeingCard baby={baby} />
          </Lockable>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Lockable locked={!subscribed}>
              <GrowthSnapshotCard babyId={baby.id} growth={growth} />
            </Lockable>
            <Lockable locked={!subscribed}>
              <SkinSnapshotCard babyId={baby.id} skin={skin} />
            </Lockable>
          </div>
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <Lockable locked={!subscribed}>
              <FoodSnapshotCard babyId={baby.id} baby={baby} food={food} underSix={foodUnderSix ?? ageInMonths(baby.dob) < 6} />
            </Lockable>
            <Lockable locked={!subscribed}>
              <SleepSnapshotCard babyId={baby.id} sleep={sleep} />
            </Lockable>
          </div>
          <Lockable locked={!subscribed}>
            <UpNextCard items={data.upcoming} />
          </Lockable>
          <Lockable locked={!subscribed}>
            <ActivityCard growth={growth} skin={skin} />
          </Lockable>
        </div>

        <div className="flex flex-col gap-4">
          <BabyProfileCard baby={baby} growth={growth} />
          <PointsCard />
          <Lockable locked={!subscribed}>
            <MilestonesCard babyId={baby.id} milestones={milestones} />
          </Lockable>
        </div>
      </div>
    </div>
  );
}

// Frosted lock veil for plan-gated cards. The wrapped card renders its empty/
// skeleton state (unsubscribed clients never receive tracker data), so the veil
// is the honest presentation, not a curtain over real numbers.
function Lockable({ locked, children }: { locked: boolean; children: ReactNode }) {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative rounded-[26px]">
      {children}
      <LockedOverlay />
    </div>
  );
}

// Unsubscribed hero CTA — where the "Paid" journey starts.
function SubscribeBanner() {
  return (
    <Link
      to="/subscribe"
      data-entrance="card"
      className="block rounded-[26px] px-6 py-5 text-white shadow-card transition-transform hover:-translate-y-0.5"
      style={{ background: 'linear-gradient(120deg, #7c5cfc 0%, #9c6cf9 45%, #ff7ac0 100%)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-white/85">
            <Sparkles className="h-3 w-3" />
            The Mateo plan
          </p>
          <p className="mt-1 text-[1.05rem] font-extrabold leading-snug">Unlock every tracker, Dai Maa AI and the health report</p>
          <p className="mt-0.5 text-sm text-white/85">Your doctor stays free — the full toolkit is one small step away.</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-violet-700">
          See plans
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

// Switch which baby the dashboard is showing. Each pill carries the baby's
// initial, name and age, plus a small dot when they have an overdue vaccine.
function BabySwitcher({ babies, activeId, onSelect }: { babies: OverviewBaby[]; activeId: string; onSelect: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Choose a baby" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 8 }}>
      {babies.map((b) => {
        const active = b.id === activeId;
        return (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(b.id)}
            className="pop-hover"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 16px 7px 7px',
              borderRadius: 999,
              border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
              backgroundColor: active ? 'var(--accent)' : 'var(--card)',
              cursor: 'pointer',
            }}
          >
            <span style={{ position: 'relative', flexShrink: 0 }}>
              {avatarUrl(b.avatar) ? (
                <img src={avatarUrl(b.avatar) ?? undefined} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: active ? 'var(--brand-gradient)' : 'var(--secondary)',
                    color: active ? '#fff' : 'var(--muted-foreground)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                  }}
                >
                  {b.name.charAt(0).toUpperCase()}
                </span>
              )}
              {b.vaccines.overdue > 0 && (
                <span aria-hidden="true" style={{ position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: '50%', backgroundColor: 'var(--status-overdue-text)', border: '2px solid var(--card)' }} />
              )}
            </span>
            <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)' }}>{b.name}</span>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>{formatAge(b.dob)}</span>
            </span>
          </button>
        );
      })}
      <Link
        to="/babies/new"
        aria-label="Add a baby"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', borderRadius: 999, border: '1.5px dashed var(--border)', color: 'var(--muted-foreground)', fontSize: '0.85rem', fontWeight: 600 }}
      >
        <Plus size={15} aria-hidden="true" />
        Add
      </Link>
    </div>
  );
}

function GreetingHero({ greeting, firstName, baby, appts }: { greeting: string; firstName: string; baby: OverviewBaby; appts: Appointment[] }) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const heroRef = useHeroParallax<HTMLDivElement>();
  const todayKey = todayInputValueIST();
  const nextAppt = appts.find((a) => !a.completed && toDateInputValueIST(a.scheduledAt) >= todayKey);
  const calm = baby.vaccines.overdue === 0;
  const emoji = greeting.includes('morning') ? '🌞' : greeting.includes('afternoon') ? '☀️' : greeting.includes('evening') ? '🌆' : '🌙';
  const radial = greeting.includes('morning') ? 'rgba(255,201,60,0.20)' : greeting.includes('night') ? 'rgba(108,139,255,0.18)' : 'rgba(124,92,252,0.14)';
  const sub = calm
    ? `${baby.name} is ${formatAge(baby.dob)} and growing beautifully. Here's a gentle look at the day.`
    : `${baby.name} is ${formatAge(baby.dob)}. A couple of things could use a gentle look today.`;
  const tip = milestonesForAge(ageInMonths(baby.dob))[0];
  const pills: { Icon: LucideIcon; text: string; bg: string; color: string }[] = [];
  if (baby.nextDue)
    pills.push(
      baby.nextDue.status === 'overdue'
        ? { Icon: AlertCircle, text: `Vaccine overdue · ${formatDateIST(baby.nextDue.dueDate)}`, bg: 'var(--status-overdue-bg)', color: 'var(--status-overdue-text)' }
        : { Icon: Syringe, text: `Next vaccine · ${formatDateIST(baby.nextDue.dueDate)}`, bg: 'var(--cat-vaccine-bg)', color: 'var(--cat-vaccine-text)' },
    );
  if (nextAppt) pills.push({ Icon: CalendarCheck, text: `Next visit · ${formatDateIST(nextAppt.scheduledAt)}`, bg: 'var(--cat-record-bg)', color: 'var(--cat-record-text)' });
  if (tip) pills.push({ Icon: Sprout, text: `Today · ${tip}`, bg: 'var(--accent)', color: 'var(--accent-foreground)' });
  const actions: { label: string; Icon: LucideIcon; seg: string; color: string; bg: string }[] = [
    { label: 'Mark a dose', Icon: Syringe, seg: 'vaccines', color: 'var(--cat-vaccine)', bg: 'var(--cat-vaccine-bg)' },
    { label: 'Log weight', Icon: Ruler, seg: 'growth', color: 'var(--cat-growth)', bg: 'var(--cat-growth-bg)' },
    { label: 'Log a meal', Icon: Apple, seg: 'food', color: 'var(--cat-food)', bg: 'var(--cat-food-bg)' },
    { label: 'Log sleep', Icon: Moon, seg: 'sleep', color: 'var(--cat-sleep)', bg: 'var(--cat-sleep-bg)' },
    { label: 'Add skin photo', Icon: Camera, seg: 'skin', color: 'var(--cat-skin)', bg: 'var(--cat-skin-bg)' },
    { label: `Ask ${ASSISTANT_NAME}`, Icon: Sparkles, seg: 'chat', color: 'var(--cat-assistant)', bg: 'var(--cat-assistant-bg)' },
  ];
  return (
    <div ref={heroRef} data-entrance="hero" className="relative overflow-hidden" style={{ borderRadius: 28, padding: '1.85rem', background: 'linear-gradient(135deg, #efe7ff 0%, #f8f4ff 45%, #ffe7f3 100%)', border: '1px solid var(--border)' }}>
      <div aria-hidden="true" className="blob" style={{ position: 'absolute', top: -50, right: 120, width: 180, height: 180, borderRadius: '50%', background: '#cbb8ff', opacity: 0.7 }} />
      <div aria-hidden="true" className="blob" style={{ position: 'absolute', bottom: -70, right: -20, width: 210, height: 210, borderRadius: '50%', background: '#ffc7e6', opacity: 0.7, animationDelay: '-6s' }} />
      <img
        src="/bear-mascot.png"
        alt=""
        aria-hidden="true"
        data-parallax
        data-depth="1"
        className={`pointer-events-none absolute bottom-0 right-3 z-[1] hidden select-none md:block lg:right-7${calm ? ' animate-floatslow' : ''}`}
        style={{ width: 'clamp(140px, 16vw, 210px)', height: 'auto', filter: 'drop-shadow(0 10px 18px rgba(124,92,252,0.22))' }}
      />
      <div className="relative z-[2]" style={{ maxWidth: 560 }}>
        <span aria-hidden="true" style={{ position: 'absolute', top: -10, left: -30, width: 200, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${radial}, transparent 70%)`, pointerEvents: 'none' }} />
        <div data-entrance-child className="eyebrow" style={{ color: 'var(--brand-purple-deep)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Calendar size={13} aria-hidden="true" />
          {today}
        </div>
        <h1 data-entrance-child className="relative" style={{ color: 'var(--foreground)', marginBottom: 6, fontSize: '1.95rem' }}>
          {greeting}, {firstName || 'there'} {emoji}
        </h1>
        <p data-entrance-child style={{ color: 'var(--muted-foreground)', fontSize: '1rem', lineHeight: 1.6, maxWidth: 460 }}>{sub}</p>
        <div data-entrance-child style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {pills.map(({ Icon, text, bg, color }) => (
            <span key={text} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, backgroundColor: bg, color, fontSize: '0.8rem', fontWeight: 700, border: `1px solid ${color}` }}>
              <Icon size={13} aria-hidden="true" />
              {text}
            </span>
          ))}
        </div>
        <div data-entrance-child style={{ marginTop: '1.2rem' }}>
          <div style={{ marginBottom: 8 }}>
            <Eyebrow color="var(--brand-purple-deep)">Quick actions</Eyebrow>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {actions.map(({ label, Icon, seg, color, bg }) => (
              <Link
                key={label}
                to={`/babies/${baby.id}/${seg}`}
                className={`pop-hover${seg === 'chat' ? ' wiggle-hover' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 12, border: `1px solid ${color}`, backgroundColor: bg, color: 'var(--foreground)', fontSize: '0.85rem', fontWeight: 700 }}
              >
                <Icon size={16} style={{ color }} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type Verdict = { label: string; bg: string; color: string };

function Ring({ percentage, verdict }: { percentage: number; verdict: Verdict }) {
  const reduce = prefersReducedMotion();
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    if (reduce) return; // honour prefers-reduced-motion — show the final value, no sweep
    const t = setTimeout(() => setAnimated(percentage), 180);
    return () => clearTimeout(t);
  }, [percentage, reduce]);
  const R = 78;
  const C = 2 * Math.PI * R;
  const off = C * (1 - (reduce ? percentage : animated) / 100);
  const full = percentage === 100;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} role="img" aria-label={`${percentage}% up to date`}>
      {full && <span aria-hidden="true" style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'var(--cat-growth)', opacity: 0.18, filter: 'blur(26px)' }} />}
      <svg width="196" height="196" viewBox="0 0 196 196" aria-hidden="true">
        <defs>
          <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c5cfc" />
            <stop offset="100%" stopColor="#b06bff" />
          </linearGradient>
        </defs>
        <circle cx="98" cy="98" r={R} fill="none" stroke="var(--secondary)" strokeWidth="13" />
        <circle cx="98" cy="98" r={R} fill="none" stroke="url(#ringgrad)" strokeWidth="13" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 98 98)" style={{ transition: reduce ? undefined : 'stroke-dashoffset 1.3s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
        <CountUp value={percentage} suffix="%" style={{ fontSize: '2.15rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.05, ...NUMERAL }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 999, backgroundColor: verdict.bg, color: verdict.color, fontSize: '0.72rem', fontWeight: 800 }}>{verdict.label}</span>
      </div>
    </div>
  );
}

// One segmented strip: doses given / due soon / overdue. Zero values render calm
// (muted), so "0 overdue" never shows as a coral alarm.
function StatStrip({ done, due, overdue }: { done: number; due: number; overdue: number }) {
  const segs = [
    { label: 'Doses given', value: done, dot: 'var(--cat-growth)', active: true, color: 'var(--foreground)' },
    { label: 'Due soon', value: due, dot: 'var(--status-duesoon-text)', active: due > 0, color: due > 0 ? 'var(--status-duesoon-text)' : 'var(--foreground)' },
    { label: 'Overdue', value: overdue, dot: 'var(--status-overdue-text)', active: overdue > 0, color: overdue > 0 ? 'var(--status-overdue-text)' : 'var(--foreground)' },
  ];
  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 180, backgroundColor: 'var(--secondary)', borderRadius: 16, overflow: 'hidden' }}>
      {segs.map((s, i) => (
        <div key={s.label} style={{ flex: 1, minWidth: 0, padding: '0.9rem 0.85rem', display: 'flex', flexDirection: 'column', gap: 7, borderLeft: i > 0 ? '1px solid var(--border)' : undefined }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted-foreground)', lineHeight: 1.3 }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: s.active ? s.dot : 'var(--text-muted-color)', opacity: s.active ? 1 : 0.35, flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
          </span>
          <CountUp value={s.value} style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1.05, ...NUMERAL }} />
        </div>
      ))}
    </div>
  );
}

function WellbeingCard({ baby }: { baby: OverviewBaby }) {
  const v = baby.vaccines;
  const pct = upToDatePct(v);
  const ringRef = useRef<HTMLDivElement>(null);
  const verdict: Verdict =
    v.overdue > 0
      ? { label: 'Action needed', bg: 'var(--status-overdue-bg)', color: 'var(--status-overdue-text)' }
      : v.due > 0
        ? { label: 'Due soon', bg: 'var(--status-duesoon-bg)', color: 'var(--status-duesoon-text)' }
        : { label: 'On track', bg: 'var(--status-ontrack-bg)', color: 'var(--status-ontrack-text)' };

  // A genuine win: fully caught up. Celebrate once per session per baby, never
  // when something is overdue. celebrate() is reduced-motion safe + self-cleaning.
  useEffect(() => {
    // A real win = at least one dose given AND nothing due/overdue. Without the
    // done>0 guard, upToDatePct returns 100 for a brand-new baby (no closed
    // windows yet) and we'd "celebrate" a parent who has given zero doses.
    if (v.done === 0 || pct !== 100 || v.overdue > 0) return;
    const key = `mateo:celebrated:${baby.id}:vax100`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const t = setTimeout(() => celebrate(ringRef.current, { colors: ['#25c281', '#7c5cfc', '#ffc93c'] }), 650);
    return () => clearTimeout(t);
  }, [pct, v.done, v.overdue, baby.id]);

  return (
    <Card tier="hero" style={{ minHeight: 232 }}>
      <CardHeader eyebrow="Vaccinations" eyebrowColor="var(--cat-vaccine-text)" title="Wellbeing overview" status={v.overdue > 0 ? 'overdue' : v.due > 0 ? 'due-soon' : 'on-track'} />
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div ref={ringRef}>
          <Ring percentage={pct} verdict={verdict} />
        </div>
        <StatStrip done={v.done} due={v.due} overdue={v.overdue} />
      </div>
    </Card>
  );
}

// Hand-rolled weight sparkline: gradient area + a latest-value guide + a draw-on
// line + a calm marker on the most recent real measurement.
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const reduce = prefersReducedMotion();
  const [drawn, setDrawn] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setDrawn(true), 260);
    return () => clearTimeout(t);
  }, [reduce]);
  if (values.length < 2) return <div style={{ height: 108 }} />;
  const w = 280;
  const h = 108;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 10 - ((v - min) / span) * (h - 26);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `0,${h} ${line} ${w},${h}`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spark)" style={{ opacity: drawn ? 1 : 0, transition: reduce ? undefined : 'opacity 0.6s ease 0.3s' }} />
      <line x1="0" y1={ly} x2={w} y2={ly} stroke={color} strokeOpacity="0.18" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={drawn ? 0 : 1}
        style={{ transition: reduce ? undefined : 'stroke-dashoffset 0.85s ease' }}
      />
      <circle cx={lx} cy={ly} r="6" fill={color} fillOpacity="0.18" style={{ opacity: drawn ? 1 : 0, transition: reduce ? undefined : 'opacity 0.3s ease 0.85s' }} />
      <circle cx={lx} cy={ly} r="3.4" fill={color} style={{ opacity: drawn ? 1 : 0, transition: reduce ? undefined : 'opacity 0.3s ease 0.85s' }} />
    </svg>
  );
}

function GrowthSnapshotCard({ babyId, growth }: { babyId: string; growth: Growth | null }) {
  const weights = (growth?.logs ?? []).filter((l) => l.metrics.weight);
  const latest = weights[weights.length - 1];
  const prev = weights[weights.length - 2];
  const kg = latest ? latest.metrics.weight!.value : null;
  const pct = latest ? Math.round(latest.metrics.weight!.percentile) : null;
  const delta = latest && prev ? Math.round((latest.metrics.weight!.value - prev.metrics.weight!.value) * 10) / 10 : null;
  return (
    <Card accent="var(--cat-growth)" style={{ display: 'flex', flexDirection: 'column', minHeight: 248 }}>
      <CardHeader eyebrow="Weight-for-age" eyebrowColor="var(--cat-growth-text)" title="Growth" icon={TrendingUp} iconBg="var(--cat-growth-bg)" iconColor="var(--cat-growth)" />
      {kg != null ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2, flexWrap: 'wrap' }}>
            <CountUp value={kg} decimals={(String(kg).split('.')[1] ?? '').length} suffix=" kg" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1, ...NUMERAL }} />
            {delta != null && delta > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 9px', borderRadius: 999, backgroundColor: 'var(--status-ontrack-bg)', color: 'var(--status-ontrack-text)', fontSize: '0.74rem', fontWeight: 800 }}>▲ {delta} kg</span>
            )}
          </div>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', marginBottom: '0.85rem' }}>
            {pct != null ? `Tracking around the ${ordinal(Math.max(1, pct))} percentile` : 'Tracking steadily'}
          </p>
          <div style={{ flex: 1, minHeight: 108, display: 'flex', alignItems: 'flex-end' }}>
            <Sparkline values={weights.map((l) => l.metrics.weight!.value)} color="var(--cat-growth)" />
          </div>
        </>
      ) : (
        <EmptyTile icon={TrendingUp} bg="var(--cat-growth-bg)" color="var(--cat-growth)" text="No measurements yet — log the first one to see the curve." />
      )}
      <FooterLink to={`/babies/${babyId}/growth`} color="var(--cat-growth-text)">View growth charts</FooterLink>
    </Card>
  );
}

const SKIN_TONE: Record<string, StatusType> = { mild: 'on-track', moderate: 'due-soon', concerning: 'overdue' };

function SkinSnapshotCard({ babyId, skin }: { babyId: string; skin: SkinLog[] | null }) {
  const latest = skin?.[0] ?? null;
  const concerning = latest?.severity === 'concerning';
  return (
    <Card accent="var(--cat-skin)" style={{ display: 'flex', flexDirection: 'column', minHeight: 248 }}>
      <CardHeader eyebrow="Skin" eyebrowColor="var(--cat-skin-text)" title="Skin health" icon={Droplets} iconBg="var(--cat-skin-bg)" iconColor="var(--cat-skin)" />
      {latest ? (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: concerning ? 'var(--status-overdue-bg)' : 'var(--secondary)', marginBottom: '0.85rem' }}>
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Sun size={18} style={{ color: concerning ? 'var(--status-overdue-text)' : 'var(--cat-skin-text)' }} />
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: concerning ? 'var(--status-overdue-text)' : 'var(--foreground)', fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.3, textTransform: 'capitalize' }}>{latest.area}</p>
              <p style={{ color: 'var(--muted-foreground)', fontSize: '0.775rem', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{latest.description}</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {skin!.slice(0, 3).map((s) => {
              const cfg = statusConfig[SKIN_TONE[s.severity]];
              return (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                    <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0 }} />
                    {s.area}
                  </span>
                  <span style={{ color: cfg.color, fontSize: '0.8rem', fontWeight: 600 }}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1 }} />
        </>
      ) : (
        <EmptyTile icon={Droplets} bg="var(--cat-skin-bg)" color="var(--cat-skin)" text="No observations yet — add a note or photo to start the timeline." />
      )}
      <FooterLink to={`/babies/${babyId}/skin`} color="var(--cat-skin-text)">Open skin timeline</FooterLink>
    </Card>
  );
}

function FoodSnapshotCard({ babyId, baby, food, underSix }: { babyId: string; baby: OverviewBaby; food: FoodLog[] | null; underSix: boolean }) {
  const today = todayInputValueIST();
  const mealsToday = (food ?? []).filter((f) => toDateInputValueIST(f.loggedAt) === today).length;
  const recent = (food ?? []).slice(0, 4);
  return (
    <Card accent="var(--cat-food)" style={{ display: 'flex', flexDirection: 'column', minHeight: 248 }}>
      <CardHeader eyebrow="Feeding" eyebrowColor="var(--cat-food-text)" title="Food" icon={Apple} iconBg="var(--cat-food-bg)" iconColor="var(--cat-food)" />
      {underSix ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', lineHeight: 1.55, flex: 1 }}>
          Under 6 months — <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>exclusive breastfeeding</span> is recommended. Solids
          usually start around 6 months; the feeding log will guide you when {baby.name} is ready.
        </p>
      ) : food !== null && food.length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', flex: 1 }}>No meals logged yet — log {baby.name}&apos;s first taste to begin the feeding journey.</p>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <CountUp value={mealsToday} style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1, ...NUMERAL }} />
            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.78rem' }}>meal{mealsToday === 1 ? '' : 's'} logged today</span>
          </div>
          {recent.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recent.map((f) => (
                <span
                  key={f.id}
                  className={f.isNewFood ? 'animate-popin' : undefined}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 999,
                    backgroundColor: f.isNewFood ? 'var(--cat-food-bg)' : 'var(--secondary)',
                    color: f.isNewFood ? 'var(--cat-food-text)' : 'var(--muted-foreground)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: f.isNewFood ? '1px solid var(--cat-food)' : '1px solid transparent',
                  }}
                >
                  {f.isNewFood && <Sparkles size={11} aria-hidden="true" />}
                  {f.foodName}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <FooterLink to={`/babies/${babyId}/food`} color="var(--cat-food-text)">Open food log</FooterLink>
    </Card>
  );
}

function SleepSnapshotCard({ babyId, sleep }: { babyId: string; sleep: SleepResponse | null }) {
  const summary = sleep?.summary ?? null;
  const hasData = summary != null && (summary.todayMinutes > 0 || (sleep?.logs.length ?? 0) > 0);
  const avg = summary?.avgPerDayMinutes ?? 0;
  const todayMin = summary?.todayMinutes ?? 0;
  const ratio = todayMin <= 0 ? 0 : avg > 0 ? Math.max(0.04, Math.min(1, todayMin / Math.max(avg, todayMin))) : 1;
  return (
    <Card accent="var(--cat-sleep)" style={{ display: 'flex', flexDirection: 'column', minHeight: 248 }}>
      <CardHeader eyebrow="Today's rest" eyebrowColor="var(--cat-sleep-text)" title="Sleep" icon={Moon} iconBg="var(--cat-sleep-bg)" iconColor="var(--cat-sleep)" />
      {summary != null && hasData ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1, ...NUMERAL }}>
                {todayMin > 0 ? formatDuration(todayMin) : '—'}
              </span>
              <span style={{ color: 'var(--muted-foreground)', fontSize: '0.78rem' }}>slept today</span>
            </div>
            <div style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', lineHeight: 1.6 }}>
              {summary.todayNaps} nap{summary.todayNaps === 1 ? '' : 's'} today
              {avg > 0 && (
                <>
                  <br />~{formatDuration(avg)} avg / day
                </>
              )}
            </div>
          </div>
          {avg > 0 && (
            <div>
              <div aria-hidden="true" style={{ position: 'relative', height: 8, borderRadius: 999, backgroundColor: 'var(--secondary)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${ratio * 100}%`, backgroundColor: 'var(--cat-sleep)', borderRadius: 999 }} />
              </div>
              <p style={{ marginTop: 5, fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>vs ~{formatDuration(avg)} daily average</p>
            </div>
          )}
        </div>
      ) : (
        <EmptyTile icon={Moon} bg="var(--cat-sleep-bg)" color="var(--cat-sleep)" text="No sleep logged yet — add a nap or last night's sleep to see the rhythm." />
      )}
      <FooterLink to={`/babies/${babyId}/sleep`} color="var(--cat-sleep-text)">Open sleep log</FooterLink>
    </Card>
  );
}

const UP_TONE: Record<string, StatusType> = { overdue: 'overdue', due: 'due-soon', upcoming: 'info', done: 'on-track' };

function UpNextCard({ items }: { items: UpcomingItem[] }) {
  return (
    <Card>
      <CardHeader title="Up next" />
      {items.length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>Nothing needs your attention today 🌱</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item, i) => {
            const tone = UP_TONE[item.status];
            const cfg = statusConfig[tone];
            return (
              <div key={`${item.babyId}-${item.vaccineName}-${i}`} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', paddingLeft: 18, borderRadius: 12, backgroundColor: 'var(--secondary)' }}>
                <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 999, backgroundColor: cfg.color }} />
                <IconTile Icon={Syringe} bg={cfg.bg} color={cfg.color} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, marginBottom: 2 }}>
                    {item.vaccineName} · {item.doseLabel}
                  </p>
                  <p style={{ color: 'var(--muted-foreground)', fontSize: '0.775rem', lineHeight: 1.3 }}>{item.babyName}</p>
                </div>
                <StatusChip status={tone} />
                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.775rem', whiteSpace: 'nowrap', minWidth: 64, textAlign: 'right', flexShrink: 0, ...NUMERAL }}>{formatDateIST(item.dueDate)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ActivityCard({ growth, skin }: { growth: Growth | null; skin: SkinLog[] | null }) {
  type Item = { id: string; text: string; iso: string; tone: StatusType; Icon: LucideIcon };
  const items: Item[] = [];
  for (const g of (growth?.logs ?? []).slice(-3)) {
    const w = g.metrics.weight;
    items.push({ id: `g-${g.id}`, text: w ? `Weight logged — ${w.value} kg (${ordinal(Math.max(1, Math.round(w.percentile)))} percentile)` : 'Measurement logged', iso: g.loggedAt, tone: 'info', Icon: Scale });
  }
  for (const s of (skin ?? []).slice(0, 3)) {
    items.push({ id: `s-${s.id}`, text: `Skin note — ${s.area} (${s.severity})`, iso: s.loggedAt, tone: SKIN_TONE[s.severity], Icon: Camera });
  }
  items.sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime());
  const feed = items.slice(0, 4);
  if (feed.length === 0) return null;
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--secondary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Activity size={17} style={{ color: 'var(--muted-foreground)' }} />
        </span>
        <h2 style={{ color: 'var(--foreground)', fontSize: '1.0625rem', fontWeight: 600 }}>Recent activity</h2>
      </div>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {feed.map((item, i) => {
          const cfg = statusConfig[item.tone];
          const isLast = i === feed.length - 1;
          return (
            <div key={item.id} style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : '1.1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconTile Icon={item.Icon} bg={cfg.bg} color={cfg.color} size={34} />
                {!isLast && <div aria-hidden="true" style={{ flex: 1, width: 2, backgroundColor: 'var(--border)', marginTop: 4 }} />}
              </div>
              <div style={{ paddingTop: 4 }}>
                <p style={{ color: 'var(--foreground)', fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.4 }}>{item.text}</p>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.775rem', marginTop: 2 }}>{relativeDays(item.iso)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BabyProfileCard({ baby, growth }: { baby: OverviewBaby; growth: Growth | null }) {
  const reduce = prefersReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const v = baby.vaccines;
  // This bar carries a completion metaphor ("X of Y doses"), so drive it from the
  // actual completion share — NOT upToDatePct (which reads 100% for a newborn with
  // no closed windows, which would fill the bar beside a "0 of N" label).
  const completion = v.total > 0 ? Math.round((v.done / v.total) * 100) : 0;
  const full = v.done > 0 && v.done === v.total && v.overdue === 0;
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setBarWidth(completion), 250);
    return () => clearTimeout(t);
  }, [completion, reduce]);
  const weights = (growth?.logs ?? []).filter((l) => l.metrics.weight);
  const latest = weights[weights.length - 1];
  const rows = [
    { label: 'Date of birth', value: formatDateIST(baby.dob) },
    { label: 'Weight', value: latest ? `${latest.metrics.weight!.value} kg` : '—' },
    { label: 'Percentile', value: latest ? `${ordinal(Math.max(1, Math.round(latest.metrics.weight!.percentile)))} (weight-for-age)` : '—' },
  ];
  const trackers: { label: string; seg: string; Icon: LucideIcon; color: string }[] = [
    { label: 'Vaccinations', seg: 'vaccines', Icon: Syringe, color: 'var(--cat-vaccine)' },
    { label: 'Growth', seg: 'growth', Icon: TrendingUp, color: 'var(--cat-growth)' },
    { label: 'Food', seg: 'food', Icon: Apple, color: 'var(--cat-food)' },
    { label: 'Sleep', seg: 'sleep', Icon: Moon, color: 'var(--cat-sleep)' },
    { label: 'Skin health', seg: 'skin', Icon: Droplets, color: 'var(--cat-skin)' },
  ];
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div
            aria-hidden="true"
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: avatarUrl(baby.avatar) ? 'var(--secondary)' : 'var(--brand-gradient)',
              border: '2.5px solid #ffffff',
              boxShadow: full ? '0 0 0 2.5px var(--cat-growth), 0 2px 8px rgba(124,92,252,0.35)' : '0 2px 8px rgba(124,92,252,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#ffffff',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {avatarUrl(baby.avatar) ? (
              <img src={avatarUrl(baby.avatar) ?? undefined} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              baby.name.charAt(0).toUpperCase()
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ color: 'var(--foreground)', marginBottom: 2, fontSize: '1.125rem', fontWeight: 600 }}>{baby.name}</h3>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.825rem' }}>
              {formatAge(baby.dob)}
              {correctedAgeLabel(baby.dob, baby.gestationalAgeWeeks) && (
                <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, background: 'var(--accent)', color: 'var(--brand-purple-deep)', fontSize: '0.68rem', fontWeight: 700 }}>
                  {correctedAgeLabel(baby.dob, baby.gestationalAgeWeeks)}
                </span>
              )}
            </p>
          </div>
        </div>
        <Link
          to={`/babies/${baby.id}/edit`}
          aria-label={`Edit ${baby.name}'s profile`}
          title="Edit profile"
          style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          <Pencil size={15} aria-hidden="true" />
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', flexShrink: 0 }}>{label}</span>
            <span style={{ color: 'var(--foreground)', fontSize: '0.825rem', fontWeight: 600, textAlign: 'right', ...NUMERAL }}>{value}</span>
          </div>
        ))}
      </div>
      {((baby.bloodGroup && baby.bloodGroup !== 'unknown') || (baby.knownAllergies?.length ?? 0) > 0 || baby.pediatricianName || baby.feedingType) && (
        <>
          <div style={{ height: 1, backgroundColor: 'var(--border)' }} aria-hidden="true" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {baby.bloodGroup && baby.bloodGroup !== 'unknown' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>Blood group</span>
                <span style={{ color: 'var(--foreground)', fontSize: '0.825rem', fontWeight: 600 }}>{baby.bloodGroup}</span>
              </div>
            )}
            {baby.feedingType && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>Feeding</span>
                <span style={{ color: 'var(--foreground)', fontSize: '0.825rem', fontWeight: 600 }}>{baby.feedingType === 'breastfed' ? 'Breastfed' : 'Mixed'}</span>
              </div>
            )}
            {baby.knownAllergies && baby.knownAllergies.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', flexShrink: 0 }}>Allergies</span>
                <span style={{ color: 'var(--status-overdue-text)', fontSize: '0.8rem', fontWeight: 700, textAlign: 'right' }}>{baby.knownAllergies.join(', ')}</span>
              </div>
            )}
            {baby.pediatricianName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', flexShrink: 0 }}>Doctor</span>
                {baby.pediatricianPhone ? (
                  <a href={`tel:${baby.pediatricianPhone}`} style={{ color: 'var(--brand-purple-deep)', fontSize: '0.825rem', fontWeight: 700, textAlign: 'right', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={13} aria-hidden="true" /> {baby.pediatricianName}
                  </a>
                ) : (
                  <span style={{ color: 'var(--foreground)', fontSize: '0.825rem', fontWeight: 600, textAlign: 'right' }}>{baby.pediatricianName}</span>
                )}
              </div>
            )}
          </div>
        </>
      )}
      <div style={{ height: 1, backgroundColor: 'var(--border)' }} aria-hidden="true" />
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>Vaccine progress</span>
          <span style={{ color: 'var(--brand-purple-deep)', fontSize: '0.8rem', fontWeight: 700, ...NUMERAL }}>{v.done} of {v.total} doses</span>
        </div>
        <div role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, backgroundColor: 'var(--secondary)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${reduce ? completion : barWidth}%`, backgroundColor: 'var(--primary)', borderRadius: 999, transition: reduce ? undefined : 'width 1.3s cubic-bezier(0.22,1,0.36,1)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {trackers.map(({ label, seg, Icon, color }) => (
          <Link key={seg} to={`/babies/${baby.id}/${seg}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', color: 'var(--foreground)', fontSize: '0.875rem', width: '100%' }}>
            <Icon size={16} style={{ color, flexShrink: 0 }} aria-hidden="true" />
            <span style={{ flex: 1 }}>{label}</span>
            <ChevronRight size={14} style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

const MILESTONE_PRIORITY: Record<string, number> = { watch: 0, inwindow: 1, upcoming: 2, achieved: 3 };

function MilestonesCard({ babyId, milestones }: { babyId: string; milestones: MilestonesResponse | null }) {
  const reduce = prefersReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const summary = milestones?.summary ?? null;
  const items = milestones?.milestones ?? [];
  const shown = [...items].sort((a, b) => MILESTONE_PRIORITY[a.status] - MILESTONE_PRIORITY[b.status]).slice(0, 4);
  const pct = summary && summary.total > 0 ? Math.round((summary.achieved / summary.total) * 100) : 0;
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setBarWidth(pct), 280);
    return () => clearTimeout(t);
  }, [pct, reduce]);
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <IconTile Icon={Star} bg="var(--cat-milestone-bg)" color="var(--cat-milestone)" size={34} />
        <h2 style={{ color: 'var(--foreground)', fontSize: '1.0625rem', fontWeight: 600 }}>Milestones</h2>
      </div>
      {summary ? (
        <>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', marginBottom: 8 }}>
            {summary.achieved} of {summary.total} reached
            {summary.watch > 0 && <span style={{ color: 'var(--status-duesoon-text)', fontWeight: 600 }}> · {summary.watch} worth a mention</span>}
          </p>
          <div style={{ position: 'relative', height: 8, backgroundColor: 'var(--secondary)', borderRadius: 999, marginBottom: '0.9rem' }}>
            <div style={{ height: '100%', width: `${reduce ? pct : barWidth}%`, backgroundColor: 'var(--cat-milestone)', borderRadius: 999, transition: reduce ? undefined : 'width 1.1s cubic-bezier(0.22,1,0.36,1)' }} />
            {pct === 100 && <span aria-hidden="true" style={{ position: 'absolute', right: -3, top: -7, fontSize: '0.85rem' }}>🌟</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {m.achieved ? (
                  <CheckCircle2 size={17} aria-hidden="true" style={{ color: 'var(--cat-milestone-text)', flexShrink: 0 }} />
                ) : (
                  <span aria-hidden="true" style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${m.status === 'watch' ? 'var(--status-duesoon-text)' : 'var(--text-muted-color)'}`, flexShrink: 0 }} />
                )}
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: m.achieved ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{m.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>Every baby is different — track each new step here.</p>
      )}
      <FooterLink to={`/babies/${babyId}/milestones`} color="var(--cat-milestone-text)">Open milestones</FooterLink>
    </Card>
  );
}

// Ask Dai Maa — the dashboard's AI front door, a big centred search bar (sits right
// under the hero). A real input whose placeholder types itself through rotating
// baby-care questions; submitting (or a chip) opens a fresh chat thread.
function AskAssistantBar({ babyId }: { babyId: string }) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const typed = useTypewriter(SUGGESTED_QUESTIONS);
  function ask(question: string) {
    const q = question.trim();
    if (q) navigate(askAssistantLink(babyId, q));
  }
  return (
    <div data-entrance="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem 0 0.25rem' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: '0.95rem' }}>
        <AssistantMark size={34} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1 }}>
          Ask{' '}
          <span style={{ background: 'linear-gradient(90deg, #7c5cfc, #9b46ee)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{ASSISTANT_NAME}</span>
        </h2>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ width: '100%', maxWidth: 680 }}>
        <div
          className="ask-assistant-box"
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', borderRadius: 18, padding: '9px 9px 9px 18px' }}
        >
          <AssistantMark size={30} />
          <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', height: 28 }}>
            {!input && (
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none', fontSize: '1rem', color: 'var(--text-muted-color)' }}>
                {typed}▏
              </span>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder=""
              aria-label={`Ask ${ASSISTANT_NAME} a question`}
              style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '1rem', color: 'var(--foreground)' }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label={`Ask ${ASSISTANT_NAME}`}
            className="pop-hover"
            style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 14, background: 'var(--brand-gradient)', color: '#fff', flexShrink: 0, opacity: input.trim() ? 1 : 0.55 }}
          >
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: '0.95rem' }}>
        {QUICK_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => ask(c)}
            className="pop-hover"
            style={{ padding: '7px 15px', borderRadius: 999, background: '#ffffff', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', padding: '4rem 2rem', textAlign: 'center' }}>
      <div aria-hidden="true" className="grid place-items-center" style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: 'var(--accent)' }}>
        <BabyIcon size={46} style={{ color: 'var(--primary)' }} />
      </div>
      <div>
        <h2 style={{ color: 'var(--foreground)', marginBottom: 8, fontSize: '1.5rem' }}>{t('dash.emptyTitle')}</h2>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9375rem', maxWidth: 360, lineHeight: 1.65 }}>{t('dash.emptyBody')}</p>
      </div>
      <Link to="/babies/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.9375rem', fontWeight: 600 }}>
        <Plus size={18} aria-hidden="true" />
        {t('dash.addYourBaby')}
      </Link>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-44 w-full rounded-[28px]" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_312px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[232px] w-full rounded-[26px]" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Skeleton className="h-[248px] rounded-[26px]" />
            <Skeleton className="h-[248px] rounded-[26px]" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-[248px] rounded-[26px]" />
            <Skeleton className="h-[248px] rounded-[26px]" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-80 w-full rounded-[26px]" />
          <Skeleton className="h-48 w-full rounded-[26px]" />
        </div>
      </div>
    </div>
  );
}
