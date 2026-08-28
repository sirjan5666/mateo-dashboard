import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { issuePrescription } from '../../../api/doctorPrescriptionDocs';
import { searchLabTestCatalog } from '../../../api/doctorLabs';
import type { LabCatalogTest } from '../../../api/doctorLabs';
import { listEncounters } from '../../../api/doctorEncounters';
import { getDosingCatalog } from '../../../api/dosing';
import { useActiveLocation } from '../../../lib/doctorLocation';
import { cn } from '../../../lib/cn';
import { AiInfoPanel, DatasetInfoPanel, DrugInfoPanel, MedicineField, resolveDrug, resolveDrugFromComposition } from './MedicineAutocomplete';
import type { DosingCatalog } from './MedicineAutocomplete';
import type { AiMedicine, DatasetMedicine } from '../../../api/dosing';

const LABEL = 'block text-[12.5px] font-semibold text-[#334155]';
const INPUT = 'mt-1.5 h-11 w-full rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 text-[13.5px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none';
const CELL = 'h-11 min-w-0 rounded-[10px] border border-[#E2E6F0] bg-white px-3 text-[13px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none';
const COLH = 'truncate px-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#94A3B8]';
// One grid template shared by the header row and every medication row, so the
// column widths line up. Weighted so the text-heavy Medicine + Composition cells
// get the most room (long compositions were being clipped).
const RX_GRID = 'lg:grid-cols-[1.5fr_2fr_.65fr_1fr_.7fr_1fr_auto]';

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
 * "Investigations advised" with type-ahead over the real lab-test catalog
 * (~1,787 tests/packages) — the doctor searches by the first characters and
 * picks a test instead of typing the full name (spec #19). Free text is still
 * allowed (type and press Enter) for anything not in the catalog. Selected tests
 * render as removable chips.
 */
function InvestigationField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LabCatalogTest[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    // All state updates are deferred into the timeout so none run synchronously
    // in the effect body (react-hooks/set-state-in-effect is an error here).
    const t = setTimeout(() => {
      if (q.length < 2) { setResults([]); setLoading(false); return; }
      setLoading(true);
      searchLabTestCatalog(q)
        .then((r) => setResults(r.tests.slice(0, 8)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const add = (name: string) => {
    const n = name.trim();
    if (n && !value.some((v) => v.toLowerCase() === n.toLowerCase())) onChange([...value, n]);
    setQuery(''); setResults([]); setOpen(false);
  };

  return (
    <div ref={ref} className="relative mt-1.5">
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[12px] font-semibold text-[#3B4FE0]">
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="opacity-70 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <input value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) { e.preventDefault(); add(query); } }}
          placeholder="Search tests (CBC, LFT, Thyroid…) or type &amp; press Enter"
          className="w-full rounded-[10px] border border-[#E2E6F0] bg-white py-2.5 pl-9 pr-3.5 text-[13px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
      </div>
      {open && (results.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-y-auto rounded-[10px] border border-[#ECEEF4] bg-white py-1 shadow-[0_12px_32px_-12px_rgba(16,24,40,.28)]">
          {loading && results.length === 0 && <p className="px-3 py-2 text-[12px] text-[#94A3B8]">Searching…</p>}
          {results.map((t) => (
            <button key={t.code} type="button" onClick={() => add(t.name)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#F7F8FC]">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#0F172A]">{t.name}</span>
              <span className="shrink-0 text-[11px] font-medium text-[#94A3B8]">{t.kind === 'package' ? 'Package' : t.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [investigations, setInvestigations] = useState<string[]>([]);
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
  // Medicines the doctor picked per line — from the real dataset, or (fallback)
  // AI. Each panel shows only while the line's text still equals the picked name,
  // so editing the field clears it.
  const [dsPicks, setDsPicks] = useState<Record<number, DatasetMedicine>>({});
  const [aiPicks, setAiPicks] = useState<Record<number, AiMedicine>>({});

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
        investigations,
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
        className="max-h-[92vh] w-full max-w-[1160px] overflow-y-auto rounded-[16px] border border-[#ECEEF4] bg-white p-5 shadow-[0_24px_60px_-20px_rgba(15,23,42,.35)] sm:p-6">
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
            {/* Column headers — shown on wide screens where the row is a single line. */}
            <li className={cn('hidden gap-2 px-0.5 lg:grid', RX_GRID)} aria-hidden="true">
              <span className={COLH}>Medicine</span>
              <span className={COLH}>Composition / strength</span>
              <span className={COLH}>Dose</span>
              <span className={COLH}>Frequency</span>
              <span className={COLH}>Duration</span>
              <span className={COLH}>Instructions</span>
              <span className="w-11" />
            </li>
            {lines.map((l, i) => {
              // A picked medicine (dataset first, else AI) wins over a loose typed
              // match — the doctor chose it for this line. Pediatric dosing comes
              // from the dataset pick's composition (single-active only), else from
              // typed text matching a known generic.
              const dsPick = dsPicks[i];
              const showDs = !!dsPick && dsPick.name === l.drug.trim();
              const aiPick = aiPicks[i];
              const showAi = !showDs && !!aiPick && aiPick.name === l.drug.trim();
              const curated = showDs
                ? resolveDrugFromComposition(dsPick.composition1, dsPick.composition2, catalog)
                : (showAi ? undefined : resolveDrug(l.drug, catalog));
              return (
                <li key={i}>
                  <div className={cn('grid grid-cols-2 items-center gap-2 sm:grid-cols-3', RX_GRID)}>
                    <MedicineField ariaLabel={`Medicine ${i + 1}`} value={l.drug} onChange={(v) => set(i, 'drug', v)}
                      onPickStrength={(s) => set(i, 'strength', s)}
                      onPickDatasetMedicine={(m) => setDsPicks((p) => ({ ...p, [i]: m }))}
                      onPickAiMedicine={(m) => setAiPicks((p) => ({ ...p, [i]: m }))}
                      placeholder="Paracetamol Syrup" className={CELL} />
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
                  {showDs && dsPick && <DatasetInfoPanel medicine={dsPick} />}
                  {curated && <DrugInfoPanel drug={curated} status={catalog?.status} />}
                  {showAi && aiPick && <AiInfoPanel medicine={aiPick} />}
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
            <label htmlFor="rx-inv" className={LABEL}>Investigations advised <span className="font-normal text-[#94A3B8]">(search &amp; pick)</span></label>
            <InvestigationField value={investigations} onChange={setInvestigations} />
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
