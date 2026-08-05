import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useActiveLocation } from '../../../lib/doctorLocation';
import { cn } from '../../../lib/cn';
import { SwitchLocationModal } from './SwitchLocationModal';

/** Multi-hue dot for "All Locations"; a solid hue dot for a single clinic. */
function LocationDot({ hue, overall, size = 8 }: { hue: string; overall?: boolean; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: overall ? 'conic-gradient(from 180deg, #4F63F5, #8B5CF6, #F59E0B, #4F63F5)' : hue,
      }}
    />
  );
}

/**
 * The signature control of the doctor panel. The pill opens the Switch Location
 * modal; choosing a clinic there re-scopes every page and persists the choice.
 */
export function LocationSwitcher({ railCollapsed = false }: { railCollapsed?: boolean }) {
  const { activeId, active } = useActiveLocation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-10 w-full items-center gap-2.5 rounded-[10px] bg-white px-3 transition-[background-color,border-color,box-shadow] duration-[180ms] sm:px-3.5 lg:w-auto',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2',
          open
            ? 'border-[1.5px] border-[#3B4FE0] shadow-[0_0_0_3px_rgba(59,79,224,.12)]'
            : 'border border-[#E2E6F0] hover:bg-[#F7F8FC]',
        )}
      >
        <LocationDot hue={active.hue} overall={activeId === 'overall'} />
        <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[#0F172A] lg:max-w-[190px] lg:flex-none">
          {active.name}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-[#94A3B8] transition-transform duration-[180ms]', open && 'rotate-180')}
        />
      </button>

      {open && <SwitchLocationModal onClose={() => setOpen(false)} railCollapsed={railCollapsed} triggerRef={triggerRef} />}
    </>
  );
}
