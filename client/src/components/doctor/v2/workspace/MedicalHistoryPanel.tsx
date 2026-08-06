import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { AlertTriangle, ChevronDown, Download, FileText, HeartPulse, ShieldCheck } from 'lucide-react';
import { listEncounters } from '../../../../api/doctorEncounters';
import { listPrescriptions } from '../../../../api/doctorPrescriptions';
import {
  documentFileUrl, listDocuments, listGrowthRecords, listImmunisations, listNotes,
} from '../../../../api/doctorPatientClinical';
import { formatAge, formatDate } from '../../../../data/patients';
import {
  CARD, H2, PanelState, SELECT, Tile, ViewAll, WS_ICONS, fieldText, swatch, useLoad, wsDate, wsTime,
} from './shared';
import type { WorkspacePanelProps } from './shared';
import { cn } from '../../../../lib/cn';

/** The rail names its glyph by string, the same way the rest of the workspace does. */
const iconFor = (name: string) => WS_ICONS[name] ?? FileText;
const PillIcon = WS_ICONS.Pill;

/** One row of the merged clinical timeline, whatever store it came from. */
interface HistoryEntry {
  id: string;
  category: string;
  title: string;
  detail: string;
  author: string;
  at: string;
  icon: string;
}

const CATEGORY_META: { id: string; label: string; icon: string }[] = [
  { id: 'immunizations', label: 'Immunizations', icon: 'Syringe' },
  { id: 'visits', label: 'Visits', icon: 'Stethoscope' },
  { id: 'growth', label: 'Growth', icon: 'Ruler' },
  { id: 'medications', label: 'Medications', icon: 'Pill' },
  { id: 'notes', label: 'Notes', icon: 'FileText' },
  { id: 'documents', label: 'Documents', icon: 'UploadCloud' },
];

const IMM_COLOR = { given: '#12A150', due: '#2B6FF0', overdue: '#EF4444' } as const;

