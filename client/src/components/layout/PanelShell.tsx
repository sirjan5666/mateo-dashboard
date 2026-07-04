import { Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../../auth/context';
import { useT } from '../../i18n/context';
import { Brand } from './Brand';
import { BrandTile } from '../ui/BrandTile';
import { Toaster } from '../ui/Toaster';
import { usePanelMode } from '../../lib/panelTheme';
import { cn } from '../../lib/cn';
import { gsap, prefersReducedMotion } from '../../lib/gsap';

export interface PanelNavItem {
  to: string;
  /** i18n key (resolved with t(); falls back to the raw string). */
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
  /** Optional i18n key for a section heading; consecutive same-section items group together. */
  section?: string;
}

const COLLAPSE_KEY = 'mateo:panel-collapsed';

const navClass = (isActive: boolean, collapsed: boolean) =>
  cn(
    'group relative flex items-center rounded-xl text-sm transition-colors',
    collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
    isActive ? 'bg-[var(--primary)] font-semibold text-white shadow-sm' : 'font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  );

interface NavGroup {
  section?: string;
  items: PanelNavItem[];
}

function groupNav(items: PanelNavItem[]): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === it.section) last.items.push(it);
    else groups.push({ section: it.section, items: [it] });
  }
  return groups;
}

/** The sidebar contents — shared by the fixed desktop rail and the mobile drawer. */
function SidebarNav({
  panelLabel,
  navItems,
  collapsed = false,
  onNavigate,
  onToggleCollapse,
}: {
  panelLabel: string;
  navItems: PanelNavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  const { user, logout } = useAuth();
  const t = useT();
  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'M';
  const groups = groupNav(navItems);

  return (
    <div className="flex h-full flex-col">
      {collapsed ? (
        <div className="flex flex-col items-center gap-3 px-2 py-6">
          <BrandTile className="h-9 w-9 rounded-xl text-sm font-bold">M</BrandTile>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              title="Expand"
              className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              <PanelLeftOpen className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-5 py-6">
          <Brand className="h-9" />
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-stone-500">{panelLabel}</span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              title="Collapse"
              className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              <PanelLeftClose className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      )}

      <nav data-lenis-prevent className={cn('scrollbar-thin flex-1 space-y-0.5 overflow-y-auto pb-4', collapsed ? 'px-2' : 'px-3')}>
        {groups.map((g, gi) => (
          <div key={g.section ?? `g${gi}`}>
            {g.section &&
              (collapsed ? (
                gi > 0 && <div className="mx-2 my-2 border-t border-[var(--hairline)]" />
              ) : (
                <p className={cn('px-3 pb-1 text-[0.65rem] font-bold uppercase tracking-wider text-stone-400', gi === 0 ? 'pt-1' : 'pt-4')}>{t(g.section)}</p>
              ))}
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                onClick={onNavigate}
                title={collapsed ? t(it.label) : undefined}
                className={({ isActive }) => navClass(isActive, collapsed)}
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <it.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-white' : 'text-stone-400 group-hover:text-stone-600')} />
                      {collapsed && it.badge ? (
                        <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[var(--surface-card)]" />
                      ) : null}
                    </span>
                    {!collapsed && t(it.label)}
                    {!collapsed && it.badge ? (
                      <span className="ml-auto inline-grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[0.7rem] font-bold text-white">{it.badge}</span>
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--hairline)] p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <BrandTile className="h-9 w-9 rounded-full text-sm font-bold">{initial}</BrandTile>
            <button
              onClick={() => {
                onNavigate?.();
                void logout();
              }}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 place-items-center rounded-xl text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <BrandTile className="h-9 w-9 shrink-0 rounded-full text-sm font-bold">{initial}</BrandTile>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">{user?.name}</p>
                <p className="truncate text-xs text-stone-500">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => {
                onNavigate?.();
                void logout();
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Sidebar shell for a role-specific panel (doctor / patient). */
export function PanelShell({
  panelLabel,
  navItems,
  topBar,
  globals,
}: {
  panelLabel: string;
  navItems: PanelNavItem[];
  /** Optional sticky desktop top bar (breadcrumbs / search / quick-add). */
  topBar?: ReactNode;
  /** Optional always-mounted overlays (e.g. the command palette). */
  globals?: ReactNode;
}) {
  const mode = usePanelMode();
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Lock body scroll + Escape-to-close while the mobile drawer is open.
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

  // Keep the document background light (for overscroll). The <html> element sits
  // outside the [data-panel] scoped subtree, so use a literal that matches this
  // panel's canvas rather than the scoped --surface-app var.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = panelLabel.toLowerCase() === 'doctor' ? '#f9fafb' : '#f8fafc';
    return () => {
      html.style.backgroundColor = prev;
    };
  }, [panelLabel]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main || prefersReducedMotion()) return;
    const tween = gsap.fromTo(
      main,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', overwrite: 'auto', immediateRender: false },
    );
    return () => {
      tween.kill();
      gsap.set(main, { clearProps: 'opacity,transform' });
    };
  }, [location.pathname]);

  return (
    <div data-theme="pro" data-mode={mode} data-panel={panelLabel.toLowerCase()} className="min-h-screen bg-[var(--surface-app)] pt-[var(--imp-bar-h)]">
      {/* Desktop sidebar (collapsible) */}
      <aside
        className={cn(
          'fixed bottom-0 left-0 top-[var(--imp-bar-h)] z-40 hidden border-r border-[var(--hairline)] bg-[var(--surface-card)] transition-[width] duration-200 lg:block',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <SidebarNav panelLabel={panelLabel} navItems={navItems} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {/* Mobile top bar with hamburger */}
      <div className="sticky top-[var(--imp-bar-h)] z-30 flex items-center gap-3 border-b border-[var(--hairline)] bg-[var(--surface-card)] px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={navOpen}
          className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--hairline)] text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Brand className="h-7" />
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-stone-500">{panelLabel}</span>
      </div>

      {/* Mobile drawer — the full sidebar (mounted only while open). */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 cursor-default bg-stone-900/50" onClick={() => setNavOpen(false)} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`${panelLabel} menu`}
            className="absolute bottom-0 left-0 top-[var(--imp-bar-h)] w-72 max-w-[85vw] border-r border-[var(--hairline)] bg-[var(--surface-card)] shadow-lift"
          >
            <SidebarNav panelLabel={panelLabel} navItems={navItems} onNavigate={() => setNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-20' : 'lg:pl-64')}>
        {topBar && (
          <div className="sticky top-[var(--imp-bar-h)] z-20 hidden border-b border-[var(--hairline)] bg-[color-mix(in_srgb,var(--surface-card)_85%,transparent)] backdrop-blur lg:block">
            {topBar}
          </div>
        )}
        <main ref={mainRef} className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
          <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <Toaster />
      {globals}
    </div>
  );
}
