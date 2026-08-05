import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ChevronDown, Download, FileText, HeartPulse, Pencil, ShieldCheck } from 'lucide-react';
import {
  HISTORY_CATEGORIES, HISTORY_ENTRIES, HISTORY_TOTAL, IMMUNIZATION_SUMMARY, MINI_DOCUMENTS,
} from '../../../../data/workspaceTabs';
import { CARD, FooterLink, H2, SELECT, Tile, ViewAll, WS_ICONS } from './shared';
import { cn } from '../../../../lib/cn';

const KEY_INFO: [string, React.ReactNode][] = [
  ['Date of Birth', '12 Jan 2023'],
  ['Age', '2y 11m'],
  ['Gender', 'Female'],
  ['Blood Group', 'B+'],
  ['Address', <>23, Green Park Main,<br />New Delhi, Delhi 110016</>],
];

export function MedicalHistoryPanel() {
  const [category, setCategory] = useState('all');
  const immTotal = IMMUNIZATION_SUMMARY.reduce((t, s) => t + s.value, 0);
  const entries = category === 'all' ? HISTORY_ENTRIES : HISTORY_ENTRIES.filter((e) => e.category === category);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Medical History */}
        <section className={`${CARD} px-[22px] pb-[22px] pt-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className={H2}>Medical History</h2>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <div className="relative">
                <label htmlFor="mh-type" className="sr-only">Record type</label>
                <select id="mh-type" className={cn(SELECT, 'w-[140px]')}>
                  {['All Types', 'Immunizations', 'Visits', 'Growth', 'Allergies', 'Medications'].map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              </div>
              <div className="relative">
                <label htmlFor="mh-sort" className="sr-only">Sort order</label>
                <select id="mh-sort" className={cn(SELECT, 'w-[148px]')}>
                  <option>Newest First</option><option>Oldest First</option>
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[236px_1fr]">
            {/* Category rail */}
            <div role="tablist" aria-label="Record categories" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {[{ id: 'all', label: 'All Records', icon: 'FileText', count: HISTORY_TOTAL }, ...HISTORY_CATEGORIES].map((c) => {
                const Icon = WS_ICONS[c.icon] ?? FileText;
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    aria-label={`${c.label}, ${c.count} records`}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      'flex h-[45px] shrink-0 items-center gap-3 rounded-[10px] px-3.5 text-left transition-colors',
                      active ? 'bg-[#EEF1FE]' : 'hover:bg-[#F7F8FC]',
                    )}
                  >
                    <Icon className={cn('h-[17px] w-[17px] shrink-0', active ? 'text-[#3B4FE0]' : 'text-[#64748B]')} />
                    <span className={cn('whitespace-nowrap text-[13px] font-semibold', active ? 'text-[#3B4FE0]' : 'text-[#334155]')}>{c.label}</span>
                    <span className={cn('ml-auto pl-3 text-[12.5px] font-bold tabular-nums', active ? 'text-[#3B4FE0]' : 'text-[#334155]')}>{c.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Timeline */}
            <div className="min-w-0">
              {entries.length ? (
                <ol className="relative flex flex-col gap-3.5 pl-6">
                  <span aria-hidden="true" className="absolute bottom-4 left-[3px] top-4 w-0.5 bg-[#E4E8F1]" />
                  {entries.map((e, i) => (
                    <li key={`${e.title}-${e.time}`} className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute -left-6 top-[26px] h-[9px] w-[9px] rounded-full"
                        style={{ background: i === 0 ? '#4F46E5' : '#CBD5E1' }}
                      />
                      <button type="button" className="flex w-full items-start gap-3.5 rounded-[12px] border border-[#ECEEF4] px-[18px] py-[15px] text-left transition-colors hover:bg-[#FAFBFF]">
                        <Tile icon={e.icon} tint={e.tint} fg={e.fg} size={36} radius={10} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-bold text-[#0F172A]">{e.title}</span>
                          <span className="mt-1 block text-[12.5px] text-[#475569]">{e.detail}</span>
                          <span className="mt-[5px] block text-xs text-[#94A3B8]">By {e.author}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[12.5px] font-semibold text-[#0F172A]">{e.date}</span>
                          <span className="block text-xs font-medium text-[#94A3B8]">{e.time}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-[11px] bg-[#F7F8FC] px-6 py-10 text-center text-[13px] font-medium text-[#64748B]">
                  No records in this category.
                </p>
              )}

              <div className="mt-4 flex justify-center">
                <button type="button" onClick={() => console.log('[Clinic OS] Load More')} className="flex h-11 items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-6 text-[13.5px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
                  Load More
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom row */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className={`${CARD} px-[22px] pb-[22px] pt-5`}>
            <div className="flex items-center gap-2.5">
              <HeartPulse aria-hidden="true" className="h-[18px] w-[18px] text-[#6D5AE0]" />
              <h2 className={H2}>Chronic Conditions</h2>
            </div>
            <p className="mt-3.5 rounded-[11px] bg-[#F7F8FC] px-[22px] py-[22px] text-center text-[13px] font-medium text-[#64748B]">
              No chronic conditions recorded.
            </p>
          </section>

          <section className={`${CARD} px-[22px] pb-[22px] pt-5`}>
            <div className="flex items-center gap-2.5">
              <WS_ICONS.Pill aria-hidden="true" className="h-[18px] w-[18px] text-[#334155]" />
              <h2 className={H2}>Medications</h2>
              <ViewAll />
            </div>
            <div className="mt-3.5 rounded-[11px] bg-[#FAFBFD] px-4 py-3.5">
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="text-[13.5px] font-bold text-[#0F172A]">Paracetamol 250 mg / 5 ml</span>
                <span className="ml-auto text-[12.5px] font-medium text-[#64748B]">As needed</span>
              </p>
              <p className="mt-1 text-[12.5px] font-medium text-[#475569]">5 ml</p>
              <p className="mt-[5px] flex flex-wrap items-baseline gap-2">
                <span className="text-xs text-[#94A3B8]">By Dr. Ananya Sharma</span>
                <span className="ml-auto text-xs font-medium text-[#64748B]">12 May 2025</span>
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* ── Right rail ── */}
      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center">
            <h2 className={H2}>Key Information</h2>
            <button type="button" aria-label="Edit key information" className="ml-auto text-[#64748B] hover:text-[#334155]">
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <dl className="mt-3.5 flex flex-col gap-3.5">
            {KEY_INFO.map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-[108px] shrink-0 text-[12.5px] font-medium text-[#64748B]">{k}</dt>
                <dd className="min-w-0 text-[12.5px] font-semibold text-[#0F172A]">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <h2 className={H2}>Immunization Summary</h2>
          <div className="mt-3.5 flex flex-wrap items-center gap-4">
            <div role="img" aria-label={`Immunisations: ${IMMUNIZATION_SUMMARY.map((s) => `${s.label} ${s.value}`).join(', ')}`} className="relative h-[112px] w-[112px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={IMMUNIZATION_SUMMARY} dataKey="value" innerRadius={40} outerRadius={56} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                    {IMMUNIZATION_SUMMARY.map((s) => <Cell key={s.label} fill={s.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-lg font-extrabold leading-none text-[#0F172A]">{IMMUNIZATION_SUMMARY[0].value}/{immTotal}</p>
                  <p className="mt-1 text-[10.5px] font-medium text-[#94A3B8]">Completed</p>
                </div>
              </div>
            </div>
            <ul className="min-w-0 flex-1">
              {IMMUNIZATION_SUMMARY.map((s) => (
                <li key={s.label} className="flex items-center gap-2.5 py-1">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#475569]">{s.label}</span>
                  <span className="text-[12.5px] font-bold tabular-nums text-[#0F172A]">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <FooterLink label="View Immunization Schedule" />
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <h2 className={H2}>Medical Alerts</h2>
          <div className="mt-3 grid place-items-center rounded-[11px] bg-[#ECFAF1] px-4 py-[22px] text-center">
            <div>
              <ShieldCheck aria-hidden="true" className="mx-auto h-[26px] w-[26px] text-[#12A150]" />
              <p className="mt-2.5 text-[13.5px] font-bold text-[#0F172A]">No active alerts</p>
              <p className="mt-1 text-[12.5px] text-[#64748B]">Patient is in good health.</p>
            </div>
          </div>
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center">
            <h2 className={H2}>Documents</h2>
            <ViewAll />
          </div>
          <ul className="mt-3">
            {MINI_DOCUMENTS.map((d) => (
              <li key={d.name} className="flex h-[46px] items-center gap-3">
                <span aria-hidden="true" className="grid h-[34px] w-[30px] shrink-0 place-items-center rounded-[6px] text-[8px] font-extrabold" style={{ background: d.tint, color: d.fg }}>
                  {d.ext}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-[#0F172A]">{d.name}</span>
                  <span className="block text-[11.5px] text-[#64748B]">{d.meta}</span>
                </span>
                <button type="button" aria-label={`Download ${d.name}, ${d.ext}`} className="shrink-0 text-[#94A3B8] hover:text-[#334155]">
                  <Download className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
