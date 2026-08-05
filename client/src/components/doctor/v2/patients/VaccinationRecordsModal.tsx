import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  ExternalLink,
  FileText,
  Plus,
  ShieldCheck,
  Syringe,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  VACCINATIONS,
  VAX_COMPLETED,
  VAX_OVERDUE,
  VAX_PERCENT,
  VAX_STATUS_META,
  VAX_TOTAL,
  VAX_UPCOMING,
} from '../../../../data/vaccinations';
import type { VaccinationRecord, VaccinationStatus } from '../../../../data/vaccinations';
import type { Patient } from '../../../../data/patients';
import { cn } from '../../../../lib/cn';
import { PatientSummaryStrip } from './PatientSummaryStrip';
import { RowMenu } from '../RowMenu';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

type TabKey = 'all' | 'upcoming' | 'completed' | 'overdue';

const OVERVIEW: { icon: LucideIcon; tint: string; fg: string; label: string; value: () => number; pct?: boolean }[] = [
  { icon: Syringe, tint: '#E0F5EA', fg: '#12A150', label: 'Total Doses', value: () => VAX_TOTAL },
  { icon: ShieldCheck, tint: '#E4EBFD', fg: '#2563EB', label: 'Completed', value: () => VAX_COMPLETED, pct: true },
  { icon: CalendarDays, tint: '#FDECD3', fg: '#F59E0B', label: 'Upcoming', value: () => VAX_UPCOMING },
  { icon: AlertTriangle, tint: '#FDE2E2', fg: '#EF4444', label: 'Overdue', value: () => VAX_OVERDUE },
];

function StatusChip({ status }: { status: VaccinationStatus }) {
  const m = VAX_STATUS_META[status];
  const Glyph = status === 'overdue' ? AlertCircle : Check;
  return (
    <span
      className="inline-flex items-center gap-[7px] rounded-[8px] px-[11px] py-[5px] text-xs font-semibold"
      style={{ background: m.bg, color: m.fg }}
    >
      <Glyph aria-hidden="true" className="h-[13px] w-[13px]" strokeWidth={3} />
      {m.label}
    </span>
  );
}

/** Em dash plus the hidden text that gives it meaning. */
function Dash({ say }: { say: string }) {
  return (
    <>
      <span aria-hidden="true" className="text-[#94A3B8]">—</span>
      <span className="sr-only">{say}</span>
    </>
  );
}

