import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { loadOwnedBaby } from '../middleware/ownership.js';
import { assistantConfigured } from '../ai/provider.js';
import { buildTrackerInsight, INSIGHT_TRACKERS } from '../ai/insights.js';
import type { InsightTracker } from '../ai/insights.js';

const insightSchema = z.object({
  tracker: z.enum(INSIGHT_TRACKERS as unknown as [InsightTracker, ...InsightTracker[]]),
  language: z.enum(['en', 'hi']).optional(),
});

const router = Router();

// "mateo.ai's take" on a single tracker's logged data. Same safety posture as the
// chat: the deterministic gate runs first (inside buildTrackerInsight); the LLM
// provider key stays server-side and is never exposed to the client.
router.post('/babies/:id/insight', requireAuth, loadOwnedBaby, async (req, res) => {
  const { tracker, language } = insightSchema.parse(req.body);

  if (!assistantConfigured()) {
    res.json({ enabled: false });
    return;
  }

  try {
    const insight = await buildTrackerInsight(req.baby!, tracker, language);
    res.json({ enabled: true, ...insight });
  } catch (err) {
    console.error('Insight error:', err);
    res.status(502).json({ error: 'mateo.ai could not put together a suggestion just now. Please try again.' });
  }
});

export default router;
