import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Calculator, CreditCard, Plus, Syringe, TrendingUp, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '../../i18n/context';

// Phase 1: a launcher to the create surfaces. Later phases open these as
// in-context drawers pre-scoped to the current patient.
const ITEMS: { key: string; icon: LucideIcon; to: string }[] = [
  { key: 'doctor.quickAdd.patient', icon: UserPlus, to: '/doctor/patients' },
  { key: 'doctor.quickAdd.growth', icon: TrendingUp, to: '/doctor/growth' },
  { key: 'doctor.quickAdd.dose', icon: Calculator, to: '/doctor/dose' },
  { key: 'doctor.quickAdd.vaccines', icon: Syringe, to: '/doctor/vaccines' },
  { key: 'doctor.quickAdd.invoice', icon: CreditCard, to: '/doctor/billing' },
];

export function QuickAdd() {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">{t('doctor.quickAdd')}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-52 rounded-xl border border-[var(--hairline)] bg-[var(--surface-card)] p-1.5 shadow-lift"
        >
          {ITEMS.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate(it.to);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-sunken)]"
            >
              <it.icon className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              {t(it.key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
