import type { ReactNode } from 'react';
import { Card } from './Card';
import { cn } from '../../lib/cn';

// The friendly per-tracker hero: a colored eyebrow, a warm headline, a short
// description, and the tracker's animal mascot on the right. Purely decorative —
// drop it in under a page header to give each tracker its character.
export function MascotHero({
  mascot,
  alt,
  eyebrow,
  eyebrowColor,
  title,
  description,
  className,
}: {
  mascot: string;
  alt: string;
  eyebrow: string;
  eyebrowColor: string; // a CSS color, e.g. 'var(--cat-growth-text)'
  title: string;
  description: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden p-0', className)}>
      <div className="flex items-center gap-3 py-2 pl-6 pr-3">
        <div className="min-w-0 flex-1 py-2">
          <span className="eyebrow" style={{ color: eyebrowColor }}>{eyebrow}</span>
          <h2 className="mb-1.5 mt-1.5 font-display text-[1.35rem] font-semibold leading-tight text-stone-900">{title}</h2>
          <p className="max-w-sm text-sm leading-relaxed text-stone-500">{description}</p>
        </div>
        <img src={mascot} alt={alt} className="h-32 w-auto shrink-0 object-contain sm:h-44 md:h-48" />
      </div>
    </Card>
  );
}
