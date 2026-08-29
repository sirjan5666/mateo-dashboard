import { Link } from 'react-router';
import { Award, BookText, ChevronRight, Gift, LogOut, MessagesSquare, Package, Settings as SettingsIcon, ShoppingBag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/context';
import { useT } from '../i18n/context';
import { BrandTile } from '../components/ui/BrandTile';
import { cn } from '../lib/cn';

interface Row {
  to: string;
  icon: LucideIcon;
  label: string;
  color?: string;
}

function LinkRow({ to, icon: Icon, label, color, onNavigate }: Row & { onNavigate?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex min-h-[52px] items-center gap-3.5 px-4 py-3 transition-colors hover:bg-[var(--surface-sunken)]"
    >
      <Icon className="h-5 w-5 shrink-0" style={{ color: color ?? 'var(--muted-foreground)' }} />
      <span className="flex-1 text-[15px] font-medium text-[var(--foreground)]">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
    </Link>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="eyebrow px-1 pb-1.5 pt-5">{title}</h2>
      <div className="divide-y divide-stone-200/70 overflow-hidden rounded-[22px] bg-[var(--surface-card)] shadow-soft ring-1 ring-stone-200/60">{children}</div>
    </section>
  );
}

/**
 * More tab — the parent app's secondary destinations, grouped. Reuses the exact
 * existing routes; nothing new is invented. Parent-only items are hidden for
 * other roles that share this shell.
 */
export default function More() {
  const { user, logout } = useAuth();
  const t = useT();
  const isParent = user?.role === 'parent';
  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'M';

  return (
    <div className="mx-auto max-w-[520px]">
      <header className="mb-2 flex items-center gap-3 px-1">
        <BrandTile className="h-12 w-12 rounded-full text-base font-bold">{initial}</BrandTile>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-[var(--foreground)]">{user?.name}</p>
          <p className="truncate text-sm text-[var(--muted-foreground)]">{user?.email}</p>
        </div>
      </header>

      {isParent && (
        <Section title="Your Mateo">
          <LinkRow to="/rewards" icon={Award} label={t('nav.rewards')} color="var(--sitare)" />
          <LinkRow to="/refer" icon={Gift} label={t('nav.refer')} />
          <LinkRow to="/report" icon={BookText} label={t('nav.report')} />
        </Section>
      )}

      <Section title="Shopping">
        <LinkRow to="/shop" icon={ShoppingBag} label={t('nav.shop')} />
        {isParent && <LinkRow to="/shop/orders" icon={Package} label={t('nav.myOrders')} />}
      </Section>

      <Section title="Community">
        <LinkRow to="/community" icon={MessagesSquare} label={t('nav.community')} />
      </Section>

      <Section title="Account">
        <LinkRow to="/settings" icon={SettingsIcon} label={t('nav.settings')} />
      </Section>

      <button
        type="button"
        onClick={() => void logout()}
        className={cn(
          'mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[22px] bg-[var(--surface-card)] font-semibold text-rose-600 shadow-soft ring-1 ring-stone-200/60 transition-colors hover:bg-rose-50',
        )}
      >
        <LogOut className="h-4.5 w-4.5" />
        {t('nav.signOut')}
      </button>
    </div>
  );
}
