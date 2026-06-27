import { Bell, CircleCheck, CircleDot, Eye, RefreshCw, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '../ui/tones';

// Shared patient-status → icon / tone for the doctor panel. Where a template
// defines its own status tone, prefer that for the colour; use statusIcon() for
// the paired icon so a status reads without relying on colour alone (WCAG).
const STATUS_ICON: Record<string, LucideIcon> = {
  active: CircleDot,
  follow_up: Bell,
  monitoring: Eye,
  clearing: TrendingUp,
  maintenance: RefreshCw,
  discharged: CircleCheck,
};

const STATUS_TONE: Record<string, Tone> = {
  active: 'emerald',
  follow_up: 'amber',
  monitoring: 'sky',
  clearing: 'violet',
  maintenance: 'amber',
  discharged: 'stone',
};

export function statusIcon(key: string): LucideIcon {
  return STATUS_ICON[key] ?? CircleDot;
}

export function statusTone(key: string): Tone {
  return STATUS_TONE[key] ?? 'stone';
}
