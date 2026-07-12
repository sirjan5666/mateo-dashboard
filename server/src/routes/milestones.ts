import { Router } from 'express';
import { z } from 'zod';
import { MilestoneAchievement } from '../models/MilestoneAchievement.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { awardTrackerEntry, reverse } from '../points/service.js';
import { correctedAgeMonths } from '../lib/correctedAge.js';
import { isFutureISTDate } from '../lib/ist.js';
import { milestones, milestoneById, milestoneStatus } from '../milestones/milestones.js';

const MIN_DATE = new Date('2000-01-01T00:00:00.000Z');

const markSchema = z.object({
  achievedOn: z.coerce
    .date()
    .refine((d) => d.getTime() >= MIN_DATE.getTime(), 'Date is too far in the past')
    .refine((d) => !isFutureISTDate(d), 'Date cannot be in the future'),
});

const router = Router();

router.get('/babies/:id/milestones', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  // Milestones use CORRECTED age for premature babies (term/24m+ unaffected).
  const ageMonths = correctedAgeMonths(baby.dob, baby.gestationalAgeWeeks);
  const achievements = await MilestoneAchievement.find({ babyId: baby._id });
  const byId = new Map(achievements.map((a) => [a.milestoneId, a]));

  const items = milestones.map((m) => {
    const ach = byId.get(m.id);
    return {
      id: m.id,
      label: m.label,
      description: m.description,
      domain: m.domain,
      source: m.source,
      windowStartMonth: m.windowStartMonth,
      windowEndMonth: m.windowEndMonth,
      achieved: Boolean(ach),
      achievedOn: ach ? ach.achievedOn : null,
      status: milestoneStatus(m, ageMonths, Boolean(ach)),
    };
  });

  res.json({
    milestones: items,
    summary: {
      achieved: items.filter((i) => i.achieved).length,
      total: items.length,
      watch: items.filter((i) => i.status === 'watch').length,
    },
  });
});

router.post('/babies/:id/milestones/:milestoneId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const milestoneId = String(req.params.milestoneId);
  if (!milestoneById.has(milestoneId)) {
    res.status(404).json({ error: 'Unknown milestone' });
    return;
  }
  const { achievedOn } = markSchema.parse(req.body);
  if (achievedOn.getTime() < baby.dob.getTime()) {
    res.status(400).json({ error: 'Date cannot be before the baby was born' });
    return;
  }
  await MilestoneAchievement.findOneAndUpdate(
    { babyId: baby._id, milestoneId },
    { $set: { achievedOn }, $setOnInsert: { babyId: baby._id, milestoneId } },
    { upsert: true },
  );
  // Content-stable dedupeKey (baby+milestone) => re-marking never re-awards.
  void awardTrackerEntry(req.userId!, 'milestone', `${baby.id}:${milestoneId}`, `earn:milestone:${baby.id}:${milestoneId}`).catch(
    (e) => console.error('sitare award failed:', e),
  );
  res.json({ ok: true });
});

router.delete('/babies/:id/milestones/:milestoneId', requireAuth, requireSubscription, loadOwnedBaby, async (req, res) => {
  const baby = req.baby!;
  const milestoneId = String(req.params.milestoneId);
  await MilestoneAchievement.deleteOne({ babyId: baby._id, milestoneId });
  // Un-marking claws back the ★ (prevents mark/unmark farming).
  void reverse({ dedupeKey: `earn:milestone:${baby.id}:${milestoneId}`, reason: 'milestone_unmarked' }).catch((e) =>
    console.error('sitare reverse failed:', e),
  );
  res.json({ ok: true });
});

export default router;
