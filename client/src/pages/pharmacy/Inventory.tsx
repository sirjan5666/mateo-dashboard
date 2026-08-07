import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle, ArrowRight, Boxes, CalendarDays, ChevronDown, Download, IndianRupee, Loader2,
  Minus, Plus, Search, SlidersHorizontal, Upload, XCircle,
} from 'lucide-react';
import {
  adjustStock, downloadInventoryCsv, getInventorySummary, importInventory, listDistributors,
  listInventory, setStock, updateMedicine, MEDICINE_CATEGORIES,
} from '../../api/pharmacy';
import type { DistributorDto, InventorySummary, MedicineDto, MedicineInput } from '../../api/pharmacy';
import { RowMenu } from '../../components/doctor/v2/RowMenu';
import { MedicineFormModal } from '../../components/doctor/v2/pharmacy/MedicineFormModal';
import { CARD, Chip, H2, TH, Tile } from '../../components/doctor/v2/pharmacy/shared';
import { cn } from '../../lib/cn';

const amt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  'In Stock': { bg: '#DCF7E6', fg: '#12A150' },
  'Low Stock': { bg: '#FDECD3', fg: '#E8890B' },
  'Out of Stock': { bg: '#FDE2E2', fg: '#E03131' },
};

/** Bar fill: green at or above half, amber while any stock remains, empty at zero. */
function levelColor(level: number): string | null {
  if (level <= 0) return null;
  return level >= 50 ? '#12A150' : '#F59E0B';
}

/**
 * The stock table's columns, declared once so the header and the body cannot
 * drift out of alignment — which is exactly what had happened: the money columns
 * were right-aligned with no padding, so their values collided with the header
 * beside them. Widths keep the numbers from crowding on a narrow window.
 */
const COLS: { label: string; align?: 'right'; width: number }[] = [
  { label: 'Medicine', width: 232 },
  { label: 'Batch', width: 96 },
  { label: 'Distributor', width: 150 },
  { label: 'Expiry', width: 96 },
  { label: 'Purchase Rate (₹)', align: 'right', width: 124 },
  { label: 'MRP (₹)', align: 'right', width: 96 },
  { label: 'Qty in Stock', align: 'right', width: 112 },
  { label: 'Stock Level', width: 140 },
  { label: 'Status', width: 106 },
  { label: 'Actions', width: 128 },
];

/** Sum of the widths above — the point below which the table has to scroll. */
const TABLE_MIN = COLS.reduce((t, c) => t + c.width, 0);

/** Shared body-cell padding, matching the header's, so columns line up. */
const TD = 'border-b border-[#F1F3F9] px-3 py-2 text-[12.5px]';

/**
 * Stock quantity you can type into, not only step with +/-.
 *
 * It commits an absolute COUNT. The server derives the movement from its own
 * current figure, so the change still lands in the stock history with a note —
 * and a page that has gone stale cannot land on the wrong total.
 *
 * Enter or blur commits; Escape abandons the edit. A value that is not a
 * non-negative whole number is refused and the field snaps back, because the
 * alternative is quietly writing a wrong count into a pharmacy's stock.
 */
function QtyCell({
  row,
  busy,
  onCommit,
}: {
  row: MedicineDto;
  busy: boolean;
  onCommit: (target: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(row.qtyInStock);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (!/^\d+$/.test(draft.trim()) || !Number.isFinite(n) || n === row.qtyInStock) return;
    onCommit(n);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={busy ? String(row.qtyInStock) : shown}
      disabled={busy}
      aria-label={`Quantity in stock for ${row.name}`}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.currentTarget.blur(); }
        if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); }
      }}
      className="h-8 w-[74px] rounded-[8px] border border-transparent bg-transparent px-2 text-right text-[13px] font-bold tabular-nums text-[#0F172A] transition-colors hover:border-[#E2E6F0] hover:bg-white focus:border-[#3B4FE0] focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,79,224,.12)] disabled:opacity-50"
    />
  );
}

