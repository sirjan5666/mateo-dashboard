import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Stethoscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getDosingCatalog, checkDose } from '../api/dosing';
import type { DosingBrand, DosingDrug, DoseCheckResponse, DoseLevel } from '../api/dosing';
import { ApiError } from '../api/client';
import { inputCls } from './ui/field';
import { cn } from '../lib/cn';

const LEVEL_UI: Record<DoseLevel, { box: string; icon: LucideIcon; iconColor: string }> = {
  ok: { box: 'border-green-200 bg-green-50 text-green-800', icon: CheckCircle2, iconColor: 'text-green-600' },
  info: { box: 'border-stone-200 bg-stone-50 text-stone-700', icon: Info, iconColor: 'text-stone-500' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle, iconColor: 'text-amber-600' },
  danger: { box: 'border-rose-200 bg-rose-50 text-rose-700', icon: AlertCircle, iconColor: 'text-rose-600' },
};

// Doctor decision-support: pick a drug/brand, enter the dose, and see whether it
// fits this baby's weight + age. Server-side deterministic check (DRAFT data).
export function DoseCheck({ consultationId }: { consultationId: string }) {
  const [drugs, setDrugs] = useState<DosingDrug[]>([]);
  const [brands, setBrands] = useState<DosingBrand[]>([]);
  const [catalogError, setCatalogError] = useState(false);

  const [sel, setSel] = useState('');
  const [qty, setQty] = useState('1');
  const [mg, setMg] = useState('');
  const [perDay, setPerDay] = useState('');

  const [resp, setResp] = useState<DoseCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDosingCatalog()
      .then((d) => {
        if (cancelled) return;
        setDrugs(d.drugs);
        setBrands(d.brands);
      })
      .catch(() => !cancelled && setCatalogError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const brand = useMemo(() => (sel.startsWith('brand:') ? brands.find((b) => b.id === sel.slice(6)) : undefined), [sel, brands]);
  const drug = useMemo(() => (sel.startsWith('drug:') ? drugs.find((d) => d.id === sel.slice(5)) : undefined), [sel, drugs]);
  const strength = brand?.strengths[0];
  const drugId = brand ? strength?.drugId : drug?.id;

  const qtyNum = parseFloat(qty);
  const mgNum = parseFloat(mg);
  const perDayNum = parseInt(perDay, 10);
  const doseMg = brand
    ? strength && qtyNum > 0
      ? Math.round(qtyNum * strength.mg * 100) / 100
      : undefined
    : mgNum > 0
      ? mgNum
      : undefined;

  useEffect(() => {
    if (!drugId) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      checkDose({ consultationId, drugId, doseMg, dosesPerDay: perDayNum > 0 ? perDayNum : undefined })
        .then((r) => !cancelled && (setResp(r), setError(null)))
        .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not check the dose.'));
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [consultationId, drugId, doseMg, perDayNum]);

  if (catalogError) return null; // reference unavailable — never block prescribing

  const result = resp?.result;
  const resolved = resp?.resolved;
  const ui = result ? LEVEL_UI[result.level] : null;
  const Icon = ui?.icon;

  return (
    <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex items-center gap-2">
        <Stethoscope className="h-4 w-4 text-violet-700" />
        <h4 className="font-display text-sm font-bold text-stone-900">Dose safety check</h4>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-amber-800">Reference · draft</span>
      </div>
      <p className="mt-1 text-xs text-stone-500">Checks the dose against this baby&apos;s weight &amp; age. Decision-support only — verify against current references; you remain responsible.</p>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="block text-xs font-medium text-stone-600">Medicine</span>
          <select
            value={sel}
            onChange={(e) => {
              setSel(e.target.value);
              setResp(null);
              setError(null);
            }}
            className={inputCls}
          >
            <option value="">Select a medicine…</option>
            <optgroup label="Brands">
              {brands.map((b) => (
                <option key={b.id} value={`brand:${b.id}`}>
                  {b.name} · {b.strengths[0].mg} mg/{b.strengths[0].per}
                </option>
              ))}
            </optgroup>
            <optgroup label="Generic">
              {drugs.map((d) => (
                <option key={d.id} value={`drug:${d.id}`}>
                  {d.name}
                  {d.aka ? ` (${d.aka})` : ''}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        {brand && strength ? (
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">{strength.per === 'ml' ? 'Millilitres (ml)' : 'Tablets'} per dose</span>
            <input value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} inputMode="decimal" />
          </label>
        ) : drug ? (
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">Dose (mg)</span>
            <input value={mg} onChange={(e) => setMg(e.target.value)} className={inputCls} inputMode="decimal" />
          </label>
        ) : null}

        {(brand || drug) && (
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">Times per day</span>
            <input value={perDay} onChange={(e) => setPerDay(e.target.value)} className={inputCls} inputMode="numeric" placeholder="e.g. 3" />
          </label>
        )}
      </div>

      {brand && strength && doseMg != null && (
        <p className="mt-2 text-xs text-stone-500">
          = <span className="font-semibold text-stone-700">{doseMg} mg</span> per dose
        </p>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {result && ui && Icon && (
        <div className={cn('mt-3 rounded-xl border p-3', ui.box)}>
          <div className="flex items-start gap-2">
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ui.iconColor)} />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">
                {resolved?.babyName ? `${resolved.babyName} · ` : ''}
                {resolved?.weightKg != null ? `${resolved.weightKg} kg` : 'weight not logged'} · {resolved?.ageMonths} mo
              </p>
              {result.recommendedSingleMg && (
                <p className="mt-0.5 text-stone-600">
                  Usual single dose <span className="font-semibold text-stone-800">{result.recommendedSingleMg.min}–{result.recommendedSingleMg.max} mg</span>
                  {result.usualFrequency ? `, ${result.usualFrequency}` : ''}
                  {result.recommendedDailyMaxMg != null ? ` · max ${result.recommendedDailyMaxMg} mg/day` : ''}
                </p>
              )}
              <ul className="mt-1.5 space-y-1">
                {result.messages.map((m, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                    <span>{m.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {result && (result.contraindications.length > 0 || result.cautions.length > 0) && (
        <div className="mt-2.5 rounded-xl border border-stone-200 bg-white p-3 text-xs">
          {result.contraindications.length > 0 && (
            <>
              <p className="font-semibold text-stone-700">Check before prescribing</p>
              <ul className="mt-1 space-y-0.5 text-stone-600">
                {result.contraindications.map((c) => (
                  <li key={c} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" /> {c}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.cautions.length > 0 && <p className="mt-2 leading-relaxed text-stone-400">{result.cautions.join(' · ')}</p>}
        </div>
      )}
    </div>
  );
}
