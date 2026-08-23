import { useEffect, useRef, useState } from 'react';
import { Loader2, Pill, ShieldAlert, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { aiMedicineSearch, searchMedicines } from '../../../api/dosing';
import type { AiMedicine, DatasetMedicine, DosingBrand, DosingDrug } from '../../../api/dosing';
import { cn } from '../../../lib/cn';

// The doctor-only pediatric dosing catalog (curated data — never LLM-generated).
export interface DosingCatalog {
  status: string;
  drugs: DosingDrug[];
  brands: DosingBrand[];
}

/** Resolve typed text back to a catalog generic — so pediatric info can show for a known name. */
export function resolveDrug(text: string, catalog: DosingCatalog | null): DosingDrug | undefined {
  if (!catalog || !text.trim()) return undefined;
  const q = text.trim().toLowerCase();
  const byId = new Map(catalog.drugs.map((d) => [d.id, d]));
  const brand =
    catalog.brands.find((b) => b.name.toLowerCase() === q) ??
    catalog.brands.find((b) => q.startsWith(b.name.toLowerCase()));
  if (brand) return byId.get(brand.strengths[0]?.drugId ?? '');
  return (
    catalog.drugs.find((d) => d.name.toLowerCase() === q || d.aka?.toLowerCase() === q) ??
    catalog.drugs.find((d) => q.startsWith(d.name.toLowerCase()))
  );
}

// A few generic-name spelling variants seen in the India dataset's composition.
const EXTRA_ALIASES: Record<string, string[]> = {
  amoxicillin: ['amoxycillin'],
  aspirin: ['acetylsalicylic'],
};

/**
 * Map a dataset medicine's composition to a curated pediatric drug — but ONLY for
 * a SINGLE active (no composition2). We deliberately do NOT infer pediatric dosing
 * for a combination product (e.g. Amoxicillin + Clavulanic acid) from one part.
 */
export function resolveDrugFromComposition(
  c1: string | null | undefined,
  c2: string | null | undefined,
  catalog: DosingCatalog | null,
): DosingDrug | undefined {
  if (!catalog || (c2 && c2.trim())) return undefined;
  const hay = (c1 ?? '').toLowerCase();
  if (!hay.trim()) return undefined;
  for (const d of catalog.drugs) {
    const aliases = [d.name.toLowerCase(), ...(d.aka ? [d.aka.toLowerCase()] : []), ...(EXTRA_ALIASES[d.id] ?? [])];
    if (aliases.some((a) => hay.includes(a))) return d;
  }
  return undefined;
}

/** The strength cell text derived from a dataset medicine's composition. */
export function compositionStrength(m: DatasetMedicine): string {
  return [m.composition1, m.composition2].map((c) => (c ?? '').trim()).filter(Boolean).join(' + ');
}

/**
 * The medicine name cell in the prescribe form — a typeahead over the real
 * IndiaMedicine catalog (~254k). Free text is always allowed; picking a medicine
 * fills its composition into the strength cell. Curated pediatric dosing
 * (DrugInfoPanel) still surfaces for single-active medicines we know, and AI is a
 * last-resort fallback only when the dataset has nothing.
 */
export function MedicineField({
  value,
  onChange,
  onPickStrength,
  onPickDatasetMedicine,
  onPickAiMedicine,
  className,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPickStrength: (strength: string) => void;
  /** A picked real medicine from the India dataset. */
  onPickDatasetMedicine: (m: DatasetMedicine) => void;
  /** A picked AI suggestion (dataset had nothing) — surfaced as an unverified reference. */
  onPickAiMedicine: (m: AiMedicine) => void;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [dsResults, setDsResults] = useState<DatasetMedicine[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [dsDone, setDsDone] = useState(false); // dataset query settled for the current value
  const [aiResults, setAiResults] = useState<AiMedicine[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOff, setAiOff] = useState(false); // no LLM provider → no AI affordance
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justPicked = useRef('');
  const dsReq = useRef(0);
  const aiReq = useRef(0);

  // PRIMARY source: the real India medicines dataset (name prefix). Debounced.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || q === justPicked.current) {
      setDsResults([]); setDsLoading(false); setDsDone(q === justPicked.current);
      return;
    }
    setDsLoading(true); setDsDone(false);
    const id = ++dsReq.current;
    const t = setTimeout(() => {
      void searchMedicines(q)
        .then((r) => { if (id === dsReq.current) setDsResults(r.medicines); })
        .catch(() => { if (id === dsReq.current) setDsResults([]); })
        .finally(() => { if (id === dsReq.current) { setDsLoading(false); setDsDone(true); } });
    }, 250);
    return () => clearTimeout(t);
  }, [value]);

  // FALLBACK: AI, only after the dataset settled with NO results (typos, salts,
  // rare items). Debounced, stale-guarded, suppressed right after a pick.
  useEffect(() => {
    const q = value.trim();
    if (aiOff || dsLoading || !dsDone || dsResults.length > 0 || q.length < 3 || q === justPicked.current) {
      setAiResults([]); setAiLoading(false);
      return;
    }
    setAiLoading(true);
    const id = ++aiReq.current;
    const t = setTimeout(() => {
      void aiMedicineSearch(q)
        .then((r) => {
          if (id !== aiReq.current) return;
          if (!r.enabled) { setAiOff(true); setAiResults([]); }
          else setAiResults(r.medicines);
        })
        .catch(() => { if (id === aiReq.current) setAiResults([]); })
        .finally(() => { if (id === aiReq.current) setAiLoading(false); });
    }, 400);
    return () => clearTimeout(t);
  }, [value, dsLoading, dsDone, dsResults.length, aiOff]);

  const showAi = dsResults.length === 0 && !dsLoading && (aiLoading || aiResults.length > 0);
  const show = open && (dsLoading || dsResults.length > 0 || showAi);

  function pickDataset(m: DatasetMedicine) {
    onChange(m.name);
    const s = compositionStrength(m);
    if (s) onPickStrength(s);
    onPickDatasetMedicine(m);
    justPicked.current = m.name;
    setOpen(false);
  }
  function pickAi(m: AiMedicine) {
    onChange(m.name); // name only — an AI strength/dose is never auto-filled
    onPickAiMedicine(m);
    justPicked.current = m.name;
    setOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <input
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
        onKeyDown={(e) => {
          if (!show) return;
          const navLen = dsResults.length || aiResults.length;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, navLen - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter') {
            if (dsResults.length) { const m = dsResults[active]; if (m) { e.preventDefault(); pickDataset(m); } }
            else if (aiResults.length) { const m = aiResults[active]; if (m) { e.preventDefault(); pickAi(m); } }
          } else if (e.key === 'Escape') { setOpen(false); }
        }}
        className={className}
      />
      {show && (
        <ul
          role="listbox"
          onMouseDown={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}
          className="absolute left-0 top-[calc(100%+4px)] z-40 max-h-[280px] w-[340px] max-w-[82vw] overflow-y-auto overflow-x-hidden rounded-[11px] border border-[#ECEEF4] bg-white py-1 shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]"
        >
          {dsLoading && dsResults.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-2 text-[12px] text-[#94A3B8]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching medicines…
            </li>
          )}
          {dsResults.map((m, i) => (
            <li key={`ds:${m.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => pickDataset(m)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left', i === active ? 'bg-[#F0F3FF]' : 'hover:bg-[#F6F7FB]')}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#E4EBFD] text-[#2B6FF0]">
                  <Pill className="h-[15px] w-[15px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[#0F172A]">{m.name}</span>
                  <span className="block truncate text-[11.5px] text-[#64748B]">{[m.composition1, m.composition2].filter(Boolean).join(' + ') || m.packSize || ''}</span>
                </span>
              </button>
            </li>
          ))}

          {showAi && (
            <>
              <li className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-[#B45309]">
                <Sparkles className="h-3 w-3" /> Not in the catalog — AI suggestions (verify)
              </li>
              {aiLoading && aiResults.length === 0 && (
                <li className="flex items-center gap-2 px-3 py-2 text-[12px] text-[#94A3B8]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                </li>
              )}
              {aiResults.map((m, i) => (
                <li key={`ai:${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onClick={() => pickAi(m)}
                    onMouseEnter={() => setActive(i)}
                    className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left', i === active ? 'bg-[#FFF6E9]' : 'hover:bg-[#FFFBF2]')}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#FEF0D3] text-[#B45309]">
                      <Sparkles className="h-[15px] w-[15px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-[#0F172A]">{m.name}</span>
                      <span className="block truncate text-[11.5px] text-[#64748B]">{[m.drugClass, m.brands.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[#FEF0D3] px-2 py-0.5 text-[10.5px] font-bold text-[#B45309]">AI</span>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Compact drug reference for the selected medicine — usual pediatric dose,
 * age limits, contraindications and cautions from the curated catalog. Always
 * carries the DRAFT / decision-support disclaimer; the prescriber decides.
 */
export function DrugInfoPanel({ drug, status }: { drug: DosingDrug; status?: string }) {
  const d = drug;
  const dose = d.dosing;
  return (
    <div className="mt-1.5 rounded-[10px] border border-[#E7ECF6] bg-[#F8FAFF] px-3 py-2.5 text-[12px] leading-relaxed">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[12.5px] font-bold text-[#0F172A]">{d.name}</span>
        {d.aka && <span className="text-[11.5px] text-[#94A3B8]">({d.aka})</span>}
        <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10.5px] font-semibold text-[#4F46E5]">{d.category}</span>
        <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10.5px] font-medium text-[#64748B]">{d.route}</span>
      </div>

      {dose && (
        <p className="mt-1.5 text-[#334155]">
          <span className="font-semibold text-[#0F172A]">Usual dose:</span>{' '}
          {dose.mgPerKgPerDose.min}–{dose.mgPerKgPerDose.max} mg/kg/dose
          {dose.usualFrequency ? `, ${dose.usualFrequency}` : ''}
          {dose.maxMgPerKgPerDay != null ? ` · max ${dose.maxMgPerKgPerDay} mg/kg/day` : ''}
          {dose.maxDailyDoseMg != null ? ` (≤ ${dose.maxDailyDoseMg} mg/day)` : ''}
        </p>
      )}

      {d.ageFloor && (
        <p className={cn('mt-1.5 flex items-start gap-1.5 font-medium', d.ageFloor.level === 'danger' ? 'text-[#B42318]' : 'text-[#B45309]')}>
          <TriangleAlert className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          <span>{d.ageFloor.reason}</span>
        </p>
      )}

      {d.contraindications.length > 0 && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[#B42318]">
          <ShieldAlert className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          <span><span className="font-semibold">Contraindications:</span> {d.contraindications.join('; ')}</span>
        </p>
      )}

      {d.cautions.length > 0 && (
        <p className="mt-1 text-[#64748B]"><span className="font-semibold text-[#475569]">Cautions:</span> {d.cautions.join('; ')}</p>
      )}

      <p className="mt-2 flex items-start gap-1.5 border-t border-[#E7ECF6] pt-1.5 text-[10.5px] text-[#94A3B8]">
        <ShieldCheck className="mt-[1px] h-3 w-3 shrink-0" />
        {status || 'Decision support only — verify against a current prescribing reference. The prescriber decides.'}
      </p>
    </div>
  );
}

/**
 * Reference for an AI-suggested medicine (one NOT in the curated catalog). Amber
 * on purpose — visually distinct from the trusted catalog panel — and it leads
 * with a strong "AI-generated, unverified" warning. No dose is ever pre-filled
 * from this; the doctor confirms everything and prescribes.
 */
export function AiInfoPanel({ medicine, disclaimer }: { medicine: AiMedicine; disclaimer?: string }) {
  const m = medicine;
  return (
    <div className="mt-1.5 rounded-[10px] border border-[#F5D9A8] bg-[#FFFBF2] px-3 py-2.5 text-[12px] leading-relaxed">
      <p className="flex items-start gap-1.5 text-[11px] font-bold text-[#B45309]">
        <TriangleAlert className="mt-[1px] h-3.5 w-3.5 shrink-0" />
        {disclaimer || 'AI-generated reference — NOT verified. Confirm every detail before prescribing.'}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF0D3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#B45309]"><Sparkles className="h-3 w-3" />AI</span>
        <span className="text-[12.5px] font-bold text-[#0F172A]">{m.name}</span>
        {m.drugClass && <span className="rounded-full bg-[#FEF3E2] px-2 py-0.5 text-[10.5px] font-semibold text-[#B45309]">{m.drugClass}</span>}
        {m.form && <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10.5px] font-medium text-[#64748B]">{m.form}</span>}
      </div>

      {m.brands.length > 0 && <p className="mt-1.5 text-[#334155]"><span className="font-semibold text-[#0F172A]">Common brands:</span> {m.brands.join(', ')}</p>}
      {m.pediatricUse && <p className="mt-1 text-[#334155]"><span className="font-semibold text-[#0F172A]">Use:</span> {m.pediatricUse}</p>}
      {m.typicalDose && <p className="mt-1 text-[#334155]"><span className="font-semibold text-[#0F172A]">Typical dose (reference — verify):</span> {m.typicalDose}</p>}

      {m.contraindications.length > 0 && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[#B42318]">
          <ShieldAlert className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          <span><span className="font-semibold">Contraindications:</span> {m.contraindications.join('; ')}</span>
        </p>
      )}
      {m.cautions.length > 0 && <p className="mt-1 text-[#64748B]"><span className="font-semibold text-[#475569]">Cautions:</span> {m.cautions.join('; ')}</p>}
    </div>
  );
}

/**
 * Factual reference for a medicine picked from the real India dataset —
 * composition, pack and type. It makes no dosing claim (the dataset has none);
 * pediatric dosing, where we have it, shows in a separate DrugInfoPanel.
 */
export function DatasetInfoPanel({ medicine }: { medicine: DatasetMedicine }) {
  const m = medicine;
  const comp = [m.composition1, m.composition2].map((c) => (c ?? '').trim()).filter(Boolean);
  return (
    <div className="mt-1.5 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[12px] leading-relaxed">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#E4EBFD] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2B6FF0]"><Pill className="h-3 w-3" />Medicine</span>
        <span className="text-[12.5px] font-bold text-[#0F172A]">{m.name}</span>
        {m.type && <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10.5px] font-medium capitalize text-[#64748B]">{m.type}</span>}
      </div>
      {comp.length > 0 && <p className="mt-1.5 text-[#334155]"><span className="font-semibold text-[#0F172A]">Composition:</span> {comp.join(' + ')}</p>}
      {m.packSize && <p className="mt-1 text-[#334155]"><span className="font-semibold text-[#0F172A]">Pack:</span> {m.packSize}</p>}
      <p className="mt-2 flex items-start gap-1.5 border-t border-[#E2E8F0] pt-1.5 text-[10.5px] text-[#94A3B8]">
        <ShieldCheck className="mt-[1px] h-3 w-3 shrink-0" />
        Reference: A–Z medicines dataset of India. Confirm strength, form and suitability before prescribing.
      </p>
    </div>
  );
}
