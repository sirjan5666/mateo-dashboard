import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Check, Plus, Settings, X } from 'lucide-react';
import { useActiveLocation } from '../../../lib/doctorLocation';
import type { ClinicLocation, LocationId } from '../../../lib/doctorLocation';
import { cn } from '../../../lib/cn';
import { LocationDetail } from './LocationDetail';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// ── list row ─────────────────────────────────────────────────────────────────

function LocationListItem({
  location,
  selected,
  focused,
  autoFocus,
  onSelect,
  registerRef,
}: {
  location: ClinicLocation;
  selected: boolean;
  focused: boolean;
  autoFocus: boolean;
  onSelect: () => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  const isOverall = location.id === 'overall';

  return (
    <button
      ref={registerRef}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={focused ? 0 : -1}
      // React applies autoFocus once, on mount. A requestAnimationFrame here is
      // unreliable: StrictMode's double-mount cancels the first frame, and the
      // trigger button keeps focus if the second lands before refs re-attach.
      autoFocus={autoFocus}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3.5 rounded-[12px] p-3 text-left transition-colors duration-[180ms]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-1',
        selected ? 'border-[1.5px] border-[#6366F1] bg-[#F5F5FF]' : 'border-[1.5px] border-transparent hover:bg-[#F7F8FC]',
      )}
    >
      {/* Avatar */}
      {isOverall ? (
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
          style={{ background: 'conic-gradient(from 180deg, #EDE9FE, #D7F5EE, #FDE8CF, #FCDCE4, #D6E6FB, #EDE9FE)' }}
        >
          <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-white/85">
            <Building2 className="h-[18px] w-[18px] text-[#4F63F5]" />
          </span>
        </span>
      ) : (
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: location.tint }}>
          <Building2 className="h-[22px] w-[22px]" style={{ color: location.hue }} />
        </span>
      )}

      {/* Text */}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-bold leading-tight text-[#0F172A]">{location.name}</span>
          {selected && (
            <span aria-hidden="true" className="rounded-[6px] bg-[#D9F7EC] px-[9px] py-1 text-[10.5px] font-bold text-[#0E9F6E]">
              Current Location
            </span>
          )}
        </span>
        <span className="mt-1 block truncate text-[13px] font-normal text-[#64748B]">{location.addressLine}</span>
        <span className="mt-0.5 block truncate text-[13px] font-medium text-[#334155]">{location.cityLine}</span>
      </span>

      {/* Check */}
      {selected && (
        <span aria-hidden="true" className="mt-3 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#3B4FE0]">
          <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}

// ── modal ────────────────────────────────────────────────────────────────────

/**
 * Mounted only while open (see LocationSwitcher), so the initial preview row and
 * focus index are seeded from `useState` initialisers rather than synced by an
 * effect — no cascading render on open.
 */
export function SwitchLocationModal({
  onClose,
  railCollapsed,
  triggerRef,
}: {
  onClose: () => void;
  railCollapsed: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { activeId, setActiveId, locations } = useActiveLocation();
  // Preview selection: the detail pane follows the highlighted row immediately.
  const [previewId, setPreviewId] = useState<LocationId>(activeId);
  const [focusIndex, setFocusIndex] = useState(() => Math.max(0, locations.findIndex((l) => l.id === activeId)));
  const dialogRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Captured once so autoFocus targets the row that was active when the modal
  // opened, and never jumps as the preview selection moves.
  const [initialId] = useState(activeId);

  const close = useCallback(() => {
    onClose();
    triggerRef.current?.focus();
  }, [onClose, triggerRef]);

  // Escape, body scroll lock, and a Tab focus trap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes?.length) return;
      const list = [...nodes].filter((n) => n.tabIndex !== -1);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const move = (delta: number) => {
    const next = (focusIndex + delta + locations.length) % locations.length;
    setFocusIndex(next);
    setPreviewId(locations[next].id);
    rowRefs.current[next]?.focus();
  };

  const commit = (id: LocationId) => {
    setActiveId(id);
    setPreviewId(id);
    close();
  };

  const preview = locations.find((l) => l.id === previewId) ?? locations[0];

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-[60] motion-safe:animate-[fadeIn_160ms_ease-out]"
      style={{ background: 'rgba(15,23,42,0.18)', backdropFilter: 'blur(1.5px)' }}
      onClick={close}
    >
      <div
        className={cn(
          'flex h-full justify-center',
          // Below md the sheet sits at the bottom; above it, top-anchored at 88px.
          'items-end md:items-start md:px-6 md:pt-[88px]',
          railCollapsed ? 'lg:pl-[76px]' : 'lg:pl-[234px]',
        )}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-location-title"
          aria-describedby="switch-location-desc"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            // min-w-0 lets the sheet shrink to the viewport: as a flex item its
            // default min-width:auto would otherwise hold it at content width.
            'flex w-full min-w-0 flex-col overflow-hidden bg-white',
            'h-[92vh] rounded-t-[20px] md:h-auto md:max-h-[640px] md:w-[862px] md:rounded-[16px]',
            'shadow-[0_24px_64px_-12px_rgba(15,23,42,.28),0_8px_24px_-8px_rgba(15,23,42,.12)]',
            'motion-safe:animate-[modalIn_200ms_cubic-bezier(.16,1,.3,1)]',
          )}
        >
          {/* Mobile grab handle */}
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-[#D9DFEC] md:hidden" />

          {/* Header */}
          <div className="flex shrink-0 items-start gap-4 border-b border-[#ECEEF4] px-5 pb-5 pt-5 sm:px-[26px] sm:pt-6">
            <div className="min-w-0 flex-1">
              <h2 id="switch-location-title" className="font-display text-[21px] font-bold leading-tight tracking-[-0.02em] text-[#0F172A]">
                Switch Location
              </h2>
              <p id="switch-location-desc" className="mt-1.5 text-[13.5px] text-[#64748B]">
                All your data and activities will update based on the selected clinic.
              </p>
            </div>

            <button
              type="button"
              aria-label="Manage locations"
              onClick={() => console.log('[Clinic OS] Manage Locations')}
              className="hidden h-11 shrink-0 items-center gap-2.5 rounded-[10px] border border-[#E2E6F0] bg-white px-[18px] shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2 sm:flex"
            >
              <Settings className="h-[17px] w-[17px] text-[#3B4FE0]" />
              <span className="text-sm font-bold text-[#1E2A5A]">Manage Locations</span>
            </button>

            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-[#64748B] transition-colors hover:bg-[#F1F3F9] md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
            {/* Left pane */}
            <div className="flex min-h-0 min-w-0 flex-col border-b border-[#ECEEF4] md:border-b-0 md:border-r">
              <div
                role="radiogroup"
                aria-label="Choose a location"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    move(1);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    move(-1);
                  }
                }}
                className="scrollbar-thin max-h-[280px] min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3.5 md:max-h-none"
              >
                {locations.map((loc, i) => (
                  <LocationListItem
                    key={loc.id}
                    location={loc}
                    selected={loc.id === previewId}
                    focused={i === focusIndex}
                    autoFocus={loc.id === initialId}
                    registerRef={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    onSelect={() => {
                      setFocusIndex(i);
                      commit(loc.id);
                    }}
                  />
                ))}
              </div>

              <div className="shrink-0 border-t border-[#ECEEF4] p-4">
                <button
                  type="button"
                  aria-label="Add a new location"
                  onClick={() => console.log('[Clinic OS] Add New Location')}
                  className="flex h-[46px] w-full items-center justify-center gap-2.5 rounded-[10px] border-[1.5px] border-dashed border-[#C7CEDB] bg-transparent transition-colors hover:border-[#3B4FE0] hover:bg-[#F5F7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
                >
                  <Plus className="h-[18px] w-[18px] text-[#3B4FE0]" />
                  <span className="text-sm font-bold text-[#3B4FE0]">Add New Location</span>
                </button>
              </div>
            </div>

            {/* Right pane */}
            <div className="scrollbar-thin min-h-0 min-w-0 overflow-y-auto">
              <LocationDetail location={preview} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
