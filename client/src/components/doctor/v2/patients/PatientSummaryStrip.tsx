import type { ReactNode } from 'react';
import { formatAge, formatDate } from '../../../../data/patients';
import type { Patient } from '../../../../data/patients';

/**
 * Identity block shared by the Vaccination Records and Growth Chart modals
 * (specs 07 §4.1 and 08 §3.1). The right-hand panel differs per modal and is
 * passed as children.
 */
export function PatientSummaryStrip({ patient, children }: { patient: Patient; children: ReactNode }) {
  const initials = patient.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const sexGlyph = patient.gender === 'Male' ? '♂' : patient.gender === 'Female' ? '♀' : '⚲';

  return (
    <div className="grid grid-cols-1 items-stretch gap-5 px-5 pb-5 sm:px-[26px] lg:grid-cols-[auto_1fr] lg:gap-[26px]">
      {/* Identity */}
      <div className="flex items-start gap-4 sm:gap-[18px]">
        <span
          role="img"
          aria-label={patient.name}
          style={{ background: patient.tint, color: patient.fg }}
          className="grid h-[78px] w-[78px] shrink-0 place-items-center rounded-full text-[26px] font-bold shadow-[0_2px_10px_-4px_rgba(15,23,42,.25)] ring-2 ring-white"
        >
          {initials}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="font-display text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">
              {patient.name}
            </h3>
            <span
              role="img"
              aria-label={patient.gender}
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#DBEAFE] text-[13px] font-bold leading-none text-[#2563EB]"
            >
              {sexGlyph}
            </span>
          </div>

          <p className="mt-[7px] text-[12.5px]">
            <span className="font-medium text-[#64748B]">Patient ID: </span>
            <span className="font-bold text-[#3B4FE0]">{patient.id}</span>
          </p>

          <p className="mt-1.5 text-[12.5px]">
            <span className="font-medium text-[#64748B]">Age: </span>
            <span className="font-bold text-[#0F172A]">{formatAge(patient.dob)}</span>
            <span aria-hidden="true" className="px-2 text-[#CBD5E1]">•</span>
            <span className="font-medium text-[#64748B]">DOB: </span>
            <span className="font-bold text-[#0F172A]">{formatDate(patient.dob)}</span>
          </p>

          <p className="mt-[5px] text-[12.5px]">
            <span className="font-medium text-[#64748B]">Guardian: </span>
            <span className="font-bold text-[#0F172A]">{patient.guardian}</span>
            <span aria-hidden="true" className="px-2 text-[#CBD5E1]">•</span>
            <span className="font-medium text-[#64748B]">Phone: </span>
            <span className="font-bold text-[#0F172A]">{patient.phone}</span>
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}
