import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ChevronDown, CircleCheck, Download, Eye, FileText, Pin, Plus, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import {
  DOCUMENTS, DOC_TYPE_BREAKDOWN, DOC_TYPE_STYLE, INVOICE_TYPE_STYLE, NOTES, NOTES_THIS_MONTH,
  NOTE_CATEGORY_COUNTS, NOTE_CATEGORY_STYLE, PATIENT_INVOICES,
  RECENT_PAYMENTS, RECENT_PRESCRIPTIONS, VISITS,
} from '../../../../data/workspaceTabs';
import { money } from '../../../../data/invoices';
import { RowMenu } from '../RowMenu';
import { CARD, Chip, Dash, FooterLink, H2, QuickActionsCard, SELECT, SinglePagePager, Tile, ViewAll, WS_ICONS } from './shared';
import { cn } from '../../../../lib/cn';

const TH = 'h-10 border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]';
const DONE = { bg: '#DCF7E6', fg: '#12A150' };

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

const VISIT_SUMMARY = [
  { cardBg: '#F3F0FE', tint: '#E7E3FD', fg: '#6D5AE0', icon: 'Stethoscope', label: 'Total Visits', value: '7', note: 'All time' },
  { cardBg: '#ECFAF1', tint: '#DCF7E6', fg: '#12A150', icon: 'CalendarDays', label: 'This Year', value: '7', note: '2025' },
  { cardBg: '#FEF6E7', tint: '#FDECD3', fg: '#F59E0B', icon: 'CalendarDays', label: 'Last Visit', value: '12 May 2025', note: '10:00 AM' },
  { cardBg: '#EAF2FE', tint: '#DCE9FE', fg: '#2B6FF0', icon: 'CalendarPlus', label: 'Next Follow-up', value: '14 May 2025', note: '11:00 AM' },
];

const WS_QUICK = [
  { icon: 'CalendarPlus', label: 'Book Follow-up' },
  { icon: 'Stethoscope', label: 'Add Prescription' },
  { icon: 'UploadCloud', label: 'Upload Document' },
  { icon: 'MessageSquare', label: 'Send Message' },
];

