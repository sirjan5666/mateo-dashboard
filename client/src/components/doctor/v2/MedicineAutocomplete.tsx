import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pill, ShieldAlert, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { aiMedicineSearch } from '../../../api/dosing';
import type { AiMedicine, DosingBrand, DosingDrug } from '../../../api/dosing';
import { cn } from '../../../lib/cn';

// The doctor-only pediatric dosing catalog (curated data — never LLM-generated).
export interface DosingCatalog {
  status: string;
  drugs: DosingDrug[];
  brands: DosingBrand[];
}

interface Match {
  kind: 'brand' | 'drug';
  id: string;
  label: string; // brand name or generic name
  sub: string; // composition / category line
  drug: DosingDrug; // the underlying generic (for info + dose reference)
  strength?: string; // for brands → pre-fills the strength cell
}

/** A brand's per-pack strength as prescription-friendly text (syrups are per 5 ml). */
function strengthText(b: DosingBrand): string {
  const s = b.strengths[0];
  if (!s) return '';
  return s.per === 'tablet' ? `${s.mg} mg` : `${s.mg * 5} mg / 5 ml`;
}

/** Resolve typed text back to a catalog generic — so info shows even without a click. */
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

function buildMatches(query: string, catalog: DosingCatalog): Match[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const byId = new Map(catalog.drugs.map((d) => [d.id, d]));
  const out: Match[] = [];
  // Brands first — doctors most often type the brand (Dolo, Azithral…).
  for (const b of catalog.brands) {
    const d = byId.get(b.strengths[0]?.drugId ?? '');
    if (!d) continue;
    if (`${b.name} ${d.name} ${d.aka ?? ''}`.toLowerCase().includes(q)) {
      out.push({ kind: 'brand', id: b.id, label: b.name, sub: `${d.name} · ${b.form} ${strengthText(b)}`, drug: d, strength: strengthText(b) });
    }
  }
  // Then generics.
  for (const d of catalog.drugs) {
    if (`${d.name} ${d.aka ?? ''}`.toLowerCase().includes(q)) {
      out.push({ kind: 'drug', id: d.id, label: d.name, sub: d.category, drug: d });
    }
  }
  return out.slice(0, 8);
}

/**
 * The medicine name cell in the prescribe form, upgraded to a typeahead over the
 * curated pediatric catalog. Free text is always allowed — the dropdown only
 * assists; picking a brand also fills the strength cell. All shown values are
 * DRAFT decision-support (see DrugInfoPanel), never LLM-generated.
 */
export function MedicineField({
  value,
  onChange,
  onPickStrength,
  onPickAiMedicine,
  catalog,
  className,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPickStrength: (strength: string) => void;
  /** A picked AI suggestion (not in the curated catalog) — surfaced as an unverified reference. */
  onPickAiMedicine: (m: AiMedicine) => void;
  catalog: DosingCatalog | null;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [aiResults, setAiResults] = useState<AiMedicine[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOff, setAiOff] = useState(false); // no LLM provider configured → no AI affordance
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justPicked = useRef('');
  const reqId = useRef(0);

  const matches = useMemo(() => (catalog ? buildMatches(value, catalog) : []), [value, catalog]);

  // AI fallback runs ONLY when the query isn't in our curated catalog. Debounced,
  // stale-guarded (reqId), and suppressed right after a pick so it can't re-fire
  // on the name we just filled in.
  useEffect(() => {
    const q = value.trim();
    if (aiOff || matches.length > 0 || q.length < 3 || q === justPicked.current) {
      setAiResults([]);
      setAiLoading(false);
      return;
    }
    setAiLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(() => {
      void aiMedicineSearch(q)
        .then((r) => {
          if (id !== reqId.current) return; // a newer keystroke superseded this
          if (!r.enabled) { setAiOff(true); setAiResults([]); }
          else setAiResults(r.medicines);
        })
        .catch(() => { if (id === reqId.current) setAiResults([]); })
        .finally(() => { if (id === reqId.current) setAiLoading(false); });
    }, 450);
    return () => clearTimeout(t);
  }, [value, matches.length, aiOff]);

  const showAi = matches.length === 0 && (aiLoading || aiResults.length > 0);
  const show = open && (matches.length > 0 || showAi);

  function pick(m: Match) {
    onChange(m.label);
    if (m.strength) onPickStrength(m.strength);
    justPicked.current = m.label;
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
          const navLen = matches.length || aiResults.length;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, navLen - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter') {
            if (matches.length) { const m = matches[active]; if (m) { e.preventDefault(); pick(m); } }
            else if (aiResults.length) { const m = aiResults[active]; if (m) { e.preventDefault(); pickAi(m); } }
          } else if (e.key === 'Escape') { setOpen(false); }
        }}
        className={className}
      />
      {show && (
        <ul
          role="listbox"
          onMouseDown={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}
          className="absolute left-0 top-[calc(100%+4px)] z-40 max-h-[280px] w-[320px] max-w-[82vw] overflow-y-auto overflow-x-hidden rounded-[11px] border border-[#ECEEF4] bg-white py-1 shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]"
        >
          {matches.map((m, i) => (
            <li key={`${m.kind}:${m.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => pick(m)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left', i === active ? 'bg-[#F0F3FF]' : 'hover:bg-[#F6F7FB]')}
              >
                <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-[8px]', m.kind === 'brand' ? 'bg-[#E4EBFD] text-[#2B6FF0]' : 'bg-[#EDE9FE] text-[#6D4FF0]')}>
                  <Pill className="h-[15px] w-[15px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[#0F172A]">{m.label}</span>
                  <span className="block truncate text-[11.5px] text-[#64748B]">{m.sub}</span>
                </span>
                {m.kind === 'brand' && <span className="shrink-0 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10.5px] font-semibold text-[#64748B]">Brand</span>}
              </button>
            </li>
          ))}

          {showAi && (
            <>
              <li className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-[#B45309]">
                <Sparkles className="h-3 w-3" /> AI suggestions — verify
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
