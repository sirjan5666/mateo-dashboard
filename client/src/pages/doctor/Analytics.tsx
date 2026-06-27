import { useEffect, useState } from 'react';
import { Activity, BarChart3, CalendarCheck, Stethoscope, UserPlus, Users } from 'lucide-react';
import { ApiError } from '../../api/client';
import { getAnalytics } from '../../api/doctorAnalytics';
import type { Analytics } from '../../api/doctorAnalytics';
import { Card } from '../../components/ui/Card';
import {
  AreaTrend,
  BarRow,
  BarTrend,
  Donut,
  EmptyState,
  Kpi,
  SectionCard,
  SkeletonChart,
  SkeletonKpi,
  useChartTheme,
} from '../../components/panel/kit';
import type { ChartTheme } from '../../components/panel/kit';
import { useEntrance } from '../../lib/gsap';

const titleCase = (s: string) => (s || '—').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function donutData(rows: { label: string; count: number }[], theme: ChartTheme) {
  return rows.map((r, i) => ({ label: r.label, value: r.count, color: theme.series[i % theme.series.length] }));
}

export default function AnalyticsPage() {
  const rootRef = useEntrance<HTMLDivElement>([]);
  const theme = useChartTheme();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAnalytics()
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load analytics'));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>;

  if (!data) {
    return (
      <div className="space-y-5">
        <Card className="p-6 sm:p-7">
          <div className="h-3 w-32 animate-pulse rounded bg-stone-200/70" />
          <div className="mt-3 h-8 w-56 animate-pulse rounded bg-stone-200/70" />
        </Card>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonKpi key={i} />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonChart key={i} height={220} />
          ))}
        </div>
      </div>
    );
  }

  const { kpis } = data;
  const totalStatus = data.statusBreakdown.reduce((s, r) => s + r.count, 0);
  const totalAge = data.ageGroups.reduce((s, r) => s + r.count, 0);
  const totalOutcome = data.appointmentOutcomes.reduce((s, r) => s + r.count, 0);
  const totalKind = data.encounterKinds.reduce((s, r) => s + r.count, 0);
  const ageRows = data.ageGroups.map((a) => ({ label: a.label, count: a.count }));
  const statusRows = data.statusBreakdown.map((s) => ({ label: titleCase(s.status), count: s.count }));
  const outcomeRows = data.appointmentOutcomes.map((a) => ({ label: titleCase(a.status), count: a.count }));

  const KIND_COLORS = [theme.brand, theme.brand2, theme.green, theme.amber, theme.sky];

  return (
    <div ref={rootRef} className="space-y-5">
      <Card data-entrance="hero" className="hero-aurora relative overflow-hidden p-6 sm:p-7">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-600">
            <BarChart3 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">Your practice · last 6 months</p>
            <h1 className="mt-0.5 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-[1.75rem]">Practice analytics</h1>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <Kpi icon={Users} label="Active patients" value={kpis.activePatients} sub="in your care" tone="sky" />
        <Kpi icon={UserPlus} label="New" value={kpis.newThisMonth} sub="this month" tone="violet" />
        <Kpi icon={Stethoscope} label="Visit notes" value={kpis.encountersThisMonth} sub="this month" tone="emerald" />
        <Kpi
          icon={CalendarCheck}
          label="Attendance"
          value={kpis.apptCompletionPct ?? 0}
          suffix="%"
          tone="amber"
          sub={kpis.apptCompletionPct == null ? 'no completed visits yet' : 'completed vs no-show'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="New patients" eyebrow="Per month" icon={UserPlus}>
          <BarTrend data={data.patientsByMonth} xKey="month" barKey="count" height={220} highlightIndex={data.patientsByMonth.length - 1} />
        </SectionCard>

        <SectionCard title="Visit notes" eyebrow="Per month" icon={Stethoscope}>
          <AreaTrend data={data.encountersByMonth} xKey="month" series={[{ key: 'count', name: 'Visit notes', color: theme.brand2 }]} height={220} />
        </SectionCard>

        <SectionCard title="Age distribution" icon={Activity}>
          {totalAge === 0 ? <EmptyState icon={Users} text="No patients yet." /> : <Donut data={donutData(ageRows, theme)} centerValue={totalAge} centerLabel="children" />}
        </SectionCard>

        <SectionCard title="Patients by status" icon={Users}>
          {totalStatus === 0 ? <EmptyState icon={Users} text="No patients yet." /> : <Donut data={donutData(statusRows, theme)} centerValue={totalStatus} centerLabel="patients" />}
        </SectionCard>

        <SectionCard title="Visit types" eyebrow="All encounters" icon={Stethoscope}>
          {totalKind === 0 ? (
            <EmptyState icon={Stethoscope} text="No visit notes yet." />
          ) : (
            <div className="space-y-3">
              {data.encounterKinds.map((k, i) => (
                <BarRow key={k.kind} label={titleCase(k.kind)} value={k.count} total={totalKind} color={KIND_COLORS[i % KIND_COLORS.length]} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Appointment outcomes" eyebrow="Follow-up compliance" icon={CalendarCheck}>
          {totalOutcome === 0 ? <EmptyState icon={CalendarCheck} text="No appointments yet." /> : <Donut data={donutData(outcomeRows, theme)} centerValue={totalOutcome} centerLabel="appts" />}
        </SectionCard>
      </div>

      <p className="px-1 text-xs leading-relaxed text-stone-400">
        Aggregated across your own patients only. Counts are computed live from your records — no individual patient data leaves this view. Vaccination statistics aren’t shown because vaccine administration isn’t recorded in the EHR yet.
      </p>
    </div>
  );
}
