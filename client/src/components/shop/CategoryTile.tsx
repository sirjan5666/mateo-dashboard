import type { LucideIcon } from 'lucide-react';
import { Bath, Check, Droplets, Leaf, Shield, Sparkles } from 'lucide-react';
import type { ShopCategory } from '../../shop/presentation';
import { cn } from '../../lib/cn';

type Cat = Exclude<ShopCategory, 'All'>;

// "Shop by need" tile — one per skincare category. Tints mirror the per-product
// tints in presentation.ts so the showcase stays on-palette. Skincare-only.
const META: Record<Cat, { tint: string; Icon: LucideIcon; color: string }> = {
  Wash: { tint: 'var(--cat-skin-bg)', Icon: Droplets, color: 'var(--cat-skin-text)' },
  Lotion: { tint: '#ede7ff', Icon: Sparkles, color: 'var(--brand-purple-deep)' },
  Oil: { tint: 'var(--cat-food-bg)', Icon: Leaf, color: 'var(--cat-food-text)' },
  Cream: { tint: 'var(--cat-growth-bg)', Icon: Shield, color: 'var(--cat-growth-text)' },
  Bar: { tint: 'var(--cat-sleep-bg)', Icon: Bath, color: 'var(--cat-sleep-text)' },
};

export function CategoryTile({ category, count, active, onSelect }: { category: Cat; count: number; active: boolean; onSelect: () => void }) {
  const { tint, Icon, color } = META[category];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn('pop-hover relative flex flex-col items-start gap-2.5 rounded-[24px] p-4 text-left', active && 'ring-2 ring-emerald-500')}
      style={{ background: tint }}
    >
      <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-soft">
        <Icon className="h-5 w-5" style={{ color }} />
      </span>
      <span className="font-display text-[15px] font-bold text-stone-900">{category}</span>
      <span className="text-[12px] font-medium text-stone-500">
        {count} {count === 1 ? 'product' : 'products'}
      </span>
      {active && (
        <span aria-hidden="true" className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white">
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