export function VaccinationRecordsModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [tab, setTab] = useState<TabKey>('all');
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes?.length) return;
      const list = [...nodes].filter((n) => n.tabIndex !== -1);
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'All Vaccinations' },
    { key: 'upcoming', label: `Upcoming (${VAX_UPCOMING})` },
    { key: 'completed', label: `Completed (${VAX_COMPLETED})` },
    { key: 'overdue', label: `Overdue (${VAX_OVERDUE})` },
  ];

  let rows: VaccinationRecord[] = tab === 'all' ? VACCINATIONS : VACCINATIONS.filter((r) => r.status === tab);
  if (sortDir) {
    // Rows with no Given On date sort last in both directions.
    rows = [...rows].sort((a, b) => {
      if (!a.givenOn && !b.givenOn) return 0;
      if (!a.givenOn) return 1;
      if (!b.givenOn) return -1;
      const d = new Date(a.givenOn).getTime() - new Date(b.givenOn).getTime();
      return sortDir === 'asc' ? d : -d;
    });
  }

  const toggleSort = () => setSortDir((d) => (d === null ? 'asc' : d === 'asc' ? 'desc' : null));
  const SortGlyph = sortDir === 'asc' ? ChevronUp : sortDir === 'desc' ? ChevronDown : ChevronsUpDown;

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-[60] motion-safe:animate-[fadeIn_160ms_ease-out]"
      style={{ background: 'rgba(15,23,42,0.22)', backdropFilter: 'blur(1.5px)' }}
      onClick={onClose}
    >
      <div className="flex h-full items-end justify-center md:items-start md:px-6 md:pt-[66px]">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vax-title"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex w-full min-w-0 flex-col overflow-hidden bg-white',
            'h-[94vh] rounded-t-[20px] md:h-auto md:max-h-[880px] md:w-[888px] md:rounded-[16px]',
            'shadow-[0_24px_64px_-12px_rgba(15,23,42,.30),0_8px_24px_-8px_rgba(15,23,42,.12)]',
            'motion-safe:animate-[modalIn_200ms_cubic-bezier(.16,1,.3,1)]',
          )}
        >
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-[#D9DFEC] md:hidden" />

          {/* Header */}
          <div className="flex shrink-0 items-center gap-4 px-5 pb-[18px] pt-[22px] sm:px-[26px]">
            <h2 id="vax-title" className="font-display text-xl font-extrabold tracking-[-0.02em] text-[#0F172A]">
              Vaccination Records
            </h2>
            <button
              type="button"
              autoFocus
              aria-label="Close"
              onClick={onClose}
              className="ml-auto grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#F1F3F9] text-[#334155] transition-colors hover:bg-[#E4E8F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
            >
              <X className="h-[17px] w-[17px]" />
            </button>
          </div>

          {/* Patient strip + overview */}
          <div className="shrink-0 border-b border-[#ECEEF4]">
            <PatientSummaryStrip patient={patient}>
              <div className="min-w-0 flex-1 rounded-[12px] bg-[#F7F8FC] px-[18px] pb-4 pt-3.5">
                <h4 className="text-[13.5px] font-bold text-[#334155]">Vaccination Overview</h4>
                <dl className="mt-3.5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {OVERVIEW.map((o) => (
                    <div key={o.label} className="flex items-center gap-[11px]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]" style={{ background: o.tint }}>
                        <o.icon className="h-4 w-4" style={{ color: o.fg }} />
                      </span>
                      <div className="min-w-0">
                        <dt className="text-[11.5px] font-medium text-[#64748B]">{o.label}</dt>
                        <dd className="mt-[3px] flex items-baseline gap-1.5 font-display text-[21px] font-extrabold leading-none tracking-[-0.02em] text-[#0F172A] tabular-nums">
                          {o.value()}
                          {o.pct && <span className="text-[11px] font-bold text-[#12A150]">{VAX_PERCENT}%</span>}
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </div>
            </PatientSummaryStrip>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-[#ECEEF4] px-5 pt-4 sm:px-[26px]">
            <div role="tablist" aria-label="Vaccination status" className="flex min-w-0 gap-[30px] overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.key}
                  tabIndex={tab === t.key ? 0 : -1}
                  onClick={() => setTab(t.key)}
                  onKeyDown={(e) => {
                    const i = TABS.findIndex((x) => x.key === tab);
                    if (e.key === 'ArrowRight') setTab(TABS[(i + 1) % TABS.length].key);
                    if (e.key === 'ArrowLeft') setTab(TABS[(i - 1 + TABS.length) % TABS.length].key);
                  }}
                  className={cn(
                    'shrink-0 whitespace-nowrap border-b-[2.5px] pb-[13px] text-sm transition-colors',
                    tab === t.key ? 'border-[#3B4FE0] font-bold text-[#1E2A5A]' : 'border-transparent font-medium text-[#64748B] hover:text-[#334155]',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              aria-label="Open vaccination chart"
              onClick={() => console.log('[Clinic OS] Vaccination Chart', patient.id)}
              className="mb-2.5 ml-auto flex h-10 items-center gap-2.5 rounded-[10px] border border-[#E2E6F0] bg-white px-4 transition-colors hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
            >
              <BarChart3 className="h-[17px] w-[17px] text-[#3B4FE0]" />
              <span className="text-[13.5px] font-bold text-[#3B4FE0]">Vaccination Chart</span>
              <ExternalLink className="h-[15px] w-[15px] text-[#3B4FE0]" />
              <span className="sr-only">opens in a new view</span>
            </button>
          </div>

          {/* Table */}
          <div role="tabpanel" className="min-h-0 flex-1 overflow-auto">
            <table className="hidden w-full min-w-[860px] border-separate border-spacing-0 md:table">
              <caption className="sr-only">Vaccination history for {patient.name}</caption>
              <thead>
                <tr>
                  {[
                    ['Vaccine', 'w-[24%] pl-[26px]'],
                    ['Dose', 'w-[8%]'],
                    ['Due Date', 'w-[12%]'],
                    ['Given On', 'w-[13%]'],
                    ['Age at Dose', 'w-[12%]'],
                    ['Status', 'w-[13%]'],
                    ['Next Due', 'w-[12%]'],
                    ['Actions', 'w-[6%]'],
                  ].map(([label, cls]) => (
                    <th
                      key={label}
                      scope="col"
                      aria-sort={label === 'Given On' ? (sortDir ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                      className={cn('h-[42px] bg-[#F7F8FC] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]', cls)}
                    >
                      {label === 'Given On' ? (
                        <button type="button" onClick={toggleSort} className="inline-flex items-center gap-1.5 uppercase tracking-[0.06em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5]">
                          {label}
                          <SortGlyph aria-hidden="true" className={cn('h-[11px] w-[11px]', sortDir ? 'text-[#3B4FE0]' : 'text-[#CBD5E1]')} />
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.vaccine} className="group">
                    <th scope="row" className="h-[47px] border-b border-[#F1F3F9] pl-[26px] pr-3 text-left font-normal group-hover:bg-[#FAFBFF]">
                      <span className="inline-block rounded-full px-[13px] py-1.5 text-[12.5px] font-semibold" style={{ background: r.pill.bg, color: r.pill.fg }}>
                        {r.vaccine}
                      </span>
                    </th>
                    <td className="border-b border-[#F1F3F9] text-[13px] font-semibold text-[#0F172A] group-hover:bg-[#FAFBFF]">
                      {r.dose ?? <Dash say="Not applicable" />}
                    </td>
                    <td className="border-b border-[#F1F3F9] text-[13px] font-medium text-[#334155] group-hover:bg-[#FAFBFF]">{r.dueDate}</td>
                    <td className="border-b border-[#F1F3F9] text-[13px] font-medium text-[#334155] group-hover:bg-[#FAFBFF]">
                      {r.givenOn ?? <Dash say="Not yet given" />}
                    </td>
                    <td className="border-b border-[#F1F3F9] text-[13px] font-medium text-[#334155] group-hover:bg-[#FAFBFF]">{r.ageAtDose}</td>
                    <td className="border-b border-[#F1F3F9] group-hover:bg-[#FAFBFF]">
                      <StatusChip status={r.status} />
                    </td>
                    <td className="border-b border-[#F1F3F9] group-hover:bg-[#FAFBFF]">
                      {r.nextDue ? (
                        <>
                          <span aria-hidden="true" className="block text-[12.5px] font-bold text-[#0F172A]">{r.nextDue.date}</span>
                          <span aria-hidden="true" className="block text-[11px] font-medium text-[#94A3B8]">({r.nextDue.age})</span>
                          <span className="sr-only">{r.nextDue.date}, at age {r.nextDue.age}</span>
                        </>
                      ) : (
                        <Dash say="No further doses" />
                      )}
                    </td>
                    <td className="border-b border-[#F1F3F9] pr-4 group-hover:bg-[#FAFBFF]">
                      <span className="flex items-center gap-2.5">
                        <button
                          type="button"
                          aria-label={`View ${r.vaccine} certificate`}
                          onClick={() => console.log('[Clinic OS] Certificate', r.vaccine)}
                          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5]"
                        >
                          <FileText className="h-[17px] w-[17px] text-[#5B4BE0]" />
                        </button>
                        <RowMenu
                          label={`Actions for ${r.vaccine}`}
                          items={[
                            { label: 'View Details', onSelect: () => console.log('[Clinic OS] View Details', r.vaccine) },
                            { label: 'Edit Record', onSelect: () => console.log('[Clinic OS] Edit Record', r.vaccine) },
                            { label: 'Print Certificate', onSelect: () => console.log('[Clinic OS] Print Certificate', r.vaccine) },
                          ]}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* < md : one card per vaccine */}
            <ul className="flex flex-col gap-2.5 p-4 md:hidden">
              {rows.map((r) => (
                <li key={r.vaccine} className="rounded-[12px] border border-[#ECEEF4] p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: r.pill.bg, color: r.pill.fg }}>
                      {r.vaccine}
                    </span>
                    <span className="ml-auto"><StatusChip status={r.status} /></span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2.5 text-[12px]">
                    <div><dt className="font-bold uppercase tracking-[0.06em] text-[#94A3B8]">Dose</dt><dd className="mt-0.5 font-semibold text-[#0F172A]">{r.dose ?? <Dash say="Not applicable" />}</dd></div>
                    <div><dt className="font-bold uppercase tracking-[0.06em] text-[#94A3B8]">Due</dt><dd className="mt-0.5 text-[#334155]">{r.dueDate}</dd></div>
                    <div><dt className="font-bold uppercase tracking-[0.06em] text-[#94A3B8]">Given On</dt><dd className="mt-0.5 text-[#334155]">{r.givenOn ?? <Dash say="Not yet given" />}</dd></div>
                    <div><dt className="font-bold uppercase tracking-[0.06em] text-[#94A3B8]">Next Due</dt><dd className="mt-0.5 text-[#334155]">{r.nextDue ? `${r.nextDue.date} (${r.nextDue.age})` : <Dash say="No further doses" />}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-[#ECEEF4] px-5 pb-5 pt-4 sm:px-[26px]">
            <button
              type="button"
              aria-label="Add a vaccination manually"
              onClick={() => console.log('[Clinic OS] Add Vaccination Manually')}
              className="flex h-11 flex-1 items-center justify-center gap-2.5 rounded-[10px] border-[1.5px] border-dashed border-[#C7CEDB] px-5 transition-colors hover:border-[#3B4FE0] hover:bg-[#F5F7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2 sm:flex-none"
            >
              <Plus className="h-[17px] w-[17px] text-[#3B4FE0]" />
              <span className="text-[13.5px] font-bold text-[#1E2A5A]">Add Vaccination Manually</span>
            </button>

            <button
              type="button"
              aria-label="Download vaccination record"
              onClick={() => console.log('[Clinic OS] Download Record')}
              className="flex h-11 flex-1 items-center justify-center gap-2.5 rounded-[10px] border border-[#E2E6F0] bg-white px-5 shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-colors hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2 sm:ml-auto sm:flex-none"
            >
              <Download className="h-[17px] w-[17px] text-[#334155]" />
              <span className="text-[13.5px] font-bold text-[#1E2A5A]">Download Record</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