export function VisitsPanel() {
  const [type, setType] = useState('All Visits');
  const rows = useMemo(() => (type === 'All Visits' ? VISITS : VISITS.filter((v) => v.subLabel === type)), [type]);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <section className={`${CARD} min-w-0 pb-4 pt-5`}>
        <div className="flex flex-wrap items-center gap-3 px-[22px]">
          <h2 className={H2}>Visits &amp; Consultations</h2>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <button type="button" aria-label="Filter visits" className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#E4E8F1] bg-white px-[18px] hover:bg-[#F7F8FC]">
              <SlidersHorizontal className="h-4 w-4 text-[#3B4FE0]" />
              <span className="text-[13px] font-semibold text-[#334155]">Filter</span>
            </button>
            <div className="relative">
              <label htmlFor="v-type" className="sr-only">Visit type</label>
              <select id="v-type" value={type} onChange={(e) => setType(e.target.value)} className={cn(SELECT, 'w-[166px]')}>
                {['All Visits', 'Consultation', 'Routine Checkup', 'Immunization', 'Video Visit'].map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0">
            <caption className="sr-only">Visit and consultation history</caption>
            <thead>
              <tr>
                {['Date & Time', 'Visit Type', 'Diagnosis', 'Doctor', 'Follow-up', 'Status', 'Actions'].map((h, i) => (
                  <th key={h} scope="col" className={cn(TH, i === 0 && 'pl-[22px]')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={`${v.date}-${v.time}`} className="hover:bg-[#FAFBFF]">
                  <th scope="row" className="h-[71px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left font-normal">
                    <span className="flex items-center gap-3">
                      <Tile icon={v.icon} tint={v.tint} fg={v.fg} />
                      <span>
                        <span className="block text-[12.5px] font-bold text-[#0F172A]">{v.date}</span>
                        <span className="block text-xs font-medium text-[#94A3B8]">{v.time}</span>
                      </span>
                    </span>
                  </th>
                  <td className="border-b border-[#F1F3F9] pr-3">
                    <span className="block text-[13px] font-bold text-[#0F172A]">{v.type}</span>
                    <span className="block text-xs text-[#64748B]">{v.subLabel}</span>
                  </td>
                  <td className="border-b border-[#F1F3F9] pr-3">
                    <span className="block text-[12.5px] font-semibold text-[#334155]">{v.diagnosis}</span>
                    <span className="block text-xs text-[#94A3B8]">
                      {v.secondary.startsWith('ICD-10') ? <abbr title="International Classification of Diseases, 10th revision" className="no-underline">{v.secondary}</abbr> : v.secondary}
                    </span>
                  </td>
                  <td className="border-b border-[#F1F3F9] pr-3">
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden="true" className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#EDE9FE] text-[11px] font-bold text-[#6D5AE0]">AS</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-bold text-[#0F172A]">Dr. Ananya Sharma</span>
                        <span className="block text-[11.5px] text-[#64748B]">Paediatrician</span>
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px]">
                    {v.followUpDate ? (
                      <>
                        <span className="block font-semibold text-[#0F172A]">{v.followUpDate}</span>
                        <span className="block text-xs font-medium text-[#94A3B8]">{v.followUpTime}</span>
                      </>
                    ) : <Dash say="No follow-up scheduled" />}
                  </td>
                  <td className="border-b border-[#F1F3F9] pr-3"><Chip label="Completed" bg={DONE.bg} fg={DONE.fg} /></td>
                  <td className="border-b border-[#F1F3F9] pr-[22px]">
                    <RowMenu label={`Actions for ${v.type} on ${v.date}`} size={32}
                      items={['View Consultation', 'View Prescription', 'Download Summary', 'Book Follow-up'].map((l) => ({ label: l, onSelect: () => console.log('[Clinic OS]', l) }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SinglePagePager label={`Showing 1 to ${rows.length} of ${rows.length} visits`} />
      </section>

      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <WS_ICONS.ClipboardList aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
            <h2 className={H2}>Visit Summary</h2>
          </div>
          <dl className="mt-3.5 grid grid-cols-2 gap-3">
            {VISIT_SUMMARY.map((t) => (
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

        <QuickActionsCard items={WS_QUICK} />

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center">
            <h2 className={H2}>Recent Prescriptions</h2>
            <ViewAll />
          </div>
          <ul className="mt-3.5">
            {RECENT_PRESCRIPTIONS.map((p, i) => (
              <li key={p.name} className={cn('flex h-14 items-center gap-3', i > 0 && 'border-t border-[#F1F3F9]')}>
                <Tile icon="Pill" tint={p.tint} fg={p.fg} size={30} glyph={15} radius={8} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-[#0F172A]">{p.name}</span>
                  <span className="block truncate text-[11.5px] text-[#64748B]">{p.regimen}</span>
                </span>
                <span className="shrink-0 text-[11.5px] font-medium text-[#94A3B8]">{p.date}</span>
              </li>
            ))}
          </ul>
          <FooterLink label="View All Prescriptions" />
        </section>
      </div>
    </div>
  );
}

// ── 19 · Documents ───────────────────────────────────────────────────────────

export function DocumentsPanel() {
  const [type, setType] = useState('All Types');
  const rows = useMemo(() => (type === 'All Types' ? DOCUMENTS : DOCUMENTS.filter((d) => d.type === type)), [type]);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <section className={`${CARD} min-w-0 pb-4 pt-5`}>
        <div className="flex flex-wrap items-start gap-3 px-[22px]">
          <div className="min-w-0">
            <h2 className={H2}>Documents</h2>
            <p className="mt-1 text-[12.5px] text-[#64748B]">All documents related to Myra&rsquo;s medical history.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <button type="button" aria-label="Filter documents" className="flex h-[42px] items-center gap-2 rounded-[10px] border border-[#E4E8F1] bg-white px-[18px] hover:bg-[#F7F8FC]">
              <SlidersHorizontal className="h-4 w-4 text-[#3B4FE0]" />
              <span className="text-[13px] font-semibold text-[#334155]">Filter</span>
            </button>
            <div className="relative">
              <label htmlFor="d-type" className="sr-only">Document type</label>
              <select id="d-type" value={type} onChange={(e) => setType(e.target.value)} className={cn(SELECT, 'w-[176px]')}>
                {['All Types', 'Identity', 'Medical Record', 'Report', 'Lab Report', 'Prescription', 'Notes'].map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
          </div>
        </div>

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
              {rows.map((d) => (
                <tr key={d.name} className="hover:bg-[#FAFBFF]">
                  <th scope="row" className="h-[69px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left font-normal">
                    <span className="flex items-center gap-3">
                      <span aria-hidden="true" className="grid h-10 w-[34px] shrink-0 place-items-center rounded-[7px] text-[8.5px] font-extrabold" style={{ background: d.badgeTint, color: d.badgeFg }}>
                        {d.ext}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold text-[#0F172A]">{d.name}</span>
                        <span className="block truncate text-[11.5px] text-[#64748B]">{d.sub}</span>
                      </span>
                    </span>
                  </th>
                  <td className="border-b border-[#F1F3F9] pr-3">
                    <span className="inline-block rounded-[7px] px-[11px] py-[5px] text-[11.5px] font-semibold" style={{ background: DOC_TYPE_STYLE[d.type].bg, color: DOC_TYPE_STYLE[d.type].fg }}>
                      {d.type}
                    </span>
                  </td>
                  <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{d.by}</td>
                  <td className="border-b border-[#F1F3F9] pr-3">
                    <span className="block text-[12.5px] font-semibold text-[#0F172A]">{d.date}</span>
                    <span className="block text-xs font-medium text-[#94A3B8]">{d.time}</span>
                  </td>
                  <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{d.size}</td>
                  <td className="border-b border-[#F1F3F9] pr-[22px]">
                    <span className="flex items-center gap-2.5">
                      <button type="button" aria-label={`Download ${d.name}, ${d.ext}, ${d.size}`} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#E2E6F0] text-[#334155] hover:bg-[#F7F8FC]">
                        <Download className="h-[17px] w-[17px]" />
                      </button>
                      <RowMenu label={`Actions for ${d.name}`} size={32}
                        items={['Preview', 'Rename', 'Share', 'Replace', 'Delete'].map((l) => ({ label: l, danger: l === 'Delete', onSelect: () => console.log('[Clinic OS]', l, d.name) }))} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SinglePagePager label={`Showing 1 to ${rows.length} of ${rows.length} documents`} />
      </section>

      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <FileText aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
            <h2 className={H2}>Document Summary</h2>
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-3">
            <div className="rounded-[11px] bg-[#F3F0FE] px-[15px] py-4">
              <p className="text-[22px] font-extrabold text-[#0F172A]">{DOCUMENTS.length}</p>
              <p className="mt-1 text-[11.5px] font-medium text-[#64748B]">Total Documents</p>
            </div>
            <div className="rounded-[11px] bg-[#ECFAF1] px-[15px] py-4">
              <p className="text-[22px] font-extrabold text-[#0F172A]">5.2 MB</p>
              <p className="mt-1 text-[11.5px] font-medium text-[#64748B]">Total Size</p>
            </div>
          </div>
          <h3 className="mt-[18px] text-[13px] font-bold text-[#0F172A]">By Type</h3>
          <Donut data={DOC_TYPE_BREAKDOWN} label="Documents by type" />
          <FooterLink label="View Document Analytics" />
        </section>

        <QuickActionsCard items={[
          { icon: 'UploadCloud', label: 'Upload Document' },
          { icon: 'ScanLine', label: 'Scan & Upload' },
          { icon: 'Mail', label: 'Request Document' },
          { icon: 'Share2', label: 'Share Documents' },
        ]} />

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <ShieldCheck aria-hidden="true" className="h-[17px] w-[17px] text-[#6D5AE0]" />
            <h2 className={H2}>Document Security</h2>
          </div>
          <p className="mt-3 text-[12.5px] leading-5 text-[#475569]">All documents are encrypted and securely stored.</p>
          <span className="mt-3.5 inline-flex items-center gap-2 rounded-[7px] bg-[#DCF7E6] px-3 py-[5px] text-[11.5px] font-bold text-[#12A150]">
            <CircleCheck aria-hidden="true" className="h-[13px] w-[13px]" />
            Secure Storage
          </span>
          <p className="mt-4 text-xs font-medium text-[#64748B]">Last backup: 12 May 2025, 02:00 AM</p>
        </section>
      </div>
    </div>
  );
}

// ── 21 · Invoices ────────────────────────────────────────────────────────────

export function InvoicesPanel() {
  const [status, setStatus] = useState('All Status');
  const rows = useMemo(() => (status === 'All Status' ? PATIENT_INVOICES : PATIENT_INVOICES.filter((i) => i.status === status)), [status]);
  const total = rows.reduce((t, i) => t + i.amount, 0);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <section className={`${CARD} min-w-0 pb-4 pt-5`}>
        <div className="flex flex-wrap items-start gap-3 px-[22px]">
          <div className="min-w-0">
            <h2 className={H2}>Invoices</h2>
            <p className="mt-1 text-[12.5px] text-[#64748B]">All billing and payment history for Myra.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="relative">
              <label htmlFor="pi-status" className="sr-only">Invoice status</label>
              <select id="pi-status" value={status} onChange={(e) => setStatus(e.target.value)} className={cn(SELECT, 'h-11 w-[152px]')}>
                {['All Status', 'Paid', 'Pending', 'Overdue'].map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
            <div className="relative">
              <label htmlFor="pi-period" className="sr-only">Period</label>
              <select id="pi-period" className={cn(SELECT, 'h-11 w-[172px]')}>
                {['Last 12 Months', 'Last 6 Months', 'Last 3 Months', 'All Time'].map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
            {/* Outlined indigo — not the gradient used elsewhere. */}
            <button type="button" aria-label="Create new invoice" className="flex h-11 items-center gap-2 rounded-[10px] border-[1.5px] border-[#C7CEF5] bg-white px-5 hover:bg-[#F5F7FF]">
              <Plus className="h-[17px] w-[17px] text-[#3B4FE0]" />
              <span className="text-[13.5px] font-bold text-[#3B4FE0]">New Invoice</span>
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0">
            <caption className="sr-only">Invoices for this patient</caption>
            <thead>
              <tr>
                {['Invoice ID', 'Date', 'Type', 'Amount', 'Payment Status', 'Due Date', 'Actions'].map((h, i) => (
                  <th key={h} scope="col" className={cn(TH, i === 0 && 'pl-[22px]')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const t = INVOICE_TYPE_STYLE[inv.type];
                return (
                  <tr key={inv.id} className="hover:bg-[#FAFBFF]">
                    <th scope="row" className="h-[67px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left font-normal">
                      <span className="flex items-center gap-3">
                        <Tile icon={t.icon} tint={t.bg} fg={t.fg} size={32} glyph={16} radius={9} />
                        <span className="text-[13px] font-bold text-[#0F172A]">{inv.id}</span>
                      </span>
                    </th>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{inv.date}</td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{inv.type}</td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[13px] font-bold text-[#0F172A]">
                      {money(inv.amount)}<span className="sr-only"> rupees</span>
                    </td>
                    <td className="border-b border-[#F1F3F9] pr-3"><Chip label={inv.status} bg={DONE.bg} fg={DONE.fg} /></td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{inv.dueDate}</td>
                    <td className="border-b border-[#F1F3F9] pr-[22px]">
                      <span className="flex items-center gap-[9px]">
                        <button type="button" aria-label={`Preview invoice ${inv.id}`} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#E2E6F0] text-[#334155] hover:bg-[#F7F8FC]">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label={`Download invoice ${inv.id}`} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#E2E6F0] text-[#334155] hover:bg-[#F7F8FC]">
                          <Download className="h-4 w-4" />
                        </button>
                        <RowMenu label={`Actions for ${inv.id}`} size={32}
                          items={['Send to Guardian', 'Record Payment', 'Duplicate', 'Cancel'].map((l) => ({ label: l, danger: l === 'Cancel', onSelect: () => console.log('[Clinic OS]', l, inv.id) }))} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <SinglePagePager label={`Showing 1 to ${rows.length} of ${rows.length} invoices`} />
      </section>

      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <FileText aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
            <h2 className={H2}>Invoice Summary</h2>
          </div>
          <dl className="mt-3.5 grid grid-cols-2 gap-3">
            {([
              ['#EEF1FE', 'Total Invoices', String(rows.length)],
              ['#ECFAF1', 'Total Paid', money(total)],
              ['#FEF6E7', 'Outstanding', '₹0.00'],
              ['#FDEEEE', 'Overdue', '0'],
            ] as const).map(([bg, label, value]) => (
              <div key={label} className="rounded-[11px] px-[15px] py-4" style={{ background: bg }}>
                <dt className="text-[11.5px] font-medium text-[#64748B]">{label}</dt>
                <dd className="mt-[7px] text-xl font-extrabold text-[#0F172A]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <h2 className={H2}>Recent Payment</h2>
            <CircleCheck aria-hidden="true" className="ml-auto h-[17px] w-[17px] text-[#12A150]" />
          </div>
          <ul className="mt-3.5">
            {RECENT_PAYMENTS.map((p, i) => (
              <li key={p.id} className={cn('py-3.5', i > 0 && 'border-t border-[#F1F3F9]')}>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-bold text-[#0F172A]">{p.id}</span>
                  <span className="ml-auto text-[12.5px] font-bold text-[#0F172A]">{money(p.amount)}</span>
                  <Chip label="Paid" bg={DONE.bg} fg={DONE.fg} className="!px-[9px] !py-[3px] !text-[11px]" />
                </p>
                <p className="mt-1 text-[11.5px] text-[#64748B]">Paid on {p.date}</p>
              </li>
            ))}
          </ul>
          <FooterLink label="View All Payments" />
        </section>

        <QuickActionsCard items={[
          { icon: 'FilePlus', label: 'Create New Invoice' },
          { icon: 'CircleCheck', label: 'Record Payment' },
          { icon: 'Download', label: 'Download Statement' },
          { icon: 'Settings', label: 'Payment Settings' },
        ]} />
      </div>
    </div>
  );
}

// ── 22 · Notes ───────────────────────────────────────────────────────────────

export function NotesPanel() {
  const [filter, setFilter] = useState('All Notes');
  const rows = useMemo(() => {
    if (filter === 'All Notes') return NOTES;
    if (filter === 'Pinned') return NOTES.filter((n) => n.pinned);
    return NOTES.filter((n) => n.category === filter);
  }, [filter]);
  const pinned = NOTES.find((n) => n.pinned);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
      <section className={`${CARD} min-w-0 px-[22px] pb-4 pt-5`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <h2 className={H2}>Notes</h2>
            <p className="mt-1 text-[12.5px] text-[#64748B]">All notes and observations related to Myra&rsquo;s care.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <button type="button" aria-label="Filter notes" className="flex h-11 items-center gap-2 rounded-[10px] border border-[#E4E8F1] bg-white px-[18px] hover:bg-[#F7F8FC]">
              <SlidersHorizontal className="h-4 w-4 text-[#3B4FE0]" />
              <span className="text-[13px] font-semibold text-[#334155]">Filter</span>
            </button>
            <div className="relative">
              <label htmlFor="n-filter" className="sr-only">Note category</label>
              <select id="n-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className={cn(SELECT, 'h-11 w-[168px]')}>
                {['All Notes', 'Clinical Note', 'General Note', 'Follow-up Note', 'Treatment Note', 'Observation', 'Pinned'].map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
            <button type="button" aria-label="Add note" onClick={() => console.log('[Clinic OS] Add Note')}
              className="flex h-11 items-center gap-2 rounded-[10px] px-5 text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
              <Plus className="h-[17px] w-[17px]" />
              <span className="text-[13.5px] font-bold">Add Note</span>
            </button>
          </div>
        </div>

        <ol className="mt-[18px]">
          {rows.map((n, i) => {
            const style = NOTE_CATEGORY_STYLE[n.category];
            return (
              <li key={`${n.date}-${n.time}`}>
                <article
                  className={cn(
                    'flex gap-4',
                    n.pinned
                      ? 'mb-3.5 rounded-[12px] border border-[#F8E3B8] bg-[#FEF8EC] px-5 py-[18px] [border-left:3px_solid_#F59E0B]'
                      : cn('py-[18px]', i > 0 && 'border-t border-[#F1F3F9]'),
                  )}
                >
                  <h3 className="sr-only">{n.date} {n.time}, {n.category}, by {n.author}{n.pinned ? ', Pinned note' : ''}</h3>
                  <div className="flex w-[150px] shrink-0 gap-3">
                    <Tile icon={n.icon} tint={n.tint} fg={n.fg} size={34} glyph={16} radius={10} />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-[#0F172A]">{n.date}</p>
                      <p className="text-[12.5px] font-medium text-[#64748B]">{n.time}</p>
                      <p className="mt-1 text-[12.5px] text-[#64748B]">{n.author}</p>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="inline-block rounded-[7px] px-3 py-[5px] text-[11.5px] font-semibold" style={{ background: style.bg, color: style.fg }}>
                      {n.category}
                    </span>
                    <p className="mt-2.5 text-[13px] leading-[22px] text-[#475569]">{n.text}</p>
                    {n.pinned && (
                      <span className="mt-3 inline-flex items-center gap-1.5 rounded-[6px] bg-[#FDECD3] px-2.5 py-1 text-[11px] font-bold text-[#E8890B]">
                        <Pin aria-hidden="true" className="h-3 w-3" />
                        Pinned
                      </span>
                    )}
                  </div>

                  <RowMenu label={`Actions for note on ${n.date}`} size={32} bordered
                    items={['Edit Note', n.pinned ? 'Unpin' : 'Pin', 'Duplicate', 'Delete'].map((l) => ({ label: l, danger: l === 'Delete', onSelect: () => console.log('[Clinic OS]', l) }))} />
                </article>
              </li>
            );
          })}
        </ol>

        <div className="-mx-[22px]"><SinglePagePager label={`Showing 1 to ${rows.length} of ${rows.length} notes`} /></div>
      </section>

      <div className="flex min-w-0 flex-col gap-[18px]">
        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <FileText aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
            <h2 className={H2}>Notes Summary</h2>
          </div>
          <dl className="mt-3.5 grid grid-cols-3 gap-2.5">
            {([
              ['#EEF1FE', String(NOTES.length), 'Total Notes', false],
              ['#FEF6E7', String(NOTES.filter((n) => n.pinned).length), 'Pinned Notes', true],
              ['#EAF1FE', String(NOTES_THIS_MONTH), 'This Month', false],
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
              <h2 className={H2}>Pinned Notes</h2>
              <ViewAll />
            </div>
            <div className="mt-3.5 flex gap-3">
              <Tile icon="Pin" tint="#FDECD3" fg="#E8890B" size={30} glyph={15} radius={8} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[#64748B]">{pinned.date} • {pinned.time}</span>
                  <span className="ml-auto rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: NOTE_CATEGORY_STYLE[pinned.category].bg, color: NOTE_CATEGORY_STYLE[pinned.category].fg }}>
                    {pinned.category}
                  </span>
                </p>
                <p title={pinned.text} className="mt-2 line-clamp-2 text-[12.5px] text-[#475569]">{pinned.text}</p>
                <span className="sr-only">{pinned.text}</span>
                <p className="mt-2 text-xs font-medium text-[#64748B]">{pinned.author}</p>
              </div>
            </div>
          </section>
        )}

        <section className={`${CARD} px-5 pb-5 pt-[18px]`}>
          <div className="flex items-center gap-2.5">
            <FileText aria-hidden="true" className="h-[17px] w-[17px] text-[#3B4FE0]" />
            <h2 className={H2}>Note Categories</h2>
          </div>
          <Donut data={NOTE_CATEGORY_COUNTS} label="Notes by category" />
          <FooterLink label="View Category Report" />
        </section>

        <QuickActionsCard items={[
          { icon: 'FileText', label: 'Add Clinical Note' },
          { icon: 'CheckSquare', label: 'Add Follow-up Note' },
          { icon: 'MessageSquare', label: 'Add General Note' },
          { icon: 'LayoutTemplate', label: 'View Note Templates' },
        ]} />
      </div>
    </div>
  );
}