/** Looks like plain text; a hover border and focus ring show it can be edited. */
const INLINE =
  'h-8 w-full rounded-[8px] border border-transparent bg-transparent px-2 text-[12.5px] text-[#334155] transition-colors hover:border-[#E2E6F0] hover:bg-white focus:border-[#3B4FE0] focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-[rgba(59,79,224,.12)] disabled:opacity-50';

/**
 * A table cell edited in place. Text and number fields read as plain text until
 * focused; committing on Enter or blur, abandoning on Escape. The parent
 * persists and reloads, so an unchanged or rejected value simply snaps back.
 *
 * Numbers show their formatted form at rest (₹ 600.00) and their raw form while
 * editing (600), and refuse anything that is not a non-negative number.
 */
function InlineText({
  value, kind = 'text', align = 'left', busy, ariaLabel, placeholder, format, onCommit,
}: {
  value: string;
  kind?: 'text' | 'number';
  align?: 'left' | 'right';
  busy: boolean;
  ariaLabel: string;
  placeholder?: string;
  format?: (v: string) => string;
  onCommit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const shown = editing ? draft : format ? format(value) : value;

  const commit = () => {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next === value.trim()) return;
    if (kind === 'number' && next !== '' && !(Number.isFinite(Number(next)) && Number(next) >= 0)) return;
    onCommit(next);
  };

  return (
    <input
      type="text"
      inputMode={kind === 'number' ? 'decimal' : undefined}
      value={busy ? (format ? format(value) : value) : shown}
      disabled={busy}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onFocus={() => setDraft(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); }
      }}
      className={cn(INLINE, align === 'right' && 'text-right font-semibold tabular-nums text-[#0F172A]')}
    />
  );
}

/** A native date field for the expiry column; empty clears the date. */
function InlineDate({ value, busy, ariaLabel, onCommit }: {
  value: string; busy: boolean; ariaLabel: string; onCommit: (raw: string) => void;
}) {
  return (
    <input
      type="date"
      defaultValue={value}
      disabled={busy}
      aria-label={ariaLabel}
      onBlur={(e) => { if (e.target.value !== value) onCommit(e.target.value); }}
      className={cn(INLINE, 'tabular-nums')}
    />
  );
}

/** Reassign the distributor from the ones this practice already deals with. */
function InlineDistributor({ value, options, busy, ariaLabel, onCommit }: {
  value: string | null;
  options: DistributorDto[];
  busy: boolean;
  ariaLabel: string;
  onCommit: (id: string) => void;
}) {
  return (
    <select
      value={value ?? ''}
      disabled={busy}
      aria-label={ariaLabel}
      onChange={(e) => onCommit(e.target.value)}
      className={cn(INLINE, 'appearance-none pr-6', !value && 'text-[#94A3B8]')}
    >
      <option value="">No distributor</option>
      {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  );
}

/** Icon + tint per category, so the table reads at a glance without stored colours. */
const CAT_STYLE: Record<string, { tint: string; fg: string; icon: string }> = {
  Antibiotics: { tint: '#EDE9FE', fg: '#6D28D9', icon: 'FlaskConical' },
  Analgesics: { tint: '#E4EBFD', fg: '#2B6FF0', icon: 'Pill' },
  Vitamins: { tint: '#FDECD3', fg: '#F59E0B', icon: 'Droplet' },
  Respiratory: { tint: '#FDE2E2', fg: '#EF4444', icon: 'Wind' },
  Topicals: { tint: '#FCE7F3', fg: '#EC4899', icon: 'Droplet' },
  Others: { tint: '#E4EBFD', fg: '#2B6FF0', icon: 'ShieldCheck' },
};

/**
 * Parses the CSV produced by "Download Inventory" back into rows for import.
 * Handles quoted fields and doubled quotes, so a medicine name containing a
 * comma survives the round-trip.
 */
function parseCsv(text: string): MedicineInput[] {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i += 1; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  if (rows.length < 2) return [];

  const head = rows[0].map((h) => h.trim().toLowerCase());
  const at = (r: string[], name: string) => {
    const i = head.indexOf(name.toLowerCase());
    return i === -1 ? '' : (r[i] ?? '').trim();
  };
  const num = (v: string) => (v === '' ? 0 : Number(v) || 0);

  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => ({
      sku: at(r, 'SKU'),
      name: at(r, 'Name'),
      form: at(r, 'Form') || undefined,
      category: (MEDICINE_CATEGORIES as readonly string[]).includes(at(r, 'Category'))
        ? (at(r, 'Category') as MedicineInput['category'])
        : 'Others',
      batch: at(r, 'Batch'),
      expiry: at(r, 'Expiry') || undefined,
      purchaseRate: num(at(r, 'PurchaseRate')),
      mrp: num(at(r, 'MRP')),
      gstPct: num(at(r, 'GSTPct')) || 12,
      qtyInStock: num(at(r, 'QtyInStock')),
      capacity: num(at(r, 'Capacity')) || undefined,
      reorderLevel: num(at(r, 'ReorderLevel')) || undefined,
    }))
    .filter((r) => r.sku && r.name && r.batch);
}

