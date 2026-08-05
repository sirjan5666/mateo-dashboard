import { useNavigate } from 'react-router';
import {
  ArrowLeft, CalendarDays, ChevronDown, ChevronRight, Download, Droplet, Heart, Paperclip,
  Phone, Printer, Ruler, Scale, Stethoscope, Thermometer, UploadCloud, Wind,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const H2 = 'font-display text-[15.5px] font-bold tracking-[-0.01em] text-[#0F172A]';

const VITALS: { icon: LucideIcon; color: string; label: string; value: string; say: string }[] = [
  { icon: Thermometer, color: '#EF4444', label: 'Temperature', value: '100.2 °F', say: 'Temperature, 100.2 degrees Fahrenheit' },
  { icon: Heart, color: '#EF4444', label: 'Heart Rate', value: '108 bpm', say: 'Heart rate, 108 beats per minute' },
  { icon: Wind, color: '#2B6FF0', label: 'Respiratory Rate', value: '22 /min', say: 'Respiratory rate, 22 per minute' },
  { icon: Droplet, color: '#64748B', label: 'Oxygen Saturation', value: '98 %', say: 'Oxygen saturation, 98 percent' },
  { icon: Scale, color: '#F59E0B', label: 'Weight', value: '14.2 kg', say: 'Weight, 14.2 kilograms' },
  { icon: Ruler, color: '#7C5CFF', label: 'Height', value: '92 cm', say: 'Height, 92 centimetres' },
];

const MEDICINES = [
  { drug: 'Paracetamol 250 mg', form: 'Syrup', dosage: '5 ml', freq: 'TDS', freqSay: 'Three times a day', duration: '3 Days', instructions: 'After food' },
  { drug: 'Cetirizine 5 mg', form: 'Syrup', dosage: '2.5 ml', freq: 'OD (Night)', freqSay: 'Once daily at night', duration: '5 Days', instructions: 'After food' },
  { drug: 'Saline Nasal Drops', form: null, dosage: '2 drops\neach nostril', freq: 'TDS', freqSay: 'Three times a day', duration: '5 Days', instructions: 'As needed' },
];

const ATTACHMENTS = [
  { name: 'Lab Report', ext: 'PDF', size: '245 KB', tint: '#FDE2E2', fg: '#E03131' },
  { name: 'Temperature Chart', ext: 'JPG', size: '112 KB', tint: '#DCF7E6', fg: '#12A150' },
  { name: 'Previous Prescription', ext: 'PDF', size: '198 KB', tint: '#E4EBFD', fg: '#2B6FF0' },
];

const SNAPSHOT = [
  { icon: Thermometer, tint: '#FDE2E2', fg: '#EF4444', value: '100.2 °F', label: 'Temperature' },
  { icon: Heart, tint: '#FDE2E2', fg: '#EF4444', value: '108 bpm', label: 'Heart Rate' },
  { icon: Wind, tint: '#E4EBFD', fg: '#2B6FF0', value: '22 /min', label: 'Respiratory Rate' },
  { icon: Droplet, tint: '#E4EBFD', fg: '#2B6FF0', value: '98 %', label: 'SpO₂', sub: true },
];

const PREVIOUS = [
  { date: '10 Apr 2025', reason: 'General Consultation', provider: 'Dr. Ananya Sharma' },
  { date: '28 Mar 2025', reason: 'Fever & Cough', provider: 'Dr. Ananya Sharma' },
  { date: '15 Mar 2025', reason: 'Well Baby Checkup', provider: 'Dr. Ananya Sharma' },
];

export default function ConsultationDetails() {
  const navigate = useNavigate();

  return (
    <div className="consultation-print">
      <button type="button" onClick={() => navigate('/doctor/appointments')} className="no-print mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-[#3B4FE0] hover:underline">
        <ArrowLeft className="h-[17px] w-[17px]" />
        Back to Appointments
      </button>

      {/* Header */}
      <div className="mb-[18px] flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]" style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
              <Stethoscope className="h-[21px] w-[21px] text-white" />
            </span>
            <h1 className="font-display text-[25px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">Consultation Details</h1>
          </div>
          <p className="mt-[7px] flex flex-wrap items-center gap-x-2 text-[13px] sm:pl-[54px]">
            <span className="font-medium text-[#64748B]">Consultation ID: </span>
            <span className="font-bold text-[#334155]">CON-0002456</span>
            <span aria-hidden="true" className="text-[#CBD5E1]">•</span>
            <span className="font-medium text-[#334155]">12 May 2025, 10:00 AM</span>
            <span aria-hidden="true" className="text-[#CBD5E1]">•</span>
            <span className="rounded-[7px] bg-[#DCF7E6] px-[11px] py-1 text-[11.5px] font-bold text-[#12A150]">Completed</span>
          </p>
        </div>
        <div className="no-print flex w-full flex-wrap items-center gap-[11px] sm:w-auto">
          <button type="button" onClick={() => window.print()} className="flex h-11 items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
            <Printer className="h-[17px] w-[17px] text-[#334155]" />
            <span className="text-[13.5px] font-bold text-[#1E2A5A]">Print</span>
          </button>
          <button type="button" aria-label="More actions" onClick={() => console.log('[Clinic OS] More Actions')} className="flex h-11 items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-[18px] hover:bg-[#F7F8FC]">
            <span className="text-[13.5px] font-bold text-[#1E2A5A]">More Actions</span>
            <ChevronDown className="h-[17px] w-[17px] text-[#94A3B8]" />
          </button>
          <button type="button" onClick={() => console.log('[Clinic OS] Edit Consultation')} className="h-11 rounded-[10px] px-[22px] text-[13.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105" style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
            Edit Consultation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_372px]">
        {/* ── Left ── */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* Clinical summary */}
          <section className={`${CARD} px-[22px] py-5`}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
              <div className="min-w-0">
                <h2 className={H2}>Chief Complaint</h2>
                <p className="mt-2.5 text-[13.5px] leading-[22px] text-[#475569]">Fever since 2 days with mild cough and cold.</p>

                <h2 className={cn(H2, 'mt-[22px]')}>Consultation Notes</h2>
                <p className="mt-2.5 text-[13.5px] leading-[23px] text-[#475569]">
                  Child has mild fever (100.2°F) since last evening associated with runny nose and mild cough. No difficulty in
                  breathing. Appetite is fair. No vomiting or loose motions. Recommend paracetamol for fever and adequate hydration.
                </p>

                <div className="mt-5 flex items-center gap-[11px]">
                  <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#EDE9FE] text-[12px] font-bold text-[#6D5AE0]">AS</span>
                  <div>
                    <p className="text-[13px] font-bold text-[#0F172A]">Dr. Ananya Sharma</p>
                    <p className="text-[11.5px] font-medium text-[#64748B]">Paediatrician</p>
                  </div>
                </div>
              </div>

              <dl className="h-full rounded-[12px] border border-[#F1F3F9] bg-[#FAFBFD] px-5 py-[18px]">
                {([
                  ['Provider', <>Dr. Ananya Sharma<span className="mt-0.5 block text-xs font-medium text-[#64748B]">Paediatrician</span></>],
                  ['Consultation Type', 'General Consultation'],
                  ['Duration', '30 Minutes'],
                  ['Consultation Mode', 'In-Clinic'],
                  ['Follow-up', '14 May 2025, 11:00 AM'],
                ] as const).map(([label, value], i) => (
                  <div key={label} className={cn('flex items-start justify-between gap-4', i > 0 && 'mt-[17px]')}>
                    <dt className="text-[12.5px] font-semibold text-[#334155]">{label}</dt>
                    <dd className="text-right text-[13px] font-medium text-[#0F172A]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* Vitals + Prescription */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[286px_1fr]">
            <section className={`${CARD} px-5 pb-[18px] pt-5`}>
              <h2 className={H2}>Vitals</h2>
              <dl className="mt-4">
                {VITALS.map((v, i) => (
                  <div key={v.label} className={cn('flex h-[43px] items-center gap-3', i > 0 && 'border-t border-[#F1F3F9]')}>
                    <v.icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" style={{ color: v.color }} />
                    <dt className="text-[13px] font-semibold text-[#334155]">{v.label}</dt>
                    <dd className="ml-auto text-[13.5px] font-bold text-[#0F172A]">
                      <span aria-hidden="true">{v.value}</span>
                      <span className="sr-only">{v.say}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <button type="button" aria-label="View full vitals history" onClick={() => console.log('[Clinic OS] View Full History')} className="mt-4 flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#DDE3F5] bg-white text-[13px] font-bold text-[#3B4FE0] hover:bg-[#F5F7FF]">
                View Full History
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </section>

            <section className={`${CARD} px-[22px] py-5`}>
              <div className="flex flex-wrap items-center gap-3">
                <span aria-hidden="true" className="font-serif text-[19px] text-[#0F172A]">℞</span>
                <h2 className={H2}>Prescription</h2>
                <button type="button" onClick={() => console.log('[Clinic OS] Download Prescription')} className="ml-auto flex h-10 items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-4 hover:bg-[#F7F8FC]">
                  <Download className="h-4 w-4 text-[#334155]" />
                  <span className="text-[13px] font-bold text-[#1E2A5A]">Download Prescription</span>
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[540px] border-separate border-spacing-0">
                  <caption className="sr-only">Prescribed medicines</caption>
                  <thead>
                    <tr>
                      {['Medicine', 'Dosage', 'Frequency', 'Duration', 'Instructions'].map((h, i) => (
                        <th key={h} scope="col" className={cn('h-[38px] bg-[#F7F8FC] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]', i === 0 && 'pl-4')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MEDICINES.map((m) => (
                      <tr key={m.drug}>
                        <th scope="row" className="h-[58px] border-b border-[#F1F3F9] pl-4 pr-3 text-left font-normal">
                          <span className="block text-[13px] font-bold text-[#0F172A]">{m.drug}</span>
                          {m.form && <span className="block text-xs text-[#64748B]">{m.form}</span>}
                        </th>
                        <td className="whitespace-pre-line border-b border-[#F1F3F9] pr-3 text-[13px] font-medium text-[#334155]">{m.dosage}</td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[13px] font-medium text-[#334155]">
                          <abbr title={m.freqSay} className="no-underline">{m.freq}</abbr>
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[13px] font-medium text-[#334155]">{m.duration}</td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[13px] font-medium text-[#334155]">{m.instructions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-[18px] flex items-start gap-3 rounded-[11px] bg-[#F3F1FE] px-[18px] py-4">
                <span className="mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#6D5AE0]">
                  <ChevronDown className="h-3 w-3 text-white" />
                </span>
                <p className="text-[13px] font-medium leading-[22px] text-[#334155]">
                  Advice: Plenty of fluids, rest and nutrition. Steam inhalation if needed.
                  <br />
                  Return if fever persists more than 3 days or if any breathing difficulty.
                </p>
              </div>
            </section>
          </div>

          {/* Attachments */}
          <section className={`${CARD} px-[22px] pb-6 pt-5`}>
            <div className="flex items-center gap-2.5">
              <Paperclip aria-hidden="true" className="h-[17px] w-[17px] text-[#334155]" />
              <h2 className={H2}>Documents &amp; Attachments</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {ATTACHMENTS.map((a) => (
                <div key={a.name} className="flex h-[66px] items-center gap-3 rounded-[11px] border border-[#ECEEF4] px-3.5 transition-colors hover:border-[#C7CEDB]">
                  <span className="grid h-[38px] w-[34px] shrink-0 place-items-center rounded-[6px] text-[8px] font-extrabold uppercase" style={{ background: a.tint, color: a.fg }}>
                    {a.ext}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-[#0F172A]">{a.name}</span>
                    <span className="block text-[11.5px] text-[#64748B]">{a.ext} • {a.size}</span>
                  </span>
                  <button type="button" aria-label={`Download ${a.name}, ${a.ext}, ${a.size}`} onClick={() => console.log('[Clinic OS] Download', a.name)}>
                    <Download className="h-[17px] w-[17px] text-[#94A3B8]" />
                  </button>
                </div>
              ))}
              <button type="button" aria-label="Upload document" onClick={() => console.log('[Clinic OS] Upload Document')} className="flex h-[66px] items-center gap-3 rounded-[11px] border-[1.5px] border-dashed border-[#C7CEDB] bg-[#F7F8FC] px-3.5 text-left transition-colors hover:border-[#3B4FE0] hover:bg-[#F5F7FF]">
                <UploadCloud className="h-[34px] w-[34px] shrink-0 text-[#6D5AE0]" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-[#0F172A]">Upload Document</span>
                  <span className="block text-[11.5px] text-[#64748B]">JPG, PNG, PDF (Max 5MB)</span>
                </span>
              </button>
            </div>
          </section>
        </div>

        {/* ── Right ── */}
        <div className="no-print flex min-w-0 flex-col gap-5">
          <div className="flex gap-[15px] rounded-[14px] bg-[#EAF1FE] px-5 py-[18px]">
            <span className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full bg-white text-[18px] font-bold text-[#3B4FE0] ring-2 ring-white">MK</span>
            <div className="min-w-0">
              <p className="font-display text-[17px] font-extrabold text-[#0F172A]">Myra Kapoor</p>
              <p className="mt-[5px] text-[12.5px]">
                <span className="font-bold text-[#3B4FE0]">PT-0002485</span>
                <span aria-hidden="true" className="px-1.5 text-[#CBD5E1]">•</span>
                <span className="font-medium text-[#475569]">2y 11m</span>
                <span aria-hidden="true" className="px-1.5 text-[#CBD5E1]">•</span>
                <span className="font-medium text-[#475569]">Female</span>
              </p>
              <p className="mt-[7px] flex items-center gap-2 text-[13px] font-medium text-[#334155]">
                <Phone aria-hidden="true" className="h-3.5 w-3.5 text-[#64748B]" />
                +91 91234 56789
              </p>
            </div>
          </div>

          <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
            <div className="flex items-center">
              <h2 className="font-display text-[15px] font-bold text-[#0F172A]">Vitals Snapshot</h2>
              <button type="button" className="ml-auto text-[12.5px] font-bold text-[#3B4FE0] hover:underline">View All</button>
            </div>
            <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SNAPSHOT.map((s) => (
                <div key={s.label} className="flex items-center gap-[11px] rounded-[11px] border border-[#ECEEF4] px-3.5 py-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px]" style={{ background: s.tint }}>
                    <s.icon className="h-[15px] w-[15px]" style={{ color: s.fg }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[#0F172A]">{s.value}</p>
                    <p className="text-[11.5px] font-medium text-[#64748B]">
                      {s.sub ? <span aria-label="Blood oxygen saturation">SpO<sub>2</sub></span> : s.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3.5 text-xs font-medium text-[#64748B]">Recorded on 12 May 2025, 10:00 AM</p>
          </section>

          <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
            <div className="flex items-center">
              <h2 className="font-display text-[15px] font-bold text-[#0F172A]">Previous Visits</h2>
              <button type="button" className="ml-auto text-[12.5px] font-bold text-[#3B4FE0] hover:underline">View All</button>
            </div>
            <div className="mt-3.5">
              {PREVIOUS.map((v, i) => (
                <button key={v.date} type="button" aria-label={`${v.date}, ${v.reason}, Completed`}
                  onClick={() => console.log('[Clinic OS] Open visit', v.date)}
                  className={cn('flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-[#FAFBFF]', i > 0 && 'border-t border-[#F1F3F9]')}>
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-[#E9EFFD]">
                    <CalendarDays className="h-[17px] w-[17px] text-[#2B6FF0]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-bold text-[#0F172A]">{v.date}</span>
                    <span className="block truncate text-[13px] font-semibold text-[#0F172A]">{v.reason}</span>
                    <span className="block truncate text-xs text-[#64748B]">{v.provider}</span>
                  </span>
                  <span className="ml-auto rounded-[6px] bg-[#DCF7E6] px-[9px] py-[3px] text-[11px] font-bold text-[#12A150]">Completed</span>
                  <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#94A3B8]" />
                </button>
              ))}
            </div>
          </section>

          <section className={`${CARD} px-5 pb-[22px] pt-[18px]`}>
            <h2 className="font-display text-[15px] font-bold text-[#0F172A]">Allergies</h2>
            <p className="mt-2 text-[13px] text-[#475569]">No known allergies</p>
            <h2 className="mt-5 font-display text-[15px] font-bold text-[#0F172A]">Chronic Conditions</h2>
            <p className="mt-2 text-[13px] text-[#475569]">No chronic conditions</p>
          </section>
        </div>
      </div>
    </div>
  );
}
