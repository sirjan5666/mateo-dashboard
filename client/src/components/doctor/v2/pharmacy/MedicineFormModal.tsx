import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { createMedicine, updateMedicine, MEDICINE_CATEGORIES } from '../../../../api/pharmacy';
import type { DistributorDto, MedicineDto, MedicineInput } from '../../../../api/pharmacy';
import { ApiError } from '../../../../api/client';
import { cn } from '../../../../lib/cn';
import { INPUT, LABEL } from './shared';

type Errors = Partial<Record<keyof MedicineInput, string>>;

/** Mirrors the server's zod rules so the problem shows before the round-trip. */
function validate(v: MedicineInput, isNew: boolean): Errors {
  const e: Errors = {};
  if (v.sku.trim().length < 2) e.sku = 'Enter the SKU';
  if (v.name.trim().length < 2) e.name = 'Enter the medicine name';
  if (v.batch.trim().length < 1) e.batch = 'Enter the batch number';
  if (!(v.purchaseRate >= 0)) e.purchaseRate = 'Enter a purchase rate';
  if (!(v.mrp >= 0)) e.mrp = 'Enter an MRP';
  // Selling below cost is almost always a typo, so it is caught here rather
  // than silently priced into every bill.
  if (v.mrp > 0 && v.purchaseRate > v.mrp) e.mrp = 'MRP cannot be below the purchase rate';
  if (isNew && v.qtyInStock !== undefined && v.qtyInStock < 0) e.qtyInStock = 'Opening stock cannot be negative';
  return e;
}

