import { lazy, Suspense, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Patient } from '../../api/doctorPatients';
import { Tabs } from '../ui/Tabs';
import type { TabItem } from '../ui/Tabs';
import { Skeleton } from '../ui/Skeleton';
import { ageInMonths } from '../../lib/age';
import { cn } from '../../lib/cn';
import type { ToolPatient } from './tools/types';

// The six clinical tools, each lazily loaded so its bundle only downloads when a
// doctor actually opens that sub-tab (Growth pulls in recharts, ~350 kB — this
// keeps it out of the initial doctor/PatientDetail load). Every tool renders in
// "embedded" mode here: fed the patient, no standalone header/picker.
const GrowthCharts = lazy(() => import('../../pages/doctor/GrowthCharts'));
const Vaccinations = lazy(() => import('../../pages/doctor/Vaccinations'));
const Development = lazy(() => import('../../pages/doctor/Development'));
const DoseCalculator = lazy(() => import('../../pages/doctor/DoseCalculator'));
const Labs = lazy(() => import('../../pages/doctor/Labs'));
const Neonatology = lazy(() => import('../../pages/doctor/Neonatology'));

type ToolTab = 'growth' | 'vaccines' | 'development' | 'dose' | 'labs' | 'neonatology';

const TOOL_FALLBACK = (
  <div className="space-y-3">
    <Skeleton className="h-9 w-40" />
    <Skeleton className="h-64 w-full" />
  </div>
);

/**
 * The per-patient clinical workspace: every decision-support tool (WHO growth,
 * IAP vaccines, development, dose, labs, neonatology) computed for THIS child in
 * one place, so the doctor never leaves the patient. An inner sub-tab bar keeps
 * the patient's primary tabs (record/encounters/…) uncluttered. Tools mount on
 * first visit and stay mounted, so a half-entered worksheet survives switching.
 */
export function ClinicalToolsWorkspace({ patient }: { patient: Patient }) {
  const toolPatient: ToolPatient = { dob: patient.dob ?? null, sex: patient.sex };

  // Neonatology (corrected age / day-of-life fluids) is only meaningful for young
  // infants — surface it only when the child is under ~6 months.
  const ageMo = patient.dob ? ageInMonths(patient.dob) : null;
  const showNeo = ageMo != null && ageMo < 6;
  const defaultTab: ToolTab = showNeo ? 'neonatology' : 'growth';

  const tabs = useMemo<TabItem<ToolTab>[]>(() => {
    const base: TabItem<ToolTab>[] = [
      { value: 'growth', label: 'Growth' },
      { value: 'vaccines', label: 'Vaccines' },
      { value: 'development', label: 'Development' },
      { value: 'dose', label: 'Dose' },
      { value: 'labs', label: 'Labs' },
    ];
    if (showNeo) base.push({ value: 'neonatology', label: 'Neonatology' });
    return base;
  }, [showNeo]);

  const [tab, setTab] = useState<ToolTab>(defaultTab);
  // Mark a tool "seen" the moment its tab is chosen (in the handler, not an
  // effect) so it mounts on first visit and stays mounted afterwards — a
  // half-entered worksheet survives switching sub-tabs.
  const [seen, setSeen] = useState<Set<ToolTab>>(() => new Set<ToolTab>([defaultTab]));
  const selectTab = (v: ToolTab) => {
    setTab(v);
    setSeen((s) => (s.has(v) ? s : new Set(s).add(v)));
  };

  const panel = (key: ToolTab, node: ReactNode) =>
    seen.has(key) ? (
      <div key={key} className={cn(tab !== key && 'hidden')}>
        <Suspense fallback={TOOL_FALLBACK}>{node}</Suspense>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <Tabs<ToolTab> items={tabs} value={tab} onChange={selectTab} />
      </div>
      {panel('growth', <GrowthCharts patient={toolPatient} />)}
      {panel('vaccines', <Vaccinations patient={toolPatient} />)}
      {panel('development', <Development patient={toolPatient} />)}
      {panel('dose', <DoseCalculator patient={toolPatient} />)}
      {panel('labs', <Labs patient={toolPatient} />)}
      {showNeo && panel('neonatology', <Neonatology patient={toolPatient} />)}
    </div>
  );
}
