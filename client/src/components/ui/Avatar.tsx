import { useState } from 'react';
import { cn } from '../../lib/cn';
import { toneBadge } from './tones';
import type { Tone } from './tones';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<AvatarSize, string> = {
  xs: 'h-7 w-7 text-xs',
  sm: 'h-9 w-9 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-[52px] w-[52px] text-lg',
  xl: 'h-16 w-16 text-2xl',
};

// Deterministic name → colour, so the same person always reads as the same
// hue across lists, headers, schedule rows and messages. Six distinct pro-theme
// hues (purple / blue / green / yellow / red / teal after the [data-theme=pro]
// remap). Opt-in via `hashColor` so existing call sites (which expect the brand
// gradient or a passed tone) are unchanged.
const HASH_PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
];

function hashIndex(name: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

// First + last initial, ignoring a leading "Dr." so doctors read as their name.
function initials(name: string): string {
  const parts = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/**
 * Round avatar. Backward-compatible: with just `name` it sits on the brand
 * gradient (white text); pass a `tone` for a soft tinted variant. New, additive:
 * `src` shows an uploaded photo (falls back to initials if it fails to load) and
 * `hashColor` derives a deterministic colour from the name.
 */
export function Avatar({
  name,
  size = 'md',
  tone,
  src,
  hashColor,
  className,
}: {
  name: string;
  size?: AvatarSize;
  tone?: Tone;
  src?: string | null;
  hashColor?: boolean;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = !!src && !broken;
  const colorClass = tone
    ? toneBadge[tone]
    : hashColor
      ? HASH_PALETTE[hashIndex(name, HASH_PALETTE.length)]
      : 'brand-gradient text-white';

  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-semibold leading-none shadow-soft',
        SIZE[size],
        !showImg && colorClass,
        className,
      )}
    >
      {showImg ? (
        <img src={src ?? undefined} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/**
 * Overlapping stack of avatars (e.g. a care team or family). Shows up to `max`
 * then a "+N" chip. Defaults to hashed colours so each person is distinct.
 */
export function AvatarGroup({
  names,
  srcs,
  size = 'sm',
  max = 4,
  hashColor = true,
  className,
}: {
  names: string[];
  srcs?: (string | null | undefined)[];
  size?: AvatarSize;
  max?: number;
  hashColor?: boolean;
  className?: string;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className={cn('flex items-center', className)}>
      {shown.map((n, i) => (
        <Avatar
          key={`${n}-${i}`}
          name={n}
          src={srcs?.[i] ?? undefined}
          size={size}
          hashColor={hashColor}
          className={cn('ring-2 ring-[var(--surface-card)]', i > 0 && '-ml-2.5')}
        />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            '-ml-2.5 inline-grid shrink-0 place-items-center rounded-full bg-stone-200 font-semibold text-stone-600 ring-2 ring-[var(--surface-card)]',
            SIZE[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
