import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle, Check, Clock, FileText, FlaskConical, Loader2,
  Plus, Search, TestTubes, Upload, X,
} from 'lucide-react';
import { getLabOrders, createLabOrder, updateLabOrderStatus, searchLabTestCatalog, uploadLabReport, labReportUrl, recordLabPayment } from '../../api/doctorLabs';
import type { LabOrderStatus, LabCatalogTest } from '../../api/doctorLabs';
import { listPatients } from '../../api/doctorPatients';
import { useLoad } from '../../components/doctor/v2/workspace/shared';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';

const STATUS_STYLE: Record<LabOrderStatus, { bg: string; fg: string; label: string }> = {
  ordered: { bg: '#EEF2FF', fg: '#3B4FE0', label: 'Ordered' },
  sample_collected: { bg: '#FDECD3', fg: '#B45309', label: 'Sample Collected' },
  in_progress: { bg: '#E0F2FE', fg: '#0284C7', label: 'In Progress' },
  completed: { bg: '#DCF7E6', fg: '#12A150', label: 'Completed' },
  cancelled: { bg: '#F1F3F9', fg: '#64748B', label: 'Cancelled' },
};

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

type PatientOption = { id: string; name: string };

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;
// Fasting values in the dataset are messy — treat only clearly-required ones as such.
const needsFasting = (f: string) => !!f && !/^(not required|no|no fasting required|not applicable|na|nil|-|none)$/i.test(f.trim());

