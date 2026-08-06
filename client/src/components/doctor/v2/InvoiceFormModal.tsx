import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { createInvoice } from '../../../api/doctorBilling';
import { listPatients } from '../../../api/doctorPatients';
import type { Patient } from '../../../api/doctorPatients';
import { money } from '../../../data/invoices';
import { cn } from '../../../lib/cn';

const LABEL = 'block text-[12.5px] font-semibold text-[#334155]';
const INPUT = 'mt-1.5 h-11 w-full rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 text-[13.5px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none';

interface Line {
  description: string;
  amount: string;
}

const BLANK: Line = { description: '', amount: '' };

/**
 * Raise an invoice against one of the doctor's own patients.
 *
 * The total is DERIVED from the line items — there is no separate total field
 * that could drift from what is actually billed.
 */
export function InvoiceFormModal({ onClose, onSaved, presetPatientId }: {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  presetPatientId?: string;
}) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState(presetPatientId ?? '');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listPatients()
      .then((r) => {
        if (cancelled) return;
        setPatients(r.patients);
        setPatientId((cur) => cur || r.patients[0]?.id || '');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parsed = useMemo(
    () => lines
      .map((l) => ({ description: l.description.trim(), amount: Number(l.amount) }))
      .filter((l) => l.description && Number.isFinite(l.amount) && l.amount >= 0),
    [lines],
  );
  const total = parsed.reduce((t, l) => t + l.amount, 0);
  const canSave = !!patientId && parsed.length > 0;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await createInvoice({
        patientId,
        items: parsed,
        date: new Date(`${date}T00:00:00`).toISOString(),
        notes: notes.trim() || undefined,
      });
      await onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create the invoice');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.45)] p-4">
      <div role="dialog" aria-modal="true" aria-label="Create invoice"
        className="max-h-[92vh] w-full max-w-[600px] overflow-y-auto rounded-[16px] border border-[#ECEEF4] bg-white p-6 shadow-[0_24px_60px_-20px_rgba(15,23,42,.35)]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[18px] font-extrabold tracking-[-0.02em] text-[#0F172A]">Create invoice</h2>
            <p className="mt-1 text-[12.5px] text-[#64748B]">Bill one of your patients for a visit, test or item.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-[#E2E6F0] text-[#64748B] hover:bg-[#F7F8FC]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="iv-patient" className={LABEL}>Patient</label>
            <select id="iv-patient" value={patientId} onChange={(e) => setPatientId(e.target.value)} className={cn(INPUT, 'appearance-none')}>
              {patients.length === 0 && <option value="">No patients registered yet</option>}
              {patients.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="iv-date" className={LABEL}>Invoice date</label>
            <input id="iv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className={LABEL}>Line items</legend>
          <ul className="mt-2 flex flex-col gap-2.5">
            {lines.map((l, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <input aria-label={`Description ${i + 1}`} value={l.description}
                  onChange={(e) => setLines((rows) => rows.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
                  placeholder="Consultation, vaccination…" maxLength={200}
                  className="h-11 min-w-0 flex-1 rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 text-[13.5px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
                <input aria-label={`Amount ${i + 1}`} type="number" min={0} step="0.01" value={l.amount}
                  onChange={(e) => setLines((rows) => rows.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))}
                  placeholder="₹"
                  className="h-11 w-[120px] shrink-0 rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 text-[13.5px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
                <button type="button" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1}
                  onClick={() => setLines((rows) => rows.filter((_, j) => j !== i))}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[#E2E6F0] text-[#EF4444] hover:bg-[#FEF2F2] disabled:opacity-40">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setLines((rows) => [...rows, { ...BLANK }])}
            className="mt-2.5 flex items-center gap-2 text-[13px] font-bold text-[#3B4FE0] hover:underline">
            <Plus className="h-4 w-4" />Add line
          </button>
        </fieldset>

        <div className="mt-4">
          <label htmlFor="iv-notes" className={LABEL}>Notes <span className="font-normal text-[#94A3B8]">(optional)</span></label>
          <textarea id="iv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000}
            className="mt-1.5 w-full rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 py-3 text-[13.5px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
        </div>

        <p className="mt-4 flex items-center gap-3 rounded-[11px] bg-[#F7F8FC] px-4 py-3.5">
          <span className="text-[13px] font-semibold text-[#475569]">Total</span>
          <span className="ml-auto text-[17px] font-extrabold text-[#0F172A]">{money(total)}</span>
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-[10px] border border-[#F5C2C2] bg-[#FDF2F2] px-4 py-2.5 text-[12.5px] font-medium text-[#B42318]">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose}
            className="h-11 rounded-[10px] border border-[#E2E6F0] bg-white px-5 text-[13.5px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
            Cancel
          </button>
          <button type="button" disabled={!canSave || saving} onClick={() => void save()}
            className="flex h-11 items-center gap-2 rounded-[10px] px-6 text-[13.5px] font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
            {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            Create invoice
          </button>
        </div>
      </div>
    </div>
  );
}
