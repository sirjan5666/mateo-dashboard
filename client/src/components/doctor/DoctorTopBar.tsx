import { Search } from 'lucide-react';
import { useT } from '../../i18n/context';
import { Breadcrumbs } from './Breadcrumbs';
import { openCommand } from '../../lib/commandPalette';

const META = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘' : 'Ctrl';

/** Desktop top bar for the doctor panel: breadcrumbs + ⌘K search. */
export function DoctorTopBar() {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 lg:px-8">
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => openCommand()}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)] py-2 pl-2.5 pr-2 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden md:inline">{t('doctor.cmd.hint')}</span>
          <kbd className="hidden rounded-md border border-[var(--hairline)] bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono-ds text-[0.7rem] font-semibold md:inline">
            {META}K
          </kbd>
        </button>
      </div>
    </div>
  );
}
