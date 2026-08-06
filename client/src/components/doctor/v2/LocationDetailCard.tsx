import {
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  FileText,
  IndianRupee,
  Info,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PowerOff,
  Star,
  UserRound,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ClinicLocation } from '../../../lib/doctorLocation';
import { countOrDash, inrOrDash } from '../../../lib/doctorLocation';
import { ClinicIllustration } from './ClinicIllustration';
import { RowMenu } from './RowMenu';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';

// ── stat tile ────────────────────────────────────────────────────────────────

interface StatTile {
  icon: LucideIcon;
  tint: string;
  hue: string;
  label: string;
  value: string;
}

function statsFor(loc: ClinicLocation): StatTile[] {
  return [
    { icon: Users, tint: '#EDE9FE', hue: '#6D5AE0', label: 'Team Members', value: String(loc.teamMembers) },
    { icon: UserRound, tint: '#E4EBFD', hue: '#2563EB', label: 'Active Patients', value: countOrDash(loc.patients) },
    { icon: CalendarDays, tint: '#E4EBFD', hue: '#2563EB', label: 'Appointments (MTD)', value: countOrDash(loc.appointmentsMtd) },
    { icon: IndianRupee, tint: '#E0F5F0', hue: '#0E9F8F', label: 'Revenue (MTD)', value: inrOrDash(loc.revenueMtd) },
    { icon: ClipboardList, tint: '#FDE8CF', hue: '#F59E0B', label: 'Consultations (MTD)', value: countOrDash(loc.consultationsMtd) },
  ];
}

function LocationStatTile({ tile }: { tile: StatTile }) {
  return (
    <div className="rounded-[12px] border border-[#ECEEF4] bg-white px-[18px] pb-5 pt-[18px] shadow-[0_1px_2px_rgba(16,24,40,.03)]">
      <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: tile.tint }}>
        <tile.icon className="h-[18px] w-[18px]" style={{ color: tile.hue }} />
      </span>
      <p className="mt-3.5 text-[13px] font-medium text-[#64748B]">{tile.label}</p>
      <p className="mt-2 font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A] tabular-nums">{tile.value}</p>
    </div>
  );
}

// ── detail card ──────────────────────────────────────────────────────────────

/**
 * The actions live on LocationsManagement (it owns the form modal and the
 * optimistic refresh), so this card takes them as callbacks. An action without
 * a handler is simply not offered rather than rendered inert.
 */
