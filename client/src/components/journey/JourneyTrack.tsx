import { useT } from '../../i18n/context';
import { JOURNEY_STAGES, JOURNEY_TOTAL } from '../../lib/journey';

/**
 * Theme-agnostic "first 2000 days" track: proportional stage labels, a gradient
 * band with stage dividers, one pulsing "you are here" marker, and a Day 0 →
 * Day 2,000 axis. Colours come entirely from CSS vars (--journey-track,
 * --journey-gradient, --primary, --hairline + text vars), so it renders
 * correctly on both the playful parent theme and the pro panels.
 */
export function JourneyTrack({ markerDay, markerTitle }: { markerDay: number | null; markerTitle?: string }) {
  const t = useT();
  const clamped = markerDay === null ? null : Math.max(0, Math.min(JOURNEY_TOTAL, markerDay));
  return (
    <div>
      {/* stage labels — proportional to each stage's share of the 2000 days */}
      <div className="flex text-[0.62rem] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted-color, var(--muted-foreground))' }}>
        {JOURNEY_STAGES.map((s, i) => {
          const prev = i === 0 ? 0 : JOURNEY_STAGES[i - 1].end;
          const w = ((s.end - prev) / JOURNEY_TOTAL) * 100;
          return (
            <span key={s.key} className="truncate px-1" style={{ width: `${w}%` }}>
              {t(s.labelKey)}
            </span>
          );
        })}
      </div>

      {/* the band */}
      <div className="relative mt-1.5 h-[52px] overflow-hidden rounded-2xl" style={{ background: 'var(--journey-track)' }}>
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.22]" style={{ background: 'var(--journey-gradient)' }} />
        {JOURNEY_STAGES.slice(0, -1).map((s) => (
          <span key={s.key} aria-hidden="true" className="absolute inset-y-0 w-px" style={{ left: `${(s.end / JOURNEY_TOTAL) * 100}%`, background: 'var(--hairline, var(--border))' }} />
        ))}

        {clamped !== null && (
          <div aria-hidden="true" className="absolute inset-y-0" style={{ left: `${(clamped / JOURNEY_TOTAL) * 100}%` }} title={markerTitle}>
            <span className="absolute inset-y-2 -left-px w-0.5 rounded-full bg-[var(--primary)] opacity-60" />
            <span className="journey-now absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--primary)]" />
          </div>
        )}
      </div>

      {/* axis */}
      <div className="mt-2 flex justify-between text-[0.66rem] font-semibold tabular-nums" style={{ color: 'var(--text-muted-color, var(--muted-foreground))' }}>
        <span>{t('journey.start')}</span>
        <span>{t('journey.end')}</span>
      </div>
    </div>
  );
}
