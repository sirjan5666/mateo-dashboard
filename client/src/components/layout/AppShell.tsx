import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AssistantLauncher } from '../assistant/AssistantLauncher';
import { useAuth } from '../../auth/context';
import { usePanelMode } from '../../lib/panelTheme';
import { cn } from '../../lib/cn';
import { gsap, prefersReducedMotion } from '../../lib/gsap';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem('mateo:sidebarCollapsed') === '1';
  } catch {
    return false;
  }
}

export function AppShell() {
  // The admin uses this same shell as parents, but on the professional
  // sky-blue/slate panel theme (with light/dark). Parents stay on the playful
  // theme — the [data-theme="pro"] scope only re-skins this subtree.
  const { user } = useAuth();
  const pro = user?.role === 'admin';
  const mode = usePanelMode();
  const [open, setOpen] = useState(false);

  // Match the document background to the panel theme so overscroll / short pages
  // never reveal the (light) base canvas behind the themed wrapper.
  useEffect(() => {
    if (!pro) return;
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = mode === 'dark' ? '#0d1420' : '#eef3f9';
    return () => {
      html.style.backgroundColor = prev;
    };
  }, [pro, mode]);
  // Desktop sidebar collapse (persisted). On mobile the drawer is used instead.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem('mateo:sidebarCollapsed', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const drawerRef = useRef<HTMLElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  // Admin data-table routes use the full content width (no centered max-width).
  const wideContent =
    location.pathname === '/parents' ||
    location.pathname === '/doctors' ||
    location.pathname === '/chats' ||
    location.pathname === '/shop/admin/orders' ||
    location.pathname.startsWith('/find-doctor');

  // Gentle page-transition: fade + rise the main content on every route change.
  // The cleanup clears props so the next navigation always starts from a clean
  // natural state (never stranded at opacity:0).
  useEffect(() => {
    const main = mainRef.current;
    if (!main || prefersReducedMotion()) return;
    const tween = gsap.fromTo(
      main,
      { opacity: 0, y: 10 },
      // immediateRender:false → a StrictMode-discarded tween never applies the
      // opacity:0 start before it's killed, so main can never strand invisible.
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out',
        overwrite: 'auto',
        immediateRender: false,
        // Once settled, drop the transform so <main> stops being a containing
        // block for position:fixed descendants (modals pin to the viewport, not
        // the sidebar-offset content area).
        onComplete: () => gsap.set(main, { clearProps: 'transform' }),
      },
    );
    return () => {
      tween.kill();
      gsap.set(main, { clearProps: 'opacity,transform' });
    };
  }, [location.pathname]);

  // Gate the off-screen drawer's focusability and manage focus in/out.
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    drawer.inert = !open;
    if (open) {
      lastFocused.current = document.activeElement as HTMLElement | null;
      drawer.querySelector<HTMLElement>('a, button')?.focus();
    } else {
      lastFocused.current?.focus?.();
    }
  }, [open]);

  // Escape to close + trap Tab within the open drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const items = drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div
      data-theme={pro ? 'pro' : undefined}
      data-mode={pro ? mode : undefined}
      className="min-h-screen bg-stone-50 pt-[var(--imp-bar-h)]"
    >
      {/* Fixed sidebar — desktop. Collapses to a slim icon rail (not hidden).
          top-[var(--imp-bar-h)] keeps it below the admin "viewing as" bar. */}
      <aside className={cn('fixed bottom-0 left-0 top-[var(--imp-bar-h)] z-40 hidden border-r border-stone-200/70 bg-[var(--surface-card)] lg:block', collapsed ? 'lg:w-16' : 'lg:w-64')}>
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {/* Slide-over drawer — mobile */}
      <div className={cn('fixed inset-0 z-50 lg:hidden', open ? '' : 'pointer-events-none')}>
        <div
          className={cn('absolute inset-0 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
          style={{ backgroundColor: 'rgba(10, 16, 26, 0.5)' }}
          onClick={() => setOpen(false)}
        />
        <aside
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={cn(
            'absolute bottom-0 left-0 top-[var(--imp-bar-h)] w-72 max-w-[82%] bg-[var(--surface-card)] shadow-lift transition-transform duration-300 ease-out',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar onNavigate={() => setOpen(false)} />
        </aside>
      </div>

      <div className={cn(collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <Topbar onOpenSidebar={() => setOpen(true)} />
        {/* Admin list pages (data tables) span the full width like a back-office
            console; reading-oriented pages stay centered for comfortable line length. */}
        <main ref={mainRef} className={cn('mx-auto px-4 py-8 lg:px-8', wideContent ? 'max-w-none' : 'max-w-6xl')}>
          <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Tara — the floating AI assistant, on every page */}
      <AssistantLauncher />
    </div>
  );
}
