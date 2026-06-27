import { cn } from '../../lib/cn';
import { toneDot } from './tones';
import type { Tone } from './tones';

export function StatTally({ value, label, tone = 'stone' }: { value: number; label: string; tone?: Tone }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <span className={cn('h-2 w-2 rounded-full', toneDot[tone])} />
        <span className="text-xl font-bold text-stone-800">{value}</span>
      </div>
      <p className="mt-0.5 text-xs text-stone-500">{label}</p>
    </div>
  );
}
