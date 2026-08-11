import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Building2, IndianRupee, Loader2, Plus, SquareChartGantt, Users, X } from 'lucide-react';
import { useActiveLocation, inr, OVERALL } from '../../lib/doctorLocation';
import type { LocationId } from '../../lib/doctorLocation';
import {
  getLocationAnalytics, listLocations, setLocationActive, setPrimaryLocation,
} from '../../api/doctorLocations';
import type { ClinicLocationDto, LocationAnalytics } from '../../api/doctorLocations';
import { LocationsListCard } from '../../components/doctor/v2/LocationsListCard';
import { LocationDetailCard, LocationServicesCard, LocationTimingsCard } from '../../components/doctor/v2/LocationDetailCard';
import { LocationFormModal } from '../../components/doctor/v2/LocationFormModal';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';

/**
 * The Location Analytics panel. Every figure is a live count from the doctor's
 * own collections — an empty practice honestly shows zeros.
 *
 * These are PRACTICE-WIDE, not per-clinic: Patient and Invoice carry no
 * locationId yet, so a per-clinic split would be invented. The panel says so.
 */
function AnalyticsPanel({ data, onClose }: { data: LocationAnalytics | null; onClose: () => void }) {
  const tiles = data
    ? [
        { icon: Building2, tint: '#EEF2FF', hue: '#3B4FE0', label: 'Locations', value: String(data.totals.locations), note: `${data.totals.activeLocations} active` },
        { icon: Users, tint: '#E4EBFD', hue: '#2563EB', label: 'Total Patients', value: data.practice.totalPatients.toLocaleString('en-IN'), note: `${data.practice.activePatients.toLocaleString('en-IN')} active` },
        { icon: IndianRupee, tint: '#DCF7E6', hue: '#12A150', label: 'Revenue (MTD)', value: inr(data.practice.revenueMtd), note: `${data.practice.invoicesMtd} invoice${data.practice.invoicesMtd === 1 ? '' : 's'}` },
        { icon: SquareChartGantt, tint: '#FDECD3', hue: '#F59E0B', label: 'Appointments (MTD)', value: data.practice.appointmentsMtd.toLocaleString('en-IN'), note: `${inr(data.practice.revenueAllTime)} all time` },
      ]
    : [];

  return (
    <section className={`${CARD} mb-5 px-[22px] py-5`} aria-label="Location analytics">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[15.5px] font-bold tracking-[-0.01em] text-[#0F172A]">Location Analytics</h2>
          <p className="mt-1 text-[12.5px] text-[#64748B]">
            Live practice-wide totals. Patients and revenue are not split per clinic yet.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close analytics"
          className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[#64748B] hover:bg-[#F1F3F9]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!data ? (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-[#64748B]">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Loading analytics…
        </p>
      ) : (
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-[12px] border border-[#ECEEF4] px-4 py-3.5">
              <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: t.tint }}>
                <t.icon className="h-[17px] w-[17px]" style={{ color: t.hue }} />
              </span>
              <dt className="mt-2.5 text-[11.5px] font-medium text-[#64748B]">{t.label}</dt>
              <dd className="mt-1 text-[19px] font-extrabold text-[#0F172A]">{t.value}</dd>
              <dd className="text-[11.5px] text-[#94A3B8]">{t.note}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export default function LocationsManagement() {
  const [search, setSearch] = useSearchParams();
  const { clinics, refresh, activeId, setActiveId } = useActiveLocation();
  const [raw, setRaw] = useState<ClinicLocationDto[]>([]);
  const [selectedId, setSelectedId] = useState<LocationId | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClinicLocationDto | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analytics, setAnalytics] = useState<LocationAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // The raw DTOs are kept alongside the context's adapted list because the edit
  // form and the row actions need the server shape (code, isPrimary, active).
  const load = useCallback(async () => {
    try {
      const { locations } = await listLocations();
      setRaw(locations);
      setSelectedId((cur) => (cur && locations.some((l) => l.id === cur) ? cur : locations[0]?.id ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load locations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Inlined for the same reason as the shell's fetch — see DoctorShell.
  useEffect(() => {
    let cancelled = false;
    void listLocations()
      .then(({ locations }) => {
        if (cancelled) return;
        setRaw(locations);
        setSelectedId((cur) => (cur && locations.some((l) => l.id === cur) ? cur : locations[0]?.id ?? null));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load locations');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!analyticsOpen || analytics) return;
    void getLocationAnalytics().then(setAnalytics).catch(() => setAnalytics(null));
  }, [analyticsOpen, analytics]);

  /**
   * Deep links from the location switcher: `?add=1` opens a blank form and
   * `?edit=<id>` opens that clinic's. Both are DERIVED during render — an effect
   * that calls setState here would cascade a render on every navigation.
   * Closing the dialog clears the param, which is what actually dismisses it.
   */
  const addParam = search.get('add');
  const editParam = search.get('edit');
  const linkedEdit = editParam ? raw.find((l) => l.id === editParam) ?? null : null;
  const dialogOpen = formOpen || !!addParam || !!editParam;
  const dialogEditing = formOpen ? editing : linkedEdit;

  const closeDialog = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
    if (addParam || editParam) setSearch({}, { replace: true });
  }, [addParam, editParam, setSearch]);

  const selected = useMemo(
    () => clinics.find((c) => c.id === selectedId) ?? clinics[0] ?? null,
    [clinics, selectedId],
  );
  const selectedRaw = raw.find((r) => r.id === selectedId) ?? null;

  /** Re-reads both this page and the shell's switcher after any mutation. */
  const reloadAll = useCallback(async () => {
    setAnalytics(null);
    await Promise.all([load(), refresh()]);
  }, [load, refresh]);

  async function act(_id: string, fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await reloadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  }

  const menuFor = (loc: ClinicLocationDto) => [
    {
      label: 'Set as Primary',
      disabled: loc.isPrimary || !loc.active,
      onSelect: () => void act(loc.id, () => setPrimaryLocation(loc.id)),
    },
    {
      label: 'Edit Location',
      onSelect: () => {
        setEditing(loc);
        setFormOpen(true);
      },
    },
    {
      label: loc.active ? 'Deactivate' : 'Activate',
      danger: loc.active,
      onSelect: () => void act(loc.id, () => setLocationActive(loc.id, !loc.active)),
    },
  ];

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[25px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">
            Locations Management
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">Manage all your clinics and locations from here.</p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <button type="button" aria-expanded={analyticsOpen} onClick={() => setAnalyticsOpen((v) => !v)}
            className="flex h-[46px] items-center gap-2.5 rounded-[11px] border border-[#E2E6F0] bg-white px-5 shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-colors hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2">
            <SquareChartGantt className="h-[17px] w-[17px] text-[#3B4FE0]" />
            <span className="text-[14.5px] font-bold text-[#1E2A5A]">Location Analytics</span>
          </button>

          <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }}
            className="flex h-[46px] items-center gap-2.5 rounded-[11px] px-[22px] text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] transition-[filter,box-shadow] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
            style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
            <Plus className="h-[18px] w-[18px]" />
            <span className="text-[14.5px] font-bold">Add New Location</span>
          </button>
        </div>
      </div>

      {analyticsOpen && <AnalyticsPanel data={analytics} onClose={() => setAnalyticsOpen(false)} />}

      {error && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Loading locations…
        </p>
      ) : raw.length === 0 ? (
        <section className={`${CARD} grid place-items-center px-6 py-16 text-center`}>
          <div className="max-w-sm">
            <span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#EEF2FF]">
              <Building2 className="h-6 w-6 text-[#3B4FE0]" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-[#0F172A]">No locations yet</h2>
            <p className="mt-2 text-sm text-[#64748B]">
              Add the clinic you practise at. The first one becomes your primary location automatically.
            </p>
            <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }}
              className="mx-auto mt-5 flex h-11 items-center gap-2 rounded-[10px] px-5 text-[13.5px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
              <Plus className="h-[17px] w-[17px]" />
              Add New Location
            </button>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[396px_1fr]">
          <LocationsListCard
            locations={clinics}
            selectedId={selectedId ?? clinics[0]?.id ?? ''}
            onSelect={setSelectedId}
            menuFor={(l) => {
              const raw2 = raw.find((r) => r.id === l.id);
              return raw2 ? menuFor(raw2) : [];
            }}
          />

          {/* min-w-0 lets the 1fr column shrink below its content width. */}
          {selected && (
            <div className="flex min-w-0 flex-col gap-5">
              <LocationDetailCard
                location={selected}
                onEdit={selectedRaw ? () => { setEditing(selectedRaw); setFormOpen(true); } : undefined}
                onSetPrimary={selectedRaw && !selectedRaw.isPrimary && selectedRaw.active
                  ? () => void act(selectedRaw.id, () => setPrimaryLocation(selectedRaw.id))
                  : undefined}
                onDeactivate={selectedRaw && selectedRaw.active
                  ? () => void act(selectedRaw.id, () => setLocationActive(selectedRaw.id, false))
                  : undefined}
              />
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.52fr_0.75fr]">
                <LocationTimingsCard location={selected} />
                <LocationServicesCard location={selected} />
              </div>
              {selectedRaw && (
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => { setEditing(selectedRaw); setFormOpen(true); }}
                    className="h-11 rounded-[10px] border-[1.5px] border-[#C7CEF5] bg-white px-5 text-[13px] font-bold text-[#3B4FE0] hover:bg-[#F5F7FF]">
                    Edit Location
                  </button>
                  {!selectedRaw.isPrimary && selectedRaw.active && (
                    <button type="button" onClick={() => void act(selectedRaw.id, () => setPrimaryLocation(selectedRaw.id))}
                      className="h-11 rounded-[10px] border border-[#E2E6F0] bg-white px-5 text-[13px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
                      Set as Primary
                    </button>
                  )}
                  <button type="button" onClick={() => void act(selectedRaw.id, () => setLocationActive(selectedRaw.id, !selectedRaw.active))}
                    className="h-11 rounded-[10px] border border-[#E2E6F0] bg-white px-5 text-[13px] font-bold text-[#B42318] hover:bg-[#FDF0F0]">
                    {selectedRaw.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <LocationFormModal
        open={dialogOpen}
        editing={dialogEditing}
        onClose={closeDialog}
        onSaved={async () => {
          await reloadAll();
          // A brand-new practice has nothing scoped yet — land on Overall.
          if (activeId !== OVERALL && !raw.length) setActiveId(OVERALL);
        }}
      />
    </div>
  );
}
