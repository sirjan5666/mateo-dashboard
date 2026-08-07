import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlignLeft,
  Bell,
  Boxes,
  BriefcaseMedical,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  FileText,
  IndianRupee,
  LayoutGrid,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Pill,
  Receipt,
  Search,
  Settings,
  ShieldPlus,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../../auth/context';
import { useStaffSession } from '../../../auth/staffSession';
import { staffLogout } from '../../../api/staffAuth';
import { Toaster } from '../../ui/Toaster';
import { cn } from '../../../lib/cn';
import { openCommand } from '../../../lib/commandPalette';
import {
  EMPTY_LOCATION,
  LocationCtx,
  OVERALL,
  aggregateOf,
  fromDto,
  readStoredLocation,
  writeStoredLocation,
} from '../../../lib/doctorLocation';
import type { ClinicLocation, LocationId } from '../../../lib/doctorLocation';
import { listLocations } from '../../../api/doctorLocations';
import { LocationSwitcher } from './LocationSwitcher';

const META = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘' : 'Ctrl';
const COLLAPSE_KEY = 'mateo:doctor-rail-collapsed';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Permission module this row needs. Rows without one are always shown. */
  module?: string;
  end?: boolean;
  badge?: number;
  /** Filled coloured tile instead of a line icon (the OPERATIONS + log items). */
  tile?: string;
  /** Turns the row into an expandable group — see `NavGroupRow`. */
  children?: NavItem[];
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    section: 'Today',
    items: [
      { to: '/doctor', label: 'Dashboard', icon: LayoutGrid, end: true, module: 'dashboard' },
      { to: '/doctor/appointments', label: 'Appointments', icon: CalendarDays, module: 'appointments' },
    ],
  },
  {
    section: 'Patients',
    items: [
      { to: '/doctor/patients', label: 'Patients', icon: Users, module: 'patients' },
      { to: '/doctor/prescriptions', label: 'Prescriptions', icon: Pill, module: 'prescriptions' },
      { to: '/doctor/charts', label: 'Analytics', icon: Activity, module: 'reports' },
      { to: '/doctor/reports', label: 'Reports', icon: FileText, module: 'reports' },
      { to: '/doctor/messages', label: 'Messages', icon: MessageSquare, module: 'consultations' },
    ],
  },
  {
    section: 'Operations',
    items: [
      {
        to: '/doctor/pharmacy',
        label: 'Pharmacy',
        icon: BriefcaseMedical,
        tile: '#F59E0B',
        module: 'pharmacy',
        children: [
          { to: '/doctor/pharmacy', label: 'Inventory', icon: Boxes, end: true },
          { to: '/doctor/pharmacy/purchase', label: 'Purchase', icon: ShoppingCart },
          { to: '/doctor/pharmacy/billing', label: 'Billing', icon: Receipt },
        ],
      },
      { to: '/doctor/revenue', label: 'Revenue', icon: IndianRupee, tile: '#16A34A', module: 'billing' },
    ],
  },
  {
    section: 'Admin',
    items: [
      { to: '/doctor/locations', label: 'Locations', icon: Building2, module: 'locations' },
      { to: '/doctor/team', label: 'Team & Roles', icon: ShieldPlus, module: 'team' },
      { to: '/doctor/audit', label: 'Audit Logs', icon: AlignLeft, tile: '#6366F1', module: 'audit' },
      { to: '/doctor/email-logs', label: 'Email Logs', icon: Mail, tile: '#22D3EE', module: 'audit' },
      { to: '/doctor/settings', label: 'Settings', icon: Settings, module: 'settings' },
    ],
  },
];

// ── sidebar ──────────────────────────────────────────────────────────────────

/**
 * A nav row that owns a submenu (Pharmacy → Inventory / Purchase / Billing).
 * Opens automatically on any of its own routes, and stays open once the doctor
 * opens it by hand. Collapsed to the 76px rail there is nowhere to put the
 * children, so it degrades to a plain link to the section's landing page.
 */
