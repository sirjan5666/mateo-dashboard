import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { bandCurves, computePercentile, percentileZone } from '../growth/percentile.js';
import type { Indicator, Sex } from '../growth/percentile.js';

// Doctor-side WHO growth PLOTTER / assessment tool. Decision support only:
//  - NON-PERSISTING — it stores nothing and returns no PHI. It only computes
//    percentiles for measurements the doctor types in, reusing the exact same
//    WHO LMS math (src/growth/percentile.ts) as the parent growth tracker.
//  - CLAUDE.md hard rule 3 compliant — it reports percentile bands, crossings
//    and WHO growth-alert zones (under-3rd / over-97th). It never emits a
//    target weight/length ("baby should weigh X").
const router = Router();
router.use(requireAuth, requireRole('doctor'));

const MEASURES: { indicator: Indicator; label: string; key: 'weightG' | 'lengthCm' | 'headCircCm'; toValue: (n: number) => number }[] = [
  { indicator: 'weight', label: 'Weight-for-age', key: 'weightG', toValue: (g) => g / 1000 },
  { indicator: 'length', label: 'Length-for-age', key: 'lengthCm', toValue: (c) => c },
  { indicator: 'head', label: 'Head circumference', key: 'headCircCm', toValue: (c) => c },
];

const plotSchema = z.object({
  sex: z.enum(['male', 'female']),
  points: z
    .array(
      z
        .object({
          ageMonths: z.number().min(0).max(60),
          weightG: z.number().int().min(300).max(30000).optional(),
          lengthCm: z.number().min(30).max(120).optional(),
          headCircCm: z.number().min(25).max(65).optional(),
        })
        .refine((p) => p.weightG != null || p.lengthCm != null || p.headCircCm != null, 'Each point needs at least one measurement'),
    )
    .max(40),
});

interface Metric {
  value: number;
  percentile: number;
  z: number;
  outOfRange: boolean;
}
interface ComputedPoint {
  ageMonths: number;
  weightG?: number;
  lengthCm?: number;
  headCircCm?: number;
  metrics: Partial<Record<Indicator, Metric>>;
}

router.post('/growth/plot', (req, res) => {
  const { sex, points } = plotSchema.parse(req.body);
  const sexT = sex as Sex;

  const computed: ComputedPoint[] = points
    .map((p) => {
      const metrics: Partial<Record<Indicator, Metric>> = {};
      for (const m of MEASURES) {
        const raw = p[m.key];
        if (raw == null) continue;
        const value = m.toValue(raw);
        const { percentile, z, outOfRange } = computePercentile(m.indicator, sexT, p.ageMonths, value);
        metrics[m.indicator] = { value, percentile: Math.round(percentile * 10) / 10, z: Math.round(z * 100) / 100, outOfRange };
      }
      return { ageMonths: p.ageMonths, weightG: p.weightG, lengthCm: p.lengthCm, headCircCm: p.headCircCm, metrics };
    })
    .sort((a, b) => a.ageMonths - b.ageMonths);

  res.json({
    sex,
    points: computed,
    bands: {
      weight: bandCurves('weight', sexT),
      length: bandCurves('length', sexT),
      head: bandCurves('head', sexT),
    },
    alerts: buildAlerts(computed),
    insights: buildInsights(computed),
  });
});

export default router;

// ── WHO growth-alert zones on the most recent point per indicator ─────────────
export interface GrowthAlert {
  indicator: Indicator;
  level: 'low' | 'high';
  label: string;
  percentile: number;
}

function latestMetric(points: ComputedPoint[], indicator: Indicator): Metric | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const m = points[i].metrics[indicator];
    if (m) return m;
  }
  return null;
}

function buildAlerts(points: ComputedPoint[]): GrowthAlert[] {
  const alerts: GrowthAlert[] = [];
  const defs: { indicator: Indicator; low: string; high: string | null }[] = [
    { indicator: 'weight', low: 'Underweight — weight-for-age below 3rd percentile', high: 'High weight-for-age (>97th) — assess weight-for-length' },
    { indicator: 'length', low: 'Stunting — length-for-age below 3rd percentile', high: null },
    { indicator: 'head', low: 'Microcephaly — head circumference below 3rd percentile', high: 'Macrocephaly — head circumference above 97th percentile' },
  ];
  for (const d of defs) {
    const m = latestMetric(points, d.indicator);
    if (!m) continue;
    if (m.percentile < 3) alerts.push({ indicator: d.indicator, level: 'low', label: d.low, percentile: m.percentile });
    else if (m.percentile > 97 && d.high) alerts.push({ indicator: d.indicator, level: 'high', label: d.high, percentile: m.percentile });
  }
  return alerts;
}

// ── deterministic insights: percentile crossing + weight stagnation ───────────
export interface GrowthInsight {
  indicator: Indicator;
  kind: 'crossing' | 'stagnation';
  message: string;
}

function buildInsights(points: ComputedPoint[]): GrowthInsight[] {
  const insights: GrowthInsight[] = [];

  for (const m of MEASURES) {
    const series = points.filter((p) => p.metrics[m.indicator]);
    for (let i = 1; i < series.length; i += 1) {
      const prev = percentileZone(series[i - 1].metrics[m.indicator]!.percentile);
      const curr = percentileZone(series[i].metrics[m.indicator]!.percentile);
      if (prev - curr >= 2) {
        insights.push({
          indicator: m.indicator,
          kind: 'crossing',
          message: `${m.label} has crossed down two or more percentile bands between measurements. Re-measure, and review feeding and any intercurrent illness.`,
        });
        break;
      }
    }
  }

  const weights = points.filter((p) => p.weightG != null);
  for (let i = 2; i < weights.length; i += 1) {
    const a = weights[i - 2].weightG!;
    const b = weights[i - 1].weightG!;
    const c = weights[i].weightG!;
    if (b <= a && c <= b) {
      insights.push({
        indicator: 'weight',
        kind: 'stagnation',
        message: 'Weight has not increased across the last three measurements. Assess feeding adequacy and consider review for faltering growth.',
      });
      break;
    }
  }

  return insights;
}
