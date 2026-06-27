import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../ui/Card';
import { CountUp } from '../ui/CountUp';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/cn';
import { usePanelMode } from '../../lib/panelTheme';
import { toneBadge } from '../ui/tones';
import type { Tone } from '../ui/tones';

// ── chart palette (recharts needs concrete colours, not CSS vars) ────────────
export interface ChartTheme {
  grid: string;
  axis: string;
  text: string;
  brand: string;
  brand2: string;
  green: string;
  amber: string;
  rose: string;
  sky: string;
  series: string[];
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

const LIGHT: ChartTheme = {
  grid: '#e2e8f0',
  axis: '#94a3b8',
  text: '#64748b',
  brand: '#2563eb',
  brand2: '#8b5cf6',
  green: '#16a34a',
  amber: '#ca8a04',
  rose: '#dc2626',
  sky: '#3b82f6',
  series: ['#2563eb', '#8b5cf6', '#16a34a', '#eab308', '#0d9488', '#ef4444'],
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e8f0',
  tooltipText: '#1e293b',
};

const DARK: ChartTheme = {
  grid: 'rgba(255,255,255,0.08)',
  axis: '#64748b',
  text: '#94a3b8',
  brand: '#3b82f6',
  brand2: '#a78bfa',
  green: '#4ade80',
  amber: '#facc15',
  rose: '#f87171',
  sky: '#60a5fa',
  series: ['#3b82f6', '#a78bfa', '#4ade80', '#facc15', '#2dd4bf', '#f87171'],
  tooltipBg: '#1e293b',
  tooltipBorder: 'rgba(255,255,255,0.1)',
  tooltipText: '#f1f5f9',
};

export function useChartTheme(): ChartTheme {
  return usePanelMode() === 'dark' ? DARK : LIGHT;
}

// ── section card with a standard header ──────────────────────────────────────
export function SectionCard({
  title,
  eyebrow,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card data-entrance="card" className={cn('p-5 sm:p-6', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <Icon className="h-[18px] w-[18px]" />
              </span>
            )}
            <div>
              {eyebrow && <p className="text-[0.64rem] font-bold uppercase tracking-[0.12em] text-stone-400">{eyebrow}</p>}
              {title && <h2 className="font-display text-base font-bold leading-tight text-stone-900 sm:text-[1.0625rem]">{title}</h2>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </Card>
  );
}

// ── KPI tile ─────────────────────────────────────────────────────────────────
const DELTA_TONE: Record<'up' | 'down' | 'flat', string> = {
  up: 'text-green-700 bg-green-50',
  down: 'text-rose-700 bg-rose-50',
  flat: 'text-stone-500 bg-stone-100',
};

export function Kpi({
  icon: Icon,
  label,
  value,
  decimals = 0,
  prefix,
  suffix,
  sub,
  tone = 'emerald',
  delta,
  spark,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  sub?: string;
  tone?: Tone;
  delta?: { dir: 'up' | 'down' | 'flat'; text: string };
  spark?: number[];
}) {
  const theme = useChartTheme();
  return (
    <Card data-entrance="card" className="relative overflow-hidden p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <CountUp
          value={value}
          decimals={decimals}
          prefix={prefix}
          suffix={suffix}
          className="font-display text-[1.7rem] font-extrabold leading-none text-stone-900 sm:text-[2rem]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', toneBadge[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-2 truncate text-[0.64rem] font-bold uppercase tracking-wide text-stone-400">{label}</p>
      <div className="mt-3 flex items-center gap-2">
        {delta && (
          <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold', DELTA_TONE[delta.dir])}>
            {delta.dir === 'up' && <ArrowUpRight className="h-3 w-3" />}
            {delta.dir === 'down' && <ArrowDownRight className="h-3 w-3" />}
            {delta.text}
          </span>
        )}
        {sub && <span className="truncate text-xs text-stone-400">{sub}</span>}
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-3 h-9">
          <Sparkline values={spark} color={theme.brand} />
        </div>
      )}
    </Card>
  );
}

