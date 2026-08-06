import { Building2, CalendarDays, ClipboardList, Clock, IndianRupee, Info, Mail, MapPin, Pencil, Phone, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ClinicLocation } from '../../../lib/doctorLocation';
import { countOrDash, inrOrDash, useActiveLocation } from '../../../lib/doctorLocation';
import { ClinicIllustration } from './ClinicIllustration';

// ── stats strip ──────────────────────────────────────────────────────────────

interface StatCell {
  icon: LucideIcon;
  tint: string;
  hue: string;
  label: string;
  value: string;
}

function statsFor(loc: ClinicLocation): StatCell[] {
  return [
    { icon: Users, tint: '#EDE9FE', hue: '#6D5AE0', label: 'Team Members', value: String(loc.teamMembers) },
    { icon: CalendarDays, tint: '#E4EBFD', hue: '#2563EB', label: 'Active Patients', value: countOrDash(loc.patients) },
    { icon: IndianRupee, tint: '#E0F5F0', hue: '#0E9F8F', label: 'Monthly Revenue', value: inrOrDash(loc.revenueMtd) },
    { icon: ClipboardList, tint: '#FDE8CF', hue: '#F59E0B', label: 'Consultations (MTD)', value: countOrDash(loc.consultationsMtd) },
  ];
}

export function LocationStats({ location }: { location: ClinicLocation }) {
  const cells = statsFor(location);
  return (
    <dl className="mt-6 grid grid-cols-2 rounded-[12px] border border-[#ECEEF4] bg-white px-1 py-[18px] sm:grid-cols-4">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={
            'px-4 py-2 sm:px-[22px] sm:py-0' +
            (i < cells.length - 1 ? ' sm:border-r sm:border-[#ECEEF4]' : '') +
            (i % 2 === 0 ? ' border-r border-[#ECEEF4] sm:border-r' : '') +
            (i < 2 ? ' border-b border-[#ECEEF4] pb-4 sm:border-b-0 sm:pb-0' : ' pt-4 sm:pt-0')
          }
        >
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[9px]" style={{ background: c.tint }}>
            <c.icon className="h-[17px] w-[17px]" style={{ color: c.hue }} />
          </span>
          <dt className="mt-3 text-[13px] font-medium text-[#64748B]">{c.label}</dt>
          <dd className="mt-1.5 font-display text-[21px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A] tabular-nums">
            {c.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ── timings ──────────────────────────────────────────────────────────────────

export function LocationTimings({ location }: { location: ClinicLocation }) {
  // Overall has no timings to show — hours belong to a single clinic, never to a sum.
  if (!location.timings.length) {
    return (
      <div className="mt-5 flex items-start gap-2.5 rounded-[10px] bg-[#F6F7FB] px-4 py-3.5">
        <Info className="mt-px h-4 w-4 shrink-0 text-[#3B4FE0]" />
        <p className="text-[13px] font-medium leading-relaxed text-[#64748B]">
          Opening hours, phone and email belong to a single clinic. Select one from the list to see them.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2.5">
        <Clock className="h-[17px] w-[17px] shrink-0 text-[#334155]" />
        <h3 className="font-display text-[15px] font-bold tracking-[-0.01em] text-[#0F172A]">Location Timings</h3>
      </div>

      <table className="mt-[18px] w-full border-separate border-spacing-y-2">
        <caption className="sr-only">Location opening hours</caption>
        <tbody>
          {location.timings.map((t) => (
            <tr key={t.day}>
              <th scope="row" className="whitespace-nowrap text-left text-[13.5px] font-medium text-[#475569]">
                {t.day}
              </th>
              {/* Decorative dotted leader — CSS only, never a text character. */}
              <td aria-hidden="true" className="w-full px-3.5 align-middle">
                <span className="block border-b-[1.5px] border-dotted border-[#D8DEE9]" />
              </td>
              <td className="whitespace-nowrap text-right text-[13.5px] font-semibold tabular-nums text-[#0F172A]">{t.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ── detail pane ──────────────────────────────────────────────────────────────

/** `onEditDetails` is owned by whoever renders the form; without it the button is hidden. */
export function LocationDetail({ location, onEditDetails }: { location: ClinicLocation; onEditDetails?: () => void }) {
  const { clinics } = useActiveLocation();
  const clinicCount = clinics.length;
  const isOverall = location.id === 'overall';

  return (
    <div className="p-5 sm:p-[26px] sm:pt-[26px]">
      {/* Identity */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-[22px]">
        {isOverall ? (
          <span
            aria-hidden="true"
            className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full sm:h-24 sm:w-24"
            style={{ background: 'conic-gradient(from 180deg, #EDE9FE, #D7F5EE, #FDE8CF, #FCDCE4, #D6E6FB, #EDE9FE)' }}
          >
            <span className="grid h-[54px] w-[54px] place-items-center rounded-full bg-white/80 sm:h-[72px] sm:w-[72px]">
              <Building2 className="h-7 w-7 text-[#4F63F5] sm:h-9 sm:w-9" />
            </span>
          </span>
        ) : (
          <span className="sm:hidden">
            <ClinicIllustration size={72} tint={location.tint} hue={location.hue} />
          </span>
        )}
        {!isOverall && (
          <span className="hidden sm:block">
            <ClinicIllustration size={96} tint={location.tint} hue={location.hue} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="font-display text-[21px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">{location.name}</h3>
            {location.primary && (
              <span className="rounded-[8px] bg-[#E6E3FF] px-[11px] py-1 text-[11px] font-bold text-[#5B4BE0]">Primary</span>
            )}
            {isOverall && (
              <span className="rounded-[8px] bg-[#EEF2FF] px-[11px] py-1 text-[11px] font-bold text-[#3B4FE0]">Overall</span>
            )}
            {!isOverall && onEditDetails && (
              <button
                type="button"
                aria-label={`Edit details for ${location.name}`}
                onClick={onEditDetails}
                className="flex h-[38px] items-center gap-2 rounded-[9px] border border-[#E2E6F0] bg-white px-4 transition-colors hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2 sm:ml-auto"
              >
                <Pencil className="h-[15px] w-[15px] text-[#334155]" />
                <span className="text-[13.5px] font-bold text-[#1E2A5A]">Edit Details</span>
              </button>
            )}
          </div>

          <div className="mt-3.5 flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" />
            <p className="min-w-0 text-sm font-medium leading-[22px] text-[#334155]">
              {location.addressLine}
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
            <div className="mt-3 flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-[#64748B]" />
              <a href={`mailto:${location.email}`} className="truncate text-sm font-medium text-[#334155] hover:text-[#3B4FE0] hover:underline">
                {location.email}
              </a>
            </div>
          )}
        </div>
      </div>

      <LocationStats location={location} />

      {isOverall && (
        <p className="mt-2.5 text-[11px] font-medium text-[#64748B]">
          Summed across all {clinicCount} clinic{clinicCount === 1 ? '' : 's'}.
        </p>
      )}

      <div className="my-5 h-px bg-[#ECEEF4] sm:mb-5 sm:mt-6" />

      <LocationTimings location={location} />
    </div>
  );
}
