import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowRight,
  Baby,
  CheckCircle2,
  ChevronRight,
  IndianRupee,
  MessagesSquare,
  Package,
  Radio,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react';
import { getAdminChats, getAdminOverview, listAdminDoctors, listParents } from '../../api/admin';
import type { AdminChatsResponse, AdminCounts, AdminDoctor, AdminParent } from '../../api/admin';
import { adminListNotifications, adminListOrders } from '../../api/shop';
import type { AdminOrder, OrderStatus } from '../../api/shop';
import { useAuth } from '../../auth/context';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { toneDot } from '../../components/ui/tones';
import type { Tone } from '../../components/ui/tones';
import {
  AreaTrend,
  Donut,
  EmptyState,
  Kpi,
  SectionCard,
  SkeletonChart,
  SkeletonKpi,
  SkeletonRows,
  useChartTheme,
} from '../../components/panel/kit';
import { greetingIST, relativePastIST, todayLongIST } from '../../lib/age';
import { useEntrance } from '../../lib/gsap';
import { cn } from '../../lib/cn';

const DAY = 86_400_000;
const rupee = (n: number) => Math.round(n).toLocaleString('en-IN');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  pending: 'stone',
  confirmed: 'amber',
  packed: 'sky',
  shipped: 'violet',
  delivered: 'emerald',
  cancelled: 'rose',
};
const ORDER_STATUS_ORDER: OrderStatus[] = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