export function MedicalHistoryPanel({ patientId, patientName, dob, sex, templateFields, fields }: WorkspacePanelProps) {
  const [category, setCategory] = useState('all');
  const [order, setOrder] = useState<'new' | 'old'>('new');
  const [limit, setLimit] = useState(10);

  const { data, loading, error } = useLoad(
    async () => {
      const [enc, imm, growth, notes, docs, rx] = await Promise.all([
        listEncounters(patientId),
        listImmunisations(patientId),
        listGrowthRecords(patientId),
        listNotes(patientId),
        listDocuments(patientId),
        listPrescriptions(patientId),
      ]);
      return {
        encounters: enc.encounters,
        immunisations: imm.immunisations,
        immSummary: imm.summary,
        growth: growth.records,
        notes: notes.notes,
        documents: docs.documents,
        prescriptions: rx.prescriptions,
      };
    },
    [patientId],
  );

  /**
   * The timeline is a MERGE of the real stores — nothing here is authored. Any
   * store that gains rows shows up automatically; an empty one contributes none.
   */
  const entries = useMemo<HistoryEntry[]>(() => {
    if (!data) return [];
    const out: HistoryEntry[] = [];
    for (const e of data.encounters) {
      out.push({
        id: `enc-${e.id}`, category: 'visits', title: 'Visit & Consultation',
        detail: e.assessment || e.subjective || 'No assessment recorded',
        author: 'Recorded in clinic', at: e.date, icon: 'Stethoscope',
      });
    }
    for (const i of data.immunisations) {
      const when = i.givenAt ?? i.dueAt;
      if (!when) continue;
      out.push({
        id: `imm-${i.id}`, category: 'immunizations',
        title: i.status === 'given' ? 'Immunization' : `Immunization ${i.status}`,
        detail: [i.vaccine, i.doseLabel].filter(Boolean).join(' • '),
        author: i.administeredBy ?? 'Clinic', at: when, icon: 'Syringe',
      });
    }
    for (const g of data.growth) {
      const bits = [
        g.weightKg != null ? `Weight: ${g.weightKg} kg` : null,
        g.heightCm != null ? `Height: ${g.heightCm} cm` : null,
        g.headCircumferenceCm != null ? `Head: ${g.headCircumferenceCm} cm` : null,
      ].filter(Boolean);
      out.push({
        id: `gr-${g.id}`, category: 'growth', title: 'Growth Measurement',
        detail: bits.join(', ') || 'Measurement recorded',
        author: g.recordedBy ?? 'Clinic', at: g.takenAt, icon: 'Ruler',
      });
    }
    for (const n of data.notes) {
      out.push({
        id: `note-${n.id}`, category: 'notes', title: n.category,
        detail: n.text, author: n.author ?? 'Clinic', at: n.createdAt, icon: 'FileText',
      });
    }
    for (const d of data.documents) {
      out.push({
        id: `doc-${d.id}`, category: 'documents', title: 'Document Uploaded',
        detail: `${d.name} — ${d.type}, ${d.size}`, author: d.uploadedBy ?? 'Clinic', at: d.createdAt, icon: 'UploadCloud',
      });
    }
    for (const p of data.prescriptions) {
      out.push({
        id: `rx-${p.id}`, category: 'medications', title: 'Medication Prescribed',
        detail: [p.drug, p.dose, p.frequency].filter(Boolean).join(' • '),
        author: 'Prescribed in clinic', at: p.date, icon: 'Pill',
      });
    }
    return out;
  }, [data]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return m;
  }, [entries]);

  const visible = useMemo(() => {
    const filtered = category === 'all' ? entries : entries.filter((e) => e.category === category);
    return [...filtered].sort((a, b) => (order === 'new' ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at)));
  }, [entries, category, order]);

  const shown = visible.slice(0, limit);

  const immSummary = data?.immSummary ?? { given: 0, due: 0, overdue: 0 };
  const immRows = [
    { label: 'Completed', color: IMM_COLOR.given, value: immSummary.given },
    { label: 'Due', color: IMM_COLOR.due, value: immSummary.due },
    { label: 'Overdue', color: IMM_COLOR.overdue, value: immSummary.overdue },
  ];
  const immTotal = immRows.reduce((t, r) => t + r.value, 0);

  // "Key Information" is core patient data plus whatever the doctor's own
  // template records — never a fixed list of fields this app does not have.
  const keyInfo: [string, React.ReactNode][] = [
    ['Date of Birth', dob ? formatDate(dob) : '—'],
    ['Age', dob ? formatAge(dob) : '—'],
    ['Gender', sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : 'Unspecified'],
    ...(templateFields ?? [])
      .map((f) => [f.label, fieldText(fields?.[f.key])] as const)
      .filter((pair): pair is readonly [string, string] => pair[1] !== null)
      .slice(0, 6)
      .map(([k, v]) => [k, v] as [string, React.ReactNode]),
  ];

  const allergyText = fieldText(fields?.allergies);
  const activeMeds = (data?.prescriptions ?? []).filter((p) => p.status === 'active');

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Medical History */}
        <section className={`${CARD} px-[22px] pb-[22px] pt-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className={H2}>Medical History</h2>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <div className="relative">
                <label htmlFor="mh-sort" className="sr-only">Sort order</label>
                <select id="mh-sort" value={order} onChange={(e) => setOrder(e.target.value as 'new' | 'old')} className={cn(SELECT, 'w-[148px]')}>
                  <option value="new">Newest First</option>
                  <option value="old">Oldest First</option>
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[236px_1fr]">
            {/* Category rail — every count is derived from the merged timeline. */}
            <div role="tablist" aria-label="Record categories" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {[{ id: 'all', label: 'All Records', icon: 'FileText' }, ...CATEGORY_META].map((c) => {
                const Icon = iconFor(c.icon);
                const count = c.id === 'all' ? entries.length : counts.get(c.id) ?? 0;
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    aria-label={`${c.label}, ${count} records`}
                    onClick={() => { setCategory(c.id); setLimit(10); }}
                    className={cn(
                      'flex h-[45px] shrink-0 items-center gap-3 rounded-[10px] px-3.5 text-left transition-colors',
                      active ? 'bg-[#EEF1FE]' : 'hover:bg-[#F7F8FC]',
                    )}
                  >
                    <Icon className={cn('h-[17px] w-[17px] shrink-0', active ? 'text-[#3B4FE0]' : 'text-[#64748B]')} />
                    <span className={cn('whitespace-nowrap text-[13px] font-semibold', active ? 'text-[#3B4FE0]' : 'text-[#334155]')}>{c.label}</span>
                    <span className={cn('ml-auto pl-3 text-[12.5px] font-bold tabular-nums', active ? 'text-[#3B4FE0]' : 'text-[#334155]')}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Timeline */}
            <div className="min-w-0">
              <PanelState loading={loading} error={error} empty={!shown.length}
                emptyText={entries.length ? 'No records in this category.' : `Nothing recorded for ${patientName} yet.`} />

              {shown.length > 0 && (
                <ol className="relative flex flex-col gap-3.5 pl-6">
                  <span aria-hidden="true" className="absolute bottom-4 left-[3px] top-4 w-0.5 bg-[#E4E8F1]" />
                  {shown.map((e, i) => {
                    const sw = swatch(e.category);
                    return (
                      <li key={e.id} className="relative">
                        <span
                          aria-hidden="true"
                          className="absolute -left-6 top-[26px] h-[9px] w-[9px] rounded-full"
                          style={{ background: i === 0 ? '#4F46E5' : '#CBD5E1' }}
                        />
                        <div className="flex w-full items-start gap-3.5 rounded-[12px] border border-[#ECEEF4] px-[18px] py-[15px] text-left">
                          <Tile icon={e.icon} tint={sw.tint} fg={sw.fg} size={36} radius={10} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-bold text-[#0F172A]">{e.title}</span>
                            <span className="mt-1 line-clamp-2 block text-[12.5px] text-[#475569]">{e.detail}</span>
                            <span className="mt-[5px] block text-xs text-[#94A3B8]">By {e.author}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-[12.5px] font-semibold text-[#0F172A]">{wsDate(e.at)}</span>
                            <span className="block text-xs font-medium text-[#94A3B8]">{wsTime(e.at)}</span>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {visible.length > shown.length && (
                <div className="mt-4 flex justify-center">
                  <button type="button" onClick={() => setLimit((n) => n + 10)}
                    className="flex h-11 items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-6 text-[13.5px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
                    Load More ({visible.length - shown.length} left)
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Bottom row */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className={`${CARD} px-[22px] pb-[22px] pt-5`}>
            <div className="flex items-center gap-2.5">
              <HeartPulse aria-hidden="true" className="h-[18px] w-[18px] text-[#6D5AE0]" />
              <h2 className={H2}>Recorded History</h2>
            </div>
            {fieldText(fields?.history) ? (
              <p className="mt-3.5 whitespace-pre-wrap rounded-[11px] bg-[#FAFBFD] px-4 py-3.5 text-[12.5px] leading-5 text-[#475569]">
                {fieldText(fields?.history)}
              </p>
            ) : (
              <p className="mt-3.5 rounded-[11px] bg-[#F7F8FC] px-[22px] py-[22px] text-center text-[13px] font-medium text-[#64748B]">
                No history recorded on this patient&rsquo;s record.
              </p>
            )}
          </section>

          <section className={`${CARD} px-[22px] pb-[22px] pt-5`}>
            <div className="flex items-center gap-2.5">
              <PillIcon aria-hidden="true" className="h-[18px] w-[18px] text-[#334155]" />
              <h2 className={H2}>Active Medications</h2>
              <span className="ml-auto text-[12.5px] font-bold text-[#334155]">{activeMeds.length}</span>
            </div>
            {activeMeds.length ? (
              <ul className="mt-3.5 flex flex-col gap-2.5">
                {activeMeds.slice(0, 4).map((m) => (
                  <li key={m.id} className="rounded-[11px] bg-[#FAFBFD] px-4 py-3.5">
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[13.5px] font-bold text-[#0F172A]">{m.drug}</span>
                      <span className="ml-auto text-[12.5px] font-medium text-[#64748B]">{m.frequency ?? '—'}</span>
                    </p>
                    <p className="mt-1 text-[12.5px] font-medium text-[#475569]">{m.dose ?? 'Dose not recorded'}</p>
                    <p className="mt-[5px] flex flex-wrap items-baseline gap-2">
                      <span className="text-xs text-[#94A3B8]">{m.duration ?? ''}</span>
                      <span className="ml-auto text-xs font-medium text-[#64748B]">{wsDate(m.date)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3.5 rounded-[11px] bg-[#F7F8FC] px-[22px] py-[22px] text-center text-[13px] font-medium text-[#64748B]">
                No active medications.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* ── Right rail ── */}
      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center">
            <h2 className={H2}>Key Information</h2>
          </div>
          <dl className="mt-3.5 flex flex-col gap-3.5">
            {keyInfo.map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-[108px] shrink-0 text-[12.5px] font-medium text-[#64748B]">{k}</dt>
                <dd className="min-w-0 text-[12.5px] font-semibold text-[#0F172A]">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <h2 className={H2}>Immunization Summary</h2>
          {immTotal ? (
            <div className="mt-3.5 flex flex-wrap items-center gap-4">
              <div role="img" aria-label={`Immunisations: ${immRows.map((s) => `${s.label} ${s.value}`).join(', ')}`} className="relative h-[112px] w-[112px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={immRows} dataKey="value" innerRadius={40} outerRadius={56} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                      {immRows.map((s) => <Cell key={s.label} fill={s.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-lg font-extrabold leading-none text-[#0F172A]">{immSummary.given}/{immTotal}</p>
                    <p className="mt-1 text-[10.5px] font-medium text-[#94A3B8]">Completed</p>
                  </div>
                </div>
              </div>
              <ul className="min-w-0 flex-1">
                {immRows.map((s) => (
                  <li key={s.label} className="flex items-center gap-2.5 py-1">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#475569]">{s.label}</span>
                    <span className="text-[12.5px] font-bold tabular-nums text-[#0F172A]">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3.5 rounded-[11px] bg-[#F7F8FC] px-4 py-6 text-center text-[12.5px] font-medium text-[#64748B]">
              No immunisations recorded.
            </p>
          )}
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <h2 className={H2}>Medical Alerts</h2>
          {allergyText || immSummary.overdue > 0 ? (
            <ul className="mt-3 flex flex-col gap-2.5">
              {allergyText && (
                <li className="flex items-start gap-2.5 rounded-[11px] bg-[#FEF7E6] px-4 py-3">
                  <AlertTriangle aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-[#E8890B]" />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-bold text-[#0F172A]">Allergies</span>
                    <span className="block text-[12.5px] text-[#475569]">{allergyText}</span>
                  </span>
                </li>
              )}
              {immSummary.overdue > 0 && (
                <li className="flex items-start gap-2.5 rounded-[11px] bg-[#FDF2F2] px-4 py-3">
                  <AlertTriangle aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-[#EF4444]" />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-bold text-[#0F172A]">{immSummary.overdue} overdue immunisation{immSummary.overdue > 1 ? 's' : ''}</span>
                    <span className="block text-[12.5px] text-[#475569]">Review the schedule at the next visit.</span>
                  </span>
                </li>
              )}
            </ul>
          ) : (
            <div className="mt-3 grid place-items-center rounded-[11px] bg-[#ECFAF1] px-4 py-[22px] text-center">
              <div>
                <ShieldCheck aria-hidden="true" className="mx-auto h-[26px] w-[26px] text-[#12A150]" />
                <p className="mt-2.5 text-[13.5px] font-bold text-[#0F172A]">No active alerts</p>
                <p className="mt-1 text-[12.5px] text-[#64748B]">Nothing flagged on this record.</p>
              </div>
            </div>
          )}
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center">
            <h2 className={H2}>Documents</h2>
            <ViewAll label={`${data?.documents.length ?? 0} total`} />
          </div>
          {data?.documents.length ? (
            <ul className="mt-3">
              {data.documents.slice(0, 4).map((d) => {
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
                    <a href={documentFileUrl(patientId, d.id)} target="_blank" rel="noreferrer"
                      aria-label={`Open ${d.name}, ${d.ext}`} className="shrink-0 text-[#94A3B8] hover:text-[#334155]">
                      <Download className="h-4 w-4" />
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 rounded-[11px] bg-[#F7F8FC] px-4 py-6 text-center text-[12.5px] font-medium text-[#64748B]">
              No documents uploaded.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
