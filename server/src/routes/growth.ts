import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { GrowthLog } from '../models/GrowthLog.js';
import type { IGrowthLog } from '../models/GrowthLog.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { awardTrackerEntry } from '../points/service.js';
import { correctedAgeMonths } from '../lib/correctedAge.js';
import { bandCurves, computePercentile, percentileZone } from '../growth/percentile.js';
import type { Indicator, Sex } from '../growth/percentile.js';
import { isFutureISTDate } from '../lib/ist.js';

// Growth percentiles evaluate against CORRECTED age for premature babies (term
// babies + anyone past 24 months are unaffected). See lib/correctedAge.ts.
function growthAgeMonths(dob: Date, gestationalAgeWeeks: number | undefined, at: Date): number {
  return correctedAgeMonths(dob, gestationalAgeWeeks, at);
}

// indicator -> measurement value in the WHO unit (kg / cm), or null if not logged.
const MEASUREMENTS: { indicator: Indicator; label: string; valueOf: (log: IGrowthLog) => number | null }[] = [
  { indicator: 'weight', label: 'weight', valueOf: (l) => (l.weightG != null ? l.weightG / 1000 : null) },
  { indicator: 'length', label: 'length', valueOf: (l) => l.lengthCm ?? null },
  { indicator: 'head', label: 'head circumference', valueOf: (l) => l.headCircCm ?? null },
];

const MIN_LOG_DATE = new Date('2000-01-01T00:00:00.000Z');

const createLogSchema = z
  .object({
    loggedAt: z.coerce
      .date()
      .refine((d) => d.getTime() >= MIN_LOG_DATE.getTime(), 'Date is too far in the past')
      // IST calendar day, not raw instant (a date-only value is UTC midnight).
      .refine((d) => !isFutureISTDate(d), 'Date cannot be in the future'),
    weightG: z.number().int().min(300).max(30000).optional(),
    lengthCm: z.number().min(30).max(120).optional(),
    headCircCm: z.number().min(25).max(65).optional(),
  })
  .refine(
    (b) => b.weightG != null || b.lengthCm != null || b.headCircCm != null,
    'Add at least one measurement (weight, length or head circumference)',
  );

function publicLog(log: IGrowthLog & { id: string }, dob: Date, gestationalAgeWeeks?: number) {
  return {
    id: log.id,
    loggedAt: log.loggedAt,
    ageMonths: Math.round(growthAgeMonths(dob, gestationalAgeWeeks, log.loggedAt) * 100) / 100,
    weightG: log.weightG,
    lengthCm: log.lengthCm,
    headCircCm: log.headCircCm,
  };
}

const router = Router();

router.get('/babies/:id/growth', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const sex = baby.sex as Sex;
  const logs = await GrowthLog.find({ babyId: baby._id }).sort({ loggedAt: 1 });

  const points = logs.map((log) => {
    const ageMonths = growthAgeMonths(baby.dob, baby.gestationalAgeWeeks, log.loggedAt);
    const metrics: Record<string, { value: number; percentile: number; z: number; outOfRange: boolean }> = {};
    for (const m of MEASUREMENTS) {
      const value = m.valueOf(log);
      if (value == null) continue;
      const { percentile, z, outOfRange } = computePercentile(m.indicator, sex, ageMonths, value);
      metrics[m.indicator] = { value, percentile: Math.round(percentile * 10) / 10, z: Math.round(z * 100) / 100, outOfRange };
    }
    return { ...publicLog(log, baby.dob, baby.gestationalAgeWeeks), metrics };
  });

  const bands = {
    weight: bandCurves('weight', sex),
    length: bandCurves('length', sex),
    head: bandCurves('head', sex),
  };

  res.json({
    baby: { id: baby.id, name: baby.name, dob: baby.dob, sex: baby.sex, gestationalAgeWeeks: baby.gestationalAgeWeeks },
    logs: points,
    bands,
    insights: buildInsights(points),
  });
});

router.post('/babies/:id/growth', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const body = createLogSchema.parse(req.body);
  if (body.loggedAt.getTime() < baby.dob.getTime()) {
    res.status(400).json({ error: 'Measurement date cannot be before the baby was born' });
    return;
  }
  const log = await GrowthLog.create({ babyId: baby._id, ...body });
  void awardTrackerEntry(req.userId!, 'growth_log', log.id, `earn:growth:${log.id}`).catch((e) => console.error('sitare award failed:', e));
  res.status(201).json({ log: publicLog(log, baby.dob, baby.gestationalAgeWeeks) });
});

router.delete('/babies/:id/growth/:logId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const { logId } = req.params;
  const log = isValidObjectId(logId) ? await GrowthLog.findById(logId) : null;
  if (!log || log.babyId.toString() !== baby._id.toString()) {
    res.status(404).json({ error: 'Growth log not found' });
    return;
  }
  await log.deleteOne();
  res.json({ ok: true });
});

export default router;

// --- deterministic insights (CLAUDE.md: percentile trends only, never target numbers) ---

interface Point {
  loggedAt: Date;
  weightG?: number;
  metrics: Record<string, { percentile: number }>;
}

export interface GrowthInsight {
  indicator: Indicator;
  kind: 'crossing' | 'stagnation';
  message: string;
}

function buildInsights(points: Point[]): GrowthInsight[] {
  const insights: GrowthInsight[] = [];

  // Percentile crossing: a drop of 2+ major bands between consecutive measurements.
  for (const m of MEASUREMENTS) {
    const series = points.filter((p) => p.metrics[m.indicator]);
    for (let i = 1; i < series.length; i++) {
      const prev = percentileZone(series[i - 1].metrics[m.indicator].percentile);
      const curr = percentileZone(series[i].metrics[m.indicator].percentile);
      if (prev - curr >= 2) {
        insights.push({
          indicator: m.indicator,
          kind: 'crossing',
          message: `Your baby's ${m.label} has dropped across two or more percentile bands recently. A single reading can be off, but it's worth mentioning to your pediatrician at the next visit.`,
        });
        break;
      }
    }
  }

  // Stagnation: weight not increasing across two consecutive intervals (3+ logs).
  const weightSeries = points.filter((p) => p.weightG != null);
  for (let i = 2; i < weightSeries.length; i++) {
    const a = weightSeries[i - 2].weightG!;
    const b = weightSeries[i - 1].weightG!;
    const c = weightSeries[i].weightG!;
    if (b <= a && c <= b) {
      insights.push({
        indicator: 'weight',
        kind: 'stagnation',
        message:
          "Your baby's weight hasn't increased across the last few measurements. Babies grow in spurts, but a check-in with your pediatrician is a good idea.",
      });
      break;
    }
  }

  return insights;
}
