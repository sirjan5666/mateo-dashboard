import { Link } from 'react-router';
import { ChevronDown, ChevronUp, ChevronsUpDown, Phone } from 'lucide-react';
import { useActiveLocation } from '../../../../lib/doctorLocation';
import { formatAge, formatDate, patientLabel, spokenAge } from '../../../../data/patients';
import type { Patient } from '../../../../data/patients';
import { cn } from '../../../../lib/cn';
import { PatientRowMenu } from './PatientRowMenu';

export type SortKey = 'name' | 'id' | 'gender' | 'dob' | 'registeredOn' | 'lastVisit' | 'phone' | 'location';
export type SortDir = 'asc' | 'desc' | null;

// Widths sum to 100. The Patient ID column shrank once it stopped showing the
// 24-character database id and now shows the short patient number, so the space
// it gave up went to Name, Phone and Location — the columns that were cramped at
// a 100% window.
const COLUMNS: { key: SortKey | null; label: string; className: string }[] = [
  { key: 'name', label: 'Patient', className: 'w-[19%] pl-[22px]' },
  { key: 'id', label: 'Patient ID', className: 'w-[7%]' },
  { key: 'gender', label: 'Gender / Age', className: 'w-[11%]' },
  { key: 'dob', label: 'Date of Birth', className: 'w-[9%] hidden lg:table-cell' },
  { key: 'registeredOn', label: 'Registered On', className: 'w-[9%] hidden lg:table-cell' },
  { key: 'lastVisit', label: 'Last Visit', className: 'w-[8%]' },
  { key: 'phone', label: 'Phone', className: 'w-[15%]' },
  { key: 'location', label: 'Primary Location', className: 'w-[15%]' },
  { key: null, label: 'Actions', className: 'w-[6%] pr-[22px] text-right' },
];

function Avatar({ p }: { p: Patient }) {
  const initials = p.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span
      role="img"
      aria-label={p.name}
      style={{ background: p.tint, color: p.fg }}
      className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-[13px] font-bold ring-2 ring-white"
    >
      {initials}
    </span>
  );
}

/** Phone + a WhatsApp launcher. */
export function PhoneCell({ p }: { p: Patient }) {
  const digits = p.phone.replace(/\D/g, '');
  return (
    <span className="flex items-center gap-[9px]">
      <Phone aria-hidden="true" className="h-[15px] w-[15px] shrink-0 text-[#64748B]" />
      <a href={`tel:+${digits}`} className="text-[13px] font-medium text-[#334155] hover:text-[#3B4FE0]">
        {p.phone}
      </a>
      <a
        href={`https://wa.me/${digits}`}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`Message ${p.name}'s guardian on WhatsApp`}
        className="shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5]"
      >
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="#25D366" aria-hidden="true">
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.470 1.5 1.07 2.95 1.22 3.15.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.22-8.24 8.22z" />
        </svg>
      </a>
    </span>
  );
}

function SortGlyph({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active || !dir) return <ChevronsUpDown aria-hidden="true" className="h-3 w-3 shrink-0 text-[#CBD5E1]" />;
  const I = dir === 'asc' ? ChevronUp : ChevronDown;
  return <I aria-hidden="true" className="h-3 w-3 shrink-0 text-[#3B4FE0]" />;
}

export function PatientsTable({
  patients,
  sortKey,
  sortDir,
  onSort,
}: {
  patients: Patient[];
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const { locations } = useActiveLocation();
  // Clinic name from the live list; an unknown/removed id shows an em dash.
  const locationName = (id: string | null | undefined) => locations.find((l) => l.id === id)?.name ?? '—';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-0">
        <caption className="sr-only">Patient records</caption>
        <thead>
          <tr>
            {COLUMNS.map((c) => {
              const active = c.key !== null && sortKey === c.key;
              return (
                <th
                  key={c.label}
                  scope="col"
                  aria-sort={c.key === null ? undefined : active && sortDir ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn(
                    'h-11 border-y border-[#ECEEF4] bg-[#F7F8FC] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]',
                    c.className,
                  )}
                >
                  {c.key ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.key!)}
                      className="inline-flex items-center gap-1.5 uppercase tracking-[0.06em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5]"
                    >
                      {c.label}
                      <SortGlyph active={active} dir={sortDir} />
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.id} className="group">
              <th
                scope="row"
                className="sticky left-0 z-10 h-[68px] border-b border-[#F1F3F9] bg-white pl-[22px] pr-3 text-left font-normal group-hover:bg-[#FAFBFF] lg:static"
              >
                <span className="flex items-center gap-3">
                  <Avatar p={p} />
                  <span className="min-w-0">
                    <Link to={`/doctor/patients/${p.id}`} className="block truncate text-sm font-bold text-[#0F172A] hover:text-[#3B4FE0]">
                      {p.name}
                    </Link>
                    <span className="mt-[3px] block truncate text-xs text-[#64748B]">Guardian: {p.guardian}</span>
                  </span>
                </span>
              </th>

              <td className="border-b border-[#F1F3F9] pr-3 group-hover:bg-[#FAFBFF]">
                <Link
                  to={`/doctor/patients/${p.id}`}
                  title={p.code ? `Patient no. ${p.code}` : p.id}
                  className="font-mono text-[13px] font-semibold tabular-nums text-[#3B4FE0] hover:underline"
                >
                  {patientLabel(p)}
                </Link>
              </td>

              <td className="border-b border-[#F1F3F9] text-[13px] font-medium text-[#334155] group-hover:bg-[#FAFBFF]">
                <span aria-hidden="true">
                  {p.gender} <span className="px-2 text-[#CBD5E1]">•</span> {formatAge(p.dob)}
                </span>
                <span className="sr-only">
                  {p.gender}, {spokenAge(p.dob)}
                </span>
              </td>

              <td className="hidden border-b border-[#F1F3F9] text-[13px] font-medium text-[#334155] group-hover:bg-[#FAFBFF] lg:table-cell">
                {formatDate(p.dob)}
              </td>

              <td className="hidden border-b border-[#F1F3F9] text-[13px] font-medium text-[#334155] group-hover:bg-[#FAFBFF] lg:table-cell">
                {formatDate(p.registeredOn)}
              </td>

              <td className="border-b border-[#F1F3F9] text-[13px] font-medium group-hover:bg-[#FAFBFF]">
                {p.lastVisit ? (
                  <span className="text-[#334155]">{formatDate(p.lastVisit)}</span>
                ) : (
                  <>
                    <span aria-hidden="true" className="text-[#94A3B8]">
                      —
                    </span>
                    <span className="sr-only">No visits yet</span>
                  </>
                )}
              </td>

              <td className="border-b border-[#F1F3F9] group-hover:bg-[#FAFBFF]">
                <PhoneCell p={p} />
              </td>

              <td className="border-b border-[#F1F3F9] pr-3 text-[13px] font-medium text-[#334155] group-hover:bg-[#FAFBFF]">
                {locationName(p.locationId)}
              </td>

              <td className="border-b border-[#F1F3F9] pr-[22px] group-hover:bg-[#FAFBFF]">
                <PatientRowMenu patient={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
