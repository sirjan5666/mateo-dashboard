import { Link } from 'react-router';
import { CalendarClock, ChevronRight, Stethoscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '../i18n/context';

/**
 * Care tab — the parent's doctor + consultation entry points (both free).
 * Wraps the existing FindDoctor and MyConsultations flows behind a simple
 * mobile landing.
 */
function CareCard({ to, icon: Icon, title, description, accent }: { to: string; icon: LucideIcon; title: string; description: string; accent: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-[26px] bg-[var(--surface-card)] p-4 shadow-soft ring-1 ring-stone-200/60 transition-transform active:scale-[0.99]"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${accent}1a`, color: accent }}>
        <Icon className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-semibold text-[var(--foreground)]">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-[var(--muted-foreground)]">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-stone-400" />
    </Link>
  );
}

export default function Care() {
  const t = useT();
  return (
    <div className="mx-auto max-w-[520px]">
      <header className="mb-4">
        <h1 className="font-display text-2xl font-semibold text-[var(--foreground)]">{t('nav.care')}</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Talk to a paediatrician when you need to.</p>
      </header>
      <div className="space-y-3">
        <CareCard to="/find-doctor" icon={Stethoscope} title={t('nav.findDoctor')} description="Browse verified doctors and book a consultation." accent="#7c5cfc" />
        <CareCard to="/consultations" icon={CalendarClock} title={t('nav.consultations')} description="Your upcoming and past appointments, chats and prescriptions." accent="#25c281" />
      </div>
    </div>
  );
}
