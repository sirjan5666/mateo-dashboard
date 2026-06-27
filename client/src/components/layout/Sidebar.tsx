import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useReveal } from '../../lib/gsap';
import { Activity, Apple, Baby, BookText, CalendarClock, Droplets, FileText, Gift, LayoutDashboard, LogOut, MessageCircleHeart, MessagesSquare, Milk, Moon, Package, PanelLeft, PanelLeftClose, Pill, Settings, ShieldAlert, ShoppingBag, Star, Stethoscope, Syringe, Thermometer, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../auth/context';
import { useT } from '../../i18n/context';
import { listBabies } from '../../api/babies';
import { Brand } from './Brand';
import { BrandTile } from '../ui/BrandTile';
import { cn } from '../../lib/cn';

// label is an i18n key resolved with t() at render.
const TRACKERS: { icon: LucideIcon; label: string; seg: string; color: string }[] = [
  { icon: Syringe, label: 'tracker.vaccines', seg: 'vaccines', color: 'var(--cat-vaccine)' },
  { icon: Activity, label: 'tracker.growth', seg: 'growth', color: 'var(--cat-growth)' },
  { icon: Apple, label: 'tracker.food', seg: 'food', color: 'var(--cat-food)' },
  { icon: Milk, label: 'tracker.feeds', seg: 'feeds', color: '#2f7fd6' },
  { icon: Moon, label: 'tracker.sleep', seg: 'sleep', color: 'var(--cat-sleep)' },
  { icon: Baby, label: 'tracker.diapers', seg: 'diapers', color: '#cc8a2b' },
  { icon: Thermometer, label: 'tracker.symptoms', seg: 'symptoms', color: '#e0556b' },
  { icon: Pill, label: 'tracker.medicines', seg: 'medicines', color: '#0891b2' },
  { icon: ShieldAlert, label: 'tracker.allergies', seg: 'allergies', color: '#dc4d4d' },
  { icon: Droplets, label: 'tracker.skin', seg: 'skin', color: 'var(--cat-skin)' },
  { icon: Star, label: 'tracker.milestones', seg: 'milestones', color: 'var(--cat-milestone)' },
  { icon: FileText, label: 'tracker.records', seg: 'records', color: 'var(--cat-record)' },
  { icon: MessageCircleHeart, label: 'tracker.assistant', seg: 'chat', color: 'var(--cat-assistant)' },
];

function SectionLabel({ children, collapsed }: { children: string; collapsed?: boolean }) {
  if (collapsed) return <div className="mx-2 my-3 h-px bg-stone-200/70" />;
  return <p className="eyebrow px-3 pb-1.5 pt-5">{children}</p>;
}

const navClass = (isActive: boolean, collapsed?: boolean) =>
  cn(
    'group relative flex items-center gap-3 rounded-xl py-2 text-sm transition-colors',
    collapsed ? 'justify-center px-0' : 'px-3',
    isActive ? 'bg-emerald-50 font-semibold text-emerald-800' : 'font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  );

function NavIcon({ icon: Icon, active, color }: { icon: LucideIcon; active: boolean; color?: string }) {
  return (
    <>
      {active && (
        <span
          className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-emerald-700"
          style={color ? { backgroundColor: color } : undefined}
        />
      )}
      <Icon
        className={cn('h-[18px] w-[18px] shrink-0', !color && (active ? 'text-emerald-600' : 'text-stone-500 group-hover:text-stone-600'))}
        style={color ? { color } : undefined}
      />
    </>
  );
}

export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { user, logout } = useAuth();
  const t = useT();
  const location = useLocation();
  const [firstBabyId, setFirstBabyId] = useState<string | null>(null);
  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'M';

  useEffect(() => {
    let cancelled = false;
    listBabies()
      .then((d) => {
        if (!cancelled) setFirstBabyId(d.babies[0]?.id ?? null);
      })
      .catch(() => {
        /* ignore — trackers just stay disabled */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Trackers navigate for the baby you're currently viewing, else the first baby.
  const routeBabyId = /^\/babies\/([^/]+)\//.exec(location.pathname)?.[1] ?? null;
  const activeBabyId = routeBabyId ?? firstBabyId;

  // Cascade the nav links in on mount. Re-runs once the baby id resolves so the
  // trackers (which switch from disabled <li> to active <a>) animate in too.
  // Also re-runs on collapse so the rail re-reveals cleanly.
  const navRef = useReveal<HTMLDivElement>([activeBabyId, collapsed], {
    selector: 'a, li',
    y: 8,
    stagger: 0.035,
    duration: 0.4,
  });

  return (
    <div ref={navRef} className="flex h-full flex-col">
      {/* Header: wordmark + collapse toggle (rail shows a compact mark) */}
      <div className={cn('flex py-5', collapsed ? 'flex-col items-center gap-3 px-2' : 'items-center justify-between gap-2 px-5')}>
        {collapsed ? (
          <BrandTile className="h-9 w-9 rounded-xl text-sm font-extrabold tracking-tight">M</BrandTile>
        ) : (
          <Brand className="h-9 drop-shadow-md" />
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        )}
      </div>

      <nav data-lenis-prevent className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
        {user?.role === 'admin' && (
          <>
            <SectionLabel collapsed={collapsed}>{t('section.management')}</SectionLabel>
            <NavLink to="/parents" onClick={onNavigate} title={collapsed ? t('nav.parents') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
              {({ isActive }) => (
                <>
                  <NavIcon icon={Users} active={isActive} />
                  {!collapsed && t('nav.parents')}
                </>
              )}
            </NavLink>
            <NavLink to="/doctors" onClick={onNavigate} title={collapsed ? t('nav.doctors') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
              {({ isActive }) => (
                <>
                  <NavIcon icon={Stethoscope} active={isActive} />
                  {!collapsed && t('nav.doctors')}
                </>
              )}
            </NavLink>
            <NavLink to="/chats" onClick={onNavigate} title={collapsed ? t('nav.aiChats') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
              {({ isActive }) => (
                <>
                  <NavIcon icon={MessagesSquare} active={isActive} />
                  {!collapsed && t('nav.aiChats')}
                </>
              )}
            </NavLink>
            <NavLink to="/shop/admin/orders" onClick={onNavigate} title={collapsed ? t('nav.shopOrders') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
              {({ isActive }) => (
                <>
                  <NavIcon icon={Package} active={isActive} />
                  {!collapsed && t('nav.shopOrders')}
                </>
              )}
            </NavLink>
          </>
        )}

        <SectionLabel collapsed={collapsed}>{t('section.workspace')}</SectionLabel>
        <NavLink to="/" end onClick={onNavigate} title={collapsed ? t('nav.dashboard') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
          {({ isActive }) => (
            <>
              <NavIcon icon={LayoutDashboard} active={isActive} />
              {!collapsed && t('nav.dashboard')}
            </>
          )}
        </NavLink>
        <NavLink to="/find-doctor" onClick={onNavigate} title={collapsed ? t('nav.findDoctor') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
          {({ isActive }) => (
            <>
              <NavIcon icon={Stethoscope} active={isActive} />
              {!collapsed && t('nav.findDoctor')}
            </>
          )}
        </NavLink>
        <NavLink to="/consultations" onClick={onNavigate} title={collapsed ? t('nav.consultations') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
          {({ isActive }) => (
            <>
              <NavIcon icon={CalendarClock} active={isActive} />
              {!collapsed && t('nav.consultations')}
            </>
          )}
        </NavLink>
        <NavLink to="/shop" onClick={onNavigate} title={collapsed ? t('nav.shop') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
          {({ isActive }) => (
            <>
              <NavIcon icon={ShoppingBag} active={isActive} />
              {!collapsed && t('nav.shop')}
            </>
          )}
        </NavLink>
        {user?.role === 'parent' && (
          <NavLink to="/shop/orders" onClick={onNavigate} title={collapsed ? t('nav.myOrders') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
            {({ isActive }) => (
              <>
                <NavIcon icon={Package} active={isActive} />
                {!collapsed && t('nav.myOrders')}
              </>
            )}
          </NavLink>
        )}
        <NavLink to="/community" onClick={onNavigate} title={collapsed ? t('nav.community') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
          {({ isActive }) => (
            <>
              <NavIcon icon={MessagesSquare} active={isActive} />
              {!collapsed && t('nav.community')}
            </>
          )}
        </NavLink>
        {user?.role === 'parent' && (
          <NavLink to="/report" onClick={onNavigate} title={collapsed ? t('nav.report') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
            {({ isActive }) => (
              <>
                <NavIcon icon={BookText} active={isActive} />
                {!collapsed && t('nav.report')}
              </>
            )}
          </NavLink>
        )}
        {user?.role === 'parent' && (
          <NavLink to="/refer" onClick={onNavigate} title={collapsed ? t('nav.refer') : undefined} className={({ isActive }) => navClass(isActive, collapsed)}>
            {({ isActive }) => (
              <>
                <NavIcon icon={Gift} active={isActive} />
                {!collapsed && t('nav.refer')}
              </>
            )}
          </NavLink>
        )}

        <SectionLabel collapsed={collapsed}>{t('section.trackers')}</SectionLabel>
        {activeBabyId ? (
          <div className="space-y-0.5">
            {TRACKERS.map(({ icon, label, seg, color }) => (
              <NavLink
                key={seg}
                to={`/babies/${activeBabyId}/${seg}`}
                end
                onClick={onNavigate}
                title={collapsed ? t(label) : undefined}
                className={({ isActive }) => navClass(isActive, collapsed)}
              >
                {({ isActive }) => (
                  <>
                    <NavIcon icon={icon} active={isActive} color={color} />
                    {!collapsed && t(label)}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ) : (
          <>
            <ul className="cursor-default select-none space-y-0.5">
              {TRACKERS.map(({ icon: Icon, label, seg }) => (
                <li
                  key={seg}
                  title={collapsed ? t(label) : undefined}
                  className={cn('flex items-center gap-3 rounded-xl py-2 text-sm opacity-60', collapsed ? 'justify-center px-0' : 'px-3')}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 text-stone-400" />
                  {!collapsed && <span className="font-medium text-stone-500">{t(label)}</span>}
                </li>
              ))}
            </ul>
            {!collapsed && <p className="px-3 pt-2 text-xs text-stone-500">{t('sidebar.addBabyHint')}</p>}
          </>
        )}
      </nav>

      <div className="border-t border-stone-200/70 p-3">
        {collapsed ? (
          <div className="flex justify-center py-1" title={user?.name ?? undefined}>
            <BrandTile className="h-9 w-9 rounded-full text-sm font-bold">{initial}</BrandTile>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <BrandTile className="h-9 w-9 shrink-0 rounded-full text-sm font-bold">{initial}</BrandTile>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-800">{user?.name}</p>
              <p className="truncate text-xs text-stone-500">{user?.email}</p>
            </div>
          </div>
        )}
        <NavLink
          to="/settings"
          onClick={onNavigate}
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            cn(
              'mt-1 flex w-full items-center gap-2 rounded-xl py-2 text-sm font-medium transition-colors',
              collapsed ? 'justify-center px-0' : 'px-3',
              isActive ? 'bg-emerald-50 text-emerald-800' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800',
            )
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && t('nav.settings')}
        </NavLink>
        <button
          onClick={() => {
            onNavigate?.();
            void logout();
          }}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'mt-1 flex w-full items-center gap-2 rounded-xl py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-800',
            collapsed ? 'justify-center px-0' : 'px-3',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && t('nav.signOut')}
        </button>
      </div>
    </div>
  );
}
