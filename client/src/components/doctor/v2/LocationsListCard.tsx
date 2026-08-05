import { useMemo, useRef, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { ClinicLocation, LocationId } from '../../../lib/doctorLocation';
import { cn } from '../../../lib/cn';
import { RowMenu } from './RowMenu';
import type { RowMenuItem } from './RowMenu';

function StatusChip({ location }: { location: ClinicLocation }) {
  const primary = !!location.primary;
  return (
    <span
      className="shrink-0 rounded-[7px] px-[11px] py-1 text-[11px] font-bold"
      style={
        primary ? { background: '#E6E3FF', color: '#5B4BE0' } : { background: '#D9F7E6', color: '#12A150' }
      }
    >
      {primary ? 'Primary' : location.status === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}

function LocationListRow({
  location,
  selected,
  onSelect,
  registerRef,
  tabbable,
  menuItems,
}: {
  location: ClinicLocation;
  selected: boolean;
  menuItems?: RowMenuItem[];
  onSelect: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
  tabbable: boolean;
}) {
  return (
    <div
      ref={registerRef}
      role="option"
      aria-selected={selected}
      tabIndex={tabbable ? 0 : -1}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'flex cursor-pointer items-start gap-3.5 rounded-[12px] p-3 transition-[background-color,border-color] duration-[180ms]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-1',
        selected ? 'border-[1.5px] border-[#6366F1] bg-[#F5F5FF]' : 'border-[1.5px] border-transparent hover:bg-[#F7F8FC]',
      )}
    >
      <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: location.tint }}>
        <Building2 className="h-6 w-6" style={{ color: location.hue }} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-bold leading-tight text-[#0F172A]">{location.name}</span>
        <span className="mt-1 block truncate text-[12.5px] font-normal text-[#64748B]">{location.addressLine},</span>
        <span className="mt-0.5 block truncate text-[12.5px] font-medium text-[#334155]">{location.cityLine}</span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        <StatusChip location={location} />
        {menuItems && <RowMenu label={`Actions for ${location.name}`} items={menuItems} />}
      </span>
    </div>
  );
}

export function LocationsListCard({
  locations,
  selectedId,
  onSelect,
  menuFor,
}: {
  locations: ClinicLocation[];
  selectedId: LocationId;
  onSelect: (id: LocationId) => void;
  /** Row actions, supplied by the page so they hit the API. Omit to hide the menu. */
  menuFor?: (l: ClinicLocation) => RowMenuItem[];
}) {
  const [query, setQuery] = useState('');
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (l) => l.name.toLowerCase().includes(q) || l.addressLine.toLowerCase().includes(q) || l.cityLine.toLowerCase().includes(q),
    );
  }, [locations, query]);

  const selectedIndex = Math.max(0, filtered.findIndex((l) => l.id === selectedId));

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(filtered.length - 1, next));
    rowRefs.current[clamped]?.focus();
  };

  return (
    <div className="flex min-w-0 flex-col self-stretch rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]">
      <div className="px-[18px] pt-5">
        {/* Count tracks the filtered list, so it always matches the rows below. */}
        <h2 className="font-display text-[15.5px] font-bold tracking-[-0.01em] text-[#0F172A]">
          All Locations ({filtered.length})
        </h2>

        <div className="relative mt-3.5">
          <label htmlFor="location-search" className="sr-only">
            Search locations
          </label>
          <input
            id="location-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search locations…"
            className="h-11 w-full rounded-[10px] border border-[#E4E8F1] bg-white pl-4 pr-11 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,79,224,.12)]"
          />
          {/* Right-aligned, unlike the top-bar search. */}
          <Search aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#94A3B8]" />
        </div>
      </div>

      <div
        role="listbox"
        aria-label="Locations"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveFocus(rowRefs.current.indexOf(document.activeElement as HTMLDivElement) + 1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveFocus(rowRefs.current.indexOf(document.activeElement as HTMLDivElement) - 1);
          } else if (e.key === 'Home') {
            e.preventDefault();
            moveFocus(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            moveFocus(filtered.length - 1);
          }
        }}
        className="scrollbar-thin mt-3.5 min-h-0 flex-1 overflow-y-auto px-[18px] pb-4"
      >
        {filtered.map((loc, i) => (
          <div key={loc.id} className={i > 0 ? 'border-t border-[#F1F3F9] pt-1.5' : undefined}>
            <div className={i > 0 ? undefined : undefined}>
              <LocationListRow
                location={loc}
                selected={loc.id === selectedId}
                tabbable={i === selectedIndex}
                registerRef={(el) => {
                  rowRefs.current[i] = el;
                }}
                onSelect={() => onSelect(loc.id)}
                menuItems={menuFor?.(loc)}
              />
            </div>
            {i < filtered.length - 1 && <div className="h-1.5" />}
          </div>
        ))}

        {!filtered.length && (
          <p className="px-1 py-8 text-center text-sm text-[#64748B]">
            No locations match “{query}”.
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-[#ECEEF4] px-[18px] py-4">
        <p className="text-[13px] font-medium text-[#64748B]">
          Showing {filtered.length ? 1 : 0} to {filtered.length} of {filtered.length}{' '}
          {filtered.length === 1 ? 'location' : 'locations'}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled
            aria-label="Previous page"
            className="grid h-[34px] w-[34px] cursor-not-allowed place-items-center rounded-[9px] border border-[#E2E6F0] text-[#64748B] opacity-45"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-current="page"
            className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border-[1.5px] border-[#6366F1] bg-white text-[13.5px] font-bold text-[#3B4FE0]"
          >
            1
          </button>
          <button
            type="button"
            disabled
            aria-label="Next page"
            className="grid h-[34px] w-[34px] cursor-not-allowed place-items-center rounded-[9px] border border-[#E2E6F0] text-[#64748B] opacity-45"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
