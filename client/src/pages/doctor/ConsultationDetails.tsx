import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, CalendarDays, ChevronRight, Download, Paperclip, Phone, Printer, Ruler, Scale,
  Stethoscope,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getEncounter, listEncounters } from '../../api/doctorEncounters';
import { listPrescriptions } from '../../api/doctorPrescriptions';
import { documentFileUrl, listDocuments, listGrowthRecords } from '../../api/doctorPatientClinical';
import type { GrowthRecord } from '../../api/doctorPatientClinical';
import { ageParts } from '../../data/patients';
import { PanelState, swatch, useLoad, wsDate, wsTime } from '../../components/doctor/v2/workspace/shared';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const H2 = 'font-display text-[15.5px] font-bold tracking-[-0.01em] text-[#0F172A]';

const KIND_LABEL: Record<string, string> = {
  visit: 'Consultation', follow_up: 'Follow-up', phone: 'Tele Consultation', procedure: 'Procedure', note: 'Clinical Note',
};

/** Whole days between two instants — used to find the measurement nearest a visit. */
const daysApart = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;

/**
 * Consultation (encounter) detail.
 *
 * The clinic records SOAP notes, prescriptions, growth measurements and
 * documents — so that is what this page shows. There is deliberately NO
 * temperature / heart-rate / SpO2 block: this app has no observations model, and
 * inventing numbers on a clinical screen is not acceptable.
 */
