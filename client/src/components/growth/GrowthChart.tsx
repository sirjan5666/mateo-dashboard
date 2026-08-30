import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BandPoint, GrowthLogPoint, Indicator, MidParentalHeight } from '../../api/growth';

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
  midParentalHeight,
}: {
  bands: BandPoint[];
  logs: GrowthLogPoint[];
  indicator: Indicator;
  midParentalHeight?: MidParentalHeight | null;
}) {
  const rows = buildRows(bands, logs, indicator);
  // Nested shaded "healthy zones" — the p15–p85 range reads as the strong band,
  // p3–p97 as the lighter outer band. Drawn outer→inner, each masking below it
  // (the last mask uses the white card surface), so the zones stay crisp even
  // when the baby's line has few points. Far clearer than faint band lines.
  const area = (key: keyof Row, fill: string) => (
    <Area type="monotone" dataKey={key} stroke="none" fill={fill} fillOpacity={1} connectNulls isAnimationActive={false} />
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={rows} margin={{ top: 8, right: 14, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ece6dc" vertical={false} />
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
          width={54}
          domain={['auto', 'auto']}
          unit={` ${UNIT[indicator]}`}
        />
        <Tooltip content={<GrowthTooltip unit={UNIT[indicator]} />} />
        {/* Shaded percentile zones (outer → inner, last one masks with card white). */}
        {area('p97', '#e5f1ea')}
        {area('p85', '#cbe1d5')}
        {area('p15', '#e5f1ea')}
        {area('p3', '#ffffff')}
        {/* Median (p50) reference line */}
        <Line type="monotone" dataKey="p50" stroke="#8fb3a5" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
        {/* Mid-parental height target — length only. `hidden` so an adult-height
            target can't blow up the 0–24m domain and squash the curves. */}
        {indicator === 'length' && midParentalHeight && (
          <>
            <ReferenceArea y1={midParentalHeight.low} y2={midParentalHeight.high} fill="#8b5cf6" fillOpacity={0.08} ifOverflow="hidden" />
            <ReferenceLine
              y={midParentalHeight.target}
              stroke="#8b5cf6"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              ifOverflow="hidden"
              label={{ value: `MPH ${midParentalHeight.target} cm`, position: 'insideRight', fill: '#7c3aed', fontSize: 11, fontWeight: 600 }}
            />
          </>
        )}
        <Line
          type="monotone"
          dataKey="baby"
          stroke="#2f7d6b"
          strokeWidth={3}
          connectNulls
          isAnimationActive={false}
          dot={{ r: 4, fill: '#2f7d6b', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
