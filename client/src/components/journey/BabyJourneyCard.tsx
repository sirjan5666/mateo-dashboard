import { PartyPopper, Sparkles } from 'lucide-react';
import type { OverviewBaby } from '../../api/overview';
import { useT } from '../../i18n/context';
import { JOURNEY_TOTAL, daysSinceDob, journeyStageKey } from '../../lib/journey';
import { JourneyTrack } from './JourneyTrack';

/**
 * The parent-dashboard "First 2000 Days" card — the emotional headline under the
 * hero. One child, one pulsing marker: "{name} · Day N of 2,000 · {stage}".
 * Pure props (no fetching), so a lock/blur wrapper stays trivial. Visual language
 * mirrors the Dashboard's local playful Card (26px radius, var(--card), soft shadow).
 */
export function BabyJourneyCard({ baby }: { baby: OverviewBaby }) {
  const t = useT();
  const day = daysSinceDob(baby.dob);
  if (day < 0) return null; // future DOB — nothing sensible to plot
  const graduated = day > JOURNEY_TOTAL;

  return (
    <div
      data-entrance="card"
      style={{
        position: 'relative',
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '26px',
        padding: '1.4rem 1.6rem',
        boxShadow: '0 6px 20px -8px rgba(124,92,252,0.18), 0 2px 6px -3px rgba(58,46,99,0.08)',
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-2 pb-3">
        <div className="min-w-0">
          <span className="eyebrow" style={{ color: 'var(--cat-milestone-text, var(--text-muted-color))' }}>
            {t('journey.eyebrow')}
          </span>
          <p className="mt-0.5 text-[0.95rem] font-bold" style={{ color: 'var(--foreground)' }}>
            {graduated
              ? t('journey.graduatedLine', { name: baby.name })
              : t('journey.dayLine', { name: baby.name, day: day.toLocaleString('en-IN'), stage: t(journeyStageKey(day)) })}
          </p>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-bold"
          style={{ backgroundColor: 'var(--secondary)', color: 'var(--text-secondary, var(--foreground))' }}
        >
          {graduated ? <PartyPopper className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {graduated ? t('journey.graduatedChip') : `${Math.round((day / JOURNEY_TOTAL) * 100)}%`}
        </span>
      </div>
      <JourneyTrack markerDay={graduated ? JOURNEY_TOTAL : day} markerTitle={baby.name} />
    </div>
  );
}
