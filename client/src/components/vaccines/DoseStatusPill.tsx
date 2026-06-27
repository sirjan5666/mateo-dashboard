import { Pill } from '../ui/Pill';
import type { Tone } from '../ui/tones';
import type { DoseStatus } from '../../api/vaccines';

const DOSE_STATUS: Record<DoseStatus, { tone: Tone; label: string }> = {
  done: { tone: 'emerald', label: 'Given' },
  due: { tone: 'amber', label: 'Due now' },
  overdue: { tone: 'rose', label: 'Overdue' },
  upcoming: { tone: 'stone', label: 'Upcoming' },
};

export function DoseStatusPill({ status }: { status: DoseStatus }) {
  const s = DOSE_STATUS[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}