// ── tiny sparkline (svg) ──────────────────────────────────────────────────────
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 3 - ((v - min) / span) * (h - 8);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `0,${h} ${line} ${w},${h}`;
  const id = `sk-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── chart tooltip ──────────────────────────────────────────────────────────────
interface TipItem {
  name?: string;
  value?: number | string;
  color?: string;
  fill?: string;
}
interface TipProps {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
  theme: ChartTheme;
  unit?: string;
}
function ChartTooltip({ active, payload, label, theme, unit }: TipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-card"
      style={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, color: theme.tooltipText }}
    >
      {label != null && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span style={{ opacity: 0.8 }}>{p.name}:</span>
          <span className="font-bold">
            {p.value}
            {unit ?? ''}
          </span>
        </p>
      ))}
    </div>
  );
}

// ── area trend chart ────────────────────────────────────────────────────────
export function AreaTrend({
  data,
  xKey,
  series,
  height = 240,
  unit,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; name: string; color?: string }[];
  height?: number;
  unit?: string;
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          {series.map((s, i) => {
            const c = s.color ?? theme.series[i % theme.series.length];
            return (
              <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={0.28} />
                <stop offset="100%" stopColor={c} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: theme.axis }} tickLine={false} axisLine={{ stroke: theme.grid }} />
        <YAxis tick={{ fontSize: 11, fill: theme.axis }} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
        <Tooltip
          content={(props) => <ChartTooltip active={props.active} payload={props.payload as unknown as TipItem[]} label={props.label as string | number} theme={theme} unit={unit} />}
          cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }}
        />
        {series.map((s, i) => {
          const c = s.color ?? theme.series[i % theme.series.length];
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={c}
              strokeWidth={2.5}
              fill={`url(#area-${s.key})`}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── bar trend chart ────────────────────────────────────────────────────────
export function BarTrend({
  data,
  xKey,
  barKey,
  height = 220,
  unit,
  highlightIndex,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  barKey: string;
  height?: number;
  unit?: string;
  highlightIndex?: number;
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: theme.axis }} tickLine={false} axisLine={{ stroke: theme.grid }} />
        <YAxis tick={{ fontSize: 11, fill: theme.axis }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <Tooltip
          content={(props) => <ChartTooltip active={props.active} payload={props.payload as unknown as TipItem[]} label={props.label as string | number} theme={theme} unit={unit} />}
          cursor={{ fill: theme.grid, opacity: 0.4 }}
        />
        <Bar dataKey={barKey} radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={highlightIndex === i ? theme.brand : theme.brand2} fillOpacity={highlightIndex === i ? 1 : 0.45} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── donut ───────────────────────────────────────────────────────────────────
export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  data,
  centerValue,
  centerLabel,
  size = 168,
}: {
  data: DonutSlice[];
  centerValue?: string | number;
  centerLabel?: string;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total === 0 ? [{ label: 'none', value: 1, color: 'var(--surface-sunken)' }] : data}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={total === 0 ? 0 : 2}
              stroke="none"
              isAnimationActive={false}
            >
              {(total === 0 ? [{ color: 'var(--surface-sunken)' }] : data).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-extrabold leading-none text-stone-900">{centerValue ?? total}</span>
          {centerLabel && <span className="mt-1 text-[0.66rem] font-bold uppercase tracking-wide text-stone-400">{centerLabel}</span>}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-stone-600">{d.label}</span>
            <span className="font-bold text-stone-900">{d.value}</span>
            <span className="w-10 text-right text-xs text-stone-400">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── progress bar row ─────────────────────────────────────────────────────────
export function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.max(3, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-stone-600">{label}</span>
        <span className="font-bold text-stone-900">{value}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-sunken)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── skeletons ─────────────────────────────────────────────────────────────────
export function SkeletonKpi() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-12" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-3 w-24" />
    </Card>
  );
}

export function SkeletonChart({ height = 240, className }: { height?: number; className?: string }) {
  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="mt-5 flex items-end gap-2" style={{ height }}>
        {[60, 80, 45, 95, 70, 88, 55, 78].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` } as CSSProperties} />
        ))}
      </div>
    </Card>
  );
}

export function SkeletonRows({ n = 4, className }: { n?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-8 text-center" style={{ borderColor: 'var(--hairline)' }}>
      <Icon className="h-6 w-6 text-stone-300" />
      <p className="text-sm text-stone-500">{text}</p>
    </div>
  );
}
