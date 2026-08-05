import { Link } from 'react-router';
import { useActiveLocation } from '../../../../lib/doctorLocation';
import { formatAge, formatDate, spokenAge } from '../../../../data/patients';
import type { Patient } from '../../../../data/patients';
import { PatientRowMenu } from './PatientRowMenu';
import { PhoneCell } from './PatientsTable';

function Avatar({ p, size = 38 }: { p: Patient; size?: number }) {
  const initials = p.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span
      role="img"
      aria-label={p.name}
      style={{ background: p.tint, color: p.fg, width: size, height: size, fontSize: size * 0.34 }}
      className="grid shrink-0 place-items-center rounded-full font-bold ring-2 ring-white"
    >
      {initials}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#94A3B8]">{label}</dt>
      <dd className="mt-0.5 truncate text-[12.5px] font-medium text-[#334155]">{children}</dd>
    </div>
  );
}

interface ViewProps {
  patients: Patient[];
  onOpenVaccination?: (p: Patient) => void;
  onOpenGrowth?: (p: Patient) => void;
}

/** The grid toggle — a real second view, not a stub. */
/** Clinic name from the live list; an unknown/removed id shows an em dash. */
function useLocationName() {
  const { locations } = useActiveLocation();
  return (id: string | null | undefined) => locations.find((l) => l.id === id)?.name ?? '—';
}

export function PatientGridView({ patients, onOpenVaccination, onOpenGrowth }: ViewProps) {
  const locationName = useLocationName();
  return (
    <ul className="grid grid-cols-1 gap-4 p-[22px] sm:grid-cols-2 xl:grid-cols-4">
      {patients.map((p) => (
        <li key={p.id} className="rounded-[12px] border border-[#ECEEF4] p-4 transition-shadow hover:shadow-[0_12px_28px_-14px_rgba(16,24,40,.18)]">
          <div className="flex items-start gap-3">
            <Avatar p={p} size={44} />
            <div className="min-w-0 flex-1">
              <Link to={`/doctor/patients/${p.id}`} className="block truncate text-sm font-bold text-[#0F172A] hover:text-[#3B4FE0]">
                {p.name}
              </Link>
              <span className="mt-0.5 block truncate text-xs text-[#64748B]">Guardian: {p.guardian}</span>
            </div>
            <PatientRowMenu patient={p} onOpenVaccination={() => onOpenVaccination?.(p)} onOpenGrowth={() => onOpenGrowth?.(p)} />
          </div>

          <Link to={`/doctor/patients/${p.id}`} className="mt-3 inline-block text-[13px] font-semibold text-[#3B4FE0] hover:underline">
            {p.id}
          </Link>

          <dl className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Gender / Age">
              <span aria-hidden="true">
                {p.gender} • {formatAge(p.dob)}
              </span>
              <span className="sr-only">
                {p.gender}, {spokenAge(p.dob)}
              </span>
            </Field>
            <Field label="Last Visit">
              {p.lastVisit ? (
                formatDate(p.lastVisit)
              ) : (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">No visits yet</span>
                </>
              )}
            </Field>
          </dl>

          <div className="mt-3 border-t border-[#F1F3F9] pt-3">
            <PhoneCell p={p} />
            <p className="mt-2 truncate text-[12px] text-[#64748B]">{locationName(p.locationId)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Below md the table becomes one card per patient. */
export function PatientCardList({ patients, onOpenVaccination, onOpenGrowth }: ViewProps) {
  const locationName = useLocationName();
  return (
    <ul className="flex flex-col gap-3 p-4">
      {patients.map((p) => (
        <li key={p.id} className="rounded-[12px] border border-[#ECEEF4] p-3.5">
          <div className="flex items-start gap-3">
            <Avatar p={p} />
            <div className="min-w-0 flex-1">
              <Link to={`/doctor/patients/${p.id}`} className="block truncate text-sm font-bold text-[#0F172A]">
                {p.name}
              </Link>
              <span className="mt-0.5 block truncate text-xs text-[#64748B]">Guardian: {p.guardian}</span>
            </div>
            <PatientRowMenu patient={p} sheetOnMobile onOpenVaccination={() => onOpenVaccination?.(p)} onOpenGrowth={() => onOpenGrowth?.(p)} />
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-3">
            <Field label="Patient ID">{p.id}</Field>
            <Field label="Gender / Age">
              <span aria-hidden="true">
                {p.gender} • {formatAge(p.dob)}
              </span>
              <span className="sr-only">
                {p.gender}, {spokenAge(p.dob)}
              </span>
            </Field>
            <Field label="Last Visit">
              {p.lastVisit ? (
                formatDate(p.lastVisit)
              ) : (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">No visits yet</span>
                </>
              )}
            </Field>
          </dl>

          <div className="mt-3 border-t border-[#F1F3F9] pt-3">
            <PhoneCell p={p} />
            <p className="mt-2 truncate text-[12px] text-[#64748B]">{locationName(p.locationId)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
