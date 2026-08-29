import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { BottomSheet } from '../ui/BottomSheet';
import { avatarUrl } from '../../lib/avatars';
import { formatAge } from '../../lib/age';
import { useBabies } from '../../lib/useBabies';
import { cn } from '../../lib/cn';

/**
 * The baby-context control at the top of Home (and reusable on tracker headers).
 * Shows the selected baby's avatar, name and age; tapping opens a bottom sheet
 * to switch baby, or add a new one. Replaces the desktop pill-row / dropdown.
 */
export function BabySwitcherButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { babies, activeBaby, activeBabyId, selectBaby } = useBabies();

  // No baby yet → a clear call to add one.
  if (!activeBaby) {
    return (
      <button
        type="button"
        onClick={() => navigate('/babies/new')}
        className={cn(
          'flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--brand-purple-tint)] px-4 py-2 text-sm font-semibold text-[var(--brand-purple-deep)]',
          className,
        )}
      >
        <Plus className="h-4 w-4" />
        Add your baby
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex min-h-[44px] items-center gap-2.5 rounded-full bg-[var(--surface-card)] py-1.5 pl-1.5 pr-3 shadow-soft ring-1 ring-stone-200/70 transition-transform active:scale-[0.98]',
          className,
        )}
      >
        <Avatar name={activeBaby.name} src={avatarUrl(activeBaby.avatar)} size={compact ? 'sm' : 'md'} />
        <span className="min-w-0 text-left">
          <span className="block truncate font-display text-[15px] font-semibold leading-tight text-[var(--foreground)]">
            {activeBaby.name}
          </span>
          {!compact && <span className="block truncate text-xs text-[var(--muted-foreground)]">{formatAge(activeBaby.dob)}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Your babies" description="Switch who you're tracking">
        <ul className="space-y-2">
          {babies.map((b) => {
            const active = b.id === activeBabyId;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectBaby(b.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
                    active ? 'bg-[var(--brand-purple-tint)]' : 'hover:bg-[var(--surface-sunken)]',
                  )}
                >
                  <Avatar name={b.name} src={avatarUrl(b.avatar)} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[15px] font-semibold text-[var(--foreground)]">{b.name}</span>
                    <span className="block truncate text-xs text-[var(--muted-foreground)]">{formatAge(b.dob)}</span>
                  </span>
                  {active && <Check className="h-5 w-5 shrink-0 text-[var(--brand-purple-deep)]" />}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate('/babies/new');
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-dashed border-stone-300 px-3 py-3 text-left text-[var(--brand-purple-deep)] transition-colors hover:bg-[var(--surface-sunken)]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--brand-purple-tint)]">
            <Plus className="h-5 w-5" />
          </span>
          <span className="font-semibold">Add another baby</span>
        </button>
      </BottomSheet>
    </>
  );
}
