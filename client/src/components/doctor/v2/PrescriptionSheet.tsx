import {
  CalendarDays, ClipboardList, FlaskConical, Globe, Mail, MapPin, MessageSquareMore, Phone,
  PhoneCall, Pill, Stethoscope, UserRound,
} from 'lucide-react';
import type { PrescriptionSheetData } from '../../../api/doctorPrescriptionDocs';
import { ageParts } from '../../../data/patients';
import { formatDateIST, formatTimeIST } from '../../../lib/age';

/**
 * The printed prescription (A4).
 *
 * Rendered from the server's single assembled read — every value on this sheet
 * is a stored record. Where the clinic has not filled something in (licence,
 * website, registration number) the line is omitted rather than invented: this
 * is a document a parent hands to a pharmacist.
 *
 * Printing is the download path. `@media print` in index.css strips the app
 * chrome and prints this element alone, so "Download" and "Print" produce the
 * same sheet — one layout, not two that can drift.
 */

const NAVY = '#123B6D';
const TEAL = '#0E9F9B';
const LINK = '#1B7FC4';

const LABEL = 'text-[11.5px] font-semibold text-[#0F172A]';
const VALUE = 'text-[11.5px] text-[#334155]';

function SectionTitle({ icon: Icon, children }: { icon: typeof UserRound; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5">
      <Icon aria-hidden="true" className="h-[17px] w-[17px] shrink-0" style={{ color: TEAL }} />
      <span className="text-[12.5px] font-bold uppercase tracking-[0.06em]" style={{ color: TEAL }}>{children}</span>
    </h2>
  );
}