const BLANK: MedicineInput = {
  sku: '', name: '', form: '', category: 'Others', batch: '', distributorId: '',
  expiry: '', purchaseRate: 0, mrp: 0, gstPct: 12, qtyInStock: 0, capacity: 100, reorderLevel: 10,
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1.5 text-[11.5px] font-medium text-[#E03131]">{message}</p>;
}

function MedicineForm({
  editing,
  distributors,
  onClose,
  onSaved,
}: {
  editing?: MedicineDto | null;
  distributors: DistributorDto[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<MedicineInput>(() =>
    editing
      ? {
          sku: editing.sku, name: editing.name, form: editing.form ?? '', category: editing.category,
          batch: editing.batch, distributorId: editing.distributorId ?? '', expiry: editing.expiry ?? '',
          purchaseRate: editing.purchaseRate, mrp: editing.mrp, gstPct: editing.gstPct,
          capacity: editing.capacity, reorderLevel: editing.reorderLevel,
        }
      : BLANK,
  );
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const set = <K extends keyof MedicineInput>(k: K, v: MedicineInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(form, !editing);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setServerError(null);
    try {
      // Stock is never edited here — it only moves through +/−, purchases and
      // bills, each of which writes a StockMovement.
      if (editing) {
        const { qtyInStock, ...rest } = form;
        void qtyInStock;
        await updateMedicine(editing.id, rest);
      } else {
        await createMedicine(form);
      }
      await onSaved();
      onClose();
    } catch (err) {
      setServerError(
        err instanceof ApiError && err.status === 409
          ? 'This SKU already exists in that batch — use a different batch number.'
          : err instanceof Error ? err.message : 'Could not save this medicine',
      );
      setSaving(false);
    }
  }

  const props = (k: keyof MedicineInput) => ({
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `merr-${k}` : undefined,
    className: cn(INPUT, errors[k] && 'border-[#E03131]'),
  });
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(10,27,77,.45)] p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="med-form-title"
        className="relative max-h-full w-full max-w-[680px] overflow-y-auto rounded-[16px] bg-white shadow-[0_28px_64px_-20px_rgba(15,23,42,.4)]">
        <div className="flex items-start gap-3 border-b border-[#ECEEF4] px-6 py-5">
          <div className="min-w-0">
            <h2 id="med-form-title" className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-[#0F172A]">
              {editing ? 'Edit Medicine' : 'Add Medicine / SKU'}
            </h2>
            <p className="mt-1 text-[13px] text-[#64748B]">
              {editing ? 'Stock is changed with +/−, purchases and bills — not here.' : 'One row per SKU and batch.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[#64748B] hover:bg-[#F1F3F9]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mf-name" className={LABEL}>Medicine Name <span aria-hidden="true" className="text-[#EF4444]">*</span></label>
              <input id="mf-name" ref={firstRef} autoFocus value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="Paracetamol 250mg" {...props('name')} />
              <FieldError id="merr-name" message={errors.name} />
            </div>
            <div>
              <label htmlFor="mf-sku" className={LABEL}>SKU <span aria-hidden="true" className="text-[#EF4444]">*</span></label>
              <input id="mf-sku" value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="PAR250SYP" {...props('sku')} />
              <FieldError id="merr-sku" message={errors.sku} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="mf-form" className={LABEL}>Form / Pack</label>
              <input id="mf-form" value={form.form} onChange={(e) => set('form', e.target.value)} placeholder="Syrup" {...props('form')} />
            </div>
            <div>
              <label htmlFor="mf-cat" className={LABEL}>Category</label>
              <select id="mf-cat" value={form.category} onChange={(e) => set('category', e.target.value as MedicineInput['category'])} className={INPUT}>
                {MEDICINE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="mf-batch" className={LABEL}>Batch <span aria-hidden="true" className="text-[#EF4444]">*</span></label>
              <input id="mf-batch" value={form.batch} onChange={(e) => set('batch', e.target.value)} placeholder="PB2417" {...props('batch')} />
              <FieldError id="merr-batch" message={errors.batch} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mf-dist" className={LABEL}>Distributor</label>
              <select id="mf-dist" value={form.distributorId} onChange={(e) => set('distributorId', e.target.value)} className={INPUT}>
                <option value="">— None —</option>
                {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="mf-exp" className={LABEL}>Expiry</label>
              <input id="mf-exp" type="date" value={form.expiry} onChange={(e) => set('expiry', e.target.value)} className={INPUT} />
              <p className="mt-1.5 text-[11.5px] text-[#94A3B8]">Leave blank for non-expiring items.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="mf-rate" className={LABEL}>Purchase ₹ <span aria-hidden="true" className="text-[#EF4444]">*</span></label>
              <input id="mf-rate" type="number" step="0.01" min={0} value={form.purchaseRate}
                onChange={(e) => set('purchaseRate', num(e.target.value))} {...props('purchaseRate')} />
              <FieldError id="merr-purchaseRate" message={errors.purchaseRate} />
            </div>
            <div>
              <label htmlFor="mf-mrp" className={LABEL}>MRP ₹ <span aria-hidden="true" className="text-[#EF4444]">*</span></label>
              <input id="mf-mrp" type="number" step="0.01" min={0} value={form.mrp}
                onChange={(e) => set('mrp', num(e.target.value))} {...props('mrp')} />
              <FieldError id="merr-mrp" message={errors.mrp} />
            </div>
            <div>
              <label htmlFor="mf-gst" className={LABEL}>GST %</label>
              <input id="mf-gst" type="number" min={0} max={28} value={form.gstPct}
                onChange={(e) => set('gstPct', num(e.target.value))} className={INPUT} />
            </div>
            <div>
              <label htmlFor="mf-reorder" className={LABEL}>Reorder at</label>
              <input id="mf-reorder" type="number" min={0} value={form.reorderLevel}
                onChange={(e) => set('reorderLevel', num(e.target.value))} className={INPUT} />
            </div>
          </div>

          {!editing && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:w-1/2">
              <div>
                <label htmlFor="mf-qty" className={LABEL}>Opening Stock</label>
                <input id="mf-qty" type="number" min={0} value={form.qtyInStock}
                  onChange={(e) => set('qtyInStock', num(e.target.value))} {...props('qtyInStock')} />
                <FieldError id="merr-qtyInStock" message={errors.qtyInStock} />
              </div>
              <div>
                <label htmlFor="mf-cap" className={LABEL}>Full-shelf Qty</label>
                <input id="mf-cap" type="number" min={1} value={form.capacity}
                  onChange={(e) => set('capacity', num(e.target.value))} className={INPUT} />
              </div>
            </div>
          )}

          {serverError && (
            <p role="alert" className="mt-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
              {serverError}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={onClose}
              className="h-11 rounded-[10px] border border-[#E2E6F0] bg-white px-6 text-[13.5px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex h-11 items-center gap-2 rounded-[10px] px-6 text-[13.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
              {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Mounted only while open, so the form state is fresh every time. */
export function MedicineFormModal({
  open,
  editing,
  distributors,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing?: MedicineDto | null;
  distributors: DistributorDto[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  if (!open) return null;
  return <MedicineForm key={editing?.id ?? 'new'} editing={editing} distributors={distributors} onClose={onClose} onSaved={onSaved} />;
}
