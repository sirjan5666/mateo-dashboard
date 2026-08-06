import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ChevronDown, CircleCheck, Download, Eye, FileText, Pin, Plus, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../../../auth/context';
import { listEncounters } from '../../../../api/doctorEncounters';
import type { Encounter, EncounterKind } from '../../../../api/doctorEncounters';
import { listPatientAppointments } from '../../../../api/doctorAppointments';
import { listPrescriptions } from '../../../../api/doctorPrescriptions';
import { listPatientInvoices } from '../../../../api/doctorBilling';
import type { InvoiceStatus } from '../../../../api/doctorBilling';
import {
  DOCUMENT_TYPES, NOTE_CATEGORIES, createNote, deleteDocument, deleteNote, documentFileUrl,
  listDocuments, listNotes, updateNote, uploadPatientDocument,
} from '../../../../api/doctorPatientClinical';
import type { DocumentType, NoteCategory } from '../../../../api/doctorPatientClinical';
import { money } from '../../../../data/invoices';
import { RowMenu } from '../RowMenu';
import {
  CARD, Chip, Dash, FooterLink, H2, PanelState, QuickActionsCard, SELECT, SinglePagePager, Tile,
  ViewAll, WS_ICONS, swatch, useLoad, withPct, wsDate, wsTime,
} from './shared';
import type { WorkspacePanelProps } from './shared';
import { cn } from '../../../../lib/cn';

const TH = 'h-10 border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]';
const DONE = { bg: '#DCF7E6', fg: '#12A150' };

type PanelProps = WorkspacePanelProps;