/** `Label : value` — the colon is its own cell so every row aligns. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-[3px]">
      <dt className={`${LABEL} w-[104px] shrink-0`}>{label}</dt>
      <dd aria-hidden="true" className={`${LABEL} w-2 shrink-0`}>:</dd>
      <dd className={`${VALUE} min-w-0 flex-1`}>{value}</dd>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[92px] shrink-0 text-[11px] font-semibold text-[#334155]">{label}</dt>
      <dd aria-hidden="true" className="text-[11px] font-semibold text-[#334155]">:</dd>
      <dd className="text-[11px] font-bold" style={{ color: NAVY }}>{value}</dd>
    </div>
  );
}

const TH = 'h-9 px-3 text-[10.5px] font-bold text-white';

export function PrescriptionSheet({ data }: { data: PrescriptionSheetData }) {
  const { document: doc, items, patient, doctor, clinic } = data;
  const age = patient?.dob ? ageParts(patient.dob) : null;
  const ageLabel = age ? `${age.years} Years ${age.months} Months` : null;
  const sexLabel = patient?.sex === 'male' ? 'Male' : patient?.sex === 'female' ? 'Female' : 'Unspecified';
  const patientCode = patient?.code ?? '—';

  return (
    <article
      id="rx-sheet"
      aria-label={`Prescription ${doc.number}`}
      className="mx-auto w-full max-w-[820px] bg-white text-[#0F172A]"
      style={{ border: '1px solid #D9E4F2', borderRadius: 10 }}
    >
      <div className="px-8 pt-7">
        {/* ── Letterhead ── */}
        <header className="flex flex-wrap items-start gap-6">
          <div className="min-w-0">
            <img src="/mateo-logo.png" alt="MateoCare" className="h-[52px] w-auto" />
            <p className="mt-1.5 text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: TEAL }}>
              Child Care Clinic
            </p>
            <p className="mt-1 text-[11.5px] italic text-[#64748B]">Caring for Little Lives</p>
          </div>

          {clinic && (
            <div className="min-w-0 flex-1 border-l border-[#DCE6F4] pl-6">
              <p className="flex items-start gap-2.5">
                <MapPin aria-hidden="true" className="mt-px h-[15px] w-[15px] shrink-0" style={{ color: LINK }} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold" style={{ color: NAVY }}>{clinic.name}</span>
                  <span className="block text-[11.5px] text-[#475569]">{clinic.address}</span>
                </span>
              </p>
              {clinic.phone && (
                <p className="mt-2 flex items-center gap-2.5">
                  <Phone aria-hidden="true" className="h-[15px] w-[15px] shrink-0" style={{ color: LINK }} />
                  <span className="text-[12px] font-semibold" style={{ color: LINK }}>{clinic.phone}</span>
                </p>
              )}
              {clinic.email && (
                <p className="mt-1.5 flex items-center gap-2.5">
                  <Mail aria-hidden="true" className="h-[15px] w-[15px] shrink-0" style={{ color: LINK }} />
                  <span className="truncate text-[12px] font-semibold" style={{ color: LINK }}>{clinic.email}</span>
                </p>
              )}
              {clinic.website && (
                <p className="mt-1.5 flex items-center gap-2.5">
                  <Globe aria-hidden="true" className="h-[15px] w-[15px] shrink-0" style={{ color: LINK }} />
                  <span className="truncate text-[12px] font-semibold" style={{ color: LINK }}>{clinic.website}</span>
                </p>
              )}
            </div>
          )}

          <dl className="shrink-0 rounded-[9px] border px-4 py-3" style={{ borderColor: '#BFD6EE' }}>
            <MetaRow label="Prescription ID" value={doc.number} />
            <div className="mt-2"><MetaRow label="Date" value={formatDateIST(doc.issuedAt)} /></div>
            <div className="mt-2"><MetaRow label="Time" value={formatTimeIST(doc.issuedAt)} /></div>
          </dl>
        </header>

        {/* ── Patient + doctor ── */}
        <section className="mt-6 rounded-[11px] border px-6 py-5" style={{ borderColor: '#CFE0F2' }}>
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <div className="min-w-0 md:border-r md:border-[#E2EBF6] md:pr-8">
              <SectionTitle icon={UserRound}>Patient Details</SectionTitle>
              <dl className="mt-3.5">
                <Row label="Patient Name" value={patient?.displayName ?? '—'} />
                <Row label="Age / Gender" value={[ageLabel, sexLabel].filter(Boolean).join(' / ')} />
                <Row label="Patient ID" value={patientCode} />
                {doc.weightKg != null && <Row label="Weight" value={`${doc.weightKg} kg`} />}
                <Row label="Allergies" value={patient?.allergies ?? 'None recorded'} />
                {patient?.address && <Row label="Address" value={patient.address} />}
                {patient?.phone && <Row label="Phone" value={patient.phone} />}
              </dl>
            </div>

            <div className="min-w-0">
              <SectionTitle icon={Stethoscope}>Doctor Details</SectionTitle>
              <dl className="mt-3.5">
                <Row label="Doctor Name" value={doctor.name} />
                {doctor.qualifications && <Row label="Qualification" value={doctor.qualifications} />}
                {doctor.specialization && <Row label="Specialization" value={doctor.specialization} />}
                {doctor.registrationNo && <Row label="Reg. No." value={doctor.registrationNo} />}
              </dl>
              {/*
                An e-signature mark, not a scanned autograph — this app stores no
                signature image, and the note below states the sheet needs none.
              */}
              <div className="mt-5">
                <p className="font-display text-[22px] italic leading-none" style={{ color: NAVY }}>{doctor.name}</p>
                <p className="mt-1 h-px w-[150px]" style={{ background: '#CBD5E1' }} />
                <p className="mt-1.5 text-[11px] font-bold" style={{ color: TEAL }}>Signature</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Diagnosis ── */}
        {doc.diagnosis && (
          <section className="mt-5 border-t border-[#E2EBF6] pt-4">
            <p className="flex flex-wrap items-center gap-2.5">
              <ClipboardList aria-hidden="true" className="h-[17px] w-[17px] shrink-0" style={{ color: TEAL }} />
              <span className="text-[12.5px] font-bold uppercase tracking-[0.06em]" style={{ color: TEAL }}>
                Diagnosis / Clinical Impression :
              </span>
              <span className="text-[12.5px] font-semibold text-[#334155]">{doc.diagnosis}</span>
            </p>
          </section>
        )}

        {/* ── Medications ── */}
        <section className="mt-5 border-t border-[#E2EBF6] pt-5">
          <SectionTitle icon={Pill}>Medications</SectionTitle>
          <div className="mt-3.5 overflow-x-auto">
            <table className="w-full min-w-[660px] border-collapse">
              <caption className="sr-only">Prescribed medications</caption>
              <thead>
                <tr style={{ background: NAVY }}>
                  <th scope="col" className={`${TH} w-[54px] text-center`}>S. No.</th>
                  <th scope="col" className={`${TH} text-left`}>Medicine</th>
                  <th scope="col" className={`${TH} text-center`}>Composition / Strength</th>
                  <th scope="col" className={`${TH} text-center`}>Dose</th>
                  <th scope="col" className={`${TH} text-center`}>Frequency</th>
                  <th scope="col" className={`${TH} text-center`}>Duration</th>
                  <th scope="col" className={`${TH} text-center`}>Instructions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m, i) => (
                  <tr key={m.id}>
                    <td className="border border-[#DCE6F4] px-3 py-3 text-center text-[11.5px] font-semibold text-[#334155]">{i + 1}</td>
                    <th scope="row" className="border border-[#DCE6F4] px-3 py-3 text-left text-[12px] font-bold" style={{ color: LINK }}>
                      {m.drug}
                    </th>
                    <td className="border border-[#DCE6F4] px-3 py-3 text-center text-[11.5px] text-[#334155]">{m.strength ?? '—'}</td>
                    <td className="border border-[#DCE6F4] px-3 py-3 text-center text-[11.5px] text-[#334155]">{m.dose ?? '—'}</td>
                    <td className="border border-[#DCE6F4] px-3 py-3 text-center text-[11.5px] text-[#334155]">{m.frequency ?? '—'}</td>
                    <td className="border border-[#DCE6F4] px-3 py-3 text-center text-[11.5px] text-[#334155]">{m.duration ?? '—'}</td>
                    <td className="border border-[#DCE6F4] px-3 py-3 text-center text-[11.5px] text-[#334155]">{m.instructions ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {doc.reviewAfterDays != null && (
            <p className="mt-3 flex items-center gap-2.5 rounded-[8px] border border-[#DCE6F4] px-4 py-3">
              <CalendarDays aria-hidden="true" className="h-[16px] w-[16px] shrink-0" style={{ color: TEAL }} />
              <span className="text-[12px] font-bold uppercase tracking-[0.05em]" style={{ color: TEAL }}>Review After :</span>
              <span className="text-[12px] font-semibold text-[#334155]">
                {doc.reviewAfterDays} {doc.reviewAfterDays === 1 ? 'Day' : 'Days'}
              </span>
            </p>
          )}
        </section>

        {/* ── Investigations + advice ── */}
        {(doc.investigations.length > 0 || doc.advice.length > 0) && (
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            {doc.investigations.length > 0 && (
              <section className="rounded-[10px] border px-5 py-4" style={{ borderColor: '#CFE0F2' }}>
                <SectionTitle icon={FlaskConical}>Investigations Advised</SectionTitle>
                <ol className="mt-3 flex flex-col gap-1.5">
                  {doc.investigations.map((t, i) => (
                    <li key={t} className="flex gap-2 text-[11.5px] text-[#334155]">
                      <span className="shrink-0 font-semibold">{i + 1}.</span>
                      <span className="min-w-0">{t}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {doc.advice.length > 0 && (
              <section className="rounded-[10px] border px-5 py-4" style={{ borderColor: '#CFE0F2' }}>
                <SectionTitle icon={MessageSquareMore}>Advice</SectionTitle>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {doc.advice.map((t) => (
                    <li key={t} className="flex gap-2.5 text-[11.5px] text-[#334155]">
                      <span aria-hidden="true" className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: NAVY }} />
                      <span className="min-w-0">{t}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* ── Note ── */}
        <p className="mt-5 flex items-start gap-3 rounded-[10px] border px-5 py-4" style={{ borderColor: '#CFE0F2' }}>
          <ClipboardList aria-hidden="true" className="mt-px h-[17px] w-[17px] shrink-0" style={{ color: TEAL }} />
          <span className="text-[11.5px] italic text-[#334155]">
            <span className="font-bold not-italic" style={{ color: NAVY }}>NOTE : </span>
            This prescription is generated electronically and does not require any physical signature.
          </span>
        </p>

        {/* ── Footer ── */}
        <footer className="mt-5 flex flex-wrap items-start gap-6 border-t border-[#E2EBF6] pt-5">
          {clinic?.openingHours && (
            <div className="flex min-w-0 items-start gap-2.5 md:border-r md:border-[#E2EBF6] md:pr-6">
              <CalendarDays aria-hidden="true" className="mt-px h-[17px] w-[17px] shrink-0" style={{ color: TEAL }} />
              <span className="min-w-0">
                <span className="block text-[11.5px] font-bold" style={{ color: TEAL }}>Clinic Timings</span>
                <span className="block text-[11.5px] text-[#334155]">{clinic.openingHours}</span>
              </span>
            </div>
          )}
          {clinic?.phone && (
            <div className="flex min-w-0 items-start gap-2.5 md:border-r md:border-[#E2EBF6] md:pr-6">
              <PhoneCall aria-hidden="true" className="mt-px h-[17px] w-[17px] shrink-0" style={{ color: TEAL }} />
              <span className="min-w-0">
                <span className="block text-[11.5px] text-[#334155]">In case of emergency, call us at</span>
                <span className="block text-[12.5px] font-bold" style={{ color: LINK }}>{clinic.phone}</span>
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] text-[#334155]">Thank you for trusting</p>
            <p className="text-[12.5px] font-bold" style={{ color: TEAL }}>{clinic?.name ?? 'our clinic'}</p>
            <p className="text-[11.5px] text-[#334155]">We wish your child a speedy recovery!</p>
          </div>
        </footer>
      </div>

      <p className="mt-6 py-2.5 text-center text-[12px] font-semibold text-white" style={{ background: NAVY, borderRadius: '0 0 9px 9px' }}>
        — Caring for Little Lives —
      </p>
    </article>
  );
}
