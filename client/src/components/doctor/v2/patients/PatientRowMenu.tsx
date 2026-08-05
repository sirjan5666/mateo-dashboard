import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { BarChart3, ExternalLink, IdCard, Monitor, MoreVertical, Pencil, Syringe, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Patient } from '../../../../data/patients';
import { cn } from '../../../../lib/cn';

interface MenuEntry {
  label: string;
  icon: LucideIcon;
  external?: boolean;
  tone?: 'default' | 'danger';
  dividerBefore?: boolean;
}

/**
 * Item 6 reads "More Options" but carries a destructive icon and colour in the
 * reference. Reproduced as specified; `tone` is a prop so the label or the
 * styling can be corrected later without touching this component.
 */
const ENTRIES: MenuEntry[] = [
  { label: 'View Patient Workspace', icon: Monitor },
  { label: 'Vaccination Records', icon: Syringe, external: true },
  { label: 'Growth Chart', icon: BarChart3, external: true },
  { label: 'Edit Patient', icon: Pencil, dividerBefore: true },
  { label: 'Download ID Card', icon: IdCard },
  { label: 'More Options', icon: Trash2, tone: 'danger', dividerBefore: true },
];

export function PatientRowMenu({
  patient,
  sheetOnMobile = false,
  onOpenVaccination,
  onOpenGrowth,
}: {
  patient: Patient;
  sheetOnMobile?: boolean;
  onOpenVaccination?: () => void;
  onOpenGrowth?: () => void;
}) {
  const patientName = patient.name;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const move = (dir: 1 | -1 | 'first' | 'last') => {
    const idx = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    const last = ENTRIES.length - 1;
    const next =
      dir === 'first' ? 0 : dir === 'last' ? last : Math.max(0, Math.min(last, (idx < 0 ? 0 : idx) + dir));
    itemRefs.current[next]?.focus();
  };

  return (
    <div ref={rootRef} className="relative flex justify-end">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Actions for ${patientName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'grid h-[34px] w-[34px] place-items-center rounded-[9px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2',
          open ? 'border-[1.5px] border-[#6366F1] bg-white' : 'border-transparent hover:bg-[#F1F3F9]',
        )}
      >
        <MoreVertical className="h-[18px] w-[18px] text-[#64748B]" />
      </button>

      {open && (
        <>
          {sheetOnMobile && (
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-[rgba(15,23,42,.35)] md:hidden"
            />
          )}
          <div
            role="menu"
            aria-label={`Actions for ${patientName}`}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
              else if (e.key === 'Home') { e.preventDefault(); move('first'); }
              else if (e.key === 'End') { e.preventDefault(); move('last'); }
            }}
            className={cn(
              'z-50 border border-[#ECEEF4] bg-white py-2 shadow-[0_18px_42px_-14px_rgba(15,23,42,.30),0_4px_12px_-6px_rgba(15,23,42,.10)]',
              'motion-safe:animate-[menuIn_150ms_cubic-bezier(.16,1,.3,1)]',
              sheetOnMobile
                ? 'fixed inset-x-0 bottom-0 rounded-t-[18px] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-[calc(100%+6px)] md:w-[218px] md:rounded-[12px]'
                : 'absolute right-0 top-[calc(100%+6px)] w-[218px] rounded-[12px]',
            )}
          >
            {ENTRIES.map((e, i) => (
              <div key={e.label}>
                {e.dividerBefore && <div className="my-1.5 h-px bg-[#F1F3F9]" />}
                <button
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  autoFocus={i === 0}
                  onClick={() => {
                    if (e.label === 'Vaccination Records' && onOpenVaccination) onOpenVaccination();
                    else if (e.label === 'Growth Chart' && onOpenGrowth) onOpenGrowth();
                    else if (e.label === 'View Patient Workspace') navigate(`/doctor/patients/${patient.id}`);
                    else if (e.label === 'Edit Patient') navigate('/doctor/patients/new');
                    else console.log('[Clinic OS]', e.label, patientName);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={cn(
                    'flex h-[42px] w-full items-center gap-[13px] px-4 text-left transition-colors focus-visible:outline-none focus-visible:bg-[#F5F7FF]',
                    e.tone === 'danger' ? 'hover:bg-[#FEF2F2]' : 'hover:bg-[#F5F7FF]',
                  )}
                >
                  <e.icon className={cn('h-[17px] w-[17px] shrink-0', e.tone === 'danger' ? 'text-[#EF4444]' : 'text-[#334155]')} />
                  <span className={cn('text-[13.5px]', e.tone === 'danger' ? 'font-semibold text-[#EF4444]' : 'font-medium text-[#1E2A5A]')}>
                    {e.label}
                  </span>
                  {e.tone === 'danger' && <span className="sr-only">destructive action</span>}
                  {e.external && <ExternalLink className="ml-auto h-[15px] w-[15px] shrink-0 text-[#334155]" />}
                  {e.external && <span className="sr-only">opens in a new view</span>}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
