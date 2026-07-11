import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireSubscription } from '../middleware/subscription.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import {
  journeyDay,
  currentAnchor,
  nextAnchor,
  currentMilestoneCheck,
  nextMilestoneCheck,
  notificationForDay,
  JOURNEY_TOTAL_DAYS,
  type JourneyLanguage,
} from '../journey/timeline.js';

const router = Router();

function parseLang(v: unknown): JourneyLanguage {
  return v === 'hi' || v === 'hi-en' ? v : 'en';
}

// The age-driven "where is my baby now" slice of the First 2,000 Days timeline —
// consumed by every tracker journey and the dashboard "today" hub. Read-only,
// owner-scoped, subscription-gated like the other trackers.
router.get('/babies/:id/journey', requireAuth, requireSubscription, loadOwnedBaby, (req, res) => {
  const baby = req.baby!;
  const lang = parseLang(req.query.lang);
  const day = journeyDay(baby.dob);
  const graduated = day > JOURNEY_TOTAL_DAYS;
  const clampedDay = Math.min(Math.max(day, 1), JOURNEY_TOTAL_DAYS);

  const current = currentAnchor(clampedDay);
  const next = nextAnchor(clampedDay);
  const checkNow = currentMilestoneCheck(clampedDay);
  const checkNext = nextMilestoneCheck(clampedDay);

  res.json({
    day: clampedDay,
    rawDay: day,
    totalDays: JOURNEY_TOTAL_DAYS,
    graduated,
    ageLabel: current.ageLabel,
    current,
    next,
    milestoneCheck: { current: checkNow, next: checkNext },
    today: notificationForDay(clampedDay, lang),
  });
});

export default router;
