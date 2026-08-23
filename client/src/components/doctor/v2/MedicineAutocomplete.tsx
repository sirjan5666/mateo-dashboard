import { useMemo, useRef, useState } from 'react';
import { Pill, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { DosingBrand, DosingDrug } from '../../../api/dosing';
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
  catalog,
  className,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPickStrength: (strength: string) => void;
  catalog: DosingCatalog | null;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => (catalog ? buildMatches(value, catalog) : []), [value, catalog]);
  const show = open && matches.length > 0;

  function pick(m: Match) {
    onChange(m.label);
    if (m.strength) onPickStrength(m.strength);
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
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); const m = matches[active]; if (m) pick(m); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
        className={className}
      />
      {show && (
        <ul
          role="listbox"
          onMouseDown={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}
          className="absolute left-0 top-[calc(100%+4px)] z-40 max-h-[248px] w-[300px] max-w-[82vw] overflow-y-auto overflow-x-hidden rounded-[11px] border border-[#ECEEF4] bg-white py-1 shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]"
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
