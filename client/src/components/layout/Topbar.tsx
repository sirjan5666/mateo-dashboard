import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { CalendarDays, Menu, Plus } from 'lucide-react';
import { Brand } from './Brand';
import { buttonClass } from '../ui/buttonStyles';
import { useT } from '../../i18n/context';
import { useAuth } from '../../auth/context';
import { todayLongIST } from '../../lib/age';
import { gsap, prefersReducedMotion } from '../../lib/gsap';
import { CartButton } from '../shop/CartButton';
import { AdminBell } from '../shop/AdminBell';

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const t = useT();
  const { user } = useAuth();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const tween = gsap.fromTo(el, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', overwrite: 'auto', immediateRender: false });
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: 'opacity,transform' });
    };
  }, []);
  return (
    <header ref={ref} className="sticky top-[var(--imp-bar-h)] z-30 flex h-16 items-center gap-3 border-b border-stone-200/70 bg-stone-50/80 px-4 backdrop-blur-md lg:px-8">
      <button
        onClick={onOpenSidebar}
        aria-label="Open menu"
        className="grid h-9 w-9 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="lg:hidden">
        <Brand compact />
      </div>

      <div className="hidden items-center gap-2 text-sm font-medium text-stone-500 lg:flex">
        <CalendarDays className="h-4 w-4 text-stone-500" />
        {todayLongIST()}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <CartButton />
        {user?.role === 'admin' && <AdminBell />}
        <Link to="/babies/new" className={buttonClass('primary', 'sm')}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('topbar.addBaby')}</span>
        </Link>
      </div>
    </header>
  );
}
