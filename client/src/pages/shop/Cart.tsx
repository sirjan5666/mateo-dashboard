import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../../shop/cart-context';
import { inr } from '../../shop/format';
import { useT } from '../../i18n/context';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { buttonClass } from '../../components/ui/buttonStyles';
import { cn } from '../../lib/cn';

const SHIPPING_FLAT = 49;
const FREE_OVER = 499;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between', strong && 'font-display text-base font-extrabold text-stone-900')}>
      <dt className={cn(!strong && 'text-stone-500')}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function Cart() {
  const { items, subtotalInr, setQty, remove, count } = useCart();
  const t = useT();
  const navigate = useNavigate();
  const shipping = subtotalInr >= FREE_OVER || subtotalInr === 0 ? 0 : SHIPPING_FLAT;
  const total = subtotalInr + shipping;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" /> {t('shop.title')}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-extrabold text-stone-900">{t('shop.cart')}</h1>

      {items.length === 0 ? (
        <Card className="mt-5 px-6 py-12 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-stone-300" />
          <p className="mt-3 font-semibold text-stone-700">{t('shop.emptyCart')}</p>
          <Link to="/shop" className={cn(buttonClass('primary', 'md'), 'mt-4')}>
            {t('shop.startShopping')}
          </Link>
        </Card>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-3">
            {items.map((l) => (
              <Card key={`${l.productId}|${l.size ?? ''}`} className="flex gap-3 p-3">
                <img src={`/shop/${l.image}`} alt={l.name} className="h-20 w-20 shrink-0 rounded-xl bg-stone-50 object-contain p-1" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-stone-900">{l.name}</p>
                      {l.size && <p className="text-xs text-stone-500">{l.size}</p>}
                      {l.brand === 'neucomed' && (
                        <Pill tone="amber" className="mt-1">
                          {t('shop.onMedicalAdvice')}
                        </Pill>
                      )}
                    </div>
                    <button onClick={() => remove(l.productId, l.size)} aria-label="Remove item" className="text-stone-400 transition-colors hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="inline-flex items-center rounded-lg border border-stone-300">
                      <button aria-label="Decrease quantity" onClick={() => setQty(l.productId, l.size, l.quantity - 1)} className="grid h-8 w-8 place-items-center text-stone-600 hover:bg-stone-100">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{l.quantity}</span>
                      <button aria-label="Increase quantity" onClick={() => setQty(l.productId, l.size, l.quantity + 1)} className="grid h-8 w-8 place-items-center text-stone-600 hover:bg-stone-100">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="font-semibold text-stone-900">{inr(l.priceInr * l.quantity)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div>
            <Card className="p-5 lg:sticky lg:top-24">
              <h2 className="font-display text-lg font-bold text-stone-900">{t('shop.summary')}</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label={`${t('shop.subtotal')} (${count})`} value={inr(subtotalInr)} />
                <Row label={t('shop.shipping')} value={shipping === 0 ? t('shop.free') : inr(shipping)} />
                <div className="border-t border-stone-200 pt-2">
                  <Row label={t('shop.total')} value={inr(total)} strong />
                </div>
              </dl>
              <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => navigate('/shop/checkout')}>
                {t('shop.checkout')}
              </Button>
              <p className="mt-2 text-center text-xs text-stone-400">{t('shop.freeShippingHint')}</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
