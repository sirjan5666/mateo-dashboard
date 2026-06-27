import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { Check, ShoppingBag, X } from 'lucide-react';
import type { ShopProduct } from '../../api/shop';
import { tintFor } from '../../shop/presentation';
import { inr } from '../../shop/format';
import { useT } from '../../i18n/context';
import { cn } from '../../lib/cn';

// Skincare quick-peek — a fast add-to-cart without leaving the grid. Wired ONLY
// on Mateo skincare cards (never on formula, per IMS Act). Links out to the full
// ProductDetail rather than re-implementing it.
export function QuickViewModal({ product, onClose, onAdd }: { product: ShopProduct; onClose: () => void; onAdd: (p: ShopProduct, size?: string) => void }) {
  const t = useT();
  const [size, setSize] = useState<string | undefined>(product.sizes?.[0]);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('button, a, input')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      prevFocus?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[80] grid place-items-center bg-stone-900/50 p-5" role="dialog" aria-modal="true" aria-label={`Quick view: ${product.name}`}>
      <div ref={panelRef} onClick={(e) => e.stopPropagation()} className="animate-popin relative grid w-full max-w-[560px] gap-5 rounded-[26px] bg-white p-5 shadow-lift sm:grid-cols-[200px_minmax(0,1fr)] sm:p-6">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-[1] grid h-8 w-8 place-items-center rounded-full bg-white/85 text-stone-600 shadow-soft backdrop-blur transition-colors hover:bg-white">
          <X className="h-4 w-4" />
        </button>
        <div className="grid h-44 place-items-center rounded-[20px] sm:h-full" style={{ background: tintFor(product.id) }}>
          <img src={`/shop/${product.image}`} alt={product.name} className="max-h-[80%] max-w-[74%] object-contain" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-stone-900">{product.name}</h2>
          <p className="mt-0.5 text-sm text-stone-500">{product.tagline}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-stone-900">{inr(product.priceInr)}</p>
          <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-stone-500">{product.description}</p>
          {product.highlights.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
              {product.highlights.slice(0, 4).map((h) => (
                <span key={h} className="inline-flex items-center gap-1 text-[12px] font-medium text-stone-600">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  {h}
                </span>
              ))}
            </div>
          )}
          {product.sizes && product.sizes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={cn('rounded-xl border px-3 py-1.5 text-sm font-bold transition-colors', s === size ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-stone-200 text-stone-500 hover:bg-stone-50')}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onAdd(product, size);
                onClose();
              }}
              className="brand-gradient inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(124,92,252,0.6)]"
            >
              <ShoppingBag className="h-4 w-4" /> {t('shop.addToCart')}
            </button>
            <Link to={`/shop/p/${product.id}`} className="inline-flex h-11 items-center justify-center rounded-2xl border border-stone-200 px-4 text-sm font-bold text-stone-600 hover:bg-stone-50">
              Full details
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
