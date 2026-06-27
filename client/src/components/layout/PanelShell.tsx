import { Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu } from 'lucide-react';
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

const navClass = (isActive: boolean) =>
  cn(
    'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
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
function SidebarNav({ panelLabel, navItems, onNavigate }: { panelLabel: string; navItems: PanelNavItem[]; onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const t = useT();
  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'M';
  const groups = groupNav(navItems);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-6">
        <Brand className="h-9" />
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-stone-500">{panelLabel}</span>
      </div>

      <nav data-lenis-prevent className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {groups.map((g, gi) => (
          <div key={g.section ?? `g${gi}`}>
            {g.section && (
              <p className={cn('px-3 pb-1 text-[0.65rem] font-bold uppercase tracking-wider text-stone-400', gi === 0 ? 'pt-1' : 'pt-4')}>{t(g.section)}</p>
            )}
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end} onClick={onNavigate} className={({ isActive }) => navClass(isActive)}>
                {({ isActive }) => (
                  <>
                    <it.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-white' : 'text-stone-400 group-hover:text-stone-600')} />
                    {t(it.label)}
                    {it.badge ? (
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

  // Keep the document background light (for overscroll).
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = '#f8fafc';
    return () => {
      html.style.backgroundColor = prev;
    };
  }, []);

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
    <div data-theme="pro" data-mode={mode} className="min-h-screen bg-stone-50 pt-[var(--imp-bar-h)]">
      {/* Desktop sidebar (white) */}
      <aside className="fixed bottom-0 left-0 top-[var(--imp-bar-h)] z-40 hidden w-64 border-r border-[var(--hairline)] bg-[var(--surface-card)] lg:block">
        <SidebarNav panelLabel={panelLabel} navItems={navItems} />
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

      <div className="lg:pl-64">
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
