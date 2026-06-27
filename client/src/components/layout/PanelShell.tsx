import { Suspense, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../auth/context';
import { Brand } from './Brand';
import { BrandTile } from '../ui/BrandTile';
import { ThemeToggle } from '../ui/ThemeToggle';
import { usePanelMode } from '../../lib/panelTheme';
import { cn } from '../../lib/cn';
import { gsap, prefersReducedMotion } from '../../lib/gsap';

export interface PanelNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}

const navClass = (isActive: boolean) =>
  cn(
    'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
    isActive ? 'bg-[var(--primary)] font-semibold text-white shadow-sm' : 'font-medium text-slate-300 hover:bg-white/5 hover:text-white',
  );

function DesktopNav({ panelLabel, navItems }: { panelLabel: string; navItems: PanelNavItem[] }) {
  const { user, logout } = useAuth();
  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'M';
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-6">
        <Brand className="h-9 drop-shadow-md" />
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-200">
          {panelLabel}
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {navItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => navClass(isActive)}>
            {({ isActive }) => (
              <>
                <it.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200')} />
                {it.label}
                {it.badge ? (
                  <span className="ml-auto inline-grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[0.7rem] font-bold text-white">
                    {it.badge}
                  </span>
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--panel-sidebar-border)] p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <BrandTile className="h-9 w-9 shrink-0 rounded-full text-sm font-bold">{initial}</BrandTile>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
          <ThemeToggle />
        </div>
        <button
          onClick={() => void logout()}
          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

/** Sidebar shell for a role-specific panel (currently the doctor panel). */
export function PanelShell({ panelLabel, navItems }: { panelLabel: string; navItems: PanelNavItem[] }) {
  const { logout } = useAuth();
  const mode = usePanelMode();
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();

  // Keep the document background in sync with the panel theme (dark overscroll).
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = mode === 'dark' ? '#0b1120' : '#f8fafc';
    return () => {
      html.style.backgroundColor = prev;
    };
  }, [mode]);

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
      {/* top-[var(--imp-bar-h)] keeps the sidebar below the admin "viewing as" bar. */}
      <aside className="fixed bottom-0 left-0 top-[var(--imp-bar-h)] z-40 hidden w-64 border-r border-[var(--panel-sidebar-border)] bg-[var(--panel-sidebar)] lg:block">
        <DesktopNav panelLabel={panelLabel} navItems={navItems} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-[var(--imp-bar-h)] z-30 flex items-center gap-2 overflow-x-auto border-b border-stone-200 bg-[var(--surface-card)] px-4 py-3 backdrop-blur lg:hidden">
        <Brand className="h-7" />
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase text-emerald-700">{panelLabel}</span>
        <nav className="ml-auto flex items-center gap-1">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn('relative whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium', isActive ? 'bg-emerald-50 text-emerald-800' : 'text-stone-500')
              }
            >
              {it.label}
              {it.badge ? <span className="ml-1 inline-grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[0.65rem] font-bold text-white">{it.badge}</span> : null}
            </NavLink>
          ))}
          <ThemeToggle className="h-7 w-7 rounded-lg" />
          <button onClick={() => void logout()} aria-label="Sign out" className="grid h-7 w-7 place-items-center rounded-lg text-stone-500 hover:bg-stone-100">
            <LogOut className="h-4 w-4" />
          </button>
        </nav>
      </div>

      <div className="lg:pl-64">
        <main ref={mainRef} className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
          <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
