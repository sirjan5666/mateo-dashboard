import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ArrowLeft, CalendarDays, CalendarPlus, Camera, ChevronDown, ChevronRight, FileText, Mail,
  MessageSquare, Pencil, Phone, Pill, Plus, ShieldCheck, Stethoscope, Syringe, UploadCloud, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PATIENTS } from '../../data/patients';
import { MedicalHistoryPanel } from '../../components/doctor/v2/workspace/MedicalHistoryPanel';
import { DocumentsPanel, InvoicesPanel, NotesPanel, VisitsPanel } from '../../components/doctor/v2/workspace/TablePanels';
import { GrowthChartsPanel, PrescriptionsPanel } from '../../components/doctor/v2/workspace/GrowthPrescriptionPanels';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const H2 = 'font-display text-[15.5px] font-bold tracking-[-0.01em] text-[#0F172A]';

const TABS = ['Overview', 'Medical History', 'Visits & Consultations', 'Growth Charts', 'Documents', 'Prescriptions', 'Invoices', 'Notes'];

/** Specs 16–22. Overview is rendered inline below; every other tab is its own panel. */
const PANELS: Record<string, React.ComponentType> = {
  'Medical History': MedicalHistoryPanel,
  'Visits & Consultations': VisitsPanel,
  'Growth Charts': GrowthChartsPanel,
  Documents: DocumentsPanel,
  Prescriptions: PrescriptionsPanel,
  Invoices: InvoicesPanel,
  Notes: NotesPanel,
};

const BASIC: [string, React.ReactNode][] = [
  ['Patient ID', 'PT-0002485'],
  ['Gender', 'Female'],
  ['Date of Birth', '12 Jan 2023'],
  ['Age', '2y 11m'],
  ['Blood Group', 'B+'],
  ['Allergies', 'No known allergies'],
  ['Address', <>23, Green Park Main,<br />New Delhi, Delhi 110016</>],
];

const HEALTH: { icon: LucideIcon; tint: string; fg: string; label: string; value: string; footer: React.ReactNode }[] = [
  { icon: Stethoscope, tint: '#E4EBFD', fg: '#2B6FF0', label: 'Total Visits', value: '8', footer: <span className="text-xs font-semibold text-[#3B4FE0]">View details</span> },
  { icon: CalendarDays, tint: '#DCF7E6', fg: '#12A150', label: 'Next Appointment', value: '14 May 2025', footer: <span className="text-[12.5px] font-semibold text-[#0F172A]">11:00 AM</span> },
  { icon: Pill, tint: '#FDE2E2', fg: '#EF4444', label: 'Active Medications', value: '1', footer: <span className="text-xs font-semibold text-[#3B4FE0]">View details</span> },
  { icon: Syringe, tint: '#E4EBFD', fg: '#2B6FF0', label: 'Vaccinations Due', value: '0', footer: <span className="flex items-center gap-1.5 text-xs font-semibold text-[#12A150]"><ShieldCheck className="h-3 w-3" />Up to date</span> },
];

const CONSULTS = [
  { d: '12 May', y: '2025', reason: 'Fever & Cough' },
  { d: '28 Apr', y: '2025', reason: 'General Consultation' },
  { d: '15 Apr', y: '2025', reason: 'Well Baby Checkup' },
  { d: '01 Apr', y: '2025', reason: 'General Consultation' },
  { d: '18 Mar', y: '2025', reason: 'Vaccination' },
];

const TIMELINE: { date: string; event: string; tint: string; fg: string; icon: LucideIcon }[] = [
  { date: '12 May 2025', event: 'Fever & Cough', tint: '#EDE9FE', fg: '#6D5AE0', icon: Stethoscope },
  { date: '28 Apr 2025', event: 'General Consultation', tint: '#DCF7E6', fg: '#12A150', icon: CalendarDays },
  { date: '15 Apr 2025', event: 'Well Baby Checkup', tint: '#E4EBFD', fg: '#2B6FF0', icon: Stethoscope },
  { date: '01 Apr 2025', event: 'General Consultation', tint: '#DCF7E6', fg: '#12A150', icon: CalendarDays },
  { date: '18 Mar 2025', event: 'Vaccination', tint: '#E4EBFD', fg: '#2B6FF0', icon: Syringe },
];

