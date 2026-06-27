import { useEffect, useState } from 'react';
import { Activity, BarChart3, CalendarCheck, Stethoscope, UserPlus, Users } from 'lucide-react';
import { ApiError } from '../../api/client';
import { getAnalytics } from '../../api/doctorAnalytics';
import type { Analytics } from '../../api/doctorAnalytics';
import { useT } from '../../i18n/context';
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
  const t = useT();
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
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-stone-400">{t('doctor.analytics.heroEyebrow')}</p>
            <h1 className="mt-0.5 font-display text-2xl font-extrabold leading-tight text-stone-900 sm:text-[1.75rem]">{t('doctor.analytics.title')}</h1>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <Kpi icon={Users} label={t('doctor.analytics.kpiActive')} value={kpis.activePatients} sub={t('doctor.analytics.kpiActiveSub')} tone="sky" />
        <Kpi icon={UserPlus} label={t('doctor.analytics.kpiNew')} value={kpis.newThisMonth} sub={t('doctor.analytics.kpiNewSub')} tone="violet" />
        <Kpi icon={Stethoscope} label={t('doctor.analytics.kpiVisits')} value={kpis.encountersThisMonth} sub={t('doctor.analytics.kpiVisitsSub')} tone="emerald" />
        <Kpi
          icon={CalendarCheck}
          label={t('doctor.analytics.kpiAttendance')}
          value={kpis.apptCompletionPct ?? 0}
          suffix="%"
          tone="amber"
          sub={kpis.apptCompletionPct == null ? t('doctor.analytics.kpiAttendanceNone') : t('doctor.analytics.kpiAttendanceSub')}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title={t('doctor.analytics.newPatients')} eyebrow={t('doctor.analytics.perMonth')} icon={UserPlus}>
          <BarTrend data={data.patientsByMonth} xKey="month" barKey="count" height={220} highlightIndex={data.patientsByMonth.length - 1} />
        </SectionCard>

        <SectionCard title={t('doctor.analytics.visitNotes')} eyebrow={t('doctor.analytics.perMonth')} icon={Stethoscope}>
          <AreaTrend data={data.encountersByMonth} xKey="month" series={[{ key: 'count', name: t('doctor.analytics.visitNotes'), color: theme.brand2 }]} height={220} />
        </SectionCard>

        <SectionCard title={t('doctor.analytics.ageDist')} icon={Activity}>
          {totalAge === 0 ? (
            <EmptyState icon={Users} text={t('doctor.analytics.noPatients')} />
          ) : (
            <Donut data={donutData(ageRows, theme)} centerValue={totalAge} centerLabel={t('doctor.analytics.children')} />
          )}
        </SectionCard>

        <SectionCard title={t('doctor.analytics.byStatus')} icon={Users}>
          {totalStatus === 0 ? (
            <EmptyState icon={Users} text={t('doctor.analytics.noPatients')} />
          ) : (
            <Donut data={donutData(statusRows, theme)} centerValue={totalStatus} centerLabel={t('doctor.analytics.patients')} />
          )}
        </SectionCard>

        <SectionCard title={t('doctor.analytics.visitTypes')} eyebrow={t('doctor.analytics.allEncounters')} icon={Stethoscope}>
          {totalKind === 0 ? (
            <EmptyState icon={Stethoscope} text={t('doctor.analytics.noVisits')} />
          ) : (
            <div className="space-y-3">
              {data.encounterKinds.map((k, i) => (
                <BarRow key={k.kind} label={titleCase(k.kind)} value={k.count} total={totalKind} color={KIND_COLORS[i % KIND_COLORS.length]} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={t('doctor.analytics.outcomes')} eyebrow={t('doctor.analytics.followupCompliance')} icon={CalendarCheck}>
          {totalOutcome === 0 ? (
            <EmptyState icon={CalendarCheck} text={t('doctor.analytics.noAppts')} />
          ) : (
            <Donut data={donutData(outcomeRows, theme)} centerValue={totalOutcome} centerLabel={t('doctor.analytics.appts')} />
          )}
        </SectionCard>
      </div>

      <p className="px-1 text-xs leading-relaxed text-stone-400">{t('doctor.analytics.disclaimer')}</p>
    </div>
  );
}
