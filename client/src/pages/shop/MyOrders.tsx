import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, PackageSearch } from 'lucide-react';
import { listMyOrders } from '../../api/shop';
import type { Order } from '../../api/shop';
import { ApiError } from '../../api/client';
import { useT } from '../../i18n/context';
import { useReveal } from '../../lib/gsap';
import { inr, ORDER_STATUS_META } from '../../shop/format';
import { formatDateIST } from '../../lib/age';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { Skeleton } from '../../components/ui/Skeleton';
import { buttonClass } from '../../components/ui/buttonStyles';
import { cn } from '../../lib/cn';

export default function MyOrders() {
  const t = useT();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyOrders()
      .then((d) => !cancelled && setOrders(d.orders))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load your orders.'));
    return () => {
      cancelled = true;
    };
  }, []);

  const listRef = useReveal<HTMLDivElement>([orders?.length], { selector: '[data-reveal]', y: 12 });

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" /> {t('shop.title')}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-extrabold text-stone-900">{t('shop.myOrders')}</h1>

      {error && <Card className="mt-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {orders === null ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-[26px]" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="mt-5 px-6 py-12 text-center">
          <PackageSearch className="mx-auto h-10 w-10 text-stone-300" />
          <p className="mt-3 font-semibold text-stone-700">{t('shop.noOrders')}</p>
          <Link to="/shop" className={cn(buttonClass('primary', 'md'), 'mt-4')}>
            {t('shop.startShopping')}
          </Link>
        </Card>
      ) : (
        <div ref={listRef} className="mt-5 flex flex-col gap-3">
          {orders.map((o) => {
            const meta = ORDER_STATUS_META[o.status];
            return (
              <Link key={o.id} to={`/shop/orders/${o.id}`} data-reveal>
                <Card className="flex items-center gap-4 p-4 transition-shadow hover:shadow-lift">
                  <div className="flex -space-x-3">
                    {o.items.slice(0, 3).map((it) => (
                      <img
                        key={it.productId + (it.size ?? '')}
                        src={`/shop/${it.image}`}
                        alt=""
                        className="h-12 w-12 rounded-xl border-2 border-white bg-stone-50 object-contain p-0.5"
                      />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-stone-900">{o.orderNumber}</p>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </div>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {formatDateIST(o.createdAt)} · {o.items.length} {t('shop.itemsLabel')}
                    </p>
                  </div>
                  <span className="font-display font-extrabold text-stone-900">{inr(o.totalInr)}</span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