interface GrowthSeries {
  unit: string;
  ticks: number[];
  data: { x: string; v: number }[];
  latest: string;
  pct: string;
  z: string;
}

const SERIES: Record<'Weight' | 'Height' | 'BMI', GrowthSeries> = {
  Weight: { unit: 'kg', ticks: [6, 8, 10, 12, 14, 16], data: [
    { x: '12 Jan 2023', v: 8.2 }, { x: '12 Apr 2023', v: 9.1 }, { x: '12 Jul 2023', v: 10.3 },
    { x: '12 Oct 2023', v: 11.2 }, { x: '12 Jan 2024', v: 12.4 }, { x: '12 Apr 2024', v: 13.1 },
  ], latest: '14.2 kg', pct: '62nd', z: '+0.31' },
  Height: { unit: 'cm', ticks: [60, 70, 80, 90, 100], data: [
    { x: '12 Jan 2023', v: 72.4 }, { x: '12 Apr 2023', v: 76.1 }, { x: '12 Jul 2023', v: 79.8 },
    { x: '12 Oct 2023', v: 83.0 }, { x: '12 Jan 2024', v: 86.2 }, { x: '12 Apr 2024', v: 89.1 },
  ], latest: '92.0 cm', pct: '55th', z: '+0.18' },
  BMI: { unit: '', ticks: [14, 15, 16, 17, 18], data: [
    { x: '12 Jan 2023', v: 15.6 }, { x: '12 Apr 2023', v: 15.7 }, { x: '12 Jul 2023', v: 16.2 },
    { x: '12 Oct 2023', v: 16.3 }, { x: '12 Jan 2024', v: 16.7 }, { x: '12 Apr 2024', v: 16.5 },
  ], latest: '16.8', pct: '58th', z: '+0.24' },
};

const QUICK: { icon: LucideIcon; label: string }[] = [
  { icon: CalendarPlus, label: 'Book Appointment' },
  { icon: Stethoscope, label: 'Add Prescription' },
  { icon: UploadCloud, label: 'Upload Document' },
  { icon: MessageSquare, label: 'Send Message' },
];

