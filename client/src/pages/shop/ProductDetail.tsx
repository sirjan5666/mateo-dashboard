import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Check, Leaf, Minus, Plus, ShoppingBag, Stethoscope } from 'lucide-react';
import { listShopProducts } from '../../api/shop';
import type { ShopProduct } from '../../api/shop';
import { ApiError } from '../../api/client';
import { useT } from '../../i18n/context';
import { useCart } from '../../shop/cart-context';
import { tintFor } from '../../shop/presentation';
import { inr } from '../../shop/format';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProductCard } from '../../components/shop/ProductCard';
import { NeucomedNotice } from '../../components/shop/NeucomedNotice';
import { ProductReviews } from '../../components/shop/ProductReviews';
import { SitareChip } from '../../components/sitare/SitareBits';
import { cn } from '../../lib/cn';

function MedicalPill() {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[12.5px] font-extrabold text-amber-800">
      <Stethoscope className="h-3.5 w-3.5" /> {t('shop.onMedicalAdvice')}
    </span>
  );
}

function FormulaRow({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-stone-400">{k}</span>
      <span className="text-right font-medium text-stone-700">{v}</span>
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const t = useT();
  const cart = useCart();
  const [all, setAll] = useState<ShopProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    listShopProducts()
      .then((d) => !cancelled && setAll(d.products))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load this product.'));
    return () => {
      cancelled = true;
    };
  }, []);

  const product = useMemo(() => all?.find((p) => p.id === id), [all, id]);
  const related = useMemo(() => (product ? (all ?? []).filter((p) => p.brand === product.brand && p.id !== product.id).slice(0, 4) : []), [all, product]);

  // Default the size once the product resolves (without setState-in-effect).
  const activeSize = size ?? product?.sizes?.[0];

  const backLink = (
    <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-500 transition-colors hover:text-stone-800">
      <ArrowLeft className="h-4 w-4" /> {t('shop.backToShop')}
    </Link>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        {backLink}
        <Card className="mt-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>
      </div>
    );
  }
  if (!all) {
    return (
      <div className="mx-auto max-w-6xl">
        {backLink}
        <div className="mt-4 grid gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-[32px]" />
          <div className="space-y-3">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="mx-auto max-w-6xl">
        {backLink}
        <Card className="mt-4 p-8 text-center text-sm text-stone-500">{t('shop.noProducts')}</Card>
      </div>
    );
  }

  const isFormula = product.brand === 'neucomed';

  function addToCart() {
    if (!product) return;
    cart.add(product, qty, activeSize);
    cart.openDrawer();
  }

  return (
    <div className="mx-auto max-w-6xl pb-28 lg:pb-0">
      {backLink}

      <div className="mt-4 grid items-start gap-10 lg:grid-cols-2">
        {/* image */}
        <div className="relative grid min-h-[440px] place-items-center overflow-hidden rounded-[32px]" style={{ background: tintFor(product.id) }}>
          <img src={`/shop/${product.image}`} alt={product.name} className="max-h-[400px] max-w-[60%] object-contain" style={{ filter: 'drop-shadow(0 24px 32px rgba(0,0,0,0.16))' }} />
          {/* Skincare-only: formula nutrient highlights are NOT shown as benefit chips (IMS Act). */}
          {!isFormula && product.highlights.length > 0 && (
            <div className="absolute bottom-5 left-5 flex flex-wrap gap-2">
              {product.highlights.slice(0, 3).map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-bold text-stone-600 backdrop-blur">
                  <Leaf className="h-3.5 w-3.5 text-green-700" /> {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* info */}
        <div>
          <h1 className="font-display text-[34px] font-bold leading-tight text-stone-900">{product.name}</h1>
          <p className="mt-1.5 text-base text-stone-500">{product.tagline}</p>
          {isFormula && <div className="mt-3.5"><MedicalPill /></div>}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="font-display text-[32px] font-extrabold text-stone-900">{inr(product.priceInr)}</p>
            {!isFormula && Math.floor(product.priceInr / 100) * 5 > 0 && (
              <SitareChip points={Math.floor(product.priceInr / 100) * 5} prefix="Earn" />
            )}
          </div>

          {isFormula && <div className="mt-4"><NeucomedNotice /></div>}

          {product.sizes && product.sizes.length > 0 && (
            <>
              <p className="mb-2 mt-6 font-display text-[15px] font-bold text-stone-900">{t('shop.size')}</p>
              <div className="flex flex-wrap gap-2.5">
                {product.sizes.map((s) => {
                  const active = s === activeSize;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={cn(
                        'rounded-2xl border px-5 py-2.5 text-sm font-bold transition-colors',
                        active ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50',
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-6 hidden items-stretch gap-3.5 lg:flex">
            <div className="inline-flex items-center rounded-2xl border border-stone-200 bg-white">
              <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-[52px] w-11 place-items-center text-stone-500 hover:bg-stone-50">
                <Minus className="h-[18px] w-[18px]" />
              </button>
              <span className="min-w-8 text-center font-display text-base font-extrabold text-stone-900">{qty}</span>
              <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(99, q + 1))} className="grid h-[52px] w-11 place-items-center text-stone-500 hover:bg-stone-50">
                <Plus className="h-[18px] w-[18px]" />
              </button>
            </div>
            <button
              type="button"
              onClick={addToCart}
              className="brand-gradient inline-flex h-[54px] flex-1 items-center justify-center gap-2.5 rounded-2xl text-[15.5px] font-extrabold text-white shadow-[0_14px_28px_-10px_rgba(124,92,252,0.6)]"
            >
              <ShoppingBag className="h-[19px] w-[19px]" /> {t('shop.addToCart')}
            </button>
          </div>

          <p className="mb-2 mt-7 font-display text-[15px] font-bold text-stone-900">{t('shop.aboutProduct')}</p>
          <p className="text-[14.5px] leading-relaxed text-stone-500">{product.description}</p>

          {!isFormula && product.highlights.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {product.highlights.map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5 text-[13.5px] text-stone-700">
                  <Check className="h-[15px] w-[15px] text-green-600" /> {f}
                </span>
              ))}
            </div>
          )}

          {isFormula && (
            <div className="mt-5 flex flex-col gap-1.5 rounded-2xl bg-stone-100 p-4">
              <FormulaRow k={t('shop.type')} v={product.type} />
              <FormulaRow k={t('shop.age')} v={product.ageRange} />
              <FormulaRow k={t('shop.size')} v={product.sizes?.join(' · ')} />
            </div>
          )}
          {isFormula && product.directions && (
            <div className="mt-5">
              <p className="mb-1.5 font-display text-[15px] font-bold text-stone-900">{t('shop.preparation')}</p>
              <p className="text-[13.5px] leading-relaxed text-stone-500">{product.directions}</p>
            </div>
          )}
          {isFormula && product.storage && (
            <div className="mt-5">
              <p className="mb-1.5 font-display text-[15px] font-bold text-stone-900">{t('shop.storage')}</p>
              <p className="text-[13.5px] leading-relaxed text-stone-500">{product.storage}</p>
            </div>
          )}

          {product.ingredients && (
            <details className="mt-6 border-t border-stone-200/70 pt-3.5">
              <summary className="cursor-pointer list-none font-display text-[15px] font-bold text-stone-900 [&::-webkit-details-marker]:hidden">
                {t('shop.ingredients')}
              </summary>
              <p className="mt-2.5 text-[13px] leading-relaxed text-stone-500">{product.ingredients}</p>
            </details>
          )}

          {isFormula && product.warning && (
            <p className="mt-5 rounded-xl bg-amber-50 p-3 text-[13px] font-medium text-amber-900">{product.warning}</p>
          )}
        </div>
      </div>

      {/* Ratings & reviews — never rendered for formula (component self-guards). */}
      <ProductReviews productId={product.id} />

      {related.length > 0 && (
        <>
          <h2 className="mb-5 mt-14 font-display text-[22px] font-bold text-stone-900">{t('shop.alsoLike')}</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((r) => (
              <ProductCard
                key={r.id}
                product={r}
                onAdd={(p) => {
                  cart.add(p);
                  cart.openDrawer();
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Mobile sticky add-to-cart bar (mobile-app concept). Portalled to <body>
          so it pins to the viewport — the AppShell <main> carries a GSAP transform
          that would otherwise become the containing block for `fixed`. */}
      {createPortal(
        <div
          className="fixed inset-x-0 bottom-0 z-[45] flex items-center gap-3 px-5 pb-7 pt-3.5 lg:hidden"
          style={{ background: 'linear-gradient(to top, var(--background) 72%, transparent)' }}
        >
          <div className="inline-flex items-center rounded-2xl border border-stone-200 bg-white">
            <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-[46px] w-10 place-items-center text-stone-500">
              <Minus className="h-[18px] w-[18px]" />
            </button>
            <span className="min-w-7 text-center font-display text-base font-extrabold text-stone-900">{qty}</span>
            <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(99, q + 1))} className="grid h-[46px] w-10 place-items-center text-stone-500">
              <Plus className="h-[18px] w-[18px]" />
            </button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            className="brand-gradient inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(124,92,252,0.6)]"
          >
            <ShoppingBag className="h-[18px] w-[18px]" /> {t('shop.addToCart')}
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
