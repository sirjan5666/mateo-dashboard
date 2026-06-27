import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from './Card';
import { IconBadge } from './IconBadge';
import type { Tone } from './tones';

export function StatCard({
  label,
  value,
  icon,
  tone = 'emerald',
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        <IconBadge icon={icon} tone={tone} />
      </div>
      <p className="mt-3 text-[2rem] font-extrabold leading-none tracking-tight text-stone-900">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-stone-500">{hint}</p>}
    </Card>
  );
}
