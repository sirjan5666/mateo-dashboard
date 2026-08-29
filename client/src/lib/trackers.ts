import { Activity, Apple, Droplets, FileText, Moon, Pill, Star, Syringe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * The canonical parent tracker set for the mobile app — the exact 8 health
 * trackers from the existing dashboard sidebar (Sidebar.tsx `TRACKERS`), minus
 * "Ask Dai Maa" (the assistant lives on its own tab). Teeth is intentionally not
 * surfaced here, matching current dashboard behaviour.
 *
 * One source of truth for name (i18n key), icon, mascot and the tracker's
 * existing category colour, so every mobile surface renders a tracker the same.
 */
export interface TrackerDef {
  seg: string;
  labelKey: string;
  taglineKey: string;
  icon: LucideIcon;
  /** Accent (icon + rail) — the tracker's existing category colour. */
  color: string;
  /** Soft tinted surface for the icon medallion. */
  bg: string;
  /** AA-safe text colour on `bg`. */
  text: string;
  /** Existing tracker mascot, when it has one. */
  mascot?: string;
}

export const TRACKERS: TrackerDef[] = [
  { seg: 'vaccines', labelKey: 'tracker.vaccines', taglineKey: 'tracker.vaccines.tagline', icon: Syringe, color: 'var(--cat-vaccine)', bg: 'var(--cat-vaccine-bg)', text: 'var(--cat-vaccine-text)', mascot: '/baby-vaccines.png' },
  { seg: 'growth', labelKey: 'tracker.growth', taglineKey: 'tracker.growth.tagline', icon: Activity, color: 'var(--cat-growth)', bg: 'var(--cat-growth-bg)', text: 'var(--cat-growth-text)', mascot: '/giraffe-growth.png' },
  { seg: 'food', labelKey: 'tracker.food', taglineKey: 'tracker.food.tagline', icon: Apple, color: 'var(--cat-food)', bg: 'var(--cat-food-bg)', text: 'var(--cat-food-text)', mascot: '/tiger-food.png' },
  { seg: 'sleep', labelKey: 'tracker.sleep', taglineKey: 'tracker.sleep.tagline', icon: Moon, color: 'var(--cat-sleep)', bg: 'var(--cat-sleep-bg)', text: 'var(--cat-sleep-text)', mascot: '/bear-sleep.png' },
  // Medicines has no --cat token in the design system; it uses a fixed cyan.
  { seg: 'medicines', labelKey: 'tracker.medicines', taglineKey: 'tracker.medicines.tagline', icon: Pill, color: '#0891b2', bg: '#e0f5fa', text: '#0e7490' },
  { seg: 'skin', labelKey: 'tracker.skin', taglineKey: 'tracker.skin.tagline', icon: Droplets, color: 'var(--cat-skin)', bg: 'var(--cat-skin-bg)', text: 'var(--cat-skin-text)', mascot: '/elephant-skin.png' },
  { seg: 'milestones', labelKey: 'tracker.milestones', taglineKey: 'tracker.milestones.tagline', icon: Star, color: 'var(--cat-milestone)', bg: 'var(--cat-milestone-bg)', text: 'var(--cat-milestone-text)', mascot: '/milestones/hero.png' },
  { seg: 'records', labelKey: 'tracker.records', taglineKey: 'tracker.records.tagline', icon: FileText, color: 'var(--cat-record)', bg: 'var(--cat-record-bg)', text: 'var(--cat-record-text)' },
];