export function LocationDetailCard({
  location, onEdit, onSetPrimary, onDeactivate,
}: {
  location: ClinicLocation;
  onEdit?: () => void;
  onSetPrimary?: () => void;
  onDeactivate?: () => void;
}) {
  const isOverall = location.id === 'overall';

  return (
    <section className={`${CARD} relative px-5 py-6 sm:px-7`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-[26px]">
        <ClinicIllustration size={132} tint={location.tint} hue={location.hue} />

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">{location.name}</h2>
            {location.primary && (
              <span className="rounded-[8px] bg-[#E6E3FF] px-3 py-1 text-[11px] font-bold text-[#5B4BE0]">Primary</span>
            )}
            {isOverall && <span className="rounded-[8px] bg-[#EEF2FF] px-3 py-1 text-[11px] font-bold text-[#3B4FE0]">Overall</span>}
          </div>

          <div className="mt-4 flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" />
            <p className="min-w-0 text-sm font-medium leading-[23px] text-[#334155]">
              {location.addressLine},
              <br />
              {location.cityLine}
            </p>
          </div>

          {location.phone && (
            <div className="mt-4 flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-[#64748B]" />
              <a href={`tel:${location.phone.replace(/\s/g, '')}`} className="text-sm font-medium text-[#334155] hover:text-[#3B4FE0] hover:underline">
                {location.phone}
              </a>
            </div>
          )}

          {location.email && (
            <div className="mt-3.5 flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-[#64748B]" />
              <a href={`mailto:${location.email}`} className="truncate text-sm font-medium text-[#334155] hover:text-[#3B4FE0] hover:underline">
                {location.email}
              </a>
            </div>
          )}
        </div>

        {/* Meta list */}
        <dl className="grid w-full shrink-0 grid-cols-2 gap-x-6 gap-y-[15px] sm:w-[300px] sm:grid-cols-[1fr_auto] lg:mt-9">
          <dt className="text-[13.5px] font-medium text-[#64748B]">Status</dt>
          <dd className="text-right">
            <span className="rounded-[8px] bg-[#D9F7E6] px-[13px] py-1 text-xs font-bold text-[#12A150]">
              {location.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </dd>

          <dt className="text-[13.5px] font-medium text-[#64748B]">Added On</dt>
          <dd className="text-right text-[13.5px] font-bold text-[#0F172A]">{location.addedOn}</dd>

          <dt className="text-[13.5px] font-medium text-[#64748B]">Time Zone</dt>
          <dd className="text-right text-[13.5px] font-bold text-[#0F172A]">{location.timezone}</dd>

          <dt className="text-[13.5px] font-medium text-[#64748B]">Currency</dt>
          <dd className="text-right text-[13.5px] font-bold text-[#0F172A]">{location.currency}</dd>

          <dt className="text-[13.5px] font-medium text-[#64748B]">Primary Location</dt>
          <dd className="text-right text-[13.5px] font-bold text-[#0F172A]">
            {location.primary ? (
              <Check className="ml-auto h-[18px] w-[18px] text-[#16A34A]" aria-label="Yes" role="img" />
            ) : (
              <span className="text-[#64748B]">No</span>
            )}
          </dd>
        </dl>

        {/* Actions — pinned to the card's top-right on wide screens so they never
            widen the identity row; they flow inline below lg. */}
        <div className="flex shrink-0 items-center gap-2.5 lg:absolute lg:right-7 lg:top-6">
          {!isOverall && onEdit && (
            <button
              type="button"
              aria-label={`Edit ${location.name}`}
              onClick={onEdit}
              className="flex h-10 items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-[17px] transition-colors hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
            >
              <Pencil className="h-[15px] w-[15px] text-[#334155]" />
              <span className="text-[13.5px] font-bold text-[#1E2A5A]">Edit Location</span>
            </button>
          )}
          {!isOverall && (onEdit || onSetPrimary || onDeactivate) && (
            <RowMenu
              label={`More actions for ${location.name}`}
              size={40}
              bordered
              items={[
                ...(onEdit ? [{ label: 'Edit Location', icon: Pencil, onSelect: onEdit }] : []),
                ...(onSetPrimary && !location.primary ? [{ label: 'Set as Primary', icon: Star, onSelect: onSetPrimary }] : []),
                ...(onDeactivate && location.status === 'active'
                  ? [{ label: 'Deactivate', icon: PowerOff, danger: true, onSelect: onDeactivate }]
                  : []),
              ]}
            />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-[26px] grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {statsFor(location).map((t) => (
          <LocationStatTile key={t.label} tile={t} />
        ))}
      </div>
    </section>
  );
}

// ── timings card ─────────────────────────────────────────────────────────────

export function LocationTimingsCard({ location }: { location: ClinicLocation }) {
  return (
    <section className={`${CARD} flex flex-col px-6 py-[22px]`}>
      <div className="flex items-center gap-2.5">
        <Clock className="h-[18px] w-[18px] shrink-0 text-[#334155]" />
        <h2 className="font-display text-[15px] font-bold tracking-[-0.01em] text-[#0F172A]">Location Timings</h2>
      </div>

      {location.timings.length ? (
        <table className="mt-5 w-full border-separate border-spacing-y-[9px]">
          <caption className="sr-only">Location opening hours</caption>
          <tbody>
            {location.timings.map((t) => (
              <tr key={t.day}>
                <th scope="row" className="whitespace-nowrap text-left text-[13.5px] font-medium text-[#475569]">
                  {t.day}
                </th>
                <td aria-hidden="true" className="w-full px-3.5 align-middle">
                  <span className="block border-b-[1.5px] border-dotted border-[#D8DEE9]" />
                </td>
                <td className="whitespace-nowrap text-right text-[13.5px] font-semibold tabular-nums text-[#0F172A]">{t.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-5 text-[13.5px] font-medium leading-[22px] text-[#64748B]">
          Opening hours belong to a single clinic. Select one from the list to see them.
        </p>
      )}

      <div className="mt-auto flex items-start gap-3 rounded-[10px] bg-[#E8EEFD] px-4 py-3.5 pt-[14px]" style={{ marginTop: 26 }}>
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#3B82F6]">
          <Info className="h-3 w-3 text-white" />
        </span>
        <p className="text-[13.5px] font-medium leading-[21px] text-[#1E3A8A]">
          Appointments can be booked during operational hours only.
        </p>
      </div>
    </section>
  );
}

// ── services + notes card ────────────────────────────────────────────────────

export function LocationServicesCard({ location }: { location: ClinicLocation }) {
  return (
    <section className={`${CARD} px-6 py-[22px]`}>
      <div className="flex items-center gap-2.5">
        <Star className="h-[18px] w-[18px] shrink-0 text-[#6D28D9]" />
        <h2 className="font-display text-[15px] font-bold tracking-[-0.01em] text-[#0F172A]">Services Available</h2>
      </div>

      <ul className="mt-[18px] flex flex-wrap gap-3">
        {location.services.map((s) => (
          <li key={s} className="rounded-full bg-[#F0EDFD] px-[18px] py-[9px] text-[13px] font-semibold text-[#4C1FD7]">
            {s}
          </li>
        ))}
      </ul>

      <div className="mt-[30px] flex items-center gap-2.5">
        <FileText className="h-[17px] w-[17px] shrink-0 text-[#334155]" />
        <h2 className="font-display text-[15px] font-bold tracking-[-0.01em] text-[#0F172A]">Notes</h2>
      </div>
      <p className="mt-3 text-[13.5px] font-normal leading-[22px] text-[#475569]">{location.notes}</p>
    </section>
  );
}
