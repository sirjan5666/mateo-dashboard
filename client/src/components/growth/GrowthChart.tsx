import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BandPoint, GrowthLogPoint, Indicator } from '../../api/growth';

const UNIT: Record<Indicator, string> = { weight: 'kg', length: 'cm', head: 'cm' };

interface Row {
  month: number;
  p3?: number;
  p15?: number;
  p50?: number;
  p85?: number;
  p97?: number;
  baby?: number;
  percentile?: number;
}

function buildRows(bands: BandPoint[], logs: GrowthLogPoint[], indicator: Indicator): Row[] {
  const bandRows: Row[] = bands.map((b) => ({
    month: b.month,
    p3: b.p3,
    p15: b.p15,
    p50: b.p50,
    p85: b.p85,
    p97: b.p97,
  }));
  const babyRows: Row[] = logs
    .filter((l) => l.metrics[indicator])
    .map((l) => ({ month: l.ageMonths, baby: l.metrics[indicator]!.value, percentile: l.metrics[indicator]!.percentile }));
  return [...bandRows, ...babyRows].sort((a, b) => a.month - b.month);
}

interface TipItem {
  dataKey?: string | number;
  value?: number;
  payload?: Row;
}

function GrowthTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: number;
  unit: string;
}) {
  if (!active || !payload) return null;
  const baby = payload.find((p) => p.dataKey === 'baby');
  if (!baby || baby.value == null) return null;
  const row: Row = baby.payload ?? { month: 0 };
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-soft">
      <p className="font-semibold text-stone-800">
        {baby.value} {unit}
      </p>
      <p className="text-stone-500">
        {Math.round((row.month ?? 0) * 10) / 10} months · {row.percentile}th percentile
      </p>
    </div>
  );
}

export function GrowthChart({
  bands,
  logs,
  indicator,
}: {
  bands: BandPoint[];
  logs: GrowthLogPoint[];
  indicator: Indicator;
}) {
  const rows = buildRows(bands, logs, indicator);
  const band = (key: keyof Row, width: number, color: string) => (
    <Line type="monotone" dataKey={key} stroke={color} strokeWidth={width} dot={false} connectNulls isAnimationActive={false} />
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ece6dc" />
        <XAxis
          dataKey="month"
          type="number"
          domain={[0, 24]}
          ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
          tick={{ fontSize: 12, fill: '#767b82' }}
          tickLine={false}
          axisLine={{ stroke: '#e3dccf' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#767b82' }}
          tickLine={false}
          axisLine={false}
          width={44}
          domain={['auto', 'auto']}
          unit={` ${UNIT[indicator]}`}
        />
        <Tooltip content={<GrowthTooltip unit={UNIT[indicator]} />} />
        {band('p97', 1, '#d6e6df')}
        {band('p85', 1, '#d6e6df')}
        {band('p50', 1.5, '#a9c1b6')}
        {band('p15', 1, '#d6e6df')}
        {band('p3', 1, '#d6e6df')}
        <Line
          type="monotone"
          dataKey="baby"
          stroke="#4f8a7b"
          strokeWidth={2.5}
          connectNulls
          isAnimationActive={false}
          dot={{ r: 4, fill: '#4f8a7b', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
