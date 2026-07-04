import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CornerDownLeft,
  CreditCard,
  MessageSquare,
  Search,
  Stethoscope,
  UserCog,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '../../i18n/context';
import { cn } from '../../lib/cn';
import { usePanelMode } from '../../lib/panelTheme';
import { closeCommand, openCommand, useCommandOpen } from '../../lib/commandPalette';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { Avatar } from '../ui/Avatar';

type Group = 'action' | 'page' | 'patient';

interface Cmd {
  id: string;
  label: string;
  sub?: string;
  group: Group;
  icon: LucideIcon;
  patientName?: string;
  run: () => void;
}

const ACTIONS: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'doctor.quickAdd.patient', to: '/doctor/patients', icon: Users },
  { label: 'doctor.quickAdd.invoice', to: '/doctor/billing', icon: CreditCard },
];

// The clinical tools moved inside each patient (PatientDetail → Tools), so they
// are no longer standalone destinations here.
const PAGES: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'doctor.nav.home', to: '/doctor', icon: Stethoscope },
  { label: 'doctor.nav.patients', to: '/doctor/patients', icon: Users },
  { label: 'doctor.nav.schedule', to: '/doctor/schedule', icon: CalendarDays },
  { label: 'doctor.nav.messages', to: '/doctor/messages', icon: MessageSquare },
  { label: 'doctor.nav.consultations', to: '/doctor/appointments', icon: CalendarClock },
  { label: 'doctor.nav.analytics', to: '/doctor/analytics', icon: BarChart3 },
  { label: 'doctor.nav.billing', to: '/doctor/billing', icon: CreditCard },
  { label: 'doctor.nav.profile', to: '/doctor/profile', icon: UserCog },
];

/** ⌘K / Ctrl-K command palette: jump to any patient, page or action. */
export function CommandPalette() {
  const open = useCommandOpen();
  const t = useT();
  const navigate = useNavigate();
  const mode = usePanelMode();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Global keyboard shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openCommand();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lazy-load patients the first time the palette opens. (Query/selection reset
  // happens on dismiss/select — see `dismiss` — to avoid set-state-in-effect.)
  useEffect(() => {
    if (open && patients === null) {
      listPatients()
        .then((d) => setPatients(d.patients))
        .catch(() => setPatients([]));
    }
  }, [open, patients]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const commands: Cmd[] = useMemo(() => {
    const go = (to: string) => () => {
      setQuery('');
      setActive(0);
      closeCommand();
      navigate(to);
    };
    const list: Cmd[] = [];
    for (const a of ACTIONS) list.push({ id: `a:${a.to}:${a.label}`, label: t(a.label), group: 'action', icon: a.icon, run: go(a.to) });
    for (const p of PAGES) list.push({ id: `p:${p.to}`, label: t(p.label), group: 'page', icon: p.icon, run: go(p.to) });
    for (const pt of (patients ?? []).filter((x) => !x.archivedAt)) {
      list.push({
        id: `pt:${pt.id}`,
        label: pt.displayName,
        sub: t('doctor.cmd.openChart'),
        group: 'patient',
        icon: Users,
        patientName: pt.displayName,
        run: go(`/doctor/patients/${pt.id}`),
      });
    }
    return list;
  }, [t, patients, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.sub?.toLowerCase().includes(q));
  }, [commands, query]);

  const dismiss = () => {
    setQuery('');
    setActive(0);
    closeCommand();
  };

  if (!open) return null;

  const groupLabel: Record<Group, string> = {
    action: t('doctor.cmd.actions'),
    page: t('doctor.cmd.pages'),
    patient: t('doctor.cmd.patients'),
  };

  return createPortal(
    <div data-theme="pro" data-mode={mode}>
      <div
        className="fixed inset-0 z-[85] flex items-start justify-center p-4 pt-[12vh]"
        role="dialog"
        aria-modal="true"
        aria-label={t('doctor.cmd.search')}
      >
        <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-stone-900/50" onClick={dismiss} />
        <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-card)] shadow-lift">
          <div className="flex items-center gap-2.5 border-b border-[var(--hairline)] px-4">
            <Search className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, filtered.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  filtered[active]?.run();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  dismiss();
                }
              }}
              placeholder={t('doctor.cmd.placeholder')}
              aria-label={t('doctor.cmd.search')}
              className="w-full bg-transparent py-3.5 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[var(--muted-foreground)]">{t('doctor.cmd.empty')}</p>
          ) : (
            <div role="listbox" data-lenis-prevent className="max-h-[52vh] overflow-y-auto p-2">
              {filtered.map((c, i) => {
                const showHeader = i === 0 || filtered[i - 1].group !== c.group;
                const isActive = i === active;
                return (
                  <div key={c.id}>
                    {showHeader && (
                      <p className="px-2 pb-1 pt-3 text-[0.65rem] font-bold uppercase tracking-wider text-[var(--muted-foreground)] first:pt-1">
                        {groupLabel[c.group]}
                      </p>
                    )}
                    <button
                      ref={isActive ? activeRef : undefined}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => setActive(i)}
                      onClick={() => c.run()}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                        isActive ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : 'text-[var(--foreground)]',
                      )}
                    >
                      {c.group === 'patient' ? (
                        <Avatar name={c.patientName ?? c.label} size="xs" hashColor />
                      ) : (
                        <c.icon className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
                      )}
                      <span className="flex-1 truncate font-medium">{c.label}</span>
                      {c.sub && <span className="shrink-0 truncate text-xs text-[var(--muted-foreground)]">{c.sub}</span>}
                      {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
