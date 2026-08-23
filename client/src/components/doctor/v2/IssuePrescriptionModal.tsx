import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { issuePrescription } from '../../../api/doctorPrescriptionDocs';
import { listEncounters } from '../../../api/doctorEncounters';
import { getDosingCatalog } from '../../../api/dosing';
import { useActiveLocation } from '../../../lib/doctorLocation';
import { cn } from '../../../lib/cn';
import { DrugInfoPanel, MedicineField, resolveDrug } from './MedicineAutocomplete';
import type { DosingCatalog } from './MedicineAutocomplete';

const LABEL = 'block text-[12.5px] font-semibold text-[#334155]';
const INPUT = 'mt-1.5 h-11 w-full rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 text-[13.5px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none';
const CELL = 'h-11 min-w-0 rounded-[10px] border border-[#E2E6F0] bg-white px-3 text-[13px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none';

interface Line {
  drug: string;
  strength: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const BLANK: Line = { drug: '', strength: '', dose: '', frequency: '', duration: '', instructions: '' };

/** One per printed line; blank entries are dropped rather than printed empty. */
const splitLines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * Issue a prescription — the header (diagnosis, review, investigations, advice)
 * plus its medication lines, written together.
 *
 * The medication rows created here are ordinary DoctorPrescription records, so
 * they show up in the Prescriptions tab and the parent's medicine reminders too.
 * The document just gives them a printable identity.
 */
export function IssuePrescriptionModal({ patientId, patientName, onClose, onIssued }: {
  patientId: string;
  patientName: string;
  onClose: () => void;
  /** Receives the new document id so the caller can jump straight to the sheet. */
  onIssued: (docId: string) => void;
}) {
  const { clinics, active } = useActiveLocation();
  const [diagnosis, setDiagnosis] = useState('');
  const [reviewAfter, setReviewAfter] = useState('');
  const [investigations, setInvestigations] = useState('');
  const [advice, setAdvice] = useState('');
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }]);
  const [encounterId, setEncounterId] = useState('');
  const [encounters, setEncounters] = useState<{ id: string; date: string; label: string }[]>([]);
  const [locationOverride, setLocationOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Curated pediatric dosing catalog powers the medicine typeahead + info. It's
  // doctor-only decision-support (DRAFT, verify) — never LLM-generated. If it
  // fails to load the fields stay plain free-text inputs.
  const [catalog, setCatalog] = useState<DosingCatalog | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getDosingCatalog().then((c) => { if (!cancelled) setCatalog(c); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const locationId = locationOverride
    || (active && active.id !== 'overall' ? active.id : clinics.find((c) => c.primary)?.id ?? clinics[0]?.id ?? '');

  useEffect(() => {
    let cancelled = false;
    void listEncounters(patientId)
      .then((r) => {
        if (cancelled) return;
        setEncounters(r.encounters.slice(0, 10).map((e) => ({
          id: e.id,
          date: e.date,
          label: `${new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} — ${e.assessment || e.subjective || 'Visit'}`,
        })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = useMemo(
    () => lines
      .map((l) => ({
        drug: l.drug.trim(),
        strength: l.strength.trim() || undefined,
        dose: l.dose.trim() || undefined,
        frequency: l.frequency.trim() || undefined,
        duration: l.duration.trim() || undefined,
        instructions: l.instructions.trim() || undefined,
      }))
      .filter((l) => l.drug),
    [lines],
  );

  async function save() {
    if (!items.length) {
      setError('Add at least one medicine');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { document: doc } = await issuePrescription(patientId, {
        diagnosis: diagnosis.trim() || undefined,
        reviewAfterDays: reviewAfter.trim() ? Number(reviewAfter) : undefined,
        investigations: splitLines(investigations),
        advice: splitLines(advice),
        locationId: locationId || undefined,
        encounterId: encounterId || undefined,
        items,
      });
      onIssued(doc.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not issue the prescription');
      setSaving(false);
    }
  }

  const set = (i: number, key: keyof Line, v: string) =>
    setLines((rows) => rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.45)] p-4">
      <div role="dialog" aria-modal="true" aria-label={`Issue prescription for ${patientName}`}
        className="max-h-[92vh] w-full max-w-[940px] overflow-y-auto rounded-[16px] border border-[#ECEEF4] bg-white p-6 shadow-[0_24px_60px_-20px_rgba(15,23,42,.35)]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[18px] font-extrabold tracking-[-0.02em] text-[#0F172A]">Issue prescription</h2>
            <p className="mt-1 text-[12.5px] text-[#64748B]">For {patientName}. A prescription ID is allocated on save.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-[#E2E6F0] text-[#64748B] hover:bg-[#F7F8FC]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label htmlFor="rx-dx" className={LABEL}>Diagnosis / clinical impression</label>
            <input id="rx-dx" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} maxLength={500}
              placeholder="Fever and Cold" className={INPUT} />
          </div>
          <div>
            <label htmlFor="rx-review" className={LABEL}>Review after (days)</label>
            <input id="rx-review" type="number" min={0} max={365} value={reviewAfter}
              onChange={(e) => setReviewAfter(e.target.value)} placeholder="3" className={INPUT} />
          </div>
          {clinics.length > 1 && (
            <div>
              <label htmlFor="rx-clinic" className={LABEL}>Letterhead clinic</label>
              <select id="rx-clinic" value={locationId} onChange={(e) => setLocationOverride(e.target.value)} className={cn(INPUT, 'appearance-none')}>
                {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {encounters.length > 0 && (
            <div className={clinics.length > 1 ? '' : 'lg:col-span-2'}>
              <label htmlFor="rx-enc" className={LABEL}>Link to a visit <span className="font-normal text-[#94A3B8]">(optional)</span></label>
              <select id="rx-enc" value={encounterId} onChange={(e) => setEncounterId(e.target.value)} className={cn(INPUT, 'appearance-none')}>
                <option value="">Not linked</option>
                {encounters.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <fieldset className="mt-5">
          <legend className={LABEL}>Medications</legend>
          <ul className="mt-2 flex flex-col gap-2.5">
            {lines.map((l, i) => {
              const info = resolveDrug(l.drug, catalog);
              return (
                <li key={i}>
                  <div className="grid grid-cols-2 items-center gap-2 lg:grid-cols-[1.3fr_1.2fr_.7fr_1fr_.8fr_1fr_auto]">
                    <MedicineField ariaLabel={`Medicine ${i + 1}`} value={l.drug} onChange={(v) => set(i, 'drug', v)}
                      onPickStrength={(s) => set(i, 'strength', s)} catalog={catalog} placeholder="Paracetamol Syrup" className={CELL} />
                    <input aria-label={`Composition or strength ${i + 1}`} value={l.strength} onChange={(e) => set(i, 'strength', e.target.value)} placeholder="250 mg / 5 ml" className={CELL} />
                    <input aria-label={`Dose ${i + 1}`} value={l.dose} onChange={(e) => set(i, 'dose', e.target.value)} placeholder="5 ml" className={CELL} />
                    <input aria-label={`Frequency ${i + 1}`} value={l.frequency} onChange={(e) => set(i, 'frequency', e.target.value)} placeholder="Every 6 hours" className={CELL} />
                    <input aria-label={`Duration ${i + 1}`} value={l.duration} onChange={(e) => set(i, 'duration', e.target.value)} placeholder="3 Days" className={CELL} />
                    <input aria-label={`Instructions ${i + 1}`} value={l.instructions} onChange={(e) => set(i, 'instructions', e.target.value)} placeholder="After Food" className={CELL} />
                    <button type="button" aria-label={`Remove medicine ${i + 1}`} disabled={lines.length === 1}
                      onClick={() => setLines((rows) => rows.filter((_, j) => j !== i))}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[#E2E6F0] text-[#EF4444] hover:bg-[#FEF2F2] disabled:opacity-40">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {info && <DrugInfoPanel drug={info} status={catalog?.status} />}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setLines((rows) => [...rows, { ...BLANK }])}
            className="mt-2.5 flex items-center gap-2 text-[13px] font-bold text-[#3B4FE0] hover:underline">
            <Plus className="h-4 w-4" />Add medicine
          </button>
        </fieldset>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="rx-inv" className={LABEL}>Investigations advised <span className="font-normal text-[#94A3B8]">(one per line)</span></label>
            <textarea id="rx-inv" value={investigations} onChange={(e) => setInvestigations(e.target.value)} rows={4}
              placeholder={'CBC (Complete Blood Count)\nCRP (C-Reactive Protein)'}
              className="mt-1.5 w-full rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 py-3 text-[13px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
          </div>
          <div>
            <label htmlFor="rx-advice" className={LABEL}>Advice <span className="font-normal text-[#94A3B8]">(one per line)</span></label>
            <textarea id="rx-advice" value={advice} onChange={(e) => setAdvice(e.target.value)} rows={4}
              placeholder={'Take plenty of fluids.\nRest is important.'}
              className="mt-1.5 w-full rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 py-3 text-[13px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-[10px] border border-[#F5C2C2] bg-[#FDF2F2] px-4 py-2.5 text-[12.5px] font-medium text-[#B42318]">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <p className="text-[12px] text-[#64748B]">{items.length} medicine{items.length === 1 ? '' : 's'} will be prescribed.</p>
          <button type="button" onClick={onClose}
            className="ml-auto h-11 rounded-[10px] border border-[#E2E6F0] bg-white px-5 text-[13.5px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
            Cancel
          </button>
          <button type="button" disabled={saving || !items.length} onClick={() => void save()}
            className="flex h-11 items-center gap-2 rounded-[10px] px-6 text-[13.5px] font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
            {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            Issue &amp; print
          </button>
        </div>
      </div>
    </div>
  );
}