function NewOrderModal({
  patients,
  onClose,
  onCreated,
}: {
  patients: PatientOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [patientId, setPatientId] = useState('');
  const [selected, setSelected] = useState<LabCatalogTest[]>([]);
  const [priority, setPriority] = useState<'routine' | 'urgent'>('routine');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<LabCatalogTest[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // Debounced search over the real ~1.8k-test price catalog. All state updates
  // happen inside the timeout (never synchronously in the effect body), and prior
  // results stay visible until the new ones arrive — no flicker between keystrokes.
  useEffect(() => {
    const q = search.trim();
    const id = ++reqId.current;
    if (q.length < 2) {
      const clear = setTimeout(() => { if (id === reqId.current) { setResults([]); setSearching(false); } }, 0);
      return () => clearTimeout(clear);
    }
    const t = setTimeout(() => {
      if (id !== reqId.current) return;
      setSearching(true);
      void searchLabTestCatalog(q)
        .then((r) => { if (id === reqId.current) setResults(r.tests); })
        .catch(() => { if (id === reqId.current) setResults([]); })
        .finally(() => { if (id === reqId.current) setSearching(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [search]);

  const selectedCodes = new Set(selected.map((t) => t.code));
  const total = selected.reduce((s, t) => s + (t.price || 0), 0);
  const toggle = (t: LabCatalogTest) =>
    setSelected((prev) => (prev.some((x) => x.code === t.code) ? prev.filter((x) => x.code !== t.code) : [...prev, t]));

  async function submit() {
    if (!patientId || selected.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await createLabOrder({ patientId, tests: selected.map((t) => t.name), priority, notes: notes.trim() || undefined, amount: total });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create order');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(10,27,77,.45)] p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative max-h-full w-full max-w-[640px] overflow-y-auto rounded-[16px] bg-white shadow-[0_28px_64px_-20px_rgba(15,23,42,.4)]">
        <div className="flex items-center gap-3 border-b border-[#ECEEF4] px-6 py-5">
          <FlaskConical className="h-5 w-5 text-[#3B4FE0]" />
          <h2 className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-[#0F172A]">New Lab Order</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto grid h-9 w-9 place-items-center rounded-[10px] text-[#64748B] hover:bg-[#F1F3F9]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="lo-patient" className="mb-[7px] block text-[12.5px] font-bold text-[#334155]">Patient <span className="text-[#EF4444]">*</span></label>
            <select id="lo-patient" value={patientId} onChange={(e) => setPatientId(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-[#E4E8F1] bg-white px-3.5 text-[13.5px] font-medium text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none">
              <option value="">Select patient…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <span className="mb-[7px] block text-[12.5px] font-bold text-[#334155]">Priority</span>
              <div className="flex gap-2">
                {(['routine', 'urgent'] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={cn('h-10 flex-1 rounded-[9px] text-[12.5px] font-bold capitalize transition-colors',
                      priority === p ? (p === 'urgent' ? 'border-[1.5px] border-[#EF4444] bg-[#FEF2F2] text-[#EF4444]' : 'border-[1.5px] border-[#3B4FE0] bg-[#EEF2FF] text-[#3B4FE0]') : 'border border-[#E2E6F0] bg-white text-[#334155] hover:bg-[#F7F8FC]')}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="lo-search" className="mb-[7px] block text-[12.5px] font-bold text-[#334155]">
              Tests <span className="text-[#EF4444]">*</span>
              <span className="ml-2 font-medium text-[#94A3B8]">({selected.length} selected)</span>
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input id="lo-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search 1,800+ tests & packages…" autoComplete="off"
                className="h-10 w-full rounded-[10px] border border-[#E4E8F1] bg-white pl-9 pr-3.5 text-[13px] font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none" />
            </div>

            {search.trim().length >= 2 && (
              <div className="mt-2 max-h-[230px] overflow-y-auto rounded-[10px] border border-[#E4E8F1]">
                {searching && results.length === 0 && (
                  <p className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-[#94A3B8]"><Loader2 className="h-3.5 w-3.5 animate-spin" />Searching…</p>
                )}
                {!searching && results.length === 0 && (
                  <p className="px-3 py-2.5 text-[12px] text-[#94A3B8]">No tests match “{search.trim()}”.</p>
                )}
                {results.map((t) => {
                  const on = selectedCodes.has(t.code);
                  return (
                    <button key={t.code} type="button" onClick={() => toggle(t)}
                      className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#F7F8FC]', on && 'bg-[#EEF2FF]')}>
                      <span className={cn('grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border', on ? 'border-[#3B4FE0] bg-[#3B4FE0]' : 'border-[#CBD5E1]')}>
                        {on && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[12.5px] font-semibold text-[#0F172A]">{t.name}</span>
                          {t.kind === 'package' && <span className="shrink-0 rounded-full bg-[#EDE9FE] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[#6D28D9]">Pkg</span>}
                          {needsFasting(t.fasting) && <span className="shrink-0 rounded-full bg-[#FEF0D3] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[#B45309]">Fasting</span>}
                        </span>
                        {t.parameters && <span className="mt-0.5 block truncate text-[11px] text-[#94A3B8]">{t.parameters}</span>}
                      </span>
                      <span className="ml-auto shrink-0 text-[12.5px] font-bold text-[#0F172A] tabular-nums">{rupee(t.price)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {selected.length > 0 && (
              <div className="mt-2.5 rounded-[10px] border border-[#E4E8F1] bg-[#FAFBFD] p-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((t) => (
                    <span key={t.code} className="inline-flex items-center gap-1.5 rounded-full border border-[#DDE3F5] bg-white py-1 pl-2.5 pr-1.5 text-[11.5px] font-semibold text-[#334155]">
                      <span className="max-w-[180px] truncate">{t.name}</span>
                      <span className="text-[#94A3B8]">{rupee(t.price)}</span>
                      <button type="button" onClick={() => toggle(t)} aria-label={`Remove ${t.name}`} className="grid h-4 w-4 place-items-center rounded-full text-[#94A3B8] hover:bg-[#F1F3F9] hover:text-[#EF4444]">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[#E4E8F1] pt-2 text-[12.5px]">
                  <span className="font-medium text-[#64748B]">{selected.length} test{selected.length !== 1 ? 's' : ''} selected</span>
                  <span className="font-bold text-[#0F172A] tabular-nums">Total: {rupee(total)}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="lo-notes" className="mb-[7px] block text-[12.5px] font-bold text-[#334155]">Notes</label>
            <textarea id="lo-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Clinical indication, fasting status…"
              className="w-full rounded-[10px] border border-[#E4E8F1] bg-white px-3.5 py-2.5 text-[13px] font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none" />
          </div>

          {error && (
            <p className="rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-2.5 text-[13px] font-medium text-[#B42318]">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="h-11 rounded-[10px] border border-[#E2E6F0] bg-white px-6 text-[13.5px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">Cancel</button>
            <button type="button" onClick={submit} disabled={saving || !patientId || selected.length === 0}
              className="flex h-11 items-center gap-2 rounded-[10px] px-6 text-[13.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Creating…' : 'Create Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const STATUS_FILTERS: { key: LabOrderStatus | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'ordered', label: 'Ordered' },
  { key: 'sample_collected', label: 'Sample Collected' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export default function LabOrders() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<LabOrderStatus | ''>('');
  const [showNew, setShowNew] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const { data, loading, error, reload } = useLoad(
    async () => {
      const [o, p] = await Promise.all([
        getLabOrders(statusFilter ? { status: statusFilter } : undefined),
        listPatients(),
      ]);
      return {
        orders: o.orders,
        patients: p.patients.map((pt) => ({ id: pt.id, name: pt.displayName })) as PatientOption[],
      };
    },
    [statusFilter],
  );

  const orders = data?.orders ?? [];
  const patients = data?.patients ?? [];

  async function changeStatus(id: string, status: LabOrderStatus) {
    setUpdatingId(id);
    try {
      await updateLabOrderStatus(id, status);
      reload();
    } catch {
      /* ignore */
    } finally {
      setUpdatingId(null);
    }
  }

  async function uploadReport(id: string, file: File) {
    setUploadingId(id);
    try {
      await uploadLabReport(id, file);
      reload();
    } catch {
      /* ignore — the order simply stays without a report */
    } finally {
      setUploadingId(null);
    }
  }

  async function markPaid(id: string, amount: number) {
    setPayingId(id);
    try {
      await recordLabPayment(id, amount);
      reload();
    } catch {
      /* ignore */
    } finally {
      setPayingId(null);
    }
  }

  const counts = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'ordered' || o.status === 'sample_collected' || o.status === 'in_progress').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    urgent: orders.filter((o) => o.priority === 'urgent' && o.status !== 'completed' && o.status !== 'cancelled').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[15px]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}>
              <TestTubes className="h-[22px] w-[22px] text-white" />
            </span>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">In-House Lab</h1>
          </div>
          <p className="mt-1.5 text-sm text-[#64748B] sm:pl-[59px]">Order, track, and manage lab tests for your patients.</p>
        </div>
        <button type="button" onClick={() => setShowNew(true)}
          className="flex h-[46px] items-center gap-2 rounded-[11px] px-5 text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
          style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
          <Plus className="h-[17px] w-[17px]" />
          <span className="text-[13.5px] font-bold">New Lab Order</span>
        </button>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total Orders', value: counts.total, tint: '#EEF2FF', fg: '#3B4FE0', icon: FlaskConical },
          { label: 'Pending', value: counts.pending, tint: '#FDECD3', fg: '#B45309', icon: Clock },
          { label: 'Completed', value: counts.completed, tint: '#DCF7E6', fg: '#12A150', icon: Check },
          { label: 'Urgent', value: counts.urgent, tint: '#FEF2F2', fg: '#EF4444', icon: AlertCircle },
        ].map((k) => (
          <div key={k.label} className="rounded-[13px] border border-[#ECEEF4] bg-white px-4 pb-3.5 pt-4">
            <div className="flex items-center gap-3">
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px]" style={{ background: k.tint }}>
                <k.icon className="h-[18px] w-[18px]" style={{ color: k.fg }} />
              </span>
              <span className="text-[12.5px] font-medium text-[#64748B]">{k.label}</span>
            </div>
            <p className="mt-2.5 font-display text-2xl font-extrabold leading-none tracking-[-0.02em] text-[#0F172A] tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setStatusFilter(f.key)}
            className={cn('h-9 shrink-0 rounded-[9px] px-4 text-[12.5px] font-bold transition-colors',
              statusFilter === f.key ? 'bg-[#3B4FE0] text-white' : 'border border-[#E2E6F0] bg-white text-[#334155] hover:bg-[#F7F8FC]')}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <section className={CARD}>
        {loading && !orders.length ? (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-[#64748B]"><Loader2 className="h-4 w-4 animate-spin" />Loading lab orders…</p>
        ) : error ? (
          <p className="px-5 py-8 text-[13px] font-medium text-[#B42318]">{error}</p>
        ) : orders.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <TestTubes className="mx-auto h-10 w-10 text-[#CBD5E1]" />
            <p className="mt-3 text-[14px] font-bold text-[#334155]">No lab orders yet</p>
            <p className="mt-1 text-[13px] text-[#64748B]">Create your first lab order to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-0">
              <thead>
                <tr>
                  {['Order #', 'Patient', 'Tests', 'Priority', 'Status', 'Billing', 'Ordered', 'Actions'].map((h, i, arr) => (
                    <th key={h} scope="col" className={cn('h-[42px] border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]', i === 0 && 'pl-5', i === arr.length - 1 && 'pr-5')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const st = STATUS_STYLE[o.status];
                  return (
                    <tr key={o.id} className="hover:bg-[#FAFBFF]">
                      <td className="h-[50px] border-b border-[#F1F3F9] pl-5 pr-3 text-[12.5px] font-bold text-[#0F172A]">{o.orderNumber}</td>
                      <td className="border-b border-[#F1F3F9] pr-3">
                        <button type="button" onClick={() => navigate(`/doctor/patients/${o.patientId}`)} className="text-[12.5px] font-semibold text-[#3B4FE0] hover:underline">{o.patientName}</button>
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3">
                        <span className="text-[12px] font-medium text-[#334155]">{o.tests.length} test{o.tests.length !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3">
                        <span className={cn('inline-block rounded-[6px] px-2.5 py-[3px] text-[11px] font-bold uppercase',
                          o.priority === 'urgent' ? 'bg-[#FEF2F2] text-[#EF4444]' : 'bg-[#F1F3F9] text-[#64748B]')}>
                          {o.priority}
                        </span>
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3">
                        <span className="inline-block rounded-[6px] px-2.5 py-[3px] text-[11px] font-bold" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3">
                        {o.amount > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-bold tabular-nums text-[#0F172A]">₹{o.amount.toLocaleString('en-IN')}</span>
                            <span className={cn('rounded-[6px] px-1.5 py-[2px] text-[10px] font-bold uppercase',
                              o.amountPaid >= o.amount ? 'bg-[#DCF7E6] text-[#12A150]' : 'bg-[#FEF2F2] text-[#EF4444]')}>
                              {o.amountPaid >= o.amount ? 'Paid' : 'Unpaid'}
                            </span>
                          </div>
                        ) : <span className="text-[12px] text-[#94A3B8]">—</span>}
                      </td>
                      <td className="border-b border-[#F1F3F9] pr-3 text-[12px] font-medium text-[#334155]">{when(o.orderedAt)}</td>
                      <td className="border-b border-[#F1F3F9] pr-5">
                        <div className="flex flex-wrap items-center gap-2">
                          {o.status === 'ordered' && (
                            <button type="button" disabled={updatingId === o.id} onClick={() => changeStatus(o.id, 'sample_collected')}
                              className="h-8 rounded-[8px] border border-[#E2E6F0] bg-white px-3 text-[11.5px] font-bold text-[#334155] hover:bg-[#F7F8FC] disabled:opacity-50">
                              {updatingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Collect Sample'}
                            </button>
                          )}
                          {o.status === 'sample_collected' && (
                            <button type="button" disabled={updatingId === o.id} onClick={() => changeStatus(o.id, 'in_progress')}
                              className="h-8 rounded-[8px] border border-[#E2E6F0] bg-white px-3 text-[11.5px] font-bold text-[#0284C7] hover:bg-[#F0F9FF] disabled:opacity-50">
                              {updatingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Start Processing'}
                            </button>
                          )}
                          {o.status === 'in_progress' && (
                            <button type="button" disabled={updatingId === o.id} onClick={() => changeStatus(o.id, 'completed')}
                              className="h-8 rounded-[8px] bg-[#12A150] px-3 text-[11.5px] font-bold text-white hover:brightness-105 disabled:opacity-50">
                              {updatingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark Complete'}
                            </button>
                          )}
                          {o.status === 'completed' && o.results.length > 0 && (
                            <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#12A150]">
                              <Check className="h-3.5 w-3.5" />Results ready
                            </span>
                          )}
                          {/* Billing: collect payment when there's an outstanding amount (spec #29). */}
                          {o.status !== 'cancelled' && o.amount > 0 && o.amountPaid < o.amount && (
                            <button type="button" disabled={payingId === o.id} onClick={() => markPaid(o.id, o.amount)}
                              className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 text-[11.5px] font-bold text-[#12A150] hover:bg-[#DCFCE7] disabled:opacity-50">
                              {payingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark Paid'}
                            </button>
                          )}
                          {/* Report upload/view once the sample is in the lab (spec #27, #30). */}
                          {(o.status === 'in_progress' || o.status === 'completed') && (
                            o.hasReport ? (
                              <a href={labReportUrl(o.id)} target="_blank" rel="noopener noreferrer"
                                className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#C7D2FE] bg-[#EEF2FF] px-3 text-[11.5px] font-bold text-[#3B4FE0] hover:bg-[#E0E7FF]">
                                <FileText className="h-3.5 w-3.5" />View Report
                              </a>
                            ) : (
                              <label className={cn('flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#E2E6F0] bg-white px-3 text-[11.5px] font-bold text-[#334155] hover:bg-[#F7F8FC]', uploadingId === o.id && 'opacity-50')}>
                                {uploadingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                Upload Report
                                <input type="file" accept=".pdf,image/*" className="hidden" disabled={uploadingId === o.id}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadReport(o.id, f); e.target.value = ''; }} />
                              </label>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showNew && <NewOrderModal patients={patients} onClose={() => setShowNew(false)} onCreated={reload} />}
    </div>
  );
}
