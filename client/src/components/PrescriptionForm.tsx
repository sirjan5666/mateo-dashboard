import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createPrescription } from '../api/prescriptions';
import type { Prescription, PrescriptionItem } from '../api/prescriptions';
import { ApiError } from '../api/client';
import { Button } from './ui/Button';
import { inputCls } from './ui/field';
import { DoseCheck } from './DoseCheck';

const emptyItem = (): PrescriptionItem => ({ medicine: '', dosage: '', frequency: '', duration: '', notes: '' });

export function PrescriptionForm({
  consultationId,
  onCreated,
  onCancel,
}: {
  consultationId: string;
  onCreated: (rx: Prescription) => void;
  onCancel: () => void;
}) {
  const [diagnosis, setDiagnosis] = useState('');
  const [items, setItems] = useState<PrescriptionItem[]>([emptyItem()]);
  const [advice, setAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(i: number, field: keyof PrescriptionItem, val: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanItems = items.map((it) => ({ ...it, medicine: it.medicine.trim() })).filter((it) => it.medicine);
    if (cleanItems.length === 0) {
      setError('Add at least one medicine');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { prescription } = await createPrescription(consultationId, {
        diagnosis: diagnosis.trim() || undefined,
        items: cleanItems,
        advice: advice.trim() || undefined,
        followUpDate: followUpDate || undefined,
      });
      onCreated(prescription);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-stone-200 bg-white p-5">
      <h3 className="font-bold text-stone-800">Write a prescription</h3>

      <div className="mt-3">
        <label htmlFor="diag" className="block text-sm font-medium text-stone-700">Diagnosis (optional)</label>
        <input id="diag" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={inputCls} />
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-stone-700">Medicines</p>
        <div className="mt-2 space-y-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-xl border border-stone-200 p-3">
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <input placeholder="Medicine *" value={it.medicine} onChange={(e) => updateItem(i, 'medicine', e.target.value)} className={inputCls} />
                  <input placeholder="Dosage (e.g. 2.5 ml)" value={it.dosage} onChange={(e) => updateItem(i, 'dosage', e.target.value)} className={inputCls} />
                  <input placeholder="Frequency (e.g. twice a day)" value={it.frequency} onChange={(e) => updateItem(i, 'frequency', e.target.value)} className={inputCls} />
                  <input placeholder="Duration (e.g. 5 days)" value={it.duration} onChange={(e) => updateItem(i, 'duration', e.target.value)} className={inputCls} />
                  <input placeholder="Notes (optional)" value={it.notes ?? ''} onChange={(e) => updateItem(i, 'notes', e.target.value)} className={`${inputCls} sm:col-span-2`} />
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove medicine" className="mt-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setItems((prev) => [...prev, emptyItem()])} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800">
          <Plus className="h-4 w-4" /> Add medicine
        </button>
      </div>

      <DoseCheck consultationId={consultationId} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="followup" className="block text-sm font-medium text-stone-700">Follow-up date (optional)</label>
          <input id="followup" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor="advice" className="block text-sm font-medium text-stone-700">Advice (optional)</label>
        <textarea id="advice" rows={2} value={advice} onChange={(e) => setAdvice(e.target.value)} className={`${inputCls} resize-none`} />
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? 'Issuing…' : 'Issue prescription'}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
