import { useNavigate } from 'react-router';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '../../shop/cart-context';
import { tintFor } from '../../shop/presentation';
import { inr } from '../../shop/format';
import { useT } from '../../i18n/context';
import { cn } from '../../lib/cn';

const SHIPPING_FLAT = 49;
const FREE_OVER = 499;

// Slide-in cart drawer (from the mateo-shop-desktop concept). Mounted globally so
// the topbar cart icon and product pages can open it anywhere. Its Checkout button
// hands off to the existing shipping + payment page.
export function CartDrawer() {
  const { items, subtotalInr, setQty, remove, drawerOpen, closeDrawer } = useCart();
  const t = useT();
  const navigate = useNavigate();
  const shipping = subtotalInr >= FREE_OVER || subtotalInr === 0 ? 0 : SHIPPING_FLAT;
  const total = subtotalInr + shipping;

  function checkout() {
    closeDrawer();
    navigate('/shop/checkout');
  }

  return (
    <div className={cn('fixed inset-0 z-[60]', drawerOpen ? '' : 'pointer-events-none')} aria-hidden={!drawerOpen}>
      <div onClick={closeDrawer} className={cn('absolute inset-0 bg-stone-900/40 transition-opacity duration-300', drawerOpen ? 'opacity-100' : 'opacity-0')} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('shop.yourCart')}
        className={cn(
          'absolute bottom-0 right-0 top-0 flex w-full flex-col bg-stone-50 shadow-lift transition-transform duration-300 ease-out sm:w-[420px] sm:max-w-[92vw]',
          drawerOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-stone-200/70 px-6 py-5">
          <h2 className="font-display text-xl font-extrabold text-stone-900">{t('shop.yourCart')}</h2>
          <button type="button" onClick={closeDrawer} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl bg-white text-stone-500 transition-colors hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="py-16 text-center text-stone-400">
              <ShoppingBag className="mx-auto h-9 w-9" />
              <p className="mt-3 text-sm">{t('shop.emptyCart')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((l) => (
                <div key={`${l.productId}|${l.size ?? ''}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl" style={{ background: tintFor(l.productId) }}>
                    <img src={`/shop/${l.image}`} alt={l.name} className="max-h-[82%] max-w-[78%] object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-stone-900">{l.name}</p>
                    {l.size && <p className="text-xs text-stone-400">{l.size}</p>}
                    <p className="font-display text-sm font-extrabold text-emerald-800">{inr(l.priceInr)}</p>
                    <div className="mt-1 inline-flex items-center rounded-lg border border-stone-200">
                      <button type="button" aria-label="Decrease quantity" onClick={() => setQty(l.productId, l.size, l.quantity - 1)} className="grid h-7 w-7 place-items-center text-stone-500 hover:bg-stone-100">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{l.quantity}</span>
                      <button type="button" aria-label="Increase quantity" onClick={() => setQty(l.productId, l.size, l.quantity + 1)} className="grid h-7 w-7 place-items-center text-stone-500 hover:bg-stone-100">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <button type="button" onClick={() => remove(l.productId, l.size)} aria-label="Remove item" className="self-start text-stone-400 transition-colors hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-stone-200/70 bg-white px-6 pb-6 pt-4">
            <div className="flex justify-between py-0.5 text-sm text-stone-500">
              <span>{t('shop.subtotal')}</span>
              <span>{inr(subtotalInr)}</span>
            </div>
            <div className="flex justify-between py-0.5 text-sm text-stone-500">
              <span>{t('shop.shipping')}</span>
              <span>{shipping === 0 ? t('shop.free') : inr(shipping)}</span>
            </div>
            <div className="my-2 h-px bg-stone-200/70" />
            <div className="mb-3 flex justify-between font-display text-base font-extrabold text-stone-900">
              <span>{t('shop.total')}</span>
              <span>{inr(total)}</span>
            </div>
            <button
              type="button"
              onClick={checkout}
              className="brand-gradient inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(124,92,252,0.6)]"
            >
              {t('shop.checkout')} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
