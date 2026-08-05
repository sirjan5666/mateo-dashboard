import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
  UserRoundPlus,
} from 'lucide-react';
import { AGE_GROUPS, GENDERS, SORTS, ageParts, formatDate, fromApi } from '../../data/patients';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../data/patients';
import { useActiveLocation } from '../../lib/doctorLocation';
import { PatientsTable } from '../../components/doctor/v2/patients/PatientsTable';
import type { SortDir, SortKey } from '../../components/doctor/v2/patients/PatientsTable';
import { PatientCardList, PatientGridView } from '../../components/doctor/v2/patients/PatientViews';
import { VaccinationRecordsModal } from '../../components/doctor/v2/patients/VaccinationRecordsModal';
import { GrowthChartModal } from '../../components/doctor/v2/patients/GrowthChartModal';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const SELECT =
  'h-[46px] rounded-[10px] border border-[#E4E8F1] bg-white pl-4 pr-9 text-[13.5px] font-semibold text-[#334155] appearance-none focus:border-[#3B4FE0] focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,79,224,.12)]';

function SelectPill({
  value, onChange, options, width, label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width: string;
  label: string;
}) {
  return (
    <div className="relative" style={{ width }}>
      <label className="sr-only" htmlFor={`sel-${label}`}>{label}</label>
      <select id={`sel-${label}`} value={value} onChange={(e) => onChange(e.target.value)} className={cn(SELECT, 'w-full')}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
    </div>
  );
}