function NavGroupRow({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem & { children: NavItem[] };
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const inSection = item.children.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`));
  const [open, setOpen] = useState(inSection);
  const [wasInSection, setWasInSection] = useState(inSection);
  const Icon = item.icon;
  const panelId = `nav-${item.label.toLowerCase()}`;

  // Entering the section from elsewhere reveals it. Adjusted during render rather
  // than in an effect so the submenu is open on the first paint, never a frame late.
  if (inSection !== wasInSection) {
    setWasInSection(inSection);
    if (inSection) setOpen(true);
  }

  if (collapsed) return <NavRow item={{ ...item, end: true }} collapsed onNavigate={onNavigate} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          'group relative mx-3 flex h-10 w-[calc(100%-1.5rem)] items-center gap-3 rounded-[10px] px-4 text-sm transition-colors',
          inSection ? 'bg-white/[0.10] font-semibold text-white' : 'font-medium text-white/[0.88] hover:bg-white/[0.08]',
        )}
      >
        {item.tile ? (
          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px]" style={{ background: item.tile }}>
            <Icon className="h-[15px] w-[15px] text-white" />
          </span>
        ) : (
          <Icon className="h-[18px] w-[18px] shrink-0 text-white/70" />
        )}
        <span className="truncate">{item.label}</span>
        <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-white/60 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div id={panelId} className="mt-0.5 space-y-0.5">
          {item.children.map((c) => {
            const CIcon = c.icon;
            return (
              <NavLink
                key={c.to}
                to={c.to}
                end={c.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'mx-3 flex h-9 items-center gap-2.5 rounded-[9px] pl-[46px] pr-4 text-[13px] transition-colors',
                    isActive
                      ? 'bg-[#2B4FF0] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(43,79,240,.9)]'
                      : 'font-medium text-white/70 hover:bg-white/[0.08] hover:text-white/90',
                  )
                }
              >
                <CIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{c.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </>
  );
}

function NavRow({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative mx-3 flex h-10 items-center rounded-[10px] text-sm transition-colors',
          collapsed ? 'justify-center px-0' : 'gap-3 px-4',
          isActive
            ? 'bg-[#2B4FF0] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(43,79,240,.9)]'
            : 'font-medium text-white/[0.88] hover:bg-white/[0.08]',
        )
      }
    >
      {({ isActive }) =>
        item.tile ? (
          <>
            <span
              className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px]"
              style={{ background: item.tile }}
            >
              <Icon className="h-[15px] w-[15px] text-white" />
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </>
        ) : (
          <>
            <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-white' : 'text-white/70')} />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && item.badge ? (
              <span className="ml-auto inline-grid min-w-[18px] place-items-center rounded-full bg-[#EF4444] px-1.5 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
            {collapsed && item.badge ? (
              <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-[#EF4444]" />
            ) : null}
          </>
        )
      }
    </NavLink>
  );
}

function SidebarNav({
  collapsed,
  unread,
  onNavigate,
  onToggleCollapse,
}: {
  collapsed: boolean;
  unread: number;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  const { user, logout } = useAuth();
  const { staff, roleName, canSee } = useStaffSession();
  // A staff member sees THEIR name and role in the rail, not the doctor's —
  // even though the session's cookie subject is the doctor.
  const displayName = staff?.name ?? user?.name ?? '';
  const displaySub = staff ? roleName ?? 'Staff' : user?.email ?? '';
  const initials = (displayName || 'Doctor')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  const groups = useMemo(
    () =>
      NAV.map((g) => ({
        ...g,
        items: g.items
          // A staff role that cannot see a module does not get the nav row.
          // Advisory only: the server refuses the request regardless.
          .filter((it) => !it.module || canSee(it.module))
          .map((it) => (it.to === '/doctor/messages' && unread ? { ...it, badge: unread } : it)),
      })).filter((g) => g.items.length > 0),
    [unread, canSee],
  );

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: 'linear-gradient(180deg, #0A1B4D 0%, #12309A 55%, #1B49D4 100%)' }}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3', collapsed ? 'justify-center px-2 py-5' : 'px-5 py-5')}>
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-2xl font-extrabold text-white shadow-[0_0_24px_-4px_rgba(124,92,255,.9)]"
          style={{ background: 'linear-gradient(135deg, #7C5CFF 0%, #3B82F6 100%)' }}
        >
          M
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block font-display text-2xl font-extrabold leading-none tracking-tight text-white">Mateo</span>
            <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#22D3EE]">Clinic OS</span>
          </span>
        )}
      </div>

      <nav data-lenis-prevent className="sidebar-scroll flex-1 overflow-y-auto pb-4">
        {groups.map((g, gi) => (
          <div key={g.section}>
            {gi > 0 && <div className="mx-5 my-2 border-t border-white/[0.12]" />}
            {collapsed ? (
              <div className="h-2" />
            ) : (
              <p className="px-5 pb-2 pt-[18px] text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">{g.section}</p>
            )}
            <div className="space-y-0.5">
              {g.items.map((it) =>
                it.children ? (
                  <NavGroupRow
                    key={it.to}
                    item={it as NavItem & { children: NavItem[] }}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                ) : (
                  <NavRow key={it.to} item={it} collapsed={collapsed} onNavigate={onNavigate} />
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.12] p-3">
        {!collapsed && (
          <div className="mb-1 flex items-center gap-3 rounded-[10px] px-2 py-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-white">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{displayName}</span>
              <span className="block truncate text-xs text-white/60">{displaySub}</span>
            </span>
          </div>
        )}
        <div className={cn('flex items-center', collapsed ? 'flex-col gap-2' : 'gap-2')}>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="flex items-center gap-2.5 rounded-[10px] px-2 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.08]"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/30">
                <ChevronLeft className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')} />
              </span>
              {!collapsed && 'Collapse'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              // Staff sign out through their own endpoint so the refresh token is
              // revoked server-side, not merely dropped from the browser.
              void (staff ? staffLogout().finally(() => window.location.assign('/staff/login')) : logout());
            }}
            aria-label="Sign out"
            title="Sign out"
            className="ml-auto grid h-9 w-9 place-items-center rounded-[10px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── top bar ──────────────────────────────────────────────────────────────────

function IconButton({
  icon: Icon,
  badge,
  badgeColor,
  label,
}: {
  icon: LucideIcon;
  badge?: number;
  badgeColor: string;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={badge ? `${label} — ${badge} unread` : label}
      className="relative grid h-[38px] w-[38px] place-items-center rounded-[10px] text-[#475569] transition-colors hover:bg-[#F1F3F9]"
    >
      <Icon className="h-[19px] w-[19px]" />
      {badge ? (
        <span
          className="absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-bold text-white"
          style={{ background: badgeColor }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function TopBar({ unread, onOpenNav, railCollapsed }: { unread: number; onOpenNav: () => void; railCollapsed: boolean }) {
  const { user } = useAuth();
  const { staff, roleName } = useStaffSession();
  const displayName = staff?.name ?? user?.name ?? '';
  const initials = (displayName || 'Doctor')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <header data-doctor-shell-chrome className="sticky top-[var(--imp-bar-h)] z-30 flex h-[74px] items-center gap-2 border-b border-[#ECEEF4] bg-white px-3 sm:gap-4 sm:px-4 lg:px-6">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open menu"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[#E2E6F0] text-[#475569] transition-colors hover:bg-[#F1F3F9] lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Shrinks to fit on small screens; the label truncates rather than pushing the bar wide. */}
      <div className="min-w-0 flex-1 lg:flex-none">
        <LocationSwitcher railCollapsed={railCollapsed} />
      </div>

      <button
        type="button"
        onClick={() => openCommand()}
        className="mx-auto hidden h-10 w-full max-w-[486px] items-center gap-2.5 rounded-[10px] border border-[#E8EBF3] bg-[#F7F8FC] px-3.5 text-left transition-colors hover:bg-[#F1F3F9] md:flex"
      >
        <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" />
        <span className="flex-1 truncate text-sm text-[#64748B]">Search patients, appointments, invoices…</span>
        <kbd className="shrink-0 rounded-[6px] border border-[#E2E6F0] bg-white px-2 py-[3px] font-mono-ds text-[11px] font-semibold text-[#64748B]">
          {META} + K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3.5">
        <IconButton icon={Bell} badge={6} badgeColor="#EF4444" label="Notifications" />
        <span className="hidden sm:contents">
          <IconButton icon={Mail} badge={unread || undefined} badgeColor="#3B4FE0" label="Messages" />
        </span>
        <span aria-hidden="true" className="hidden h-7 w-px bg-[#E5E8F0] sm:block" />
        <button type="button" className="flex items-center gap-2.5 rounded-[10px] py-1 pl-1 pr-2 transition-colors hover:bg-[#F1F3F9]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EEF2FF] text-sm font-bold text-[#3B4FE0] ring-2 ring-white">
            {initials}
          </span>
          <span className="hidden text-left lg:block">
            <span className="block text-sm font-bold leading-tight text-[#0F172A]">{displayName}</span>
            <span className="block text-xs font-medium text-[#3B4FE0]">{staff ? roleName ?? 'Staff' : 'Paediatrician'}</span>
          </span>
          <ChevronDown className="hidden h-[18px] w-[18px] text-[#94A3B8] lg:block" />
        </button>
      </div>
    </header>
  );
}

// ── shell ────────────────────────────────────────────────────────────────────

/**
 * Doctor-panel shell (Clinic OS). Deliberately separate from `PanelShell`, which
 * still serves the Patient portal — the doctor rebuild must not restyle it.
 */
export function DoctorShell({ unread = 0, globals }: { unread?: number; globals?: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [activeId, setActiveIdState] = useState<LocationId>(() => readStoredLocation());
  const [clinics, setClinics] = useState<ClinicLocation[]>([]);
  const [locLoading, setLocLoading] = useState(true);

  const setActiveId = (id: LocationId) => {
    setActiveIdState(id);
    writeStoredLocation(id);
  };

  // The doctor's clinics come from the API; there is no hardcoded list any more.
  // A failure leaves the list empty rather than substituting invented clinics —
  // the switcher then shows only "All Locations".
  const refreshLocations = useCallback(async () => {
    try {
      const { locations } = await listLocations();
      setClinics(locations.map(fromDto));
    } catch {
      setClinics([]);
    } finally {
      setLocLoading(false);
    }
  }, []);

  // Inlined rather than calling refreshLocations(), so every setState here is
  // provably after an await and the effect cannot cascade a render.
  useEffect(() => {
    let cancelled = false;
    void listLocations()
      .then(({ locations }) => {
        if (!cancelled) setClinics(locations.map(fromDto));
      })
      .catch(() => {
        if (!cancelled) setClinics([]);
      })
      .finally(() => {
        if (!cancelled) setLocLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCollapse = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });

  // Lock scroll + Escape-to-close while the mobile drawer is open.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  // Keep overscroll matching the new canvas (html sits outside the scoped subtree).
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = '#F6F7FB';
    return () => {
      html.style.backgroundColor = prev;
    };
  }, []);

  const ctx = useMemo(() => {
    const locations = [aggregateOf(clinics), ...clinics];
    // A stored id can point at a clinic that was since deleted or deactivated —
    // fall back to Overall rather than rendering a stale name.
    const active = locations.find((l) => l.id === activeId) ?? locations[0] ?? EMPTY_LOCATION;
    return {
      locations,
      clinics,
      activeId: active.id === OVERALL && activeId !== OVERALL ? OVERALL : activeId,
      active,
      setActiveId,
      loading: locLoading,
      refresh: refreshLocations,
    };
    // setActiveId is stable in behaviour (writes to state + localStorage only).
  }, [activeId, clinics, locLoading, refreshLocations]);

  return (
    <LocationCtx.Provider value={ctx}>
      <div
        data-theme="pro"
        data-mode="light"
        data-panel="doctor"
        data-doctor-shell-layout
        className="min-h-screen bg-[#F6F7FB] pt-[var(--imp-bar-h)]"
      >
        {/* Desktop rail */}
        <aside
          data-doctor-shell-chrome
          className={cn(
            'fixed bottom-0 left-0 top-[var(--imp-bar-h)] z-40 hidden transition-[width] duration-200 lg:block',
            collapsed ? 'w-[76px]' : 'w-[234px]',
          )}
        >
          <SidebarNav collapsed={collapsed} unread={unread} onToggleCollapse={toggleCollapse} />
        </aside>

        {/* Mobile drawer */}
        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 cursor-default bg-[rgba(10,27,77,.45)]"
              onClick={() => setNavOpen(false)}
            />
            <aside role="dialog" aria-modal="true" aria-label="Doctor menu" className="absolute bottom-0 left-0 top-0 w-[280px] max-w-[85vw] shadow-lift">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setNavOpen(false)}
                className="absolute right-3 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarNav collapsed={false} unread={unread} onNavigate={() => setNavOpen(false)} />
            </aside>
          </div>
        )}

        <div data-doctor-shell-layout className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[234px]')}>
          <TopBar unread={unread} onOpenNav={() => setNavOpen(true)} railCollapsed={collapsed} />
          <main data-doctor-shell-layout className="px-4 pb-8 pt-5 sm:px-6 lg:px-8 lg:pb-8 lg:pt-7">
            <Suspense fallback={<p className="text-sm text-[#64748B]">Loading…</p>}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        <Toaster />
        {globals}
      </div>
    </LocationCtx.Provider>
  );
}

/** Placeholder for doctor routes whose screen has not been built yet. */
export function DoctorScreenStub({ title }: { title: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[#EEF2FF]">
        <Lock className="h-6 w-6 text-[#3B4FE0]" />
      </span>
      <h1 className="mt-4 font-display text-xl font-bold text-[#0F172A]">{title}</h1>
      <p className="mt-2 text-sm text-[#64748B]">
        This screen is next in the Clinic OS rebuild. The navigation is wired so it drops straight in.
      </p>
    </div>
  );
}
