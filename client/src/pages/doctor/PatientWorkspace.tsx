import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ArrowLeft,
  Loader2, CalendarDays, CalendarPlus, ChevronRight, FileText, Mail,
  Pencil, Phone, Pill, Plus, ShieldCheck, Stethoscope, Syringe,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getPatient, patientNumber } from '../../api/doctorPatients';
import type { Patient as ApiPatient, PortalStatus, Template } from '../../api/doctorPatients';
import { listEncounters } from '../../api/doctorEncounters';
import { listPatientAppointments } from '../../api/doctorAppointments';
import { listPrescriptions } from '../../api/doctorPrescriptions';
import { listGrowthRecords, listImmunisations } from '../../api/doctorPatientClinical';
import type { GrowthRecord } from '../../api/doctorPatientClinical';
import { ageParts, formatDate } from '../../data/patients';
import { MedicalHistoryPanel } from '../../components/doctor/v2/workspace/MedicalHistoryPanel';
import { DocumentsPanel, InvoicesPanel, NotesPanel, VisitsPanel } from '../../components/doctor/v2/workspace/TablePanels';
import { GrowthChartsPanel, PrescriptionsPanel } from '../../components/doctor/v2/workspace/GrowthPrescriptionPanels';
import { IssuePrescriptionModal } from '../../components/doctor/v2/IssuePrescriptionModal';
import { PanelState, fieldText, swatch, useLoad, wsDate, wsTime } from '../../components/doctor/v2/workspace/shared';
import type { WorkspacePanelProps } from '../../components/doctor/v2/workspace/shared';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const H2 = 'font-display text-[15.5px] font-bold tracking-[-0.01em] text-[#0F172A]';

const TABS = ['Overview', 'Medical History', 'Visits & Consultations', 'Growth Charts', 'Documents', 'Prescriptions', 'Invoices', 'Notes'];

/** Specs 16–22. Overview is rendered inline below; every other tab is its own panel. */
const PANELS: Record<string, React.ComponentType<WorkspacePanelProps>> = {
  'Medical History': MedicalHistoryPanel,
  'Visits & Consultations': VisitsPanel,
  'Growth Charts': GrowthChartsPanel,
  Documents: DocumentsPanel,
  Prescriptions: PrescriptionsPanel,
  Invoices: InvoicesPanel,
  Notes: NotesPanel,
};


type OverviewMetric = 'Weight' | 'Height' | 'Head' | 'BMI';
const OVERVIEW_UNIT: Record<OverviewMetric, string> = { Weight: 'kg', Height: 'cm', Head: 'cm', BMI: '' };
const overviewValue = (r: GrowthRecord, m: OverviewMetric) =>
  (m === 'Weight' ? r.weightKg : m === 'Height' ? r.heightCm : m === 'Head' ? r.headCircumferenceCm : r.bmi);