export default function PatientsList() {
  const [query, setQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  // Row-menu modals (specs 07 and 08) — the Patients page stays mounted behind them.
  const [vaxPatient, setVaxPatient] = useState<Patient | null>(null);
  const [growthPatient, setGrowthPatient] = useState<Patient | null>(null);

  const { locations, clinics } = useActiveLocation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Inlined so every setState is provably after an await.
  useEffect(() => {
    let cancelled = false;
    void listPatients()
      .then((r) => {
        if (!cancelled) setPatients(r.patients.map(fromApi));
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load patients');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Clinic name from the live list; an unknown/removed id shows an em dash. */
  const locationName = useCallback(
    (id: string | null | undefined) => locations.find((l) => l.id === id)?.name ?? '—',
    [locations],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = patients.filter((p) => {
      if (q && !(
        p.name.toLowerCase().includes(q) ||
        p.guardian.toLowerCase().includes(q) ||
        p.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        p.email.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      )) return false;
      if (locationFilter !== 'all' && p.locationId !== locationFilter) return false;
      if (genderFilter !== 'all' && p.gender !== genderFilter) return false;
      if (ageFilter !== 'all') {
        const g = AGE_GROUPS.find((a) => a.value === ageFilter);
        if (g && g.min !== undefined) {
          const y = ageParts(p.dob).years;
          if (y < g.min || y >= g.max!) return false;
        }
      }
      return true;
    });

    const dir = sortDir === 'desc' ? -1 : 1;
    if (sortKey) {
      const get = (p: Patient): string | number =>
        sortKey === 'name' ? p.name
        : sortKey === 'id' ? p.id
        : sortKey === 'gender' ? ageParts(p.dob).years * 12 + ageParts(p.dob).months
        : sortKey === 'dob' ? p.dob
        : sortKey === 'registeredOn' ? p.registeredOn
        : sortKey === 'lastVisit' ? (p.lastVisit ?? '')
        : sortKey === 'phone' ? p.phone
        : locationName(p.locationId);
      list = [...list].sort((a, b) => (get(a) > get(b) ? dir : get(a) < get(b) ? -dir : 0));
    } else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'lastVisit') list = [...list].sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''));
    else if (sort === 'age') list = [...list].sort((a, b) => a.dob.localeCompare(b.dob));
    else list = [...list].sort((a, b) => b.registeredOn.localeCompare(a.registeredOn) || b.id.localeCompare(a.id));

    return list;
  }, [patients, locationName, query, locationFilter, ageFilter, genderFilter, sort, sortKey, sortDir]);

  const filtering =
    query.trim() !== '' || ageFilter !== 'all' || genderFilter !== 'all' || locationFilter !== 'all';
  // The roster is the real one now, so every filter reports its true count.
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const from = (page - 1) * rowsPerPage;
  const shown = filtered.slice(from, from + rowsPerPage);

  function toggleSort(k: SortKey) {
    if (sortKey !== k) { setSortKey(k); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    setSortKey(null); setSortDir(null);
  }

  function exportCsv() {
    const head = ['Patient ID', 'Name', 'Guardian', 'Gender', 'Date of Birth', 'Registered On', 'Last Visit', 'Phone', 'Primary Location'];
    const rows = filtered.map((p) => [
      p.id, p.name, p.guardian, p.gender, formatDate(p.dob), formatDate(p.registeredOn),
      p.lastVisit ? formatDate(p.lastVisit) : '', p.phone, locationName(p.locationId),
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patients.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const pageButtons = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : [1, 2, 3, '…', totalPages];

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-[#64748B]">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading patients…
      </p>
    );
  }

  return (
    <div>
      {loadError && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
          {loadError}
        </p>
      )}
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3.5">
            <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px]" style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
              <UserRound className="h-5 w-5 text-white" />
            </span>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">Patients</h1>
          </div>
          <p className="mt-2 text-sm text-[#64748B]">View and manage all your patients across locations.</p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <button
            type="button"
            aria-label="Import patients"
            onClick={() => console.log('[Clinic OS] Import Patients')}
            className="flex h-[46px] flex-1 items-center justify-center gap-2.5 rounded-[11px] border border-[#E2E6F0] bg-white px-5 shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-colors hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2 sm:flex-none"
          >
            <UserRoundPlus className="h-[18px] w-[18px] text-[#3B4FE0]" />
            <span className="text-[14.5px] font-bold text-[#1E2A5A]">Import Patients</span>
          </button>
          <Link
            to="/doctor/patients/new"
            aria-label="Register a new patient"
            className="flex h-[46px] flex-1 items-center justify-center gap-2.5 rounded-[11px] px-[22px] text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] transition-[filter] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2 sm:flex-none"
            style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}
          >
            <Plus className="h-[18px] w-[18px]" />
            <span className="text-[14.5px] font-bold">Register New Patient</span>
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className={`${CARD} mb-[18px] flex flex-wrap items-center gap-3.5 px-5 py-[18px]`}>
        <div className="relative w-full lg:w-[358px]">
          <label htmlFor="patient-search" className="sr-only">Search patients</label>
          <input
            id="patient-search"
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search by name, phone, email or Patient ID…"
            className="h-[46px] w-full rounded-[10px] border border-[#E4E8F1] bg-white pl-4 pr-[46px] text-[13.5px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,79,224,.12)]"
          />
          <Search aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#94A3B8]" />
        </div>

        <SelectPill label="Location" width="152px" value={locationFilter} onChange={(v) => { setLocationFilter(v); setPage(1); }}
          options={[{ value: 'all', label: 'All Locations' }, ...clinics.map((c) => ({ value: c.id, label: c.name }))]} />
        <SelectPill label="Age group" width="170px" value={ageFilter} onChange={(v) => { setAgeFilter(v); setPage(1); }}
          options={AGE_GROUPS.map((a) => ({ value: a.value, label: a.label }))} />
        <SelectPill label="Gender" width="148px" value={genderFilter} onChange={(v) => { setGenderFilter(v); setPage(1); }} options={GENDERS} />

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            aria-label="More filters"
            onClick={() => console.log('[Clinic OS] More Filters')}
            className="flex h-[46px] items-center gap-2 rounded-[10px] border border-[#E4E8F1] bg-white px-4 transition-colors hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
          >
            <SlidersHorizontal className="h-[17px] w-[17px] text-[#3B4FE0]" />
            <span className="text-[13.5px] font-semibold text-[#334155]">More Filters</span>
            <ChevronDown className="h-[17px] w-[17px] text-[#94A3B8]" />
          </button>
          <button
            type="button"
            aria-label="Export filtered patients as CSV"
            onClick={exportCsv}
            className="flex h-[46px] items-center gap-2 rounded-[10px] border border-[#E4E8F1] bg-white px-5 transition-colors hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
          >
            <Download className="h-[17px] w-[17px] text-[#334155]" />
            <span className="text-[13.5px] font-bold text-[#1E2A5A]">Export</span>
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-3 px-[22px] pb-3.5 pt-[18px]">
          <p className="text-[14.5px] font-bold text-[#0F172A]">
            Total Patients: {total.toLocaleString('en-IN')}
          </p>

          <div className="ml-auto flex items-center gap-3.5">
            <div className="flex items-center gap-1.5">
              <label htmlFor="sort-by" className="text-[13.5px] font-medium text-[#64748B]">Sort by:</label>
              <div className="relative">
                <select
                  id="sort-by"
                  value={sort}
                  onChange={(e) => { setSort(e.target.value); setSortKey(null); setSortDir(null); }}
                  className="appearance-none bg-transparent pr-6 text-[13.5px] font-bold text-[#0F172A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5]"
                >
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-0 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {([['list', List], ['grid', LayoutGrid]] as const).map(([v, Icon]) => (
                <button
                  key={v}
                  type="button"
                  aria-label={v === 'list' ? 'List view' : 'Grid view'}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    'grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2',
                    view === v ? 'border-[1.5px] border-[#6366F1] text-[#3B4FE0]' : 'border border-[#E2E6F0] text-[#94A3B8] hover:bg-[#F7F8FC]',
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === 'grid' ? (
          <PatientGridView patients={shown} onOpenVaccination={setVaxPatient} onOpenGrowth={setGrowthPatient} />
        ) : (
          <>
            <div className="hidden md:block">
              <PatientsTable
                patients={shown}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                onOpenVaccination={setVaxPatient}
                onOpenGrowth={setGrowthPatient}
              />
            </div>
            <div className="md:hidden">
              <PatientCardList patients={shown} onOpenVaccination={setVaxPatient} onOpenGrowth={setGrowthPatient} />
            </div>
          </>
        )}

        {/* Pagination */}
        <div className="flex flex-col gap-4 border-t border-[#ECEEF4] px-[22px] py-[18px] lg:flex-row lg:items-center">
          <p className="text-[13px] font-medium text-[#64748B]">
            Showing {shown.length ? from + 1 : 0} to {from + shown.length} of {total.toLocaleString('en-IN')} patients
          </p>

          <div className="flex items-center gap-2 lg:mx-auto">
            <button type="button" disabled={page === 1} aria-label="Previous page"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid h-[38px] w-[38px] place-items-center rounded-[9px] border border-[#E2E6F0] text-[#64748B] disabled:cursor-not-allowed disabled:opacity-45">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageButtons.map((b, i) =>
              b === '…' ? (
                <span key={`e${i}`} aria-hidden="true" className="grid h-[38px] w-[38px] place-items-center text-[13.5px] font-semibold text-[#94A3B8]">…</span>
              ) : (
                <button key={b} type="button" onClick={() => setPage(b as number)}
                  aria-current={page === b ? 'page' : undefined}
                  className={cn('grid h-[38px] w-[38px] place-items-center rounded-[9px] text-[13.5px] font-semibold',
                    page === b ? 'border-[1.5px] border-[#6366F1] bg-white text-[#3B4FE0]' : 'border border-[#E2E6F0] text-[#334155] hover:bg-[#F7F8FC]')}>
                  {b}
                </button>
              ),
            )}
            <button type="button" disabled={page === totalPages} aria-label="Next page"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="grid h-[38px] w-[38px] place-items-center rounded-[9px] border border-[#E2E6F0] text-[#64748B] disabled:cursor-not-allowed disabled:opacity-45">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            <label htmlFor="rows-per-page" className="text-[13px] font-medium text-[#64748B]">Rows per page:</label>
            <div className="relative">
              <select id="rows-per-page" value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                className="h-10 w-[82px] appearance-none rounded-[9px] border border-[#E2E6F0] bg-white pl-3 pr-8 text-[13px] font-semibold text-[#334155] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5]">
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
          </div>
        </div>
      </div>

      {vaxPatient && <VaccinationRecordsModal patient={vaxPatient} onClose={() => setVaxPatient(null)} />}
      {growthPatient && <GrowthChartModal patient={growthPatient} onClose={() => setGrowthPatient(null)} />}

      <p aria-live="polite" className="sr-only">
        {filtering ? `${filtered.length} patients match the current filters.` : ''}
      </p>
    </div>
  );
}
