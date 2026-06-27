import { Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/cn';
import { togglePanelMode, usePanelMode } from '../../lib/panelTheme';

/**
 * Light/dark switch for the professional panels. Surface vars (not literal
 * bg-white) so it themes correctly in dark mode.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const mode = usePanelMode();
  const dark = mode === 'dark';
  return (
    <button
      type="button"
      onClick={togglePanelMode}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900',
        className,
      )}
      style={{ borderColor: 'var(--hairline)', backgroundColor: 'var(--surface-raised)' }}
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
