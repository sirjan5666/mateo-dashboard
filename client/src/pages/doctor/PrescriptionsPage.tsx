import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, Pill, Search } from 'lucide-react';
import { listAllPrescriptions, updatePrescription } from '../../api/doctorPrescriptions';
import type { RxStatus } from '../../api/doctorPrescriptions';
import { RowMenu } from '../../components/doctor/v2/RowMenu';
import { CARD, H2, PanelState, SELECT, Tile, swatch, useLoad, wsDate } from '../../components/doctor/v2/workspace/shared';
import { cn } from '../../lib/cn';

const TH = 'h-10 border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]';

const STATUS_STYLE: Record<RxStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: '#DCF7E6', fg: '#12A150', label: 'Active' },
  completed: { bg: '#EAF0FE', fg: '#2B6FF0', label: 'Completed' },
  stopped: { bg: '#F1F5F9', fg: '#64748B', label: 'Stopped' },
};

/** Clinic-wide prescriptions — every medication this doctor has written. */
export default function PrescriptionsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'all' | RxStatus>('all');
  const [q, setQ] = useState('');
  const [writeError, setWriteError] = useState<string | null>(null);

  const { data, loading, error, reload } = useLoad(() => listAllPrescriptions(), []);
  const all = useMemo(() => data?.prescriptions ?? [], [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (!needle) return true;
      return p.drug.toLowerCase().includes(needle) || p.patientName.toLowerCase().includes(needle);
    });
  }, [all, status, q]);

  const counts = useMemo(() => ({
    all: all.length,
    active: all.filter((p) => p.status === 'active').length,
    completed: all.filter((p) => p.status === 'completed').length,
    stopped: all.filter((p) => p.status === 'stopped').length,
  }), [all]);

  async function setRxStatus(id: string, next: RxStatus) {
    setWriteError(null);
    try {
      await updatePrescription(id, { status: next });
      reload();
    } catch (e: unknown) {
      setWriteError(e instanceof Error ? e.message : 'Could not update the medication');
    }
  }

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-[#0F172A]">Prescriptions</h1>
          <p className="mt-1 text-[13px] text-[#64748B]">Every medication written across your patients.</p>
        </div>
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['#EEF1FE', 'Total', counts.all],
          ['#ECFAF1', 'Active', counts.active],
          ['#EAF1FE', 'Completed', counts.completed],
          ['#F1F5F9', 'Stopped', counts.stopped],
        ] as const).map(([bg, label, value]) => (
          <div key={label} className={`${CARD} px-[18px] py-4`} style={{ background: bg }}>
            <dt className="text-[11.5px] font-medium text-[#64748B]">{label}</dt>
            <dd className="mt-[7px] text-xl font-extrabold text-[#0F172A]">{value}</dd>
          </div>
        ))}
      </dl>

      <section className={`${CARD} pb-4 pt-5`}>
        <div className="flex flex-wrap items-center gap-3 px-[22px]">
          <h2 className={H2}>All Medications</h2>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="relative">
              <label htmlFor="rx-q" className="sr-only">Search prescriptions</label>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input id="rx-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Medicine or patient"
                className="h-[42px] w-[220px] rounded-[10px] border border-[#E4E8F1] bg-white pl-9 pr-3 text-[13px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
            </div>
            <div className="relative">
              <label htmlFor="rx-status" className="sr-only">Status</label>
              <select id="rx-status" value={status} onChange={(e) => setStatus(e.target.value as 'all' | RxStatus)} className={cn(SELECT, 'w-[150px]')}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="stopped">Stopped</option>
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
          </div>
        </div>

        {writeError && (
          <p role="alert" className="mx-[22px] mt-3 rounded-[10px] border border-[#F5C2C2] bg-[#FDF2F2] px-4 py-2.5 text-[12.5px] font-medium text-[#B42318]">
            {writeError}
          </p>
        )}

        <div className="mt-4 px-[22px]">
          <PanelState loading={loading} error={error} empty={!rows.length}
            emptyText={all.length ? 'No medications match this filter.' : 'No prescriptions written yet.'} />
        </div>

        {rows.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-0">
              <caption className="sr-only">All prescriptions</caption>
              <thead>
                <tr>
                  {['Medicine', 'Patient', 'Dose', 'Frequency', 'Duration', 'Date', 'Status', ''].map((h, i) => (
                    <th key={h} scope="col" className={cn(TH, i === 0 && 'pl-[22px]')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const sw = swatch(p.drug);
                  const st = STATUS_STYLE[p.status];
                  return (
                    <tr key={p.id} className="hover:bg-[#FAFBFF]">
                      <th scope="row" className="h-[60px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left font-normal">
                        <span className="flex items-center gap-3">
                          <Tile icon="Pill" tint={sw.tint} fg={sw.fg} size={32} glyph={16} radius={9} />
                          <span className="truncate text-[13px] font-bold text-[#0F172A]">{p.drug}</span>
                        </span>
                      </th>
                      <td className="border-b border-[#F1F3F9] pr-3">
                        <button type="button" onClick={() => navigate(`/doctor/patients/${p.patientId}`)}
                          className="truncate text-[12.5px] font-semibold text-[#3B4FE0] hover:underline">
                          {p.patientName}
                        </button>
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{p.dose ?? '—'}</td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{p.frequency ?? '—'}</td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{p.duration ?? '—'}</td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{wsDate(p.date)}</td>
                      <td className="border-b border-[#F1F3F9] pr-3">
                        <span className="inline-block rounded-[7px] px-[11px] py-[5px] text-[11.5px] font-bold" style={{ background: st.bg, color: st.fg }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-[22px]">
                        <RowMenu label={`Actions for ${p.drug}`} size={32}
                          items={[
                            { label: 'Open patient', onSelect: () => navigate(`/doctor/patients/${p.patientId}`) },
                            ...(p.status !== 'completed' ? [{ label: 'Mark completed', onSelect: () => void setRxStatus(p.id, 'completed') }] : []),
                            ...(p.status !== 'stopped' ? [{ label: 'Stop medication', danger: true, onSelect: () => void setRxStatus(p.id, 'stopped') }] : []),
                          ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 flex items-center gap-2 border-t border-[#ECEEF4] px-[22px] pt-4 text-[12.5px] font-medium text-[#64748B]">
          <Pill aria-hidden="true" className="h-4 w-4 text-[#94A3B8]" />
          Showing {rows.length} of {all.length} medications. Prescribe from a patient&rsquo;s Prescriptions tab.
        </p>
      </section>
    </div>
  );
}
