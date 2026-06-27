import { describe, it, expect } from 'vitest';
import { feedingStages, neverFeed, stageForAge, underSixMonths, feedingNote } from './feeding.js';
import { ageInWholeMonthsIST, isFutureISTDate } from '../lib/ist.js';

describe('stageForAge — the 6-month solids gate', () => {
  it('returns null below 6 months (exclusive breastfeeding)', () => {
    expect(stageForAge(0)).toBeNull();
    expect(stageForAge(3)).toBeNull();
    expect(stageForAge(5)).toBeNull();
  });

  it('maps boundary ages to the right stage', () => {
    expect(stageForAge(6)?.id).toBe('stage_6_8m');
    expect(stageForAge(8)?.id).toBe('stage_6_8m');
    expect(stageForAge(9)?.id).toBe('stage_9_11m');
    expect(stageForAge(11)?.id).toBe('stage_9_11m');
    expect(stageForAge(12)?.id).toBe('stage_12_24m');
    expect(stageForAge(24)?.id).toBe('stage_12_24m');
  });

  it('returns null past the tracked range (>=25 months)', () => {
    expect(stageForAge(25)).toBeNull();
    expect(stageForAge(40)).toBeNull();
  });

  it('has contiguous, non-overlapping stage ranges', () => {
    const sorted = [...feedingStages].sort((a, b) => a.ageStartMonth - b.ageStartMonth);
    expect(sorted[0].ageStartMonth).toBe(6);
    for (let i = 1; i < sorted.length; i++) {
      // each stage starts exactly where the previous one ends (end is exclusive)
      expect(sorted[i].ageStartMonth).toBe(sorted[i - 1].ageEndMonth);
    }
    // every whole month from 6..24 maps to exactly one stage
    for (let m = 6; m <= 24; m++) {
      const matches = feedingStages.filter((s) => m >= s.ageStartMonth && m < s.ageEndMonth);
      expect(matches).toHaveLength(1);
    }
  });
});

describe('brand-neutrality (IMS Act 1992 / CLAUDE.md rule 4)', () => {
  // The actual food SUGGESTIONS and never-feed list must name no formula,
  // milk-substitute, or baby-food brand.
  const BRAND_DENYLIST = /cerelac|lactogen|nestl|nestum|nestogen|enfamil|similac|gerber|aptamil|dexolac|nangrow|farex/i;

  const suggestionText = JSON.stringify(feedingStages) + JSON.stringify(neverFeed) + JSON.stringify(underSixMonths);

  it('food ideas and never-feed list contain no brand names', () => {
    expect(suggestionText).not.toMatch(BRAND_DENYLIST);
  });

  it('food ideas never recommend formula or packaged baby food', () => {
    // "formula" must not appear in any actual food suggestion (the negative
    // disclaimer in feedingNote is allowed and tested separately).
    expect(JSON.stringify(feedingStages)).not.toMatch(/formula|packaged|jarred|tinned/i);
  });

  it('the feeding note states it is brand-neutral and defers to the pediatrician', () => {
    expect(feedingNote.toLowerCase()).toContain('brand-neutral');
    expect(feedingNote.toLowerCase()).toContain('pediatrician');
  });

  it('never-feed list flags honey (botulism, under 12 months)', () => {
    expect(neverFeed.some((n) => /honey/i.test(n.item))).toBe(true);
  });
});

describe('IST date helpers', () => {
  it('counts whole calendar months on the IST calendar', () => {
    const dob = new Date('2026-01-15T12:00:00.000Z');
    expect(ageInWholeMonthsIST(dob, new Date('2026-07-15T12:00:00.000Z'))).toBe(6);
    expect(ageInWholeMonthsIST(dob, new Date('2026-07-14T12:00:00.000Z'))).toBe(5);
    expect(ageInWholeMonthsIST(dob, new Date('2027-01-15T12:00:00.000Z'))).toBe(12);
  });

  it('does NOT reject a same-IST-day date in the early-morning UTC window', () => {
    // 01:30 IST on 2026-06-13 (the bug window). A meal logged "today" arrives as
    // UTC midnight of 2026-06-13, which is AHEAD of this instant but the same IST day.
    const now = new Date('2026-06-12T20:00:00.000Z'); // = 2026-06-13 01:30 IST
    const todayMidnightUTC = new Date('2026-06-13T00:00:00.000Z');
    expect(isFutureISTDate(todayMidnightUTC, now)).toBe(false);
  });

  it('still rejects a genuinely future IST date', () => {
    const now = new Date('2026-06-13T06:00:00.000Z');
    const tomorrow = new Date('2026-06-14T00:00:00.000Z');
    expect(isFutureISTDate(tomorrow, now)).toBe(true);
  });
});
