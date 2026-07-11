import { AlertTriangle, Lightbulb, Sparkles } from 'lucide-react';
import type { Journey } from '../../api/journey';
import { Card } from '../ui/Card';
import { cn } from '../../lib/cn';

// The age-driven "what's happening now" band that turns a tracker from a data-entry
// form into a living timeline. Drops on top of any tracker page; `focus` picks which
// slice of the current timeline anchor to headline. Population-level ranges, never a
// per-child deadline — the disclaimer stays put (CLAUDE.md hard rules).

type Focus = 'milestone' | 'vision' | 'cognitive' | 'growth' | 'today' | 'general';

function headline(journey: Journey, focus: Focus): { title: string; body: string } {
  const c = journey.current;
  switch (focus) {
    case 'milestone': {
      const m = journey.milestoneCheck.current ?? c;
      return { title: m.theme, body: m.description };
    }
    case 'vision':
      return { title: c.theme, body: c.visionMilestone };
    case 'cognitive':
      return { title: c.theme, body: c.cognitiveMilestone };
    case 'growth':
      return { title: c.theme, body: c.growthSnapshot };
    case 'today':
      return { title: c.theme, body: journey.today?.text ?? c.notificationText };
    default:
      return { title: c.theme, body: c.description };
  }
}

export function JourneyNowCard({
  journey,
  focus = 'general',
  accent = 'milestone',
  babyName,
  className,
}: {
  journey: Journey;
  focus?: Focus;
  /** cat-* token stem, e.g. 'milestone' | 'growth' | 'food' | 'sleep' | 'skin'. */
  accent?: string;
  babyName?: string;
  className?: string;
}) {
  const { title, body } = headline(journey, focus);
  const pct = Math.min(100, Math.round((journey.day / journey.totalDays) * 100));
  const bg = `var(--cat-${accent}-bg)`;
  const text = `var(--cat-${accent}-text)`;

  return (
    <Card className={cn('overflow-hidden p-0', className)}>
      {/* Header strip: Day N of 2,000 */}
      <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ background: bg }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-[18px] w-[18px]" style={{ color: text }} />
          <span className="text-sm font-bold" style={{ color: text }}>
            {journey.graduated ? 'Journey complete' : `Day ${journey.day.toLocaleString()} of ${journey.totalDays.toLocaleString()}`}
          </span>
        </div>
        <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-bold" style={{ color: text }}>{journey.ageLabel}</span>
      </div>
      {/* progress hairline */}
      <div className="h-1 w-full" style={{ background: bg }}>
        <div className="h-full" style={{ width: `${pct}%`, background: text }} />
      </div>

      <div className="p-5">
        <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-stone-400">
          {babyName ? `${babyName} right now` : 'Where your baby is now'}
        </p>
        <h3 className="mt-0.5 font-display text-lg font-bold text-stone-900">{title}</h3>
        {body && <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{body}</p>}

        {journey.current.parentTip && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-stone-50 px-3.5 py-3">
            <Lightbulb className="mt-0.5 h-[17px] w-[17px] shrink-0" style={{ color: text }} />
            <p className="text-sm text-stone-600">{journey.current.parentTip}</p>
          </div>
        )}

        {journey.current.doctorFlag && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-[17px] w-[17px] shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Talk to a doctor if: </span>
              {journey.current.doctorFlag}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
