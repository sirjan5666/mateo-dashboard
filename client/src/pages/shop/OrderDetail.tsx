import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CheckCircle2, MapPin } from 'lucide-react';
import { getMyOrder } from '../../api/shop';
import type { Order } from '../../api/shop';
import { ApiError } from '../../api/client';
import { useT } from '../../i18n/context';
import { inr, ORDER_STATUS_META } from '../../shop/format';
import { formatDateTimeIST } from '../../lib/age';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { Skeleton } from '../../components/ui/Skeleton';
import { OrderStatusTimeline } from '../../components/shop/OrderStatusTimeline';
import { NeucomedNotice } from '../../components/shop/NeucomedNotice';
import { SitareCoin } from '../../components/sitare/SitareBits';
import { formatStars } from '../../lib/sitare';

export default function OrderDetail() {
  const { id } = useParams();
  const t = useT();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getMyOrder(id)
      .then((d) => !cancelled && setOrder(d.order))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load this order.'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const backLink = (
    <Link to="/shop/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
      <ArrowLeft className="h-4 w-4" /> {t('shop.myOrders')}
    </Link>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <Card className="mt-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <Skeleton className="mt-4 h-40 w-full rounded-[26px]" />
      </div>
    );
  }

  const meta = ORDER_STATUS_META[order.status];
  const addr = order.shippingAddress;

  return (
    <div className="mx-auto max-w-3xl">
      {backLink}

      {order.payment.status === 'paid' && order.status === 'confirmed' && (
        <Card className="mt-3 flex items-center gap-3 border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-semibold">{t('shop.orderPlaced')}</p>
            <p className="text-sm">{t('shop.orderPlacedBody')}</p>
          </div>
        </Card>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-mono-ds text-2xl font-semibold text-stone-900">{order.orderNumber}</h1>
          <p className="text-sm text-stone-500">{formatDateTimeIST(order.createdAt)}</p>
        </div>
        <Pill tone={meta.tone}>{meta.label}</Pill>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-lg font-bold text-stone-900">{t('shop.trackOrder')}</h2>
        <div className="mt-4">
          <OrderStatusTimeline order={order} />
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-lg font-bold text-stone-900">{t('shop.items')}</h2>
        <ul className="mt-3 divide-y divide-stone-100">
          {order.items.map((it) => (
            <li key={it.productId + (it.size ?? '')} className="flex items-center gap-3 py-3">
              <img src={`/shop/${it.image}`} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-stone-50 object-contain p-1" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900">{it.name}</p>
                <p className="text-sm text-stone-500">
                  {it.quantity} × {inr(it.priceInr)}
                  {it.size ? ` · ${it.size}` : ''}
                </p>
              </div>
              <span className="font-semibold text-stone-900">{inr(it.priceInr * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1.5 border-t border-stone-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">{t('shop.subtotal')}</dt>
            <dd>{inr(order.subtotalInr)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">{t('shop.shipping')}</dt>
            <dd>{order.shippingInr === 0 ? t('shop.free') : inr(order.shippingInr)}</dd>
          </div>
          {order.sitare && order.sitare.discountInr > 0 && (
            <div className="flex justify-between text-emerald-700">
              <dt className="font-semibold">Credits redeemed ({formatStars(order.sitare.pointsRedeemed)} ★)</dt>
              <dd className="font-semibold">−{inr(order.sitare.discountInr)}</dd>
            </div>
          )}
          <div className="flex justify-between font-display text-base font-extrabold text-stone-900">
            <dt>{t('shop.total')}</dt>
            <dd>{inr(order.totalInr - (order.sitare?.discountInr ?? 0))}</dd>
          </div>
          <p className="pt-1 text-xs text-stone-400">
            {t('shop.paidVia')} {order.payment.method === 'mock' ? t('shop.testPayment') : 'Razorpay'}
          </p>
          {order.sitare && order.sitare.earnedPoints > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: 'var(--sitare-bg)', color: 'var(--sitare-deep)' }}>
              <SitareCoin size={14} /> You earned ★ {formatStars(order.sitare.earnedPoints)} credits
            </p>
          )}
        </dl>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-stone-900">
          <MapPin className="h-5 w-5 text-stone-400" /> {t('shop.deliverTo')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          {addr.fullName}
          <br />
          {addr.phone}
          {addr.email ? (
            <>
              <br />
              {addr.email}
            </>
          ) : null}
          <br />
          {addr.line1}
          {addr.line2 ? `, ${addr.line2}` : ''}
          <br />
          {addr.city}, {addr.state} {addr.pincode}
          <br />
          {addr.country}
        </p>
      </Card>

      {order.hasFormula && <NeucomedNotice className="mt-4" />}
    </div>
  );
}
