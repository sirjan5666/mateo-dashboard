import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle, ArrowUp, Banknote, Calendar, ChevronDown, ChevronLeft, ChevronRight, CircleCheck,
  Clock, CreditCard, Download, FileText, IndianRupee, Landmark, Phone, Plus, Search, Send,
  SlidersHorizontal, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BILLING_KPIS, INVOICES, INVOICE_DETAIL, STATUS_STYLE, money } from '../../data/invoices';
import type { Invoice, PaymentMode } from '../../data/invoices';
import { RowMenu } from '../../components/doctor/v2/RowMenu';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const KPI_ICONS: Record<string, LucideIcon> = { FileText, IndianRupee, CircleCheck, Clock, AlertCircle };
const MODE_ICONS: Record<string, LucideIcon> = { Card: CreditCard, Cash: Banknote, 'Net Banking': Landmark };

function ModeCell({ mode }: { mode: PaymentMode }) {
  if (!mode) {
    return (
      <>
        <span aria-hidden="true" className="text-[#94A3B8]">—</span>
        <span className="sr-only">No payment recorded</span>
      </>
    );
  }
  if (mode === 'UPI') {
    return (
      <span className="flex items-center gap-2.5">
        <span aria-hidden="true" className="grid h-[17px] w-[17px] place-items-center rounded-[4px] bg-gradient-to-br from-[#F97316] to-[#16A34A] text-[8px] font-extrabold text-white">U</span>
        <span className="text-[12.5px] font-medium text-[#334155]">UPI</span>
      </span>
    );
  }
  const Icon = MODE_ICONS[mode];
  return (
    <span className="flex items-center gap-2.5">
      <Icon aria-hidden="true" className={cn('h-[17px] w-[17px]', mode === 'Cash' ? 'text-[#12A150]' : 'text-[#334155]')} />
      <span className="text-[12.5px] font-medium text-[#334155]">{mode}</span>
    </span>
  );
}