export default function PatientWorkspace() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tab, setTab] = useState('Overview');
  const [metric, setMetric] = useState<keyof typeof SERIES>('Weight');
  const s = SERIES[metric];
  const patient = PATIENTS.find((p) => p.id === id) ?? PATIENTS[1];
  const Panel = PANELS[tab];

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <div className="min-w-0">
        <button type="button" onClick={() => navigate('/doctor/patients')} className="mb-3.5 flex items-center gap-2 text-[13.5px] font-semibold text-[#3B4FE0] hover:underline">
          <ArrowLeft className="h-[17px] w-[17px]" />
          Back to Patients
        </button>

        {/* Patient header */}
        <div className="mb-5 flex flex-wrap items-start gap-[22px]">
          <div className="relative shrink-0">
            <span role="img" aria-label={patient.name} className="grid h-24 w-24 place-items-center rounded-full text-[30px] font-bold shadow-[0_2px_12px_-4px_rgba(15,23,42,.25)] ring-[3px] ring-white" style={{ background: patient.tint, color: patient.fg }}>
              {patient.name.split(' ').map((w) => w[0]).join('')}
            </span>
            <button type="button" aria-label="Change patient photo" onClick={() => console.log('[Clinic OS] Change photo')}
              className="absolute -bottom-0.5 -right-0.5 grid h-[26px] w-[26px] place-items-center rounded-full border border-[#E2E6F0] bg-white">
              <Camera className="h-[13px] w-[13px] text-[#64748B]" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[27px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">{patient.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-[11px] gap-y-2 text-[13.5px]">
              <span className="font-bold text-[#334155]">{patient.id}</span>
              <span aria-hidden="true" className="text-[#CBD5E1]">•</span>
              <span className="font-medium text-[#475569]">Female</span>
              <span aria-hidden="true" className="text-[#CBD5E1]">•</span>
              <span className="font-medium text-[#475569]">2y 11m</span>
              <span aria-hidden="true" className="text-[#CBD5E1]">•</span>
              <span className="font-medium text-[#475569]">12 Jan 2023</span>
              <span className="rounded-[7px] bg-[#DCF7E6] px-3 py-1 text-[11.5px] font-bold text-[#12A150]">Active</span>
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-[30px] gap-y-2 text-[13px] font-medium text-[#334155]">
              <a href={`tel:${patient.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-[#3B4FE0]">
                <Phone aria-hidden="true" className="h-[15px] w-[15px] text-[#64748B]" />+91 91234 56789
              </a>
              <a href="mailto:myra.kapoor@email.com" className="flex items-center gap-2 hover:text-[#3B4FE0]">
                <Mail aria-hidden="true" className="h-[15px] w-[15px] text-[#64748B]" />myra.kapoor@email.com
              </a>
              <span className="flex items-center gap-2">
                <Users aria-hidden="true" className="h-[15px] w-[15px] text-[#64748B]" />Parent: Rohan Kapoor
              </span>
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate('/doctor/patients/new')} className="flex h-[46px] items-center gap-2 rounded-[11px] border border-[#E2E6F0] bg-white px-[22px] hover:bg-[#F7F8FC]">
                <Pencil className="h-[17px] w-[17px] text-[#334155]" />
                <span className="text-sm font-bold text-[#1E2A5A]">Edit Patient</span>
              </button>
              <button type="button" onClick={() => navigate('/doctor/appointments')} className="flex h-[46px] items-center gap-2 rounded-[11px] px-[22px] text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105" style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
                <Plus className="h-[18px] w-[18px]" />
                <span className="text-sm font-bold">New Appointment</span>
              </button>
            </div>
            <button type="button" aria-label="More actions" onClick={() => console.log('[Clinic OS] More Actions')} className="flex h-11 items-center justify-center gap-2 self-end rounded-[11px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
              <span className="text-[13.5px] font-bold text-[#1E2A5A]">More Actions</span>
              <ChevronDown className="h-[17px] w-[17px] text-[#94A3B8]" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Patient sections" className="mb-[18px] flex gap-8 overflow-x-auto border-b border-[#E4E8F1]">
          {TABS.map((t) => (
            <button key={t} role="tab" type="button" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1}
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

        {Panel ? (
          <div role="tabpanel" aria-label={tab}>
            <Panel />
          </div>
        ) : (
          <div role="tabpanel" aria-label={tab} className="flex flex-col gap-4">
            {/* Row 1 */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[0.86fr_0.72fr_1.02fr]">
              <section className={`${CARD} px-[22px] py-5`}>
                <h2 className={H2}>Basic Information</h2>
                <dl className="mt-4 flex flex-col gap-[15px]">
                  {BASIC.map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                      <dt className="w-[118px] shrink-0 text-[13px] font-medium text-[#64748B]">{k}</dt>
                      <dd className="min-w-0 text-[13px] font-semibold text-[#0F172A]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className={`${CARD} px-[22px] py-5`}>
                <h2 className={H2}>Emergency Contact</h2>
                {[
                  { name: 'Rohan Kapoor (Father)', phone: '+91 98765 43210', email: 'rohan.kapoor@email.com' },
                  { name: 'Anita Kapoor (Mother)', phone: '+91 98765 43211', email: 'anita.kapoor@email.com' },
                ].map((c, i) => (
                  <div key={c.name} className={i === 0 ? 'mt-4' : 'mt-5'}>
                    <p className="text-[13.5px] font-bold text-[#0F172A]">{c.name}</p>
                    <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="mt-2.5 flex items-center gap-2 text-[13px] font-medium text-[#334155] hover:text-[#3B4FE0]">
                      <Phone aria-hidden="true" className="h-3.5 w-3.5 text-[#64748B]" />{c.phone}
                    </a>
                    <a href={`mailto:${c.email}`} className="mt-[7px] flex items-center gap-2 truncate text-[13px] font-medium text-[#334155] hover:text-[#3B4FE0]">
                      <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />{c.email}
                    </a>
                  </div>
                ))}
                <button type="button" onClick={() => console.log('[Clinic OS] Add Emergency Contact')} className="mt-5 flex items-center gap-2 text-[13px] font-semibold text-[#3B4FE0] hover:underline">
                  <Plus className="h-[15px] w-[15px]" />Add Emergency Contact
                </button>
              </section>

              <section className={`${CARD} px-[22px] py-5`}>
                <h2 className={H2}>Health Summary</h2>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {HEALTH.map((h) => (
                    <div key={h.label} className="rounded-[11px] border border-[#ECEEF4] px-[15px] py-3.5">
                      <div className="flex items-center gap-[11px]">
                        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px]" style={{ background: h.tint }}>
                          <h.icon className="h-4 w-4" style={{ color: h.fg }} />
                        </span>
                        <span className="min-w-0 text-[12.5px] font-medium text-[#64748B]">{h.label}</span>
                      </div>
                      <p className="mt-2.5 text-[15px] font-extrabold text-[#0F172A]">{h.value}</p>
                      <p className="mt-[7px]">{h.footer}</p>
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
                  <button type="button" className="ml-auto text-[12.5px] font-bold text-[#3B4FE0] hover:underline">View All</button>
                </div>
                <div className="mt-3.5">
                  {CONSULTS.map((c, i) => (
                    <button key={c.d} type="button" aria-label={`${c.d} ${c.y}, ${c.reason}, Completed`}
                      onClick={() => navigate('/doctor/consultations/CON-0002456')}
                      className={cn('flex h-[60px] w-full items-center gap-3 px-[22px] text-left transition-colors hover:bg-[#FAFBFF]', i > 0 && 'border-t border-[#F1F3F9]')}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#EEF1F8]">
                        <FileText className="h-4 w-4 text-[#64748B]" />
                      </span>
                      <span className="w-[72px] shrink-0">
                        <span className="block text-[12.5px] font-semibold text-[#0F172A]">{c.d}</span>
                        <span className="block text-[12.5px] font-medium text-[#64748B]">{c.y}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-[#0F172A]">{c.reason}</span>
                        <span className="block truncate text-xs text-[#64748B]">Dr. Ananya Sharma</span>
                      </span>
                      <span className="shrink-0 rounded-[6px] bg-[#DCF7E6] px-[9px] py-[3px] text-[11px] font-bold text-[#12A150]">Completed</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                    </button>
                  ))}
                </div>
              </section>

              <section className={`${CARD} px-[22px] py-5`}>
                <div className="flex items-center">
                  <h2 className={H2}>Growth Summary</h2>
                  <button type="button" className="ml-auto text-[12.5px] font-bold text-[#3B4FE0] hover:underline">View Full Chart</button>
                </div>
                <div role="radiogroup" aria-label="Growth metric" className="mt-3.5 flex gap-1.5">
                  {(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((k) => (
                    <button key={k} role="radio" type="button" aria-checked={metric === k} onClick={() => setMetric(k)}
                      className={cn('h-[38px] rounded-[10px] px-5 text-[13.5px] transition-colors',
                        metric === k ? 'border-[1.5px] border-[#6366F1] bg-[#F0EFFE] font-bold text-[#3B4FE0]' : 'border border-[#E2E6F0] bg-white font-semibold text-[#334155] hover:bg-[#F7F8FC]')}>
                      {k}
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-[11px] font-medium text-[#64748B]">{s.unit || 'BMI'}</p>
                <div role="img" aria-label={`${metric} over time for ${patient.name}`} style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={s.data} margin={{ top: 18, right: 12, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F46E5" stopOpacity={0.1} /><stop offset="100%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                      <XAxis dataKey="x" tick={{ fontSize: 10.5, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={0} />
                      <YAxis domain={[s.ticks[0], s.ticks[s.ticks.length - 1]]} ticks={[...s.ticks]} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                      <Area type="linear" dataKey="v" stroke="#4F46E5" strokeWidth={2.5} fill="url(#gw)" dot={{ r: 4, fill: '#4F46E5' }} isAnimationActive={false}>
                        <LabelList dataKey="v" position="top" offset={10} style={{ fontSize: 11.5, fontWeight: 600, fill: '#334155' }} />
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <table className="sr-only">
                  <caption>{metric} measurements</caption>
                  <tbody>{s.data.map((d) => <tr key={d.x}><td>{d.x}</td><td>{d.v} {s.unit}</td></tr>)}</tbody>
                </table>

                <dl className="mt-[18px] grid grid-cols-3 border-t border-[#F1F3F9] pt-[18px]">
                  {([['Latest (12 May 2025)', s.latest, '#0F172A'], ['Growth Percentile', s.pct, '#0F172A'], ['Z-score', s.z, '#12A150']] as const).map(([k, v, c]) => (
                    <div key={k}>
                      <dt className="text-xs font-medium text-[#64748B]">{k}</dt>
                      <dd className="mt-1.5 text-[15.5px] font-extrabold" style={{ color: c }}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </div>
        )}
      </div>

      {/* ── Right rail ── */}
      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-[18px] pt-5`}>
          <h2 className={H2}>Patient Timeline</h2>
          <ol className="relative mt-4">
            <span aria-hidden="true" className="absolute bottom-4 left-4 top-4 w-0.5 bg-[#E4E8F1]" />
            {TIMELINE.map((t, i) => (
              <li key={t.date} className={cn('relative flex items-start gap-3', i > 0 && 'mt-[22px]')}>
                <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-[9px]" style={{ background: t.tint }}>
                  <t.icon className="h-4 w-4" style={{ color: t.fg }} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold text-[#0F172A]">{t.date}</span>
                  <span className="mt-[3px] block truncate text-[13px] font-semibold text-[#0F172A]">{t.event}</span>
                  <span className="mt-0.5 block truncate text-xs text-[#64748B]">Dr. Ananya Sharma</span>
                </span>
              </li>
            ))}
          </ol>
          <button type="button" className="mt-5 flex items-center gap-[7px] text-[12.5px] font-bold text-[#3B4FE0] hover:underline">
            View Full Timeline<ChevronRight className="h-[15px] w-[15px]" />
          </button>
        </section>

        <section className={`${CARD} px-5 py-5`}>
          <h2 className={H2}>Upcoming Appointment</h2>
          <div className="mt-[15px] flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#E4EBFD]">
              <CalendarDays className="h-4 w-4 text-[#2B6FF0]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px]">
                <span className="font-bold text-[#0F172A]">14 May 2025</span>
                <span aria-hidden="true" className="px-1.5 text-[#CBD5E1]">•</span>
                <span className="font-semibold text-[#334155]">11:00 AM</span>
              </p>
              <p className="mt-[5px] text-[13px] font-bold text-[#0F172A]">Follow-up Consultation</p>
              <p className="mt-[3px] text-xs text-[#64748B]">with Dr. Ananya Sharma</p>
            </div>
            <span className="shrink-0 rounded-[6px] bg-[#DCE9FE] px-2.5 py-1 text-[11px] font-bold text-[#2B6FF0]">Scheduled</span>
          </div>
        </section>

        <section className={`${CARD} pb-3.5 pt-5`}>
          <h2 className={cn(H2, 'px-5')}>Quick Actions</h2>
          <ul className="mt-3">
            {QUICK.map((q) => (
              <li key={q.label}>
                <button type="button" aria-label={q.label} onClick={() => console.log('[Clinic OS]', q.label)}
                  className="flex h-[46px] w-full items-center gap-3.5 px-5 text-left transition-colors hover:bg-[#FAFBFF]">
                  <q.icon className="h-[18px] w-[18px] shrink-0 text-[#3B4FE0]" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#334155]">{q.label}</span>
                  <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#CBD5E1]" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
