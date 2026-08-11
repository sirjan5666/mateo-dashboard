import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, ClipboardList, TrendingUp, Users, UsersRound } from 'lucide-react';
import { ChartData, LinkArrow, Panel, PanelHead, SelectPill } from './kit';

const AXIS = '#64748B';
const GRID = '#EEF1F6';

/** One-decimal percentage, rounded half-up. Rows may sum to 99.9–100.1 by design. */
function pct(value: number, total: number): string {
  return `${(Math.round((value / total) * 1000) / 10).toFixed(1)}%`;
}

interface TipItem {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
}

function TrendTip({ active, payload, label }: { active?: boolean; payload?: TipItem[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[8px] border border-[#ECEEF4] bg-white px-3 py-2 shadow-[0_12px_28px_-14px_rgba(16,24,40,.3)]">
      <p className="text-xs font-bold text-[#0F172A]">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="mt-1 flex items-center gap-1.5 text-xs text-[#475569]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-bold tabular-nums text-[#0F172A]">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Donut with a centred metric. Sweeps clockwise from 12 o'clock. */
function Donut({
  data,
  outer,
  inner,
  centreValue,
  centreLabel,
  size,
}: {
  data: { label: string; value: number; color: string }[];
  outer: number;
  inner: number;
  centreValue: string;
  centreLabel: string;
  size: number;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={inner}
            outerRadius={outer}
            startAngle={90}
            endAngle={-270}
            paddingAngle={0}
            stroke="none"
            isAnimationActive
            animationDuration={700}
          >
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display font-extrabold leading-none tracking-[-0.02em] text-[#0F172A] tabular-nums" style={{ fontSize: size > 180 ? 24 : 22 }}>
            {centreValue}
          </p>
          <p className="mt-1 text-[11px] font-medium text-[#64748B]">{centreLabel}</p>
        </div>
      </div>
    </div>
  );
}

function LegendRow({ label, color, value, percent, height = 36 }: { label: string; color: string; value: number; percent: string; height?: number }) {
  return (
    <li className="flex items-center gap-2.5" style={{ height }}>
      <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#475569]">{label}</span>
      <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#0F172A]">{value.toLocaleString('en-IN')}</span>
      <span className="w-[52px] shrink-0 text-right text-xs font-medium tabular-nums text-[#64748B]">({percent})</span>
    </li>
  );
}

// ── Patient Demographics ─────────────────────────────────────────────────────

export interface Slice { label: string; value: number; color: string }
export interface TrendPoint { label: string; new: number; returning: number }
export interface Reason { label: string; value: number }

export function PatientDemographics({ data }: { data: Slice[] }) {
  const DEMOGRAPHICS = data;
  const DEMOGRAPHICS_TOTAL = data.reduce((t, d) => t + d.value, 0);
  return (
    <Panel className="flex flex-col">
      <PanelHead icon={Users} title="Patient Demographics" info right={<SelectPill label="This Month" />} />

      <div className="flex flex-1 flex-wrap items-center gap-5 px-5 py-4 sm:flex-nowrap">
        <Donut
          data={DEMOGRAPHICS}
          outer={78}
          inner={56}
          size={180}
          centreValue={DEMOGRAPHICS_TOTAL.toLocaleString('en-IN')}
          centreLabel="Total Patients"
        />
        <ul className="min-w-[220px] flex-1">
          {DEMOGRAPHICS.map((d) => (
            <LegendRow key={d.label} label={d.label} color={d.color} value={d.value} percent={pct(d.value, DEMOGRAPHICS_TOTAL)} />
          ))}
        </ul>
      </div>

      <div className="mx-5 mb-5 mt-auto flex items-center gap-2.5 rounded-[10px] bg-[#F6F7FB] px-3.5 py-2.5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-[#EEF2FF]">
          <UsersRound className="h-3.5 w-3.5 text-[#3B4FE0]" />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-[#64748B]">
          Most patients in: <span className="font-bold text-[#0F172A]">1 – 5 years</span>
        </p>
        <LinkArrow to="/doctor/patients" label="View full report" />
      </div>

      <ChartData
        caption="Patient demographics by age band"
        columns={['Age band', 'Patients', 'Share']}
        rows={DEMOGRAPHICS.map((d) => [d.label, d.value, pct(d.value, DEMOGRAPHICS_TOTAL)])}
      />
    </Panel>
  );
}

// ── New vs Returning ─────────────────────────────────────────────────────────

const TREND_TICKS = ['1 May', '8 May', '15 May', '22 May', '31 May'];

export function NewVsReturning({ data }: { data: TrendPoint[] }) {
  const VISIT_TREND = data;
  const TOTAL_NEW = data.reduce((t, d) => t + d.new, 0);
  const TOTAL_RETURNING = data.reduce((t, d) => t + d.returning, 0);
  const RETURNING_SHARE = TOTAL_NEW + TOTAL_RETURNING > 0
    ? Math.round((TOTAL_RETURNING / (TOTAL_NEW + TOTAL_RETURNING)) * 100)
    : 0;
  return (
    <Panel className="flex flex-col">
      <PanelHead icon={TrendingUp} title="New vs Returning Patients" iconColor="#3B4FE0" solid info right={<SelectPill label="This Month" />} />

      {/* Returning is listed first because it is the upper series. */}
      <div className="flex items-center gap-5 px-5 pt-3">
        <span className="flex items-center gap-2 text-xs font-medium text-[#475569]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
          Returning Patients
        </span>
        <span className="flex items-center gap-2 text-xs font-medium text-[#475569]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3B4FE0]" />
          New Patients
        </span>
      </div>

      <div className="px-2 pt-2">
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={VISIT_TREND} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="dashReturning" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22C55E" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dashNew" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B4FE0" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#3B4FE0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="label"
              ticks={TREND_TICKS}
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis ticks={[0, 20, 40, 60, 80]} domain={[0, 80]} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              content={(props) => (
                <TrendTip active={props.active} payload={props.payload as unknown as TipItem[]} label={props.label as string | number} />
              )}
              cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="returning"
              name="Returning"
              stroke="#22C55E"
              strokeWidth={2}
              fill="url(#dashReturning)"
              dot={{ r: 3, fill: '#22C55E', stroke: '#FFFFFF', strokeWidth: 1.5 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              animationDuration={700}
            />
            <Area
              type="monotone"
              dataKey="new"
              name="New"
              stroke="#3B4FE0"
              strokeWidth={2}
              fill="url(#dashNew)"
              dot={{ r: 3, fill: '#3B4FE0', stroke: '#FFFFFF', strokeWidth: 1.5 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              animationDuration={700}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-auto border-t border-[#F1F3F9] px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <p className="text-xs font-medium text-[#475569]">
            Total Returning: <span className="font-bold tabular-nums text-[#16A34A]">{TOTAL_RETURNING.toLocaleString('en-IN')}</span>
          </p>
          <p className="text-xs font-medium text-[#475569]">
            Total New: <span className="font-bold tabular-nums text-[#3B4FE0]">{TOTAL_NEW.toLocaleString('en-IN')}</span>
          </p>
          <span className="ml-auto">
            <LinkArrow to="/doctor/patients" label="View analytics" />
          </span>
        </div>
        <p className="mt-1 text-[11px] font-medium text-[#64748B]">
          {RETURNING_SHARE.toFixed(1)}% of visits this month were returning patients.
        </p>
      </div>

      <ChartData
        caption="New versus returning patients per day, May 2025"
        columns={['Day', 'Returning', 'New']}
        rows={VISIT_TREND.map((d) => [d.label, d.returning, d.new])}
      />
    </Panel>
  );
}

// ── Today's Appointments Overview ────────────────────────────────────────────

export function AppointmentsOverview({ data }: { data: Slice[] }) {
  const APPT_STATUSES = data;
  const APPT_TOTAL = data.reduce((t, d) => t + d.value, 0);
  return (
    <Panel className="flex flex-col">
      <PanelHead icon={CalendarCheck} title="Today's Appointments Overview" />

      <div className="flex flex-1 flex-wrap items-center gap-4 px-5 py-3 sm:flex-nowrap">
        <Donut data={APPT_STATUSES} outer={62} inner={42} size={144} centreValue={String(APPT_TOTAL)} centreLabel="Total" />
        <ul className="min-w-[190px] flex-1">
          {APPT_STATUSES.map((s) => (
            <LegendRow key={s.label} label={s.label} color={s.color} value={s.value} percent={pct(s.value, APPT_TOTAL)} height={26} />
          ))}
        </ul>
      </div>

      <div className="mt-auto flex justify-end px-5 pb-4">
        <LinkArrow to="/doctor/appointments" label="View all appointments" />
      </div>

      <ChartData
        caption="Today's appointments by status"
        columns={['Status', 'Count', 'Share']}
        rows={APPT_STATUSES.map((s) => [s.label, s.value, pct(s.value, APPT_TOTAL)])}
      />
    </Panel>
  );
}

// ── Top 5 Visit Reasons ──────────────────────────────────────────────────────

export function TopVisitReasons({ data }: { data: Reason[] }) {
  const VISIT_REASONS = data;
  const TOTAL_VISITS = data.reduce((t, d) => t + d.value, 0);
  const max = Math.max(...VISIT_REASONS.map((r) => r.value));

  return (
    <Panel className="flex flex-col">
      <PanelHead icon={ClipboardList} title="Top 5 Visit Reasons (This Month)" />

      <ul className="flex-1 px-5 py-3">
        {VISIT_REASONS.map((r, i) => (
          <li key={r.label} className="flex h-[26px] items-center gap-3">
            <span className="w-[92px] shrink-0 truncate text-xs font-medium text-[#475569]">{r.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEF1F8]">
              <span
                className="block h-full origin-left rounded-full bg-[#4F82F5] motion-safe:animate-[dashbar_.6s_ease-out_both]"
                style={{ width: `${(r.value / max) * 100}%`, animationDelay: `${i * 60}ms` }}
              />
            </span>
            <span className="shrink-0 text-xs font-bold tabular-nums text-[#0F172A]">{r.value}</span>
            <span className="w-[46px] shrink-0 text-right text-[11px] font-medium tabular-nums text-[#64748B]">
              ({pct(r.value, TOTAL_VISITS)})
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center px-5 pb-4">
        <p className="text-[11px] font-medium text-[#64748B]">of {TOTAL_VISITS.toLocaleString('en-IN')} visits this month</p>
        <span className="ml-auto">
          <LinkArrow to="/doctor/patients" label="View full report" />
        </span>
      </div>

      <ChartData
        caption="Top five visit reasons this month"
        columns={['Reason', 'Visits', 'Share of all visits']}
        rows={VISIT_REASONS.map((r) => [r.label, r.value, pct(r.value, TOTAL_VISITS)])}
      />
    </Panel>
  );
}