export default function PharmacyInventory() {
  const [items, setItems] = useState<MedicineDto[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [distributors, setDistributors] = useState<DistributorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MedicineDto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const [inv, sum] = await Promise.all([
      listInventory({ q: query, category, status: alertsOnly ? 'alerts' : undefined }),
      getInventorySummary(),
    ]);
    setItems(inv.items);
    setSummary(sum);
  }, [query, category, alertsOnly]);

  // Inlined so every setState is provably after an await (no cascading render).
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listInventory({ q: query, category, status: alertsOnly ? 'alerts' : undefined }),
      getInventorySummary(),
      listDistributors(),
    ])
      .then(([inv, sum, dist]) => {
        if (cancelled) return;
        setItems(inv.items);
        setSummary(sum);
        setDistributors(dist.distributors);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load inventory');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, category, alertsOnly]);

  const kpis = useMemo(
    () =>
      summary
        ? [
            { id: 'value', accent: '#4F46E5', wash: '#F3F4FE', icon: IndianRupee, label: 'Stock Value', value: inr(Math.round(summary.kpis.stockValue)) },
            { id: 'skus', accent: '#6D5AE0', wash: '#F5F3FE', icon: Boxes, label: 'Total SKUs', value: summary.kpis.totalSkus.toLocaleString('en-IN') },
            { id: 'low', accent: '#F59E0B', wash: '#FEF8EC', icon: AlertTriangle, label: 'Low Stock', value: String(summary.kpis.lowStock) },
            { id: 'out', accent: '#EF4444', wash: '#FDF0F0', icon: XCircle, label: 'Out of Stock', value: String(summary.kpis.outOfStock) },
            { id: 'exp', accent: '#12A150', wash: '#EDFAF2', icon: CalendarDays, label: 'Expiring in 60 Days', value: String(summary.kpis.expiringSoon) },
          ]
        : [],
    [summary],
  );

  /** The +/− buttons. A 409 means the till lost a race — surfaced, not swallowed. */
  async function bump(m: MedicineDto, delta: number) {
    setBusyId(m.id);
    setError(null);
    try {
      await adjustStock(m.id, delta, delta > 0 ? 'Manual increase' : 'Manual decrease');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not adjust stock');
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Persist an inline edit to one field of a row. Everything except the stock
   * balance goes through the medicine PATCH; the count has its own movement-based
   * path (`setQty`) so it always lands in the stock ledger.
   */
  async function saveField(m: MedicineDto, patch: Partial<MedicineInput>) {
    setBusyId(m.id);
    setError(null);
    try {
      await updateMedicine(m.id, patch);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the change');
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Set stock to a typed figure. The absolute count goes to the server, which
   * derives the movement from ITS current number and records it — a delta worked
   * out here would be wrong the moment this page went stale.
   */
  async function setQty(m: MedicineDto, target: number) {
    setBusyId(m.id);
    setError(null);
    try {
      await setStock(m.id, target, 'Stock count');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set the stock count');
    } finally {
      setBusyId(null);
    }
  }

  /** Hides the SKU from the counter without erasing its stock history. */
  async function discontinue(m: MedicineDto) {
    setBusyId(m.id);
    setError(null);
    try {
      await updateMedicine(m.id, { active: false });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not discontinue this medicine');
    } finally {
      setBusyId(null);
    }
  }

  async function onImportFile(file: File) {
    setError(null);
    setNotice(null);
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) {
        setError('No usable rows found — the file needs SKU, Name and Batch columns.');
        return;
      }
      const r = await importInventory(rows);
      setNotice(`Imported ${r.created} new and updated ${r.updated} item${r.updated === 1 ? '' : 's'}.${r.failed ? ` ${r.failed} failed.` : ''}`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import this file');
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex min-w-0 flex-col">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-extrabold tracking-[-0.02em] text-[#0F172A]">Pharmacy</h1>
            <p className="mt-1 text-[13.5px] font-medium text-[#64748B]">Inventory / Stock Management</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = '';
              }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex h-[46px] items-center gap-2 rounded-[11px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
              <Upload className="h-[17px] w-[17px] text-[#334155]" />
              <span className="text-sm font-bold text-[#1E2A5A]">Import Stock</span>
            </button>
            <button type="button" onClick={() => void downloadInventoryCsv().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Export failed'))}
              className="flex h-[46px] items-center gap-2 rounded-[11px] border border-[#E2E6F0] bg-white px-5 hover:bg-[#F7F8FC]">
              <Download className="h-[17px] w-[17px] text-[#334155]" />
              <span className="text-sm font-bold text-[#1E2A5A]">Download</span>
            </button>
            <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }}
              className="flex h-[46px] items-center gap-2 rounded-[11px] px-[22px] text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
              <Plus className="h-[18px] w-[18px]" />
              <span className="text-sm font-bold">Add Medicine / SKU</span>
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {(kpis.length ? kpis : Array.from({ length: 5 })).map((k, i) =>
            k ? (
              <article key={(k as { id: string }).id} className="rounded-[13px] border border-[#ECEEF4] px-[18px] pb-[14px] pt-4"
                style={{ background: (k as { wash: string }).wash, borderLeft: `2px solid ${(k as { accent: string }).accent}` }}>
                <div className="flex items-center gap-[13px]">
                  <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]" style={{ background: (k as { accent: string }).accent }}>
                    {(() => { const I = (k as { icon: typeof Boxes }).icon; return <I className="h-[19px] w-[19px] text-white" />; })()}
                  </span>
                  <p className="min-w-0 text-[12.5px] font-medium text-[#64748B]">{(k as { label: string }).label}</p>
                </div>
                <p className="mt-2 text-[22px] font-extrabold text-[#0F172A]">{(k as { value: string }).value}</p>
              </article>
            ) : (
              <div key={i} className="h-[118px] animate-pulse rounded-[13px] border border-[#ECEEF4] bg-[#F7F8FC]" />
            ),
          )}
        </div>

        {/* Alert bar — only when there is something to alert about. */}
        {summary && (summary.kpis.outOfStock > 0 || summary.kpis.lowStock > 0) && (
          <p role="status" className="mt-3.5 flex flex-wrap items-center gap-[13px] rounded-[12px] border border-[#F8D4D4] bg-[#FDF0F0] px-5 py-3.5">
            <AlertTriangle aria-hidden="true" className="h-[19px] w-[19px] shrink-0 text-[#EF4444]" />
            <span className="text-[13px] font-semibold text-[#B42318]">
              {summary.kpis.outOfStock} item{summary.kpis.outOfStock === 1 ? '' : 's'} out of stock
              <span aria-hidden="true" className="px-2 text-[#E0A0A0]">•</span>
              {summary.kpis.lowStock} low in stock
            </span>
            <button type="button" onClick={() => setAlertsOnly((v) => !v)} aria-pressed={alertsOnly}
              className="ml-auto flex items-center gap-[7px] text-[13px] font-bold text-[#3B4FE0] hover:underline">
              {alertsOnly ? 'Clear Filter' : 'View Alerts'}
              <ArrowRight className="h-[15px] w-[15px]" />
            </button>
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3.5 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">{error}</p>
        )}
        {notice && (
          <p role="status" className="mt-3.5 rounded-[10px] border border-[#C8EDD8] bg-[#ECFAF1] px-4 py-3 text-[13px] font-medium text-[#0F7A46]">{notice}</p>
        )}

        {/* Inventory card */}
        <section className={cn(CARD, 'mt-4 pb-4 pt-5')}>
          <div className="flex flex-wrap items-start gap-3 px-[22px]">
            <div className="min-w-0">
              <h2 className={H2}>Inventory</h2>
              <p className="mt-1 text-[12.5px] text-[#64748B]">Real-time stock overview of all medicines.</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setAlertsOnly((v) => !v)} aria-pressed={alertsOnly}
                className={cn('flex h-[42px] items-center gap-2 rounded-[10px] border bg-white px-[18px] hover:bg-[#F7F8FC]',
                  alertsOnly ? 'border-[1.5px] border-[#6366F1]' : 'border-[#E4E8F1]')}>
                <SlidersHorizontal className="h-4 w-4 text-[#3B4FE0]" />
                <span className="text-[13px] font-semibold text-[#334155]">{alertsOnly ? 'Alerts only' : 'Filter'}</span>
              </button>
              <div className="relative">
                <label htmlFor="inv-cat" className="sr-only">Category</label>
                <select id="inv-cat" value={category} onChange={(e) => setCategory(e.target.value)}
                  className="h-[42px] w-[176px] appearance-none rounded-[10px] border border-[#E4E8F1] bg-white pl-3.5 pr-9 text-[13px] font-semibold text-[#334155] focus:border-[#3B4FE0] focus:outline-none">
                  {['All Categories', ...MEDICINE_CATEGORIES].map((c) => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              </div>
              <div className="relative">
                <label htmlFor="inv-q" className="sr-only">Search medicine or batch</label>
                <input id="inv-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search medicine or batch…"
                  className="h-[42px] w-full rounded-[10px] border border-[#E4E8F1] bg-white pl-3.5 pr-10 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#3B4FE0] focus:outline-none sm:w-[218px]" />
                <Search aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#94A3B8]" />
              </div>
            </div>
          </div>

          {loading ? (
            <p className="px-[22px] py-10 text-center text-sm text-[#64748B]">
              <Loader2 aria-hidden="true" className="mr-2 inline h-4 w-4 animate-spin" />
              Loading inventory…
            </p>
          ) : items.length === 0 ? (
            <div className="px-[22px] py-14 text-center">
              <span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#F3F4FE]">
                <Boxes className="h-6 w-6 text-[#4F46E5]" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-[#0F172A]">
                {query || category !== 'All Categories' || alertsOnly ? 'Nothing matches those filters' : 'No stock yet'}
              </h3>
              <p className="mt-2 text-sm text-[#64748B]">
                {query || category !== 'All Categories' || alertsOnly
                  ? 'Clear the search or filters to see the full list.'
                  : 'Add your first medicine, or import a stock CSV.'}
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table style={{ minWidth: TABLE_MIN }} className="w-full border-separate border-spacing-0">
                <caption className="sr-only">Pharmacy stock</caption>
                <thead>
                  <tr>
                    {COLS.map((c, i) => (
                      <th
                        key={c.label}
                        scope="col"
                        className={cn(
                          TH,
                          // Every header gets padding of its own. Without it a
                          // right-aligned "MRP (₹)" ran straight into the next
                          // header's first letter.
                          'px-3',
                          c.align === 'right' && 'text-right',
                          i === 0 && 'pl-[22px]',
                          i === COLS.length - 1 && 'pr-[22px]',
                        )}
                        style={{ width: c.width }}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => {
                    const fill = levelColor(r.level);
                    const st = STATUS_STYLE[r.status] ?? STATUS_STYLE['In Stock'];
                    const cat = CAT_STYLE[r.category] ?? CAT_STYLE.Others;
                    return (
                      <tr key={r.id} className="hover:bg-[#FAFBFF]">
                        <th scope="row" className="h-[57px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left font-normal">
                          <span className="flex items-center gap-3">
                            <Tile icon={cat.icon} tint={cat.tint} fg={cat.fg} size={32} glyph={16} radius={9} />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-bold text-[#0F172A]">{r.name}</span>
                              {r.form && <span className="block text-[11.5px] text-[#64748B]">{r.form}</span>}
                            </span>
                          </span>
                        </th>
                        <td className={TD}>
                          <InlineText
                            value={r.batch}
                            busy={busyId === r.id}
                            ariaLabel={`Batch for ${r.name}`}
                            placeholder="Batch"
                            onCommit={(v) => void saveField(r, { batch: v })}
                          />
                        </td>
                        <td className={TD}>
                          <InlineDistributor
                            value={r.distributorId}
                            options={distributors}
                            busy={busyId === r.id}
                            ariaLabel={`Distributor for ${r.name}`}
                            onCommit={(id) => void saveField(r, { distributorId: id })}
                          />
                        </td>
                        <td className={TD}>
                          {/* Keyed by the value so a saved date remounts the
                              uncontrolled input with the new default. */}
                          <InlineDate
                            key={r.expiry ?? 'none'}
                            value={r.expiry ?? ''}
                            busy={busyId === r.id}
                            ariaLabel={`Expiry date for ${r.name}`}
                            onCommit={(v) => void saveField(r, { expiry: v })}
                          />
                        </td>
                        <td className={TD}>
                          <InlineText
                            value={String(r.purchaseRate)}
                            kind="number"
                            align="right"
                            busy={busyId === r.id}
                            ariaLabel={`Purchase rate for ${r.name}`}
                            format={(v) => amt(Number(v))}
                            onCommit={(v) => void saveField(r, { purchaseRate: Number(v) })}
                          />
                        </td>
                        <td className={TD}>
                          <InlineText
                            value={String(r.mrp)}
                            kind="number"
                            align="right"
                            busy={busyId === r.id}
                            ariaLabel={`MRP for ${r.name}`}
                            format={(v) => amt(Number(v))}
                            onCommit={(v) => void saveField(r, { mrp: Number(v) })}
                          />
                        </td>
                        <td className={cn(TD, 'text-right')}>
                          <QtyCell
                            row={r}
                            busy={busyId === r.id}
                            onCommit={(target) => void setQty(r, target)}
                          />
                        </td>
                        <td className={TD}>
                          <span className="flex items-center gap-2.5">
                            <span role="progressbar" aria-valuenow={r.level} aria-valuemin={0} aria-valuemax={100}
                              aria-label={`Stock level of ${r.name}`}
                              className="block h-1.5 w-[74px] shrink-0 overflow-hidden rounded-full bg-[#EEF0F8]">
                              {fill && <span className="block h-full rounded-full" style={{ width: `${r.level}%`, background: fill }} />}
                            </span>
                            <span className="text-[11.5px] font-semibold text-[#64748B]">{r.level}%</span>
                          </span>
                        </td>
                        <td className={TD}><Chip label={r.status} bg={st.bg} fg={st.fg} /></td>
                        <td className="border-b border-[#F1F3F9] py-2 pl-3 pr-[22px]">
                          <span className="flex items-center gap-2">
                            {busyId === r.id ? (
                              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[#64748B]" />
                            ) : (
                              <>
                                <button type="button" aria-label={`Increase stock of ${r.name}`} onClick={() => void bump(r, 1)}
                                  className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-[#E2E6F0] hover:bg-[#F7F8FC]">
                                  <Plus className="h-4 w-4 text-[#12A150]" />
                                </button>
                                <button type="button" aria-label={`Decrease stock of ${r.name}`} disabled={r.qtyInStock === 0}
                                  aria-disabled={r.qtyInStock === 0} title={r.qtyInStock === 0 ? 'Nothing left to remove' : undefined}
                                  onClick={() => void bump(r, -1)}
                                  className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-[#E2E6F0] hover:bg-[#F7F8FC] disabled:cursor-not-allowed disabled:opacity-40">
                                  <Minus className="h-4 w-4 text-[#EF4444]" />
                                </button>
                                <RowMenu label={`Actions for ${r.name}`} size={30} items={[
                                  { label: 'Edit Medicine', onSelect: () => { setEditing(r); setFormOpen(true); } },
                                  { label: 'Mark Discontinued', danger: true, onSelect: () => void discontinue(r) },
                                ]} />
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && items.length > 0 && (
            <p className="border-t border-[#ECEEF4] px-[22px] pt-4 text-[12.5px] font-medium text-[#64748B]">
              Showing {items.length} item{items.length === 1 ? '' : 's'}
            </p>
          )}
        </section>
      </div>

      {/* Fast Movers and Stock by Category sit BELOW the stock table now, side
          by side — the table is what the page is for, and it was the thing
          being squeezed to make room for two small charts. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={cn(CARD, 'px-5 pb-5 pt-[18px]')}>
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className={H2}>Fast Movers</h2>
            <span className="text-xs font-medium text-[#64748B]">(This Month)</span>
          </div>
          {summary?.fastMovers.length ? (
            <>
              <div role="img" aria-label="Fast-moving medicines by units sold this month" style={{ height: 230 }} className="mt-3.5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.fastMovers} layout="vertical" margin={{ top: 0, right: 38, bottom: 0, left: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10.5, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11.5, fill: '#334155' }} tickLine={false} axisLine={false} />
                    <Bar dataKey="units" barSize={11} radius={[0, 5, 5, 0]} isAnimationActive={false}>
                      {summary.fastMovers.map((m) => <Cell key={m.name} fill={m.color} />)}
                      <LabelList dataKey="units" position="right" style={{ fontSize: 11.5, fontWeight: 700, fill: '#0F172A' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-center text-[11px] font-medium text-[#64748B]">Units Sold</p>
              <table className="sr-only">
                <caption>Fast movers this month</caption>
                <thead><tr><th>Medicine</th><th>Units sold</th></tr></thead>
                <tbody>{summary.fastMovers.map((m) => <tr key={m.name}><td>{m.name}</td><td>{m.units}</td></tr>)}</tbody>
              </table>
            </>
          ) : (
            <p className="mt-3.5 text-[12.5px] text-[#64748B]">No sales recorded this month yet.</p>
          )}
        </section>

        <section className={cn(CARD, 'px-5 pb-5 pt-[18px]')}>
          <h2 className={H2}>Stock by Category</h2>
          {summary?.categories.length ? (
            <div className="mt-3.5 flex flex-wrap items-center gap-4">
              <div className="relative shrink-0" style={{ width: 150, height: 150 }} role="img"
                aria-label={`Stock by category, ${summary.kpis.totalSkus} total SKUs`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={summary.categories} dataKey="count" innerRadius={50} outerRadius={72} startAngle={90} endAngle={-270}
                      paddingAngle={1} stroke="none" isAnimationActive={false}>
                      {summary.categories.map((c) => <Cell key={c.label} fill={c.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <span>
                    <span className="block text-lg font-extrabold text-[#0F172A]">{summary.kpis.totalSkus}</span>
                    <span className="block text-[10.5px] font-medium text-[#94A3B8]">Total SKUs</span>
                  </span>
                </span>
              </div>
              <dl className="min-w-0 flex-1 space-y-2.5">
                {summary.categories.map((c) => (
                  <div key={c.label} className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                    <dt className="min-w-0 truncate text-xs font-medium text-[#475569]">{c.label}</dt>
                    <dd className="ml-auto text-xs font-semibold text-[#0F172A]">{c.pct}%</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="mt-3.5 text-[12.5px] text-[#64748B]">Add stock to see the category split.</p>
          )}
        </section>
      </div>

      <MedicineFormModal
        open={formOpen}
        editing={editing}
        distributors={distributors}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
      />
    </div>
  );
}
