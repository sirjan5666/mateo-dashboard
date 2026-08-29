import { Link, useLocation, useNavigate } from 'react-router';
import { Home, LayoutGrid, Stethoscope, MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '../../i18n/context';
import { useSubscribed } from '../../lib/subscription';
import { useBabies } from '../../lib/useBabies';
import { cn } from '../../lib/cn';

// The tracker segments that belong under the Trackers tab (chat is Dai Maa's).
const TRACKER_SEGS = ['vaccines', 'growth', 'food', 'sleep', 'medicines', 'skin', 'milestones', 'records', 'teeth'];

type TabKey = 'home' | 'trackers' | 'daimaa' | 'care' | 'more';

function activeTab(pathname: string): TabKey | null {
  if (pathname === '/') return 'home';
  if (pathname.endsWith('/chat')) return 'daimaa';
  if (pathname.startsWith('/trackers')) return 'trackers';
  const seg = /^\/babies\/[^/]+\/([^/]+)/.exec(pathname)?.[1];
  if (seg && TRACKER_SEGS.includes(seg)) return 'trackers';
  if (pathname.startsWith('/find-doctor') || pathname.startsWith('/consultations') || pathname.startsWith('/care')) return 'care';
  if (
    pathname.startsWith('/more') ||
    pathname.startsWith('/shop') ||
    pathname.startsWith('/community') ||
    pathname.startsWith('/rewards') ||
    pathname.startsWith('/refer') ||
    pathname.startsWith('/report') ||
    pathname.startsWith('/settings')
  )
    return 'more';
  return null;
}

function TabButton({ icon: Icon, label, active, to, onClick }: { icon: LucideIcon; label: string; active: boolean; to?: string; onClick?: () => void }) {
  const cls = cn(
    'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 pt-1 text-[11px] font-semibold transition-colors',
    active ? 'text-[var(--brand-purple-deep)]' : 'text-[var(--muted-foreground)]',
  );
  const inner = (
    <>
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
      <span className="leading-none">{label}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls} aria-current={active ? 'page' : undefined}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} aria-current={active ? 'page' : undefined}>
      {inner}
    </button>
  );
}

/**
 * Fixed bottom navigation for the parent mobile app — Home · Trackers · Dai Maa
 * (elevated centre) · Care · More. Replaces the desktop sidebar/hamburger below
 * lg. Dai Maa routes to the assistant, or gently to add-baby / subscribe when
 * there's no baby or no plan yet.
 */
export function BottomTabBar() {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const subscribed = useSubscribed();
  const { activeBabyId } = useBabies();
  const tab = activeTab(location.pathname);

  const openDaiMaa = () => {
    if (!activeBabyId) return navigate('/babies/new');
    if (!subscribed) return navigate('/subscribe', { state: { from: `/babies/${activeBabyId}/chat` } });
    navigate(`/babies/${activeBabyId}/chat`);
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/70 bg-[var(--surface-card)]/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="mx-auto flex max-w-[520px] items-stretch px-1">
        <TabButton icon={Home} label={t('nav.home')} active={tab === 'home'} to="/" />
        <TabButton icon={LayoutGrid} label={t('section.trackers')} active={tab === 'trackers'} to="/trackers" />

        {/* Elevated centre — Dai Maa */}
        <div className="relative flex min-h-[54px] w-16 shrink-0 flex-col items-center justify-end">
          <button
            type="button"
            onClick={openDaiMaa}
            aria-label="Ask Dai Maa"
            className={cn(
              'absolute -top-8 grid h-14 w-14 place-items-center rounded-full ring-4 ring-[var(--surface-card)] shadow-card transition-transform active:scale-95',
              'brand-gradient',
            )}
          >
            <img src="/dai-maa.png" alt="" className="h-11 w-11 rounded-full object-cover" draggable={false} />
          </button>
          <span className={cn('pb-1 text-[11px] font-semibold leading-none', tab === 'daimaa' ? 'text-[var(--brand-purple-deep)]' : 'text-[var(--muted-foreground)]')}>
            Dai Maa
          </span>
        </div>

        <TabButton icon={Stethoscope} label={t('nav.care')} active={tab === 'care'} to="/care" />
        <TabButton icon={MoreHorizontal} label={t('nav.more')} active={tab === 'more'} to="/more" />
      </div>
    </nav>
  );
}
