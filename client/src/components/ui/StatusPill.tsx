import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { tonePill } from './tones';
import type { Tone } from './tones';

/** Describes one status: its label, tone and icon — so status reads the same everywhere. */
export interface StatusMeta {
  label: string;
  tone: Tone;
  icon: LucideIcon;
}

/**
 * Status chip that pairs colour with an icon AND a label, so a status is
 * distinguishable without relying on colour alone (WCAG). Use for patient
 * status, appointment status, invoice status, etc.
 */
export function StatusPill({
  label,
  tone,
  icon: Icon,
  className,
}: {
  label: string;
  tone: Tone;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tonePill[tone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
