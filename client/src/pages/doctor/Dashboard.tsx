import { useEffect, useState } from 'react';
import { Calendar, ChevronDown, SlidersHorizontal, Sun } from 'lucide-react';
import { useAuth } from '../../auth/context';
import { useActiveLocation } from '../../lib/doctorLocation';
import { KPIS, kpiValuesFor, subtitleFor } from '../../data/doctorDashboard';
import type { DashboardStats } from '../../data/doctorDashboard';
import { getOverview } from '../../api/doctorOverview';
import { getBillingSummary } from '../../api/doctorBilling';
import { KpiCard } from '../../components/doctor/v2/KpiCard';
import { AppointmentsOverview, NewVsReturning, PatientDemographics, TopVisitReasons } from '../../components/doctor/v2/charts';
import { AlertsReminders, RecentPatients, TodaysSchedule } from '../../components/doctor/v2/panels';

/** First name only — "Good morning, Dr. Ananya". */
function greetingName(fullName?: string | null): string {
  const cleaned = (fullName ?? '').replace(/^Dr\.?\s*/i, '').trim();
  const first = cleaned.split(/\s+/)[0];
  return first ? `Dr. ${first}` : 'Doctor';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { activeId, active, clinics } = useActiveLocation();
  const overall = activeId === 'overall';

  // Real practice figures. A failure leaves `stats` null, which renders em
  // dashes — never a placeholder count on a clinical dashboard.
  const [stats, setStats] = useState<DashboardStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [overview, billing] = await Promise.all([getOverview(), getBillingSummary()]);
        if (cancelled) return;
        setStats({
          upcoming: overview.counts.upcoming,
          // "Ongoing" = today's appointments that have started but not finished.
          ongoing: overview.today.filter((a) => a.status === 'scheduled' && new Date(a.start) <= new Date()).length,
          patients: overview.counts.activePatients,
          revenueMtd: billing.collectedMonth,
          revenueToday: billing.collectedToday,
        });
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const values = kpiValuesFor(stats);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold leading-8 tracking-[-0.02em] text-[#0F172A]">
            Good morning, {greetingName(user?.name)}
            <Sun className="h-5 w-5 shrink-0 text-[#F59E0B]" />
          </h1>
          <p className="mt-1.5 text-sm text-[#64748B]">{subtitleFor(activeId, active.name, clinics.length)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="flex h-11 w-[246px] items-center gap-2.5 rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 transition-colors hover:bg-[#F7F8FC]"
          >
            <Calendar className="h-[17px] w-[17px] shrink-0 text-[#3B4FE0]" />
            <span className="flex-1 text-left text-sm font-semibold text-[#0F172A]">Thursday, 8 May 2025</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#94A3B8]" />
          </button>
          <button
            type="button"
            className="flex h-11 items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-[18px] transition-colors hover:bg-[#F7F8FC]"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#3B4FE0]" />
            <span className="text-sm font-semibold text-[#0F172A]">Filter</span>
          </button>
        </div>
      </div>

      {/* KPI row — Upcoming · Ongoing · Total Patients · Total Revenue · Today's Revenue */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {KPIS.map((kpi) => (
          <KpiCard key={kpi.id} kpi={{ ...kpi, value: values[kpi.id] ?? kpi.value }} overallNote={overall} />
        ))}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.06fr_1.15fr_0.95fr]">
        <PatientDemographics />
        <NewVsReturning />
        <div className="flex flex-col gap-5">
          <TodaysSchedule />
          <AlertsReminders />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[0.92fr_1.08fr_1.30fr]">
        <AppointmentsOverview />
        <TopVisitReasons />
        <div className="lg:col-span-2 xl:col-span-1">
          <RecentPatients />
        </div>
      </div>
    </div>
  );
}