export default function BillingInvoices() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Invoice | null>(INVOICES[0]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [mode, setMode] = useState('all');
  const [checked, setChecked] = useState<string[]>([]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INVOICES.filter((i) =>
      (!q || i.no.toLowerCase().includes(q) || i.patient.toLowerCase().includes(q)) &&
      (status === 'all' || i.status === status) &&
      (mode === 'all' || i.mode === mode));
  }, [query, status, mode]);

  const allChecked = checked.length === rows.length && rows.length > 0;
  const selectPill = 'h-11 rounded-[10px] border border-[#E4E8F1] bg-white pl-3.5 pr-9 text-[13px] font-semibold text-[#334155] appearance-none focus:border-[#3B4FE0] focus:outline-none';

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[15px]">
            <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px]" style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
              <FileText className="h-[21px] w-[21px] text-white" />
            </span>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">Billing &amp; Invoices</h1>
          </div>
          <p className="mt-1.5 text-sm text-[#64748B] sm:pl-[57px]">Manage invoices, payments and patient billing.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <button type="button" aria-label="Open reports" onClick={() => navigate('/doctor/charts')} className="flex h-[46px] items-center gap-2 rounded-[11px] border border-[#E2E6F0] bg-white px-[22px] hover:bg-[#F7F8FC]">
            <FileText className="h-[17px] w-[17px] text-[#334155]" />
            <span className="text-sm font-bold text-[#1E2A5A]">Reports</span>
          </button>
          <button type="button" aria-label="Create invoice" onClick={() => console.log('[Clinic OS] Create Invoice')} className="flex h-[46px] items-center gap-2 rounded-[11px] px-[22px] text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105" style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
            <Plus className="h-[18px] w-[18px]" />
            <span className="text-sm font-bold">Create Invoice</span>
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {BILLING_KPIS.map((k) => {
          const Icon = KPI_ICONS[k.icon] ?? FileText;
          return (
            <div key={k.id} className="rounded-[13px] border border-[#ECEEF4] bg-white px-[18px] pb-3.5 pt-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px]" style={{ background: k.tint }}>
                  <Icon className="h-[18px] w-[18px]" style={{ color: k.fg }} />
                </span>
                <span className="min-w-0 text-[12.5px] font-medium text-[#64748B]">{k.label}</span>
              </div>
              <p className="mt-2 font-display text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[#0F172A] tabular-nums">{k.value}</p>
              <p className="mt-[9px] flex items-center">
                <span className="text-[11.5px] font-medium text-[#94A3B8]">This Month</span>
                <span className="ml-auto flex items-center gap-1">
                  <ArrowUp aria-hidden="true" className="h-[11px] w-[11px]" style={{ color: k.deltaFg }} />
                  <span className="text-[11.5px] font-bold" style={{ color: k.deltaFg }}>{k.delta}</span>
                  <span className="sr-only">up</span>
                </span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[1fr_300px]">
        {/* ── Invoices ── */}
        <div className={`${CARD} min-w-0 overflow-hidden`}>
          {checked.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-[#ECEEF4] bg-[#F5F7FF] p-4">
              <span className="text-[13px] font-bold text-[#3B4FE0]">{checked.length} selected</span>
              {['Download', 'Send', 'Mark as Paid', 'Cancel'].map((a) => (
                <button key={a} type="button" onClick={() => console.log('[Clinic OS] Bulk', a, checked)} className="h-9 rounded-[8px] border border-[#DDE3F5] bg-white px-3 text-[12.5px] font-bold text-[#3B4FE0]">{a}</button>
              ))}
              <button type="button" onClick={() => setChecked([])} className="ml-auto text-[12.5px] font-bold text-[#64748B] hover:underline">Clear</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 border-b border-[#ECEEF4] p-[18px]">
              <div className="relative w-full lg:w-[278px]">
                <label htmlFor="inv-search" className="sr-only">Search invoices</label>
                <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
                <input id="inv-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by invoice no., patient name…"
                  className="h-11 w-full rounded-[10px] border border-[#E4E8F1] bg-white pl-[42px] pr-3.5 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none" />
              </div>
              <button type="button" aria-label="Change date range" className="flex h-11 w-[232px] items-center gap-2 rounded-[10px] border border-[#E4E8F1] bg-white px-3.5 hover:bg-[#F7F8FC]">
                <Calendar className="h-[17px] w-[17px] text-[#3B4FE0]" />
                <span className="text-[13px] font-semibold text-[#0F172A]">01 May 2025 - 12 May 2025</span>
                <ChevronDown className="ml-auto h-4 w-4 text-[#94A3B8]" />
              </button>
              <div className="relative">
                <label htmlFor="inv-status" className="sr-only">Status</label>
                <select id="inv-status" value={status} onChange={(e) => setStatus(e.target.value)} className={cn(selectPill, 'w-[122px]')}>
                  <option value="all">All Status</option>
                  {(['Paid', 'Pending', 'Partially Paid', 'Overdue'] as const).map((s) => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              </div>
              <div className="relative">
                <label htmlFor="inv-mode" className="sr-only">Payment mode</label>
                <select id="inv-mode" value={mode} onChange={(e) => setMode(e.target.value)} className={cn(selectPill, 'w-[178px]')}>
                  <option value="all">All Payment Modes</option>
                  {['UPI', 'Card', 'Cash', 'Net Banking'].map((s) => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button type="button" aria-label="More filters" className="flex h-11 items-center gap-2 rounded-[10px] border border-[#E4E8F1] bg-white px-4 hover:bg-[#F7F8FC]">
                  <SlidersHorizontal className="h-4 w-4 text-[#3B4FE0]" />
                  <span className="text-[13px] font-semibold text-[#334155]">More Filters</span>
                </button>
                <button type="button" aria-label="Export invoices" className="flex h-11 items-center gap-2 rounded-[10px] border border-[#E4E8F1] bg-white px-[18px] hover:bg-[#F7F8FC]">
                  <Download className="h-4 w-4 text-[#334155]" />
                  <span className="text-[13px] font-bold text-[#1E2A5A]">Export</span>
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-separate border-spacing-0">
              <caption className="sr-only">Patient invoices</caption>
              <thead>
                <tr>
                  <th scope="col" className="h-[42px] w-[4%] border-b border-[#ECEEF4] bg-[#FAFBFD] pl-4">
                    <input type="checkbox" aria-label="Select all invoices on this page" checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = checked.length > 0 && !allChecked; }}
                      onChange={(e) => setChecked(e.target.checked ? rows.map((r) => r.no) : [])}
                      className="h-[18px] w-[18px] rounded-[5px] border-[1.5px] border-[#C7CEDB] accent-[#4F63F5]" />
                  </th>
                  {['Invoice No.', 'Patient', 'Date', 'Amount', 'Paid', 'Due', 'Status', 'Payment Mode', 'Actions'].map((h) => (
                    <th key={h} scope="col" className="h-[42px] border-b border-[#ECEEF4] bg-[#FAFBFD] pr-3 text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.no} onClick={() => setSelected(inv)} className={cn('cursor-pointer hover:bg-[#FAFBFF]', selected?.no === inv.no && 'bg-[#F7F9FF]')}>
                    <td className="h-[49px] border-b border-[#F1F3F9] pl-4">
                      <input type="checkbox" aria-label={`Select ${inv.no}`} checked={checked.includes(inv.no)} onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setChecked((p) => e.target.checked ? [...p, inv.no] : p.filter((x) => x !== inv.no))}
                        className="h-[18px] w-[18px] rounded-[5px] border-[1.5px] border-[#C7CEDB] accent-[#4F63F5]" />
                    </td>
                    <th scope="row" className="border-b border-[#F1F3F9] pr-3 text-left text-[12.5px] font-semibold text-[#3B4FE0]">{inv.no}</th>
                    <td className="border-b border-[#F1F3F9] pr-3">
                      <span className="flex items-center gap-[11px]">
                        <span role="img" aria-label={inv.patient} className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: inv.tint, color: inv.fg }}>
                          {inv.patient.split(' ').map((w) => w[0]).join('')}
                        </span>
                        <span className="text-[12.5px] font-semibold text-[#0F172A]">{inv.patient}</span>
                        <span className="text-[11.5px] font-medium text-[#94A3B8]">({inv.age})</span>
                      </span>
                    </td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{inv.date}</td>
                    <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-semibold text-[#0F172A]">
                      {money(inv.amount)}<span className="sr-only"> rupees</span>
                    </td>
                    <td className={cn('border-b border-[#F1F3F9] pr-3 text-[12.5px] font-semibold', inv.paid ? 'text-[#12A150]' : 'text-[#334155]')}>
                      {money(inv.paid)}<span className="sr-only"> rupees paid</span>
                    </td>
                    <td className={cn('border-b border-[#F1F3F9] pr-3 text-[12.5px] font-semibold', inv.due ? 'text-[#E03131]' : 'text-[#334155]')}>
                      {money(inv.due)}<span className="sr-only">{inv.due ? ' rupees due' : ' rupees, nothing due'}</span>
                    </td>
                    <td className="border-b border-[#F1F3F9] pr-3">
                      <span className="inline-block rounded-[7px] px-3 py-[5px] text-[11.5px] font-bold" style={{ background: STATUS_STYLE[inv.status].bg, color: STATUS_STYLE[inv.status].fg }}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="border-b border-[#F1F3F9] pr-3"><ModeCell mode={inv.mode} /></td>
                    <td className="border-b border-[#F1F3F9] pr-4" onClick={(e) => e.stopPropagation()}>
                      <RowMenu label={`Actions for ${inv.no}`} size={32}
                        items={['View Invoice', 'Download PDF', 'Send to Guardian', 'Record Payment', 'Cancel Invoice'].map((l) => ({
                          label: l, danger: l === 'Cancel Invoice', onSelect: () => console.log('[Clinic OS]', l, inv.no),
                        }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-[#ECEEF4] p-[18px] lg:flex-row lg:items-center">
            <p className="text-[12.5px] font-medium text-[#64748B]">Showing 1 to {rows.length} of 1,248 invoices</p>
            <div className="flex items-center gap-2 lg:mx-auto">
              <button type="button" disabled aria-label="Previous page" className="grid h-9 w-9 place-items-center rounded-[9px] border border-[#E2E6F0] text-[#64748B] opacity-45">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {['1', '2', '3', '…', '125'].map((p, i) => p === '…' ? (
                <span key={i} aria-hidden="true" className="grid h-9 w-9 place-items-center text-[13px] font-semibold text-[#94A3B8]">…</span>
              ) : (
                <button key={p} type="button" aria-current={p === '1' ? 'page' : undefined}
                  className={cn('grid h-9 w-9 place-items-center rounded-[9px] text-[13px] font-semibold',
                    p === '1' ? 'border-[1.5px] border-[#6366F1] bg-white text-[#3B4FE0]' : 'border border-[#E2E6F0] text-[#334155] hover:bg-[#F7F8FC]')}>{p}</button>
              ))}
              <button type="button" aria-label="Next page" className="grid h-9 w-9 place-items-center rounded-[9px] border border-[#E2E6F0] text-[#64748B]">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 lg:ml-auto">
              <label htmlFor="inv-rows" className="text-[12.5px] font-medium text-[#64748B]">Rows per page:</label>
              <select id="inv-rows" className="h-[38px] w-[76px] rounded-[9px] border border-[#E2E6F0] bg-white pl-3 text-[13px] font-semibold text-[#334155]">
                {[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Details ── */}
        {selected && (
          <aside role="complementary" aria-labelledby="inv-details-title" className={`${CARD} min-w-0`}>
            <div className="flex items-center border-b border-[#ECEEF4] px-[18px] pb-4 pt-[18px]">
              <h2 id="inv-details-title" className="font-display text-[15.5px] font-bold text-[#0F172A]">Invoice Details</h2>
              <button type="button" aria-label="Close details" onClick={() => setSelected(null)} className="ml-auto grid h-[30px] w-[30px] place-items-center rounded-[8px] text-[#64748B] hover:bg-[#F1F3F9]">
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="border-b border-[#ECEEF4] px-[18px] pb-[18px] pt-4">
              <p className="flex flex-wrap items-center gap-[11px]">
                <span className="font-display text-[17px] font-extrabold text-[#0F172A]">{selected.no}</span>
                <span className="rounded-[7px] px-[11px] py-1 text-[11px] font-bold" style={{ background: STATUS_STYLE[selected.status].bg, color: STATUS_STYLE[selected.status].fg }}>{selected.status}</span>
              </p>
              <p className="mt-1.5 text-[12.5px] font-medium text-[#64748B]">{selected.no === INVOICE_DETAIL.no ? INVOICE_DETAIL.issuedAt : `${selected.date}, 10:30 AM`}</p>
            </div>

            <div className="border-b border-[#ECEEF4] px-[18px] pb-[18px] pt-4">
              <h3 className="text-[13.5px] font-bold text-[#0F172A]">Patient Details</h3>
              <div className="mt-3 flex gap-3">
                <span role="img" aria-label={selected.patient} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[14px] font-bold" style={{ background: selected.tint, color: selected.fg }}>
                  {selected.patient.split(' ').map((w) => w[0]).join('')}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0F172A]">{selected.patient} <span className="text-xs font-medium text-[#64748B]">({selected.age})</span></p>
                  <p className="mt-[3px] text-xs font-semibold text-[#3B4FE0]">{selected.patientId}</p>
                  <p className="mt-[5px] flex items-center gap-1.5 text-xs font-medium text-[#334155]">
                    <Phone aria-hidden="true" className="h-[13px] w-[13px] text-[#64748B]" />
                    {selected.phone}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-b border-[#ECEEF4] px-[18px] pb-[18px] pt-4">
              <h3 className="text-[13.5px] font-bold text-[#0F172A]">Billing Summary</h3>
              <dl className="mt-3 flex flex-col gap-3">
                {(selected.no === INVOICE_DETAIL.no ? INVOICE_DETAIL.lines : [{ label: 'Consultation Fee', value: money(selected.amount), fg: '#0F172A' }]).map((l) => (
                  <div key={l.label} className="flex items-center justify-between gap-3">
                    <dt className="text-[12.5px] font-medium text-[#475569]">{l.label}</dt>
                    <dd className="text-[12.5px] font-semibold" style={{ color: l.fg }}>
                      {l.label === 'Discount' ? <><span aria-hidden="true">{l.value}</span><span className="sr-only">minus 50 rupees</span></> : l.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="my-3.5 h-px bg-[#F1F3F9]" />
              <dl className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[13.5px] font-extrabold text-[#0F172A]">Total Amount</dt>
                  <dd className="text-[13.5px] font-extrabold text-[#0F172A]">{money(selected.amount)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[12.5px] font-medium text-[#475569]">Paid Amount</dt>
                  <dd className="text-[12.5px] font-bold text-[#12A150]">{money(selected.paid)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[12.5px] font-medium text-[#475569]">Due Amount</dt>
                  {/* Fixed red on this row — the reference shows ₹0.00 in red too. */}
                  <dd className="text-[12.5px] font-bold text-[#E03131]">{money(selected.due)}</dd>
                </div>
              </dl>
            </div>

            <div className="border-b border-[#ECEEF4] px-[18px] pb-[18px] pt-4">
              <h3 className="text-[13.5px] font-bold text-[#0F172A]">Payment Information</h3>
              <dl className="mt-3 flex flex-col gap-3">
                {(selected.no === INVOICE_DETAIL.no ? INVOICE_DETAIL.payment : [
                  { label: 'Payment Mode', value: selected.mode ?? '—' },
                  { label: 'Transaction ID', value: selected.mode ? 'TXN…' : '—' },
                  { label: 'Paid On', value: selected.paid ? `${selected.date}, 10:35 AM` : '—' },
                ]).map((p) => (
                  <div key={p.label} className="flex items-center justify-between gap-3">
                    <dt className="text-[12.5px] font-medium text-[#475569]">{p.label}</dt>
                    <dd className="text-[12.5px] font-semibold text-[#0F172A]">{p.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="grid grid-cols-2 gap-3 px-[18px] pb-5 pt-4">
              {([[Download, 'Download Invoice'], [Send, 'Send Invoice']] as const).map(([Icon, label]) => (
                <button key={label} type="button" aria-label={label} onClick={() => console.log('[Clinic OS]', label, selected.no)}
                  className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#DDE3F5] bg-white text-[12.5px] font-bold text-[#3B4FE0] hover:bg-[#F5F7FF]">
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
