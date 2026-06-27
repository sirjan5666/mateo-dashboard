import { Link } from 'react-router';
import { Check, Eye, Plus, Stethoscope } from 'lucide-react';
import { categoryFor, tintFor } from '../../shop/presentation';
import { inr } from '../../shop/format';
import { useT } from '../../i18n/context';
import { cn } from '../../lib/cn';
import type { ShopProduct } from '../../api/shop';

// Premium hover-lift skincare card: tinted image area, a real category micro-badge,
// two REAL highlight chips (verbatim from the catalog — the only trust signal), a
// single price + Add, and an optional quick-view eye.
//
// IMS Act 1992 (CLAUDE.md rule 4): the canonical formula surface is FormulaInfoCard,
// not this card. If a formula product is ever passed here it keeps the "On medical
// advice" badge and DROPS the category badge, highlight chips and quick-view upsell —
// no ratings, no benefit-framed claims. Do not re-add those for formula.
export function ProductCard({ product, onAdd, onQuickView }: { product: ShopProduct; onAdd: (p: ShopProduct) => void; onQuickView?: (p: ShopProduct) => void }) {
  const t = useT();
  const isFormula = product.brand === 'neucomed';
  const category = isFormula ? undefined : categoryFor(product.id);
  const chips = isFormula ? [] : product.highlights.slice(0, 2);
  return (
    <div data-reveal className="pop-hover group flex flex-col rounded-[20px] bg-white p-3 shadow-soft sm:rounded-[26px] sm:p-4">
      <div className="relative">
        <Link to={`/shop/p/${product.id}`} className="block">
          <div className="relative grid h-36 place-items-center rounded-[16px] sm:h-[200px] sm:rounded-[20px]" style={{ background: tintFor(product.id) }}>
            <img
              src={`/shop/${product.image}`}
              alt={product.name}
              loading="lazy"
              className="max-h-[86%] max-w-[74%] object-contain transition-transform duration-300 group-hover:scale-105"
            />
            {category && (
              <span className="absolute left-2 top-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-stone-700 backdrop-blur sm:left-3 sm:top-3">{category}</span>
            )}
            {isFormula && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-extrabold text-amber-800 sm:left-3 sm:top-3 sm:px-2.5 sm:text-[11px]">
                <Stethoscope className="h-3 w-3" /> {t('shop.onMedicalAdvice')}
              </span>
            )}
          </div>
        </Link>
        {onQuickView && !isFormula && (
          <button
            type="button"
            onClick={() => onQuickView(product)}
            aria-label={`Quick view ${product.name}`}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-stone-600 opacity-0 shadow-soft backdrop-blur transition-opacity group-hover:opacity-100 max-sm:opacity-100 sm:right-3 sm:top-3"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
      </div>
      <Link to={`/shop/p/${product.id}`} className="block">
        <h3 className="mt-3 font-display text-[15px] font-bold text-stone-900 sm:mt-3.5 sm:text-[17px]">{product.name}</h3>
        <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-stone-400 sm:text-[13px]">{product.tagline}</p>
      </Link>
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((h, i) => (
            <span key={h} className={cn('inline-flex max-w-full items-center gap-1 rounded-full bg-stone-100 px-2 py-1 text-[10.5px] font-bold text-stone-600 sm:text-[11px]', i === 1 && 'hidden sm:inline-flex')}>
              <Check className="h-3 w-3 shrink-0 text-green-600" />
              <span className="truncate">{h}</span>
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="font-display text-[17px] font-extrabold text-stone-900 sm:text-[19px]">{inr(product.priceInr)}</span>
        <button
          type="button"
          onClick={() => onAdd(product)}
          aria-label={`Add ${product.name} to cart`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[13px] font-bold transition-colors',
            'bg-emerald-600 text-white shadow-[0_6px_14px_-4px_rgba(124,92,252,0.6)]',
            'sm:bg-stone-100 sm:px-3.5 sm:text-emerald-800 sm:shadow-none sm:hover:bg-emerald-600 sm:hover:text-white',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('shop.add')}</span>
        </button>
      </div>
    </div>
  );
}