export default function ConsultationDetails() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data, loading, error } = useLoad(
    async () => {
      if (!id) throw new Error('No consultation selected');
      const { encounter, patient } = await getEncounter(id);
      if (!patient) return { encounter, patient: null, rx: [], growth: [] as GrowthRecord[], docs: [], history: [] };
      const [rx, growth, docs, history] = await Promise.all([
        listPrescriptions(patient.id),
        listGrowthRecords(patient.id),
        listDocuments(patient.id),
        listEncounters(patient.id),
      ]);
      return {
        encounter,
        patient,
        rx: rx.prescriptions,
        growth: growth.records,
        docs: docs.documents,
        history: history.encounters,
      };
    },
    [id],
  );

  if (loading || error || !data?.encounter) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-[13.5px] font-semibold text-[#3B4FE0] hover:underline">
          <ArrowLeft className="h-[17px] w-[17px]" />Back
        </button>
        <PanelState loading={loading} error={error} empty={!loading && !error} emptyText="This consultation was not found." />
      </div>
    );
  }

  const { encounter, patient, rx, growth, docs, history } = data;
  const visitDay = encounter.date;

  // Medications written on the same calendar day as this visit.
  const meds = rx.filter((p) => p.date.slice(0, 10) === visitDay.slice(0, 10));

  // The measurement closest to this visit, within a week — real numbers only.
  const nearest = growth
    .map((g) => ({ g, gap: daysApart(g.takenAt, visitDay) }))
    .filter(({ gap }) => gap <= 7)
    .sort((a, b) => a.gap - b.gap)[0]?.g ?? null;

  const measures: { icon: LucideIcon; color: string; label: string; value: string }[] = nearest
    ? ([
      nearest.weightKg != null ? { icon: Scale, color: '#F59E0B', label: 'Weight', value: `${nearest.weightKg} kg` } : null,
      nearest.heightCm != null ? { icon: Ruler, color: '#7C5CFF', label: 'Height', value: `${nearest.heightCm} cm` } : null,
      // 1dp, matching the Growth Charts table — the same number must not print
      // as "16.9" there and "16.86" here.
      nearest.bmi != null ? { icon: Scale, color: '#2B6FF0', label: 'BMI', value: nearest.bmi.toFixed(1) } : null,
      nearest.headCircumferenceCm != null ? { icon: Ruler, color: '#12A150', label: 'Head circ.', value: `${nearest.headCircumferenceCm} cm` } : null,
    ].filter((m): m is NonNullable<typeof m> => m !== null))
    : [];

  const docsNearby = docs.filter((d) => daysApart(d.createdAt, visitDay) <= 7);
  const previous = history.filter((h) => h.id !== encounter.id).slice(0, 4);

  const age = patient?.dob ? ageParts(patient.dob) : null;

  const SOAP: [string, string | null][] = [
    ['Subjective', encounter.subjective],
    ['Objective', encounter.objective],
    ['Assessment', encounter.assessment],
    ['Plan', encounter.plan],
  ];

  return (
    <div className="consultation-print">
      <button type="button" onClick={() => (patient ? navigate(`/doctor/patients/${patient.id}`) : navigate('/doctor/appointments'))}
        className="no-print mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-[#3B4FE0] hover:underline">
        <ArrowLeft className="h-[17px] w-[17px]" />
        {patient ? `Back to ${patient.displayName}` : 'Back to Appointments'}
      </button>

      {/* Header */}
      <div className="mb-[18px] flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]" style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
              <Stethoscope className="h-5 w-5 text-white" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[21px] font-extrabold tracking-[-0.02em] text-[#0F172A]">
                {KIND_LABEL[encounter.kind] ?? 'Consultation'}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#64748B]">
                <span className="flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" className="h-[14px] w-[14px]" />
                  {wsDate(encounter.date)} • {wsTime(encounter.date)}
                </span>
                {patient && (
                  <>
                    <span aria-hidden="true" className="text-[#CBD5E1]">•</span>
                    <button type="button" onClick={() => navigate(`/doctor/patients/${patient.id}`)}
                      className="font-semibold text-[#3B4FE0] hover:underline">
                      {patient.displayName}
                    </button>
                    {age && <span>{age.years}y {age.months}m</span>}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="no-print flex flex-wrap items-center gap-3">
          {patient?.phone && (
            <a href={`tel:${patient.phone.replace(/\s/g, '')}`}
              className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
              <Phone className="h-4 w-4 text-[#334155]" />
              <span className="text-[13px] font-bold text-[#1E2A5A]">Call</span>
            </a>
          )}
          <button type="button" onClick={() => window.print()} className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
            <Printer className="h-4 w-4 text-[#334155]" />
            <span className="text-[13px] font-bold text-[#1E2A5A]">Print</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* SOAP note */}
          <section className={`${CARD} px-[22px] py-5`}>
            <h2 className={H2}>Visit Note</h2>
            <dl className="mt-4 flex flex-col gap-4">
              {SOAP.map(([label, text]) => (
                <div key={label}>
                  <dt className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]">{label}</dt>
                  <dd className={cn('mt-1.5 whitespace-pre-wrap text-[13px] leading-[22px]', text ? 'text-[#334155]' : 'text-[#94A3B8]')}>
                    {text || 'Not recorded'}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Measurements */}
          <section className={`${CARD} px-[22px] py-5`}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={H2}>Measurements</h2>
              {nearest && <span className="ml-auto text-[12px] font-medium text-[#64748B]">Recorded {wsDate(nearest.takenAt)}</span>}
            </div>
            {measures.length ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {measures.map((m) => (
                  <div key={m.label} className="rounded-[11px] border border-[#ECEEF4] px-[15px] py-3.5">
                    <m.icon aria-hidden="true" className="h-[18px] w-[18px]" style={{ color: m.color }} />
                    <dd className="mt-2 text-[17px] font-extrabold text-[#0F172A]">{m.value}</dd>
                    <dt className="mt-1 text-[11.5px] font-medium text-[#64748B]">{m.label}</dt>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 rounded-[11px] bg-[#F7F8FC] px-4 py-6 text-center text-[12.5px] font-medium text-[#64748B]">
                No growth measurement recorded within a week of this visit.
              </p>
            )}
          </section>

          {/* Medications prescribed at this visit */}
          <section className={`${CARD} pb-4 pt-5`}>
            <h2 className={cn(H2, 'px-[22px]')}>Medications Prescribed</h2>
            {meds.length ? (
              <div className="mt-3.5 overflow-x-auto">
                <table className="w-full min-w-[700px] border-separate border-spacing-0">
                  <caption className="sr-only">Medications prescribed at this visit</caption>
                  <thead>
                    <tr>
                      {['Medicine', 'Dose', 'Frequency', 'Duration', 'Instructions'].map((h, i) => (
                        <th key={h} scope="col" className={cn('h-10 border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]', i === 0 && 'pl-[22px]')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {meds.map((m) => (
                      <tr key={m.id}>
                        <th scope="row" className="h-[52px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left text-[13px] font-bold text-[#0F172A]">{m.drug}</th>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.dose ?? '—'}</td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.frequency ?? '—'}</td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.duration ?? '—'}</td>
                        <td className="border-b border-[#F1F3F9] pr-[22px] text-[12.5px] font-medium text-[#334155]">{m.instructions ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mx-[22px] mt-3.5 rounded-[11px] bg-[#F7F8FC] px-4 py-6 text-center text-[12.5px] font-medium text-[#64748B]">
                No medications were prescribed on this date.
              </p>
            )}
          </section>
        </div>

        {/* ── Right rail ── */}
        <div className="flex min-w-0 flex-col gap-[18px]">
          <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
            <div className="flex items-center gap-2.5">
              <Paperclip aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
              <h2 className={H2}>Attachments</h2>
            </div>
            {docsNearby.length ? (
              <ul className="mt-3">
                {docsNearby.map((d) => {
                  const sw = swatch(d.type);
                  return (
                    <li key={d.id} className="flex h-[46px] items-center gap-3">
                      <span aria-hidden="true" className="grid h-[34px] w-[30px] shrink-0 place-items-center rounded-[6px] text-[8px] font-extrabold" style={{ background: sw.tint, color: sw.fg }}>
                        {d.ext}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-bold text-[#0F172A]">{d.name}</span>
                        <span className="block text-[11.5px] text-[#64748B]">{d.ext} • {d.size}</span>
                      </span>
                      {patient && (
                        <a href={documentFileUrl(patient.id, d.id)} target="_blank" rel="noreferrer"
                          aria-label={`Open ${d.name}`} className="no-print shrink-0 text-[#94A3B8] hover:text-[#334155]">
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 rounded-[11px] bg-[#F7F8FC] px-4 py-6 text-center text-[12.5px] font-medium text-[#64748B]">
                Nothing uploaded around this visit.
              </p>
            )}
          </section>

          <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
            <h2 className={H2}>Previous Visits</h2>
            {previous.length ? (
              <ul className="mt-3.5">
                {previous.map((p, i) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => navigate(`/doctor/consultations/${p.id}`)}
                      className={cn('flex h-[58px] w-full items-center gap-3 text-left transition-colors hover:bg-[#FAFBFF]', i > 0 && 'border-t border-[#F1F3F9]')}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-[#64748B]">{wsDate(p.date)}</span>
                        <span className="block truncate text-[13px] font-bold text-[#0F172A]">
                          {p.assessment || p.subjective || KIND_LABEL[p.kind] || 'Visit'}
                        </span>
                      </span>
                      <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#94A3B8]" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-[11px] bg-[#F7F8FC] px-4 py-6 text-center text-[12.5px] font-medium text-[#64748B]">
                This is the first recorded visit.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