// 14-day paid-revenue series, bucketed by day. Kept at module scope (out of the
// component body) so the time read isn't a render-time impurity.
function buildRevenueSeries(orders: AdminOrder[]) {
  const buckets = new Map<string, number>();
  for (let i = 13; i >= 0; i -= 1) buckets.set(new Date(Date.now() - i * DAY).toLocaleDateString('en-CA'), 0);
  for (const o of orders) {
    if (o.payment.status !== 'paid') continue;
    const k = dayKey(o.createdAt);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + o.totalInr);
  }
  return [...buckets.entries()].map(([k, revenue]) => ({
    day: new Date(`${k}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    revenue,
  }));
}

function countNewFamilies(parents: AdminParent[]) {
  const since = Date.now() - 7 * DAY;
  return parents.filter((p) => +new Date(p.createdAt) >= since).length;
}

interface Attention {
  tone: Tone;
  icon: LucideIcon;
  text: string;
  to: string;
}

function AttentionRow({ a }: { a: Attention }) {
  const Icon = a.icon;
  const TONE_BADGE: Record<Tone, string> = {
    emerald: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
    stone: 'bg-stone-100 text-stone-500',
  };
  return (
    <Link to={a.to} className="group flex items-center gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-stone-100">
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', TONE_BADGE[a.tone])}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="min-w-0 flex-1 text-sm font-semibold text-stone-800">{a.text}</p>
      <ChevronRight className="h-4 w-4 text-stone-300 transition-colors group-hover:text-stone-500" />
    </Link>
  );
}

function OrderPipeline({ counts, total }: { counts: Record<OrderStatus, number>; total: number }) {
  if (total === 0) return <p className="text-sm text-stone-500">No orders yet.</p>;
  const present = ORDER_STATUS_ORDER.filter((s) => counts[s] > 0);
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-sunken)' }}>
        {present.map((s) => (
          <div key={s} className={cn('h-full', toneDot[ORDER_STATUS_TONE[s]])} style={{ width: `${(counts[s] / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {present.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-xs text-stone-600">
            <span className={cn('h-2 w-2 rounded-full', toneDot[ORDER_STATUS_TONE[s]])} />
            <span className="capitalize">{s}</span>
            <span className="font-bold text-stone-800">{counts[s]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ManageLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link to={to}>
      <Card data-entrance="card" className="pop-hover flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-semibold text-stone-800">{label}</span>
        <ChevronRight className="ml-auto h-4 w-4 text-stone-300" />
      </Card>
    </Link>
  );
}

export default function AdminHome() {
  const { user } = useAuth();
  const scope = useEntrance<HTMLDivElement>([]);
  const theme = useChartTheme();

  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [doctors, setDoctors] = useState<AdminDoctor[] | null>(null);
  const [parents, setParents] = useState<AdminParent[] | null>(null);
  const [chats, setChats] = useState<AdminChatsResponse | null>(null);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getAdminOverview(), listAdminDoctors(), getAdminChats(), adminListOrders(), adminListNotifications(), listParents()]).then(
      (res) => {
        if (cancelled) return;
        const [ov, dc, ch, or, nt, pa] = res;
        if (ov.status === 'fulfilled') setCounts(ov.value.counts);
        if (dc.status === 'fulfilled') setDoctors(dc.value.doctors);
        if (ch.status === 'fulfilled') setChats(ch.value);
        if (or.status === 'fulfilled') setOrders(or.value.orders);
        if (nt.status === 'fulfilled') setUnreadOrders(nt.value.unread);
        if (pa.status === 'fulfilled') setParents(pa.value.parents);
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const doctorStatus = useMemo(() => {
    const g = { approved: 0, pending: 0, rejected: 0 } as Record<string, number>;
    for (const d of doctors ?? []) g[d.status] = (g[d.status] ?? 0) + 1;
    return g;
  }, [doctors]);

  const orderAgg = useMemo(() => {
    const c: Record<OrderStatus, number> = { pending: 0, confirmed: 0, packed: 0, shipped: 0, delivered: 0, cancelled: 0 };
    let revenue = 0;
    for (const o of orders ?? []) {
      c[o.status] += 1;
      if (o.payment.status === 'paid') revenue += o.totalInr;
    }
    return { c, revenue, total: (orders ?? []).length };
  }, [orders]);

  // 14-day revenue trend (paid orders, bucketed by day)
  const revenueSeries = useMemo(() => buildRevenueSeries(orders ?? []), [orders]);
  const revenueSpark = revenueSeries.map((d) => d.revenue);

  const newFamiliesThisWeek = useMemo(() => (parents ? countNewFamilies(parents) : 0), [parents]);

  const recentChats = useMemo(
    () => [...(chats?.sessions ?? [])].sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)).slice(0, 5),
    [chats],
  );

  const donutDoctors = [
    { label: 'Approved', value: doctorStatus.approved, color: theme.green },
    { label: 'Pending', value: doctorStatus.pending, color: theme.amber },
    { label: 'Rejected', value: doctorStatus.rejected, color: theme.rose },
  ].filter((d) => d.value > 0);

  const pendingDocs = doctorStatus.pending;
  const redFlags = chats?.counts.redFlags ?? 0;
  const attention: Attention[] = [];
  if (pendingDocs > 0) attention.push({ tone: 'amber', icon: ShieldAlert, text: `${pendingDocs} doctor${pendingDocs > 1 ? 's' : ''} awaiting verification`, to: '/doctors' });
  if (unreadOrders > 0) attention.push({ tone: 'sky', icon: Package, text: `${unreadOrders} new order${unreadOrders > 1 ? 's' : ''} to process`, to: '/shop/admin/orders' });
  if (redFlags > 0) attention.push({ tone: 'rose', icon: AlertTriangle, text: `${redFlags} red-flag escalation${redFlags > 1 ? 's' : ''} in AI chats`, to: '/chats' });

  const firstName = user?.name?.split(' ')[0] || 'Admin';
  const primary = attention[0];
  // Headline the same population the admin actually manages: derive families/
  // doctors from the authoritative lists (parents list + doctors table) and fall
  // back to the /admin/overview aggregate only if a list failed to load. The
  // aggregate counts raw User docs, so an orphaned/half-created doctor or parent
  // User would otherwise make the hero + KPIs disagree with the table below.
  const familyCount = parents?.length ?? counts?.parents ?? 0;
  const doctorCount = doctors?.length ?? counts?.doctors ?? 0;
  const babyCount = counts?.babies ?? 0;
  const summary = !loaded
    ? 'Loading platform overview…'
    : `${plural(familyCount, 'family', 'families')} · ${plural(doctorCount, 'doctor', 'doctors')} · ${plural(babyCount, 'baby', 'babies')} on Mateo`;

  if (!loaded) return <AdminSkeleton />;

  return (
    <div ref={scope} className="space-y-5">
      {/* Hero */}
      <div data-entrance="hero" className="brand-gradient relative overflow-hidden rounded-[var(--card-radius)] px-6 py-7 text-white shadow-card sm:px-8 sm:py-8">
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/12 blur-2xl" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/80">{todayLongIST()}</p>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-white">Mission control</span>
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-extrabold leading-tight sm:text-[2rem]">
            {greetingIST()}, {firstName}
          </h1>
          <p className="mt-2 max-w-lg text-[0.95rem] text-white/90">{summary}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {primary ? (
              <Link to={primary.to} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-card transition-transform hover:-translate-y-0.5">
                <ArrowRight className="h-4 w-4" />
                {primary.text}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white backdrop-blur">
                <CheckCircle2 className="h-4 w-4" />
                All clear — nothing needs attention
              </span>
            )}
            <Link to="/chats" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/25">
              <MessagesSquare className="h-4 w-4" />
              AI oversight
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi
          icon={Users}
          label="Families"
          value={familyCount}
          tone="violet"
          sub={newFamiliesThisWeek > 0 ? 'this week' : 'on Mateo'}
          delta={newFamiliesThisWeek > 0 ? { dir: 'up', text: `+${newFamiliesThisWeek}` } : undefined}
        />
        <Kpi icon={Stethoscope} label="Doctors" value={doctorCount} tone="sky" sub={`${doctorStatus.approved} approved`} />
        <Kpi icon={Baby} label={babyCount === 1 ? 'Baby' : 'Babies'} value={babyCount} tone="emerald" sub="tracked" />
        <Kpi icon={IndianRupee} label="Revenue" value={orderAgg.revenue} prefix="₹" tone="amber" sub={`${orderAgg.total} order${orderAgg.total === 1 ? '' : 's'}`} spark={revenueSpark.some((v) => v > 0) ? revenueSpark : undefined} />
      </div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <SectionCard
            title="Revenue"
            eyebrow="Paid orders · last 14 days"
            icon={TrendingUp}
            action={
              <div className="text-right">
                <p className="font-display text-xl font-extrabold leading-none text-stone-900">₹{rupee(orderAgg.revenue)}</p>
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-stone-400">total</p>
              </div>
            }
          >
            {revenueSpark.some((v) => v > 0) ? (
              <AreaTrend data={revenueSeries} xKey="day" series={[{ key: 'revenue', name: 'Revenue', color: theme.brand }]} height={240} unit="" />
            ) : (
              <EmptyState icon={TrendingUp} text="No paid orders in the last 14 days yet." />
            )}
          </SectionCard>

          <SectionCard
            title="Assistant oversight"
            eyebrow="mateo.ai across all families"
            icon={Sparkles}
            action={
              <Link to="/chats" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                Open
              </Link>
            }
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <MiniFact label="Sessions" value={chats?.counts.sessions ?? 0} />
              <MiniFact label="Live now" value={chats?.counts.live ?? 0} tone={chats && chats.counts.live > 0 ? 'violet' : undefined} />
              <MiniFact label="Questions" value={chats?.counts.questions ?? 0} />
              <MiniFact label="Red-flags" value={chats?.counts.redFlags ?? 0} tone={chats && chats.counts.redFlags > 0 ? 'rose' : undefined} />
            </div>
            <p className="mt-5 text-[0.66rem] font-bold uppercase tracking-wide text-stone-400">Recent conversations</p>
            {recentChats.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">No AI conversations yet.</p>
            ) : (
              <div className="mt-1 divide-y" style={{ borderColor: 'var(--hairline)' }}>
                {recentChats.map((s) => (
                  <Link key={s.id} to="/chats" className="group flex items-center gap-3 py-2.5">
                    <Avatar name={s.parentName} size="sm" tone={s.redFlags > 0 ? 'rose' : 'violet'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-stone-800">
                        {s.parentName} <span className="font-normal text-stone-400">· {s.babyName}</span>
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {relativePastIST(s.lastMessageAt)} · {s.messages} msg{s.messages === 1 ? '' : 's'}
                      </p>
                    </div>
                    {s.live && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[0.7rem] font-bold text-violet-800">
                        <Radio className="h-3 w-3" />
                        Live
                      </span>
                    )}
                    {s.redFlags > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[0.7rem] font-bold text-rose-700">
                        <AlertTriangle className="h-3 w-3" />
                        {s.redFlags}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-stone-300 transition-colors group-hover:text-stone-500" />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="min-w-0 space-y-5">
          <SectionCard title="Needs attention">
            {attention.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                All clear — no pending items.
              </div>
            ) : (
              <div className="space-y-0.5">
                {attention.map((a, i) => (
                  <AttentionRow key={i} a={a} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Doctor verification"
            action={
              <Link to="/doctors" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                Manage
              </Link>
            }
          >
            {donutDoctors.length === 0 ? (
              <EmptyState icon={Stethoscope} text="No doctors onboarded yet." />
            ) : (
              <Donut data={donutDoctors} centerValue={doctorCount} centerLabel="doctors" size={148} />
            )}
          </SectionCard>

          <SectionCard
            title="Order pipeline"
            action={
              <Link to="/shop/admin/orders" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                Orders
              </Link>
            }
          >
            <OrderPipeline counts={orderAgg.c} total={orderAgg.total} />
          </SectionCard>
        </div>
      </div>

      {/* Management shortcuts */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <ManageLink to="/parents" icon={Users} label="Parents" />
        <ManageLink to="/doctors" icon={Stethoscope} label="Doctors" />
        <ManageLink to="/chats" icon={MessagesSquare} label="AI Chats" />
        <ManageLink to="/shop/admin/orders" icon={Package} label="Shop Orders" />
      </div>
    </div>
  );
}

function MiniFact({ label, value, tone }: { label: string; value: number; tone?: Tone }) {
  const TONE_TEXT: Record<Tone, string> = {
    emerald: 'text-green-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    sky: 'text-sky-700',
    violet: 'text-violet-700',
    stone: 'text-stone-700',
  };
  return (
    <div className="rounded-2xl px-3 py-2.5 text-center" style={{ background: 'var(--surface-sunken)' }}>
      <p className={cn('font-display text-lg font-extrabold', tone ? TONE_TEXT[tone] : 'text-stone-900')}>{value}</p>
      <p className="text-[0.7rem] font-medium text-stone-500">{label}</p>
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div className="space-y-5">
      <Card className="brand-gradient h-40 rounded-[var(--card-radius)]" />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonKpi key={i} />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <SkeletonChart height={240} />
          <Card className="p-5 sm:p-6">
            <SkeletonRows n={4} />
          </Card>
        </div>
        <div className="min-w-0 space-y-5">
          <Card className="p-5 sm:p-6">
            <SkeletonRows n={2} />
          </Card>
          <SkeletonChart height={150} />
        </div>
      </div>
    </div>
  );
}