/** Every panel's tables and rails read from the same fetch — they cannot disagree. */
function Donut({ data, label }: { data: { label: string; color: string; count: number; pct: number }[]; label: string }) {
  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-4">
      <div role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.count}`).join(', ')}`} className="h-[104px] w-[104px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" innerRadius={36} outerRadius={52} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
              {data.map((d) => <Cell key={d.label} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2.5 py-[3px]">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#475569]">{d.label}</span>
            <span className="text-xs font-semibold tabular-nums text-[#0F172A]">{d.count} ({d.pct}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── 17 · Visits & Consultations ──────────────────────────────────────────────

const KIND: Record<EncounterKind, { label: string; sub: string; icon: string }> = {
  visit: { label: 'Consultation', sub: 'In-person visit', icon: 'Stethoscope' },
  follow_up: { label: 'Follow-up', sub: 'Follow-up visit', icon: 'CalendarDays' },
  phone: { label: 'Tele Consultation', sub: 'Phone visit', icon: 'PhoneCall' },
  procedure: { label: 'Procedure', sub: 'Procedure', icon: 'Syringe' },
  note: { label: 'Clinical Note', sub: 'Note only', icon: 'FileText' },
};

const VISIT_FILTERS = ['All Visits', ...Object.values(KIND).map((k) => k.label)];

export function VisitsPanel({ patientId, patientName }: PanelProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState('All Visits');

  const { data, loading, error } = useLoad(
    async () => {
      const [enc, appts, rx] = await Promise.all([
        listEncounters(patientId),
        listPatientAppointments(patientId),
        listPrescriptions(patientId),
      ]);
      return { encounters: enc.encounters, appointments: appts.appointments, prescriptions: rx.prescriptions };
    },
    [patientId],
  );

  const encounters = useMemo(() => data?.encounters ?? [], [data]);
  const appointments = useMemo(() => data?.appointments ?? [], [data]);
  const prescriptions = data?.prescriptions ?? [];

  const rows = useMemo(
    () => (type === 'All Visits' ? encounters : encounters.filter((e: Encounter) => KIND[e.kind].label === type)),
    [encounters, type],
  );

  /**
   * The spec's "Follow-up" column. There is no follow-up field on an encounter,
   * so it shows the earliest appointment booked strictly AFTER that visit — the
   * only honest reading of "what was scheduled at this visit".
   */
  const followUpFor = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => a.start.localeCompare(b.start));
    return (visitISO: string) => sorted.find((a) => a.start > visitISO && a.status === 'scheduled') ?? null;
  }, [appointments]);

  const now = new Date().toISOString();
  const thisYear = new Date().getFullYear();
  const lastVisit = encounters[0] ?? null; // server sorts newest first
  const nextAppt = [...appointments].sort((a, b) => a.start.localeCompare(b.start)).find((a) => a.start > now && a.status === 'scheduled') ?? null;

  const summary = [
    { cardBg: '#F3F0FE', tint: '#E7E3FD', fg: '#6D5AE0', icon: 'Stethoscope', label: 'Total Visits', value: String(encounters.length), note: 'All time' },
    { cardBg: '#ECFAF1', tint: '#DCF7E6', fg: '#12A150', icon: 'CalendarDays', label: 'This Year', value: String(encounters.filter((e) => new Date(e.date).getFullYear() === thisYear).length), note: String(thisYear) },
    { cardBg: '#FEF6E7', tint: '#FDECD3', fg: '#F59E0B', icon: 'CalendarDays', label: 'Last Visit', value: lastVisit ? wsDate(lastVisit.date) : '—', note: lastVisit ? wsTime(lastVisit.date) : 'No visits yet' },
    { cardBg: '#EAF2FE', tint: '#DCE9FE', fg: '#2B6FF0', icon: 'CalendarPlus', label: 'Next Follow-up', value: nextAppt ? wsDate(nextAppt.start) : '—', note: nextAppt ? wsTime(nextAppt.start) : 'None scheduled' },
  ];

  const doctorName = user?.name ?? 'Doctor';
  const doctorInitials = doctorName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <section className={`${CARD} min-w-0 pb-4 pt-5`}>
        <div className="flex flex-wrap items-center gap-3 px-[22px]">
          <h2 className={H2}>Visits &amp; Consultations</h2>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => navigate(`/doctor/appointments/new?patient=${patientId}`)}
              className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#E4E8F1] bg-white px-[18px] hover:bg-[#F7F8FC]">
              <SlidersHorizontal className="h-4 w-4 text-[#3B4FE0]" />
              <span className="text-[13px] font-semibold text-[#334155]">Schedule</span>
            </button>
            <div className="relative">
              <label htmlFor="v-type" className="sr-only">Visit type</label>
              <select id="v-type" value={type} onChange={(e) => setType(e.target.value)} className={cn(SELECT, 'w-[176px]')}>
                {VISIT_FILTERS.map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
          </div>
        </div>

        <div className="mt-4 px-[22px]">
          <PanelState loading={loading} error={error} empty={!rows.length}
            emptyText={encounters.length ? 'No visits of this type.' : `No visits recorded for ${patientName} yet.`} />
        </div>

        {rows.length > 0 && (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-0">
                <caption className="sr-only">Visit and consultation history</caption>
                <thead>
                  <tr>
                    {['Date & Time', 'Visit Type', 'Assessment', 'Doctor', 'Follow-up', 'Status', 'Actions'].map((h, i) => (
                      <th key={h} scope="col" className={cn(TH, i === 0 && 'pl-[22px]')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => {
                    const k = KIND[v.kind];
                    const sw = swatch(v.kind);
                    const fu = followUpFor(v.date);
                    return (
                      <tr key={v.id} className="hover:bg-[#FAFBFF]">
                        <th scope="row" className="h-[71px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left font-normal">
                          <span className="flex items-center gap-3">
                            <Tile icon={k.icon} tint={sw.tint} fg={sw.fg} />
                            <span>
                              <span className="block text-[12.5px] font-bold text-[#0F172A]">{wsDate(v.date)}</span>
                              <span className="block text-xs font-medium text-[#94A3B8]">{wsTime(v.date)}</span>
                            </span>
                          </span>
                        </th>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <span className="block text-[13px] font-bold text-[#0F172A]">{k.label}</span>
                          <span className="block text-xs text-[#64748B]">{k.sub}</span>
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <span className="block max-w-[220px] truncate text-[12.5px] font-semibold text-[#334155]" title={v.assessment ?? undefined}>
                            {v.assessment || <Dash say="No assessment recorded" />}
                          </span>
                          <span className="block max-w-[220px] truncate text-xs text-[#94A3B8]" title={v.subjective ?? undefined}>
                            {v.subjective || ''}
                          </span>
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <span className="flex items-center gap-2.5">
                            <span aria-hidden="true" className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#EDE9FE] text-[11px] font-bold text-[#6D5AE0]">{doctorInitials}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-[12.5px] font-bold text-[#0F172A]">{doctorName}</span>
                            </span>
                          </span>
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px]">
                          {fu ? (
                            <>
                              <span className="block font-semibold text-[#0F172A]">{wsDate(fu.start)}</span>
                              <span className="block text-xs font-medium text-[#94A3B8]">{wsTime(fu.start)}</span>
                            </>
                          ) : <Dash say="No follow-up scheduled" />}
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3"><Chip label="Completed" bg={DONE.bg} fg={DONE.fg} /></td>
                        <td className="border-b border-[#F1F3F9] pr-[22px]">
                          <RowMenu label={`Actions for ${k.label} on ${wsDate(v.date)}`} size={32}
                            items={[
                              { label: 'View Consultation', onSelect: () => navigate(`/doctor/consultations/${v.id}`) },
                              { label: 'Book Follow-up', onSelect: () => navigate(`/doctor/appointments/new?patient=${patientId}`) },
                              { label: 'Create Invoice', onSelect: () => navigate(`/doctor/revenue?patient=${patientId}`) },
                            ]} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <SinglePagePager label={`Showing 1 to ${rows.length} of ${rows.length} visits`} />
          </>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <WS_ICONS.ClipboardList aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
            <h2 className={H2}>Visit Summary</h2>
          </div>
          <dl className="mt-3.5 grid grid-cols-2 gap-3">
            {summary.map((t) => (
              <div key={t.label} className="rounded-[11px] px-[15px] py-3.5" style={{ background: t.cardBg }}>
                <div className="flex items-center gap-2.5">
                  <Tile icon={t.icon} tint={t.tint} fg={t.fg} size={28} glyph={15} radius={8} />
                  <dt className="min-w-0 text-xs font-medium text-[#64748B]">{t.label}</dt>
                </div>
                <dd>
                  <span className="mt-2 block text-xl font-extrabold text-[#0F172A]">{t.value}</span>
                  <span className="mt-1 block text-[11.5px] font-medium text-[#94A3B8]">{t.note}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <QuickActionsCard items={[
          { icon: 'CalendarPlus', label: 'Book Follow-up', onSelect: () => navigate(`/doctor/appointments/new?patient=${patientId}`) },
          { icon: 'FilePlus', label: 'Create Invoice', onSelect: () => navigate(`/doctor/revenue?patient=${patientId}`) },
          { icon: 'MessageSquare', label: 'Send Message', onSelect: () => navigate('/doctor/messages') },
        ]} />

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center">
            <h2 className={H2}>Recent Prescriptions</h2>
          </div>
          {prescriptions.length ? (
            <ul className="mt-3.5">
              {prescriptions.slice(0, 5).map((p, i) => {
                const sw = swatch(p.drug);
                return (
                  <li key={p.id} className={cn('flex h-14 items-center gap-3', i > 0 && 'border-t border-[#F1F3F9]')}>
                    <Tile icon="Pill" tint={sw.tint} fg={sw.fg} size={30} glyph={15} radius={8} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-[#0F172A]">{p.drug}</span>
                      <span className="block truncate text-[11.5px] text-[#64748B]">
                        {[p.dose, p.frequency, p.duration].filter(Boolean).join(' • ') || 'No regimen recorded'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11.5px] font-medium text-[#94A3B8]">{wsDate(p.date)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3.5 rounded-[11px] bg-[#F7F8FC] px-4 py-6 text-center text-[12.5px] font-medium text-[#64748B]">
              No prescriptions yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

// ── 19 · Documents ───────────────────────────────────────────────────────────

const DOC_TYPE_STYLE: Record<string, { bg: string; fg: string }> = {
  Identity: { bg: '#EAF0FE', fg: '#2B6FF0' },
  'Medical Record': { bg: '#DCF7E6', fg: '#12A150' },
  Report: { bg: '#E4EBFD', fg: '#2B6FF0' },
  'Lab Report': { bg: '#FDECD3', fg: '#E8890B' },
  Prescription: { bg: '#FDE2E2', fg: '#E03131' },
  Notes: { bg: '#EAF0FE', fg: '#2B6FF0' },
  Other: { bg: '#F1F5F9', fg: '#475569' },
};

const humanMB = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  // Round up so a 300-byte file is not "0 KB" — but zero bytes stays zero.
  return `${bytes === 0 ? 0 : Math.max(1, Math.round(bytes / 1024))} KB`;
};

export function DocumentsPanel({ patientId, patientName }: PanelProps) {
  const [type, setType] = useState('All Types');
  const [uploadType, setUploadType] = useState<DocumentType>('Medical Record');
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, loading, error, reload } = useLoad(() => listDocuments(patientId), [patientId]);
  const documents = useMemo(() => data?.documents ?? [], [data]);
  const rows = useMemo(() => (type === 'All Types' ? documents : documents.filter((d) => d.type === type)), [documents, type]);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy('upload');
    setUploadError(null);
    try {
      await uploadPatientDocument(patientId, file, { type: uploadType });
      reload();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onDelete(id: string) {
    setBusy(id);
    try {
      await deleteDocument(patientId, id);
      reload();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(null);
    }
  }

  const byType = withPct((data?.byType ?? []).map((t) => ({ label: t.label as string, count: t.count, color: DOC_TYPE_STYLE[t.label]?.fg ?? '#94A3B8' })));

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <section className={`${CARD} min-w-0 pb-4 pt-5`}>
        <div className="flex flex-wrap items-start gap-3 px-[22px]">
          <div className="min-w-0">
            <h2 className={H2}>Documents</h2>
            <p className="mt-1 text-[12.5px] text-[#64748B]">All documents related to {patientName}&rsquo;s medical history.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="relative">
              <label htmlFor="d-upload-type" className="sr-only">Upload as type</label>
              <select id="d-upload-type" value={uploadType} onChange={(e) => setUploadType(e.target.value as DocumentType)} className={cn(SELECT, 'w-[168px]')}>
                {DOCUMENT_TYPES.map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
            <input ref={fileRef} type="file" className="sr-only" id="d-file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={(e) => void onPick(e.target.files?.[0])} />
            <button type="button" disabled={busy === 'upload'} onClick={() => fileRef.current?.click()}
              className="flex h-[42px] items-center gap-2 rounded-[10px] px-5 text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
              <Plus className="h-[17px] w-[17px]" />
              <span className="text-[13px] font-bold">{busy === 'upload' ? 'Uploading…' : 'Upload'}</span>
            </button>
            <div className="relative">
              <label htmlFor="d-type" className="sr-only">Document type filter</label>
              <select id="d-type" value={type} onChange={(e) => setType(e.target.value)} className={cn(SELECT, 'w-[168px]')}>
                {['All Types', ...DOCUMENT_TYPES].map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
          </div>
        </div>

        {uploadError && (
          <p role="alert" className="mx-[22px] mt-3 rounded-[10px] border border-[#F5C2C2] bg-[#FDF2F2] px-4 py-2.5 text-[12.5px] font-medium text-[#B42318]">
            {uploadError}
          </p>
        )}

        <div className="mt-4 px-[22px]">
          <PanelState loading={loading} error={error} empty={!rows.length}
            emptyText={documents.length ? 'No documents of this type.' : 'No documents uploaded yet.'} />
        </div>

        {rows.length > 0 && (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] border-separate border-spacing-0">
                <caption className="sr-only">Patient documents</caption>
                <thead>
                  <tr>
                    {['Document Name', 'Type', 'Uploaded By', 'Upload Date', 'Size', 'Actions'].map((h, i) => (
                      <th key={h} scope="col" className={cn(TH, i === 0 && 'pl-[22px]')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    const style = DOC_TYPE_STYLE[d.type] ?? DOC_TYPE_STYLE.Other;
                    return (
                      <tr key={d.id} className="hover:bg-[#FAFBFF]">
                        <th scope="row" className="h-[69px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left font-normal">
                          <span className="flex items-center gap-3">
                            <span aria-hidden="true" className="grid h-10 w-[34px] shrink-0 place-items-center rounded-[7px] text-[8.5px] font-extrabold" style={{ background: style.bg, color: style.fg }}>
                              {d.ext}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-bold text-[#0F172A]">{d.name}</span>
                              <span className="block truncate text-[11.5px] text-[#64748B]">{d.note ?? ''}</span>
                            </span>
                          </span>
                        </th>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <span className="inline-block rounded-[7px] px-[11px] py-[5px] text-[11.5px] font-semibold" style={{ background: style.bg, color: style.fg }}>
                            {d.type}
                          </span>
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{d.uploadedBy ?? '—'}</td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <span className="block text-[12.5px] font-semibold text-[#0F172A]">{wsDate(d.createdAt)}</span>
                          <span className="block text-xs font-medium text-[#94A3B8]">{wsTime(d.createdAt)}</span>
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{d.size}</td>
                        <td className="border-b border-[#F1F3F9] pr-[22px]">
                          <span className="flex items-center gap-2.5">
                            <a href={documentFileUrl(patientId, d.id)} target="_blank" rel="noreferrer"
                              aria-label={`Open ${d.name}, ${d.ext}, ${d.size}`}
                              className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#E2E6F0] text-[#334155] hover:bg-[#F7F8FC]">
                              <Download className="h-[17px] w-[17px]" />
                            </a>
                            <RowMenu label={`Actions for ${d.name}`} size={32}
                              items={[
                                { label: 'Open', onSelect: () => window.open(documentFileUrl(patientId, d.id), '_blank', 'noopener') },
                                { label: busy === d.id ? 'Deleting…' : 'Delete', danger: true, onSelect: () => void onDelete(d.id) },
                              ]} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <SinglePagePager label={`Showing 1 to ${rows.length} of ${rows.length} documents`} />
          </>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <FileText aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
            <h2 className={H2}>Document Summary</h2>
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-3">
            <div className="rounded-[11px] bg-[#F3F0FE] px-[15px] py-4">
              <p className="text-[22px] font-extrabold text-[#0F172A]">{documents.length}</p>
              <p className="mt-1 text-[11.5px] font-medium text-[#64748B]">Total Documents</p>
            </div>
            <div className="rounded-[11px] bg-[#ECFAF1] px-[15px] py-4">
              <p className="text-[22px] font-extrabold text-[#0F172A]">{humanMB(data?.totalBytes ?? 0)}</p>
              <p className="mt-1 text-[11.5px] font-medium text-[#64748B]">Total Size</p>
            </div>
          </div>
          {byType.length > 0 && (
            <>
              <h3 className="mt-[18px] text-[13px] font-bold text-[#0F172A]">By Type</h3>
              <Donut data={byType} label="Documents by type" />
            </>
          )}
        </section>

        <QuickActionsCard items={[
          { icon: 'UploadCloud', label: 'Upload Document', onSelect: () => fileRef.current?.click() },
        ]} />

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <ShieldCheck aria-hidden="true" className="h-[17px] w-[17px] text-[#6D5AE0]" />
            <h2 className={H2}>Document Security</h2>
          </div>
          <p className="mt-3 text-[12.5px] leading-5 text-[#475569]">
            File names and notes are encrypted at rest, and every download is access-logged.
          </p>
          <span className="mt-3.5 inline-flex items-center gap-2 rounded-[7px] bg-[#DCF7E6] px-3 py-[5px] text-[11.5px] font-bold text-[#12A150]">
            <CircleCheck aria-hidden="true" className="h-[13px] w-[13px]" />
            Secure Storage
          </span>
        </section>
      </div>
    </div>
  );
}

// ── 21 · Invoices ────────────────────────────────────────────────────────────

const INV_STATUS_STYLE: Record<InvoiceStatus, { bg: string; fg: string; label: string }> = {
  paid: { bg: '#DCF7E6', fg: '#12A150', label: 'Paid' },
  partial: { bg: '#FDECD3', fg: '#E8890B', label: 'Partial' },
  unpaid: { bg: '#FDE2E2', fg: '#E03131', label: 'Unpaid' },
  cancelled: { bg: '#F1F5F9', fg: '#64748B', label: 'Cancelled' },
};

export function InvoicesPanel({ patientId, patientName }: PanelProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('All Status');

  const { data, loading, error } = useLoad(() => listPatientInvoices(patientId), [patientId]);
  const invoices = useMemo(() => data?.invoices ?? [], [data]);
  const rows = useMemo(
    () => (status === 'All Status' ? invoices : invoices.filter((i) => INV_STATUS_STYLE[i.status].label === status)),
    [invoices, status],
  );

  const live = invoices.filter((i) => i.status !== 'cancelled');
  const paid = live.reduce((t, i) => t + i.amountPaid, 0);
  const outstanding = live.reduce((t, i) => t + Math.max(0, i.total - i.amountPaid), 0);
  const unpaidCount = live.filter((i) => i.status !== 'paid').length;
  const recent = invoices.filter((i) => i.paidAt).slice(0, 3);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <section className={`${CARD} min-w-0 pb-4 pt-5`}>
        <div className="flex flex-wrap items-start gap-3 px-[22px]">
          <div className="min-w-0">
            <h2 className={H2}>Invoices</h2>
            <p className="mt-1 text-[12.5px] text-[#64748B]">All billing and payment history for {patientName}.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="relative">
              <label htmlFor="pi-status" className="sr-only">Invoice status</label>
              <select id="pi-status" value={status} onChange={(e) => setStatus(e.target.value)} className={cn(SELECT, 'h-11 w-[152px]')}>
                {['All Status', 'Paid', 'Partial', 'Unpaid', 'Cancelled'].map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
            {/* Outlined indigo — not the gradient used elsewhere. */}
            <button type="button" aria-label="Create new invoice" onClick={() => navigate(`/doctor/revenue?patient=${patientId}`)}
              className="flex h-11 items-center gap-2 rounded-[10px] border-[1.5px] border-[#C7CEF5] bg-white px-5 hover:bg-[#F5F7FF]">
              <Plus className="h-[17px] w-[17px] text-[#3B4FE0]" />
              <span className="text-[13.5px] font-bold text-[#3B4FE0]">New Invoice</span>
            </button>
          </div>
        </div>

        <div className="mt-4 px-[22px]">
          <PanelState loading={loading} error={error} empty={!rows.length}
            emptyText={invoices.length ? 'No invoices with this status.' : 'No invoices raised for this patient yet.'} />
        </div>

        {rows.length > 0 && (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[820px] border-separate border-spacing-0">
                <caption className="sr-only">Invoices for this patient</caption>
                <thead>
                  <tr>
                    {['Invoice ID', 'Date', 'For', 'Amount', 'Payment Status', 'Paid On', 'Actions'].map((h, i) => (
                      <th key={h} scope="col" className={cn(TH, i === 0 && 'pl-[22px]')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((inv) => {
                    const st = INV_STATUS_STYLE[inv.status];
                    const sw = swatch(inv.summary ?? inv.number);
                    return (
                      <tr key={inv.id} className="hover:bg-[#FAFBFF]">
                        <th scope="row" className="h-[67px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left font-normal">
                          <span className="flex items-center gap-3">
                            <Tile icon="FileText" tint={sw.tint} fg={sw.fg} size={32} glyph={16} radius={9} />
                            <span className="text-[13px] font-bold text-[#0F172A]">{inv.number}</span>
                          </span>
                        </th>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{wsDate(inv.date)}</td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <span className="block max-w-[200px] truncate text-[12.5px] font-medium text-[#334155]" title={inv.summary ?? undefined}>
                            {inv.summary || <Dash say="No line items" />}
                          </span>
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[13px] font-bold text-[#0F172A]">
                          {money(inv.total)}<span className="sr-only"> rupees</span>
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3"><Chip label={st.label} bg={st.bg} fg={st.fg} /></td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">
                          {inv.paidAt ? wsDate(inv.paidAt) : <Dash say="Not paid yet" />}
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-[22px]">
                          <span className="flex items-center gap-[9px]">
                            <button type="button" aria-label={`Open invoice ${inv.number}`} onClick={() => navigate(`/doctor/revenue?invoice=${inv.id}`)}
                              className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#E2E6F0] text-[#334155] hover:bg-[#F7F8FC]">
                              <Eye className="h-4 w-4" />
                            </button>
                            <RowMenu label={`Actions for ${inv.number}`} size={32}
                              items={[{ label: 'Manage in Billing', onSelect: () => navigate(`/doctor/revenue?invoice=${inv.id}`) }]} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <SinglePagePager label={`Showing 1 to ${rows.length} of ${rows.length} invoices`} />
          </>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <FileText aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
            <h2 className={H2}>Invoice Summary</h2>
          </div>
          <dl className="mt-3.5 grid grid-cols-2 gap-3">
            {([
              ['#EEF1FE', 'Total Invoices', String(invoices.length)],
              ['#ECFAF1', 'Total Paid', money(paid)],
              ['#FEF6E7', 'Outstanding', money(outstanding)],
              ['#FDEEEE', 'Unpaid', String(unpaidCount)],
            ] as const).map(([bg, label, value]) => (
              <div key={label} className="rounded-[11px] px-[15px] py-4" style={{ background: bg }}>
                <dt className="text-[11.5px] font-medium text-[#64748B]">{label}</dt>
                <dd className="mt-[7px] text-xl font-extrabold text-[#0F172A]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {recent.length > 0 && (
          <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
            <div className="flex items-center gap-2.5">
              <h2 className={H2}>Recent Payments</h2>
              <CircleCheck aria-hidden="true" className="ml-auto h-[17px] w-[17px] text-[#12A150]" />
            </div>
            <ul className="mt-3.5">
              {recent.map((p, i) => (
                <li key={p.id} className={cn('py-3.5', i > 0 && 'border-t border-[#F1F3F9]')}>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-bold text-[#0F172A]">{p.number}</span>
                    <span className="ml-auto text-[12.5px] font-bold text-[#0F172A]">{money(p.amountPaid)}</span>
                    <Chip label={INV_STATUS_STYLE[p.status].label} bg={INV_STATUS_STYLE[p.status].bg} fg={INV_STATUS_STYLE[p.status].fg} className="!px-[9px] !py-[3px] !text-[11px]" />
                  </p>
                  <p className="mt-1 text-[11.5px] text-[#64748B]">Paid on {wsDate(p.paidAt)}</p>
                </li>
              ))}
            </ul>
            <FooterLink label="View All Payments" onClick={() => navigate('/doctor/revenue')} />
          </section>
        )}

        <QuickActionsCard items={[
          { icon: 'FilePlus', label: 'Create New Invoice', onSelect: () => navigate(`/doctor/revenue?patient=${patientId}`) },
          { icon: 'CircleCheck', label: 'Record Payment', onSelect: () => navigate('/doctor/revenue') },
        ]} />
      </div>
    </div>
  );
}

// ── 22 · Notes ───────────────────────────────────────────────────────────────

const NOTE_CATEGORY_STYLE: Record<string, { bg: string; fg: string; icon: string }> = {
  'Clinical Note': { bg: '#EDE9FE', fg: '#6D28D9', icon: 'FileText' },
  'General Note': { bg: '#E4EBFD', fg: '#2B6FF0', icon: 'MessageSquare' },
  'Follow-up Note': { bg: '#DCF7E6', fg: '#12A150', icon: 'CheckSquare' },
  'Treatment Note': { bg: '#DCF7E6', fg: '#12A150', icon: 'FlaskConical' },
  Observation: { bg: '#EAF0FE', fg: '#2B6FF0', icon: 'Search' },
};

export function NotesPanel({ patientId, patientName }: PanelProps) {
  const [filter, setFilter] = useState('All Notes');
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftCategory, setDraftCategory] = useState<NoteCategory>('Clinical Note');
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const { data, loading, error, reload } = useLoad(() => listNotes(patientId), [patientId]);
  const notes = useMemo(() => data?.notes ?? [], [data]);

  const rows = useMemo(() => {
    if (filter === 'All Notes') return notes;
    if (filter === 'Pinned') return notes.filter((n) => n.pinned);
    return notes.filter((n) => n.category === filter);
  }, [notes, filter]);

  const pinned = notes.find((n) => n.pinned);
  const monthKey = new Date().toISOString().slice(0, 7);
  const thisMonth = notes.filter((n) => n.createdAt.slice(0, 7) === monthKey).length;
  const byCategory = withPct(
    (data?.byCategory ?? []).map((c) => ({ label: c.label as string, count: c.count, color: NOTE_CATEGORY_STYLE[c.label]?.fg ?? '#94A3B8' })),
  );

  async function save() {
    if (!draft.trim()) return;
    setSaving(true);
    setWriteError(null);
    try {
      await createNote(patientId, { text: draft.trim(), category: draftCategory });
      setDraft('');
      setComposing(false);
      reload();
    } catch (e: unknown) {
      setWriteError(e instanceof Error ? e.message : 'Could not save the note');
    } finally {
      setSaving(false);
    }
  }

  async function mutate(fn: () => Promise<unknown>) {
    setWriteError(null);
    try {
      await fn();
      reload();
    } catch (e: unknown) {
      setWriteError(e instanceof Error ? e.message : 'Action failed');
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <section className={`${CARD} min-w-0 px-[22px] pb-4 pt-5`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <h2 className={H2}>Notes</h2>
            <p className="mt-1 text-[12.5px] text-[#64748B]">All notes and observations related to {patientName}&rsquo;s care.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="relative">
              <label htmlFor="n-filter" className="sr-only">Note category</label>
              <select id="n-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className={cn(SELECT, 'h-11 w-[168px]')}>
                {['All Notes', ...NOTE_CATEGORIES, 'Pinned'].map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
            <button type="button" aria-label="Add note" onClick={() => setComposing((v) => !v)}
              className="flex h-11 items-center gap-2 rounded-[10px] px-5 text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
              <Plus className="h-[17px] w-[17px]" />
              <span className="text-[13.5px] font-bold">Add Note</span>
            </button>
          </div>
        </div>

        {composing && (
          <div className="mt-4 rounded-[12px] border border-[#E4E8F1] bg-[#FAFBFD] p-4">
            <label htmlFor="n-cat" className="sr-only">Note category</label>
            <select id="n-cat" value={draftCategory} onChange={(e) => setDraftCategory(e.target.value as NoteCategory)} className={cn(SELECT, 'w-[180px]')}>
              {NOTE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <label htmlFor="n-text" className="sr-only">Note text</label>
            <textarea id="n-text" value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} maxLength={4000}
              placeholder="What happened at this visit?"
              className="mt-3 w-full rounded-[10px] border border-[#E4E8F1] bg-white px-3.5 py-3 text-[13px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
            <div className="mt-3 flex items-center gap-3">
              <button type="button" disabled={saving || !draft.trim()} onClick={() => void save()}
                className="h-10 rounded-[10px] px-5 text-[13px] font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
                {saving ? 'Saving…' : 'Save Note'}
              </button>
              <button type="button" onClick={() => { setComposing(false); setDraft(''); }}
                className="h-10 rounded-[10px] border border-[#E2E6F0] bg-white px-5 text-[13px] font-bold text-[#1E2A5A]">
                Cancel
              </button>
            </div>
          </div>
        )}

        {writeError && (
          <p role="alert" className="mt-3 rounded-[10px] border border-[#F5C2C2] bg-[#FDF2F2] px-4 py-2.5 text-[12.5px] font-medium text-[#B42318]">
            {writeError}
          </p>
        )}

        <div className="mt-4">
          <PanelState loading={loading} error={error} empty={!rows.length}
            emptyText={notes.length ? 'No notes in this category.' : 'No notes yet — add the first one.'} />
        </div>

        {rows.length > 0 && (
          <>
            <ol className="mt-[18px]">
              {rows.map((n, i) => {
                const style = NOTE_CATEGORY_STYLE[n.category] ?? NOTE_CATEGORY_STYLE['General Note'];
                return (
                  <li key={n.id}>
                    <article
                      className={cn(
                        'flex gap-4',
                        n.pinned
                          ? 'mb-3.5 rounded-[12px] border border-[#F8E3B8] bg-[#FEF8EC] px-5 py-[18px] [border-left:3px_solid_#F59E0B]'
                          : cn('py-[18px]', i > 0 && 'border-t border-[#F1F3F9]'),
                      )}
                    >
                      <h3 className="sr-only">{wsDate(n.createdAt)} {wsTime(n.createdAt)}, {n.category}, by {n.author ?? 'Unknown'}{n.pinned ? ', Pinned note' : ''}</h3>
                      <div className="flex w-[150px] shrink-0 gap-3">
                        <Tile icon={n.pinned ? 'Pin' : style.icon} tint={n.pinned ? '#FDECD3' : style.bg} fg={n.pinned ? '#E8890B' : style.fg} size={34} glyph={16} radius={10} />
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-bold text-[#0F172A]">{wsDate(n.createdAt)}</p>
                          <p className="text-[12.5px] font-medium text-[#64748B]">{wsTime(n.createdAt)}</p>
                          <p className="mt-1 truncate text-[12.5px] text-[#64748B]">{n.author ?? '—'}</p>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="inline-block rounded-[7px] px-3 py-[5px] text-[11.5px] font-semibold" style={{ background: style.bg, color: style.fg }}>
                          {n.category}
                        </span>
                        <p className="mt-2.5 whitespace-pre-wrap text-[13px] leading-[22px] text-[#475569]">{n.text}</p>
                        {n.pinned && (
                          <span className="mt-3 inline-flex items-center gap-1.5 rounded-[6px] bg-[#FDECD3] px-2.5 py-1 text-[11px] font-bold text-[#E8890B]">
                            <Pin aria-hidden="true" className="h-3 w-3" />
                            Pinned
                          </span>
                        )}
                      </div>

                      <RowMenu label={`Actions for note on ${wsDate(n.createdAt)}`} size={32} bordered
                        items={[
                          { label: n.pinned ? 'Unpin' : 'Pin', onSelect: () => void mutate(() => updateNote(patientId, n.id, { pinned: !n.pinned })) },
                          { label: 'Delete', danger: true, onSelect: () => void mutate(() => deleteNote(patientId, n.id)) },
                        ]} />
                    </article>
                  </li>
                );
              })}
            </ol>
            <div className="-mx-[22px]"><SinglePagePager label={`Showing 1 to ${rows.length} of ${rows.length} notes`} /></div>
          </>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <FileText aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
            <h2 className={H2}>Notes Summary</h2>
          </div>
          <dl className="mt-3.5 grid grid-cols-3 gap-2.5">
            {([
              ['#EEF1FE', String(notes.length), 'Total Notes', false],
              ['#FEF6E7', String(notes.filter((n) => n.pinned).length), 'Pinned Notes', true],
              ['#EAF1FE', String(thisMonth), 'This Month', false],
            ] as const).map(([bg, value, label, showPin]) => (
              <div key={label} className="rounded-[11px] px-3 py-[15px]" style={{ background: bg }}>
                {showPin && <Pin aria-hidden="true" className="mb-1 h-[15px] w-[15px] text-[#E8890B]" />}
                <dd className="text-2xl font-extrabold text-[#0F172A]">{value}</dd>
                <dt className="mt-1.5 text-[11px] font-medium text-[#64748B]">{label}</dt>
              </div>
            ))}
          </dl>
        </section>

        {pinned && (
          <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
            <div className="flex items-center gap-2.5">
              <Pin aria-hidden="true" className="h-[17px] w-[17px] text-[#E8890B]" />
              <h2 className={H2}>Pinned Note</h2>
              <ViewAll label="Show all" onClick={() => setFilter('Pinned')} />
            </div>
            <div className="mt-3.5 flex gap-3">
              <Tile icon="Pin" tint="#FDECD3" fg="#E8890B" size={30} glyph={15} radius={8} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[#64748B]">{wsDate(pinned.createdAt)} • {wsTime(pinned.createdAt)}</span>
                  <span className="ml-auto rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold"
                    style={{ background: (NOTE_CATEGORY_STYLE[pinned.category] ?? NOTE_CATEGORY_STYLE['General Note']).bg, color: (NOTE_CATEGORY_STYLE[pinned.category] ?? NOTE_CATEGORY_STYLE['General Note']).fg }}>
                    {pinned.category}
                  </span>
                </p>
                <p title={pinned.text} className="mt-2 line-clamp-2 text-[12.5px] text-[#475569]">{pinned.text}</p>
                <span className="sr-only">{pinned.text}</span>
                <p className="mt-2 text-xs font-medium text-[#64748B]">{pinned.author ?? '—'}</p>
              </div>
            </div>
          </section>
        )}

        {byCategory.length > 0 && (
          <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
            <div className="flex items-center gap-2.5">
              <FileText aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
              <h2 className={H2}>Note Categories</h2>
            </div>
            <Donut data={byCategory} label="Notes by category" />
          </section>
        )}

        <QuickActionsCard items={NOTE_CATEGORIES.slice(0, 3).map((c) => ({
          icon: NOTE_CATEGORY_STYLE[c].icon,
          label: `Add ${c}`,
          onSelect: () => { setDraftCategory(c); setComposing(true); },
        }))} />
      </div>
    </div>
  );
}
