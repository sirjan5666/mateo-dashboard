import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, FlaskConical } from 'lucide-react';
import { ApiError } from '../../api/client';
import { getLabCatalog, interpretLabs } from '../../api/doctorLabs';
import type { LabAnalyte, LabInterpretResult, LabLevel, LabResult } from '../../api/doctorLabs';
import { listPatients } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { Kpi, SectionCard } from '../../components/panel/kit';
import { cn } from '../../lib/cn';
import { useEntrance } from '../../lib/gsap';
import { ageInMonths } from '../../lib/age';

const inputClass =
  'w-full rounded-xl border border-stone-200 bg-[var(--input-background)] px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400';
const labelClass = 'mb-1 block text-[0.66rem] font-bold uppercase tracking-wide text-stone-400';

const LEVEL_META: Record<LabLevel, { label: string; tone: 'amber' | 'rose' | 'emerald'; icon: typeof Check }> = {
  low: { label: 'Low', tone: 'amber', icon: ArrowDownRight },
  high: { label: 'High', tone: 'rose', icon: ArrowUpRight },
  normal: { label: 'Normal', tone: 'emerald', icon: Check },
};

export default function Labs() {
  const rootRef = useEntrance<HTMLDivElement>([]);

  const [age, setAge] = useState('');
  const [analytes, setAnalytes] = useState<LabAnalyte[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<LabInterpretResult | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ageMonths = parseFloat(age);
  const hasAge = age !== '' && ageMonths >= 0 && !Number.isNaN(ageMonths);

  useEffect(() => {
    getLabCatalog()
      .then((d) => setAnalytes(d.analytes))
      .catch(() => setCatalogError(true));
    listPatients()
      .then((d) => setPatients(d.patients.filter((p) => !p.archivedAt && p.dob)))
      .catch(() => undefined);
  }, []);

  const entries = useMemo(
    () => analytes.map((a) => ({ analyteId: a.id, value: parseFloat(values[a.id] ?? '') })).filter((e) => Number.isFinite(e.value)),
    [analytes, values],
  );
  const entriesKey = JSON.stringify(entries);

  useEffect(() => {
    if (!hasAge || entries.length === 0) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      interpretLabs({ ageMonths, results: entries })
        .then((r) => !cancelled && (setResult(r), setError(null)))
        .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not interpret the results'));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // entries is captured via entriesKey; ageMonths via dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageMonths, hasAge, entriesKey]);

  function selectPatient(id: string) {
    const p = patients.find((x) => x.id === id);
    if (p?.dob) setAge(String(ageInMonths(p.dob)));
    setResult(null);
    setError(null);
  }

  const resultByAnalyte = useMemo(() => {
    const m = new Map<string, LabResult>();
    result?.results.forEach((r) => m.set(r.analyteId, r));
    return m;
  }, [result]);

  const categories = useMemo(() => [...new Set(analytes.map((a) => a.category))], [analytes]);

  const lowN = result ? result.results.filter((r) => r.level === 'low').length : 0;
  const highN = result ? result.results.filter((r) => r.level === 'high').length : 0;
  const enteredN = entries.length;

  return (
    <div ref={rootRef} className="space-y-5">
      <Card data-entrance="hero" className="hero-aurora relative overflow-hidden p-6 sm:p-7">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-600">
              <FlaskConical className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">Pediatric reference ranges · draft</p>
              <h1 className="mt-0.5 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-[1.75rem]">Lab interpreter</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelClass}>Age (months)</label>
              <input type="number" inputMode="decimal" min={0} step={1} value={age} onChange={(e) => { setAge(e.target.value); setResult(null); setError(null); }} placeholder="e.g. 9" className={cn(inputClass, 'w-28')} />
            </div>
            {patients.length > 0 && (
              <div>
                <label className={labelClass}>Patient</label>
                <select aria-label="Prefill age from patient" className={cn(inputClass, 'w-auto cursor-pointer font-semibold')} value="" onChange={(e) => e.target.value && selectPatient(e.target.value)}>
                  <option value="">Prefill age…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {catalogError && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Lab reference is unavailable right now.</Card>}
      {error && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {!hasAge && !catalogError && (
        <Card data-entrance="card" className="flex items-center gap-2 p-4 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Enter the child’s age (or pick a patient) — pediatric reference ranges are age-specific.
        </Card>
      )}

      {result && enteredN > 0 && (
        <div className="grid grid-cols-3 gap-3.5">
          <Kpi icon={AlertTriangle} label="Abnormal" value={result.abnormal} sub={`of ${enteredN} entered`} tone="rose" />
          <Kpi icon={ArrowDownRight} label="Low" value={lowN} sub="below range" tone="amber" />
          <Kpi icon={ArrowUpRight} label="High" value={highN} sub="above range" tone="rose" />
        </div>
      )}

      {!catalogError &&
        categories.map((cat) => (
          <SectionCard key={cat} title={cat} icon={FlaskConical} eyebrow="Enter the value you have">
            <div className="space-y-2">
              {analytes
                .filter((a) => a.category === cat)
                .map((a) => {
                  const r = values[a.id] && hasAge ? resultByAnalyte.get(a.id) : undefined;
                  const meta = r ? LEVEL_META[r.level] : null;
                  return (
                    <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border p-3" style={{ borderColor: 'var(--hairline)' }}>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-stone-800">
                          {a.name} <span className="font-medium text-stone-400">· {a.unit}</span>
                        </p>
                        {r && r.refLow != null && r.refHigh != null ? (
                          <p className="text-xs text-stone-400">Ref {r.refLow}–{r.refHigh} {a.unit}{a.note ? ` · ${a.note}` : ''}</p>
                        ) : (
                          a.aka && <p className="text-xs text-stone-400">{a.aka}</p>
                        )}
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        step={a.decimals > 0 ? 0.1 : 1}
                        value={values[a.id] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [a.id]: e.target.value }))}
                        placeholder="value"
                        className={cn(inputClass, 'w-24 text-right')}
                      />
                      {meta ? (
                        <Pill tone={meta.tone} className="min-w-16 justify-center">
                          {meta.label}
                        </Pill>
                      ) : (
                        <span className="inline-block min-w-16" />
                      )}
                    </div>
                  );
                })}
            </div>
          </SectionCard>
        ))}

      <p className="px-1 text-xs leading-relaxed text-stone-400">
        Flags values against <span className="font-semibold">indicative, DRAFT</span> pediatric reference ranges (not clinically validated) for the entered age — it reports low / normal / high, <span className="font-semibold">never a diagnosis</span>. Reference intervals vary by laboratory, assay and population; always confirm against the issuing lab’s ranges and the full clinical picture. Nothing entered here is saved.
      </p>
    </div>
  );
}