function OverviewTab({
  patientId, patientName, dob, sex, templateFields, fields, phone, patientCode, portal, parentAccess,
}: WorkspacePanelProps & { phone?: string | null; patientCode?: string | null; portal?: PortalStatus; parentAccess?: PortalStatus }) {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<OverviewMetric>('Weight');
  const [rxModal, setRxModal] = useState(false);

  const { data, loading, error } = useLoad(
    async () => {
      const [enc, appts, rx, growth, imm] = await Promise.all([
        listEncounters(patientId),
        listPatientAppointments(patientId),
        listPrescriptions(patientId),
        listGrowthRecords(patientId),
        listImmunisations(patientId),
      ]);
      return {
        encounters: enc.encounters,
        appointments: appts.appointments,
        prescriptions: rx.prescriptions,
        growth: growth.records,
        immSummary: imm.summary,
      };
    },
    [patientId],
  );

  const encounters = data?.encounters ?? [];
  const now = new Date().toISOString();
  const nextAppt = useMemo(
    () => [...(data?.appointments ?? [])].sort((a, b) => a.start.localeCompare(b.start)).find((a) => a.start > now && a.status === 'scheduled') ?? null,
    [data, now],
  );
  const activeMeds = (data?.prescriptions ?? []).filter((p) => p.status === 'active');
  const immDue = (data?.immSummary?.due ?? 0) + (data?.immSummary?.overdue ?? 0);

  const series = useMemo(() => {
    const chrono = [...(data?.growth ?? [])].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    return chrono
      .map((r) => ({ x: wsDate(r.takenAt), v: overviewValue(r, metric) }))
      .filter((p): p is { x: string; v: number } => p.v != null);
  }, [data, metric]);

  const latest = series.length ? series[series.length - 1] : null;

  const basic: [string, React.ReactNode][] = [
    ['Patient ID', patientNumber(patientCode)],
    ['Gender', sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : 'Unspecified'],
    ['Date of Birth', dob ? formatDate(dob) : '—'],
    ['Age', dob ? `${ageParts(dob).years}y ${ageParts(dob).months}m` : '—'],
    ...(templateFields ?? [])
      .map((f) => [f.label, fieldText(fields?.[f.key])] as const)
      .filter((pair): pair is readonly [string, string] => pair[1] !== null)
      .slice(0, 5)
      .map(([k, v]) => [k, v] as [string, React.ReactNode]),
  ];

  const health: { icon: LucideIcon; tint: string; fg: string; label: string; value: string; footer: React.ReactNode }[] = [
    {
      icon: Stethoscope, tint: '#E4EBFD', fg: '#2B6FF0', label: 'Total Visits', value: String(encounters.length),
      footer: <span className="text-xs font-semibold text-[#64748B]">{encounters.length ? `Last ${wsDate(encounters[0].date)}` : 'None yet'}</span>,
    },
    {
      icon: CalendarDays, tint: '#DCF7E6', fg: '#12A150', label: 'Next Appointment', value: nextAppt ? wsDate(nextAppt.start) : '—',
      footer: <span className="text-[12.5px] font-semibold text-[#0F172A]">{nextAppt ? wsTime(nextAppt.start) : 'Nothing scheduled'}</span>,
    },
    {
      icon: Pill, tint: '#FDE2E2', fg: '#EF4444', label: 'Active Medications', value: String(activeMeds.length),
      footer: <span className="truncate text-xs font-semibold text-[#64748B]">{activeMeds[0]?.drug ?? 'None active'}</span>,
    },
    {
      icon: Syringe, tint: '#E4EBFD', fg: '#2B6FF0', label: 'Vaccinations Due', value: String(immDue),
      footer: immDue === 0
        ? <span className="flex items-center gap-1.5 text-xs font-semibold text-[#12A150]"><ShieldCheck className="h-3 w-3" />Nothing due</span>
        : <span className="text-xs font-semibold text-[#E8890B]">{data?.immSummary.overdue ?? 0} overdue</span>,
    },
  ];

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* Row 1 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[0.86fr_0.72fr_1.02fr]">
          <section className={`${CARD} px-[22px] py-5`}>
            <h2 className={H2}>Basic Information</h2>
            <dl className="mt-4 flex flex-col gap-[15px]">
              {basic.map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-[118px] shrink-0 text-[13px] font-medium text-[#64748B]">{k}</dt>
                  <dd className="min-w-0 text-[13px] font-semibold text-[#0F172A]">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={`${CARD} px-[22px] py-5`}>
            <h2 className={H2}>Contacts</h2>
            {phone ? (
              <div className="mt-4">
                <p className="text-[13.5px] font-bold text-[#0F172A]">Registered phone</p>
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="mt-2.5 flex items-center gap-2 text-[13px] font-medium text-[#334155] hover:text-[#3B4FE0]">
                  <Phone aria-hidden="true" className="h-3.5 w-3.5 text-[#64748B]" />{phone}
                </a>
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-[#94A3B8]">No phone number on record.</p>
            )}
            {parentAccess?.email && (
              <div className="mt-5">
                <p className="text-[13.5px] font-bold text-[#0F172A]">Parent app account</p>
                <a href={`mailto:${parentAccess.email}`} className="mt-2.5 flex items-center gap-2 truncate text-[13px] font-medium text-[#334155] hover:text-[#3B4FE0]">
                  <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />{parentAccess.email}
                </a>
              </div>
            )}
            {portal?.email && (
              <div className="mt-5">
                <p className="text-[13.5px] font-bold text-[#0F172A]">Patient portal login</p>
                <a href={`mailto:${portal.email}`} className="mt-2.5 flex items-center gap-2 truncate text-[13px] font-medium text-[#334155] hover:text-[#3B4FE0]">
                  <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />{portal.email}
                </a>
              </div>
            )}
            {/* Opens THIS patient's record for editing — not a blank register form. */}
            {!phone && !parentAccess?.email && !portal?.email && (
              <button type="button" onClick={() => navigate(`/doctor/patients/new?edit=${patientId}`)} className="mt-5 flex items-center gap-2 text-[13px] font-semibold text-[#3B4FE0] hover:underline">
                <Plus className="h-[15px] w-[15px]" />Add contact details
              </button>
            )}
          </section>

          <section className={`${CARD} px-[22px] py-5`}>
            <h2 className={H2}>Health Summary</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {health.map((h) => (
                <div key={h.label} className="rounded-[11px] border border-[#ECEEF4] px-[15px] py-3.5">
                  <div className="flex items-center gap-[11px]">
                    <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px]" style={{ background: h.tint }}>
                      <h.icon className="h-4 w-4" style={{ color: h.fg }} />
                    </span>
                    <span className="min-w-0 text-[12.5px] font-medium text-[#64748B]">{h.label}</span>
                  </div>
                  <p className="mt-2.5 text-[15px] font-extrabold text-[#0F172A]">{h.value}</p>
                  <p className="mt-[7px] truncate">{h.footer}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.78fr_1fr]">
          <section className={`${CARD} pb-4 pt-5`}>
            <div className="flex items-center px-[22px]">
              <h2 className={H2}>Recent Consultations</h2>
            </div>
            <div className="mt-3.5 px-[22px]">
              <PanelState loading={loading} error={error} empty={!encounters.length} emptyText="No visits recorded yet." />
            </div>
            <div className="mt-3.5">
              {encounters.slice(0, 5).map((c, i) => {
                const sw = swatch(c.kind);
                return (
                  <button key={c.id} type="button"
                    aria-label={`${wsDate(c.date)}, ${c.assessment || c.subjective || 'Visit'}`}
                    onClick={() => navigate(`/doctor/consultations/${c.id}`)}
                    className={cn('flex h-[60px] w-full items-center gap-3 px-[22px] text-left transition-colors hover:bg-[#FAFBFF]', i > 0 && 'border-t border-[#F1F3F9]')}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px]" style={{ background: sw.tint }}>
                      <FileText className="h-4 w-4" style={{ color: sw.fg }} />
                    </span>
                    <span className="w-[72px] shrink-0">
                      <span className="block text-[12.5px] font-semibold text-[#0F172A]">{wsDate(c.date)}</span>
                      <span className="block text-[12.5px] font-medium text-[#64748B]">{wsTime(c.date)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-[#0F172A]">{c.assessment || c.subjective || 'Visit'}</span>
                      <span className="block truncate text-xs text-[#64748B]">{c.plan || ''}</span>
                    </span>
                    <span className="shrink-0 rounded-[6px] bg-[#DCF7E6] px-[9px] py-[3px] text-[11px] font-bold text-[#12A150]">Completed</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`${CARD} px-[22px] py-5`}>
            <div className="flex items-center">
              <h2 className={H2}>Growth Summary</h2>
              <button type="button" className="ml-auto text-[12.5px] font-bold text-[#3B4FE0] hover:underline"
                onClick={() => document.querySelector<HTMLButtonElement>('[data-tab="Growth Charts"]')?.click()}>
                View Full Chart
              </button>
            </div>
            <div role="radiogroup" aria-label="Growth metric" className="mt-3.5 flex gap-1.5">
              {(['Weight', 'Height', 'Head', 'BMI'] as OverviewMetric[]).map((k) => (
                <button key={k} role="radio" type="button" aria-checked={metric === k} onClick={() => setMetric(k)}
                  className={cn('h-[38px] rounded-[10px] px-5 text-[13.5px] transition-colors',
                    metric === k ? 'border-[1.5px] border-[#6366F1] bg-[#F0EFFE] font-bold text-[#3B4FE0]' : 'border border-[#E2E6F0] bg-white font-semibold text-[#334155] hover:bg-[#F7F8FC]')}>
                  {k}
                </button>
              ))}
            </div>

            {series.length ? (
              <>
                <p className="mt-4 text-[11px] font-medium text-[#64748B]">{OVERVIEW_UNIT[metric] || 'BMI'}</p>
                <div role="img" aria-label={`${metric} over time for ${patientName}`} style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 18, right: 12, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F46E5" stopOpacity={0.1} /><stop offset="100%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                      <XAxis dataKey="x" tick={{ fontSize: 10.5, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                      <Area type="linear" dataKey="v" stroke="#4F46E5" strokeWidth={2.5} fill="url(#gw)" dot={{ r: 4, fill: '#4F46E5' }} isAnimationActive={false}>
                        <LabelList dataKey="v" position="top" offset={10} style={{ fontSize: 11.5, fontWeight: 600, fill: '#334155' }} />
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <table className="sr-only">
                  <caption>{metric} measurements</caption>
                  <tbody>{series.map((d) => <tr key={d.x}><td>{d.x}</td><td>{d.v} {OVERVIEW_UNIT[metric]}</td></tr>)}</tbody>
                </table>
                <dl className="mt-[18px] grid grid-cols-2 border-t border-[#F1F3F9] pt-[18px]">
                  <div>
                    <dt className="text-xs font-medium text-[#64748B]">Latest ({latest?.x})</dt>
                    <dd className="mt-1.5 text-[15.5px] font-extrabold text-[#0F172A]">
                      {latest?.v}{OVERVIEW_UNIT[metric] ? ` ${OVERVIEW_UNIT[metric]}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[#64748B]">Measurements</dt>
                    <dd className="mt-1.5 text-[15.5px] font-extrabold text-[#0F172A]">{series.length}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="mt-4">
                <PanelState loading={loading} error={error} empty emptyText={`No ${metric.toLowerCase()} measurements recorded.`} />
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Right rail — Overview only; specs 16–22 carry their own rail. ── */}
      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-[18px] pt-5`}>
          <h2 className={H2}>Patient Timeline</h2>
          {encounters.length ? (
            <ol className="relative mt-4">
              <span aria-hidden="true" className="absolute bottom-4 left-4 top-4 w-0.5 bg-[#E4E8F1]" />
              {encounters.slice(0, 5).map((t, i) => {
                const sw = swatch(t.kind);
                return (
                  <li key={t.id} className={cn('relative flex items-start gap-3', i > 0 && 'mt-[22px]')}>
                    <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-[9px]" style={{ background: sw.tint }}>
                      <Stethoscope className="h-4 w-4" style={{ color: sw.fg }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-bold text-[#0F172A]">{wsDate(t.date)}</span>
                      <span className="mt-[3px] block truncate text-[13px] font-semibold text-[#0F172A]">{t.assessment || t.subjective || 'Visit'}</span>
                      <span className="mt-0.5 block truncate text-xs text-[#64748B]">{wsTime(t.date)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-4 rounded-[11px] bg-[#F7F8FC] px-4 py-6 text-center text-[12.5px] font-medium text-[#64748B]">
              Nothing on the timeline yet.
            </p>
          )}
        </section>

        <section className={`${CARD} px-5 py-5`}>
          <h2 className={H2}>Upcoming Appointment</h2>
          {nextAppt ? (
            <div className="mt-[15px] flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#E4EBFD]">
                <CalendarDays className="h-4 w-4 text-[#2B6FF0]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px]">
                  <span className="font-bold text-[#0F172A]">{wsDate(nextAppt.start)}</span>
                  <span aria-hidden="true" className="px-1.5 text-[#CBD5E1]">•</span>
                  <span className="font-semibold text-[#334155]">{wsTime(nextAppt.start)}</span>
                </p>
                <p className="mt-[5px] text-[13px] font-bold text-[#0F172A]">{nextAppt.reason ?? 'Consultation'}</p>
                <p className="mt-[3px] text-xs text-[#64748B]">{nextAppt.durationMin} min • {nextAppt.mode.replace('_', ' ')}</p>
              </div>
              <span className="shrink-0 rounded-[6px] bg-[#DCE9FE] px-2.5 py-1 text-[11px] font-bold text-[#2B6FF0]">Scheduled</span>
            </div>
          ) : (
            <>
              <p className="mt-3 text-[12.5px] text-[#64748B]">Nothing scheduled for this patient.</p>
              <button type="button" onClick={() => navigate(`/doctor/appointments/new?patient=${patientId}`)}
                className="mt-3.5 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white text-[13px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
                <CalendarPlus className="h-4 w-4" />Book Appointment
              </button>
            </>
          )}
        </section>

        <section className={`${CARD} pb-3.5 pt-5`}>
          <h2 className={cn(H2, 'px-5')}>Quick Actions</h2>
          <ul className="mt-3">
            {([
              [CalendarPlus, 'Book Appointment', () => navigate(`/doctor/appointments/new?patient=${patientId}`)],
              [Pill, 'Create Prescription', () => setRxModal(true)],
              [FileText, 'Create Invoice', () => navigate(`/doctor/pharmacy/billing?patient=${patientId}`)],
            ] as const).map(([Icon, label, onSelect]) => (
              <li key={label}>
                <button type="button" aria-label={label} onClick={onSelect}
                  className="flex h-[46px] w-full items-center gap-3.5 px-5 text-left transition-colors hover:bg-[#FAFBFF]">
                  <Icon className="h-[18px] w-[18px] shrink-0 text-[#3B4FE0]" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#334155]">{label}</span>
                  <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#CBD5E1]" />
                </button>
              </li>
            ))}
          </ul>
        </section>
        {rxModal && (
          <IssuePrescriptionModal
            patientId={patientId}
            patientName={patientName}
            onClose={() => setRxModal(false)}
            onIssued={(docId) => { setRxModal(false); navigate(`/doctor/prescriptions/${docId}`); }}
          />
        )}
      </div>
    </div>
  );
}

export default function PatientWorkspace() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tab, setTab] = useState('Overview');
  const [patient, setPatient] = useState<ApiPatient | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [portal, setPortal] = useState<PortalStatus | undefined>(undefined);
  const [parentAccess, setParentAccess] = useState<PortalStatus | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await getPatient(id);
        if (cancelled) return;
        setPatient(r.patient);
        setTemplate(r.template);
        setRecord(r.record?.fields ?? null);
        setPortal(r.portal);
        setParentAccess(r.parentAccess);
      } catch (e: unknown) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load this patient');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const Panel = PANELS[tab];

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-[#64748B]">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading patient…
      </p>
    );
  }

  if (!patient) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-lg font-bold text-[#0F172A]">Patient not found</h1>
        <p className="mt-2 text-sm text-[#64748B]">{loadError ?? 'This patient may have been removed.'}</p>
        <button type="button" onClick={() => navigate('/doctor/patients')}
          className="mx-auto mt-5 h-11 rounded-[10px] border border-[#E2E6F0] bg-white px-5 text-[13.5px] font-bold text-[#1E2A5A]">
          Back to Patients
        </button>
      </div>
    );
  }

  const name = patient.displayName;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const age = patient.dob ? ageParts(patient.dob) : null;
  const ageLabel = age ? `${age.years}y ${age.months}m` : '—';
  const sexLabel = patient.sex === 'male' ? 'Male' : patient.sex === 'female' ? 'Female' : 'Unspecified';

  // Fetched once, handed to every tab, so no two tabs can disagree.
  const panelProps: WorkspacePanelProps = {
    patientId: patient.id,
    patientName: name,
    dob: patient.dob,
    sex: patient.sex,
    templateFields: (template?.fields ?? [])
      .filter((f) => !f.archived)
      .map((f) => ({ key: f.key, label: f.label })),
    fields: record ?? undefined,
  };

  return (
    <div className="min-w-0">
      <button type="button" onClick={() => navigate('/doctor/patients')} className="mb-3.5 flex items-center gap-2 text-[13.5px] font-semibold text-[#3B4FE0] hover:underline">
        <ArrowLeft className="h-[17px] w-[17px]" />
        Back to Patients
      </button>

      {/* Patient header */}
      <div className="mb-5 flex flex-wrap items-start gap-[22px]">
        <div className="relative shrink-0">
          <span role="img" aria-label={name} className="grid h-24 w-24 place-items-center rounded-full text-[30px] font-bold shadow-[0_2px_12px_-4px_rgba(15,23,42,.25)] ring-[3px] ring-white" style={{ background: '#EDE9FE', color: '#6D5AE0' }}>
            {initials}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[27px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">{name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-[11px] gap-y-2 text-[13.5px]">
            <span className="font-medium text-[#475569]">{sexLabel}</span>
            <span aria-hidden="true" className="text-[#CBD5E1]">•</span>
            <span className="font-medium text-[#475569]">{ageLabel}</span>
            <span aria-hidden="true" className="text-[#CBD5E1]">•</span>
            <span className="font-medium text-[#475569]">{patient.dob ? formatDate(patient.dob) : '—'}</span>
            <span className="rounded-[7px] bg-[#DCF7E6] px-3 py-1 text-[11.5px] font-bold text-[#12A150]">
              {patient.archivedAt ? 'Archived' : 'Active'}
            </span>
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-[30px] gap-y-2 text-[13px] font-medium text-[#334155]">
            {patient.phone ? (
              <a href={`tel:${patient.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-[#3B4FE0]">
                <Phone aria-hidden="true" className="h-[15px] w-[15px] text-[#64748B]" />{patient.phone}
              </a>
            ) : (
              <span className="flex items-center gap-2 text-[#94A3B8]">
                <Phone aria-hidden="true" className="h-[15px] w-[15px]" />No phone on record
              </span>
            )}
            <span className="text-[#94A3B8]">Patient ID {patientNumber(patient.code)}</span>
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate(`/doctor/patients/new?edit=${patient.id}`)} className="flex h-[46px] items-center gap-2 rounded-[11px] border border-[#E2E6F0] bg-white px-[22px] hover:bg-[#F7F8FC]">
              <Pencil className="h-[17px] w-[17px] text-[#334155]" />
              <span className="text-sm font-bold text-[#1E2A5A]">Edit Patient</span>
            </button>
            <button type="button" onClick={() => navigate(`/doctor/appointments/new?patient=${patient.id}`)} className="flex h-[46px] items-center gap-2 rounded-[11px] px-[22px] text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105" style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
              <Plus className="h-[18px] w-[18px]" />
              <span className="text-sm font-bold">New Appointment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Patient sections" className="mb-[18px] flex gap-8 overflow-x-auto border-b border-[#E4E8F1]">
        {TABS.map((t) => (
          <button key={t} role="tab" type="button" data-tab={t} aria-selected={tab === t} tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              const i = TABS.indexOf(tab);
              if (e.key === 'ArrowRight') setTab(TABS[(i + 1) % TABS.length]);
              if (e.key === 'ArrowLeft') setTab(TABS[(i - 1 + TABS.length) % TABS.length]);
            }}
            className={cn('shrink-0 whitespace-nowrap border-b-[2.5px] pb-3.5 text-[13.5px] transition-colors',
              tab === t ? 'border-[#3B4FE0] font-bold text-[#3B4FE0]' : 'border-transparent font-medium text-[#64748B] hover:text-[#334155]')}>
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tab}>
        {Panel
          ? <Panel key={tab} {...panelProps} />
          : <OverviewTab {...panelProps} phone={patient.phone} patientCode={patient.code} portal={portal} parentAccess={parentAccess} />}
      </div>
    </div>
  );
}
