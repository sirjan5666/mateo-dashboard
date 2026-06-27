import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

// emerald-700 (not 600) keeps white label text at WCAG AA contrast (~5.5:1).
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800',
  secondary: 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-100',
  ghost: 'text-stone-600 hover:bg-stone-100',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

/** Shared class string so <Link>s can render as buttons too. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-60 disabled:pointer-events-none',
    SIZES[size],
    VARIANTS[variant],
    className,
  );
}
