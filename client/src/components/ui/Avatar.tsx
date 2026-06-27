import { cn } from '../../lib/cn';
import { toneBadge } from './tones';
import type { Tone } from './tones';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<AvatarSize, string> = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-[52px] w-[52px] text-lg',
  xl: 'h-16 w-16 text-2xl',
};

// First + last initial, ignoring a leading "Dr." so doctors read as their name.
function initials(name: string): string {
  const parts = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// Round initials avatar. Default sits on the brand gradient (white text); pass a
// `tone` for a soft category-tinted variant (used for quieter/past cards).
export function Avatar({
  name,
  size = 'md',
  tone,
  className,
}: {
  name: string;
  size?: AvatarSize;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-display font-semibold leading-none shadow-soft',
        SIZE[size],
        tone ? toneBadge[tone] : 'brand-gradient text-white',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
