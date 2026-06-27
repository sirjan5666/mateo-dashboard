export type Tone = 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'stone';

// Soft tinted icon/badge backgrounds used across stat cards, action tiles, pills.
// NOTE: the `emerald` tone means "on-track / done" and intentionally uses the
// GREEN ramp — the violet brand lives on the emerald/violet Tailwind ramps, so
// status green must stay separate to keep its meaning.
export const toneBadge: Record<Tone, string> = {
  emerald: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
  stone: 'bg-stone-100 text-stone-500',
};

// Stronger pill styling (text + bg) for status chips.
export const tonePill: Record<Tone, string> = {
  emerald: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-700',
  sky: 'bg-sky-100 text-sky-800',
  violet: 'bg-violet-100 text-violet-800',
  stone: 'bg-stone-100 text-stone-600',
};

// Ring/track accents — text-* so an SVG stroke="currentColor" picks them up.
export const toneRing: Record<Tone, string> = {
  emerald: 'text-green-500',
  amber: 'text-amber-500',
  rose: 'text-rose-500',
  sky: 'text-sky-500',
  violet: 'text-violet-500',
  stone: 'text-stone-400',
};

// Solid status dots for the stat tallies.
export const toneDot: Record<Tone, string> = {
  emerald: 'bg-green-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  stone: 'bg-stone-300',
};
