import { useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { createOrder, verifyPayment } from '../../api/shop';
import type { ShippingAddress } from '../../api/shop';
import { ApiError } from '../../api/client';
import { useCart } from '../../shop/cart-context';
import { useAuth } from '../../auth/context';
import { useT } from '../../i18n/context';
import { inr } from '../../shop/format';
import { loadRazorpay, openRazorpay } from '../../shop/razorpay';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { inputCls } from '../../components/ui/field';
import { buttonClass } from '../../components/ui/buttonStyles';
import { cn } from '../../lib/cn';

const SHIPPING_FLAT = 49;
const FREE_OVER = 499;

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

export default function Checkout() {
  const { items, subtotalInr, clear, count } = useCart();
  const { user } = useAuth();
  const t = useT();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: user?.name ?? '',
    phone: '',
    email: user?.email ?? '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shipping = subtotalInr >= FREE_OVER || subtotalInr === 0 ? 0 : SHIPPING_FLAT;
  const total = subtotalInr + shipping;

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mt-5 px-6 py-12 text-center">
          <p className="font-semibold text-stone-700">{t('shop.emptyCart')}</p>
          <Link to="/shop" className={cn(buttonClass('primary', 'md'), 'mt-4')}>
            {t('shop.startShopping')}
          </Link>
        </Card>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setProcessing(true);
    const shippingAddress: ShippingAddress = { ...form, country: 'India' };
    try {
      const res = await createOrder({
        items: items.map((l) => ({ productId: l.productId, quantity: l.quantity, size: l.size })),
        shippingAddress,
      });

      if (res.razorpay) {
        const ok = await loadRazorpay();
        if (!ok) {
          setError(t('shop.payLoadError'));
          setProcessing(false);
          return;
        }
        const opened = openRazorpay({
          key: res.razorpay.keyId,
          amount: res.razorpay.amount,
          currency: res.razorpay.currency,
          order_id: res.razorpay.orderId,
          name: 'Mateo',
          description: `Order ${res.order.orderNumber}`,
          prefill: { name: form.fullName, email: form.email || undefined, contact: form.phone },
          theme: { color: '#7c5cfc' },
          handler: (resp) => {
            void (async () => {
              try {
                await verifyPayment(res.order.id, resp.razorpay_payment_id, resp.razorpay_signature);
                clear();
                navigate(`/shop/orders/${res.order.id}`);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : t('shop.payVerifyError'));
                setProcessing(false);
              }
            })();
          },
          modal: { ondismiss: () => setProcessing(false) },
        });
        if (!opened) {
          setError(t('shop.payLoadError'));
          setProcessing(false);
        }
        return;
      }

      // Mock path — the server already marked this paid + confirmed.
      clear();
      navigate(`/shop/orders/${res.order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place your order. Please try again.');
      setProcessing(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/shop/cart" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" /> {t('shop.cart')}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-extrabold text-stone-900">{t('shop.checkout')}</h1>

      {error && <Card className="mt-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      <form onSubmit={submit} className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          <h2 className="font-display text-lg font-bold text-stone-900">{t('shop.shippingDetails')}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label={t('shop.fullName')} className="sm:col-span-2">
              <input required value={form.fullName} onChange={set('fullName')} className={inputCls} autoComplete="name" />
            </Field>
            <Field label={t('shop.phone')}>
              <input required value={form.phone} onChange={set('phone')} className={inputCls} inputMode="tel" autoComplete="tel" />
            </Field>
            <Field label={t('shop.email')}>
              <input value={form.email} onChange={set('email')} className={inputCls} type="email" autoComplete="email" />
            </Field>
            <Field label={t('shop.address1')} className="sm:col-span-2">
              <input required value={form.line1} onChange={set('line1')} className={inputCls} autoComplete="address-line1" />
            </Field>
            <Field label={t('shop.address2')} className="sm:col-span-2">
              <input value={form.line2} onChange={set('line2')} className={inputCls} autoComplete="address-line2" />
            </Field>
            <Field label={t('shop.city')}>
              <input required value={form.city} onChange={set('city')} className={inputCls} autoComplete="address-level2" />
            </Field>
            <Field label={t('shop.state')}>
              <input required value={form.state} onChange={set('state')} className={inputCls} autoComplete="address-level1" />
            </Field>
            <Field label={t('shop.pincode')}>
              <input required value={form.pincode} onChange={set('pincode')} className={inputCls} inputMode="numeric" maxLength={6} autoComplete="postal-code" />
            </Field>
            <Field label={t('shop.country')}>
              <input value="India" disabled className={cn(inputCls, 'bg-stone-100 text-stone-500')} />
            </Field>
          </div>
        </Card>

        <div>
          <Card className="p-5 lg:sticky lg:top-24">
            <h2 className="font-display text-lg font-bold text-stone-900">{t('shop.summary')}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((l) => (
                <li key={`${l.productId}|${l.size ?? ''}`} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate text-stone-600">
                    {l.quantity}× {l.name}
                    {l.size ? ` (${l.size})` : ''}
                  </span>
                  <span className="shrink-0 font-medium text-stone-800">{inr(l.priceInr * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-2 border-t border-stone-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-500">
                  {t('shop.subtotal')} ({count})
                </dt>
                <dd>{inr(subtotalInr)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">{t('shop.shipping')}</dt>
                <dd>{shipping === 0 ? t('shop.free') : inr(shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2 font-display text-base font-extrabold text-stone-900">
                <dt>{t('shop.total')}</dt>
                <dd>{inr(total)}</dd>
              </div>
            </dl>
            <Button type="submit" variant="primary" size="lg" className="mt-4 w-full" disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('shop.processing')}
                </>
              ) : (
                <>
                  {t('shop.pay')} {inr(total)}
                </>
              )}
            </Button>
            <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-stone-400">
              <ShieldCheck className="h-3.5 w-3.5" /> {t('shop.securePay')}
            </p>
          </Card>
        </div>
      </form>
    </div>
  );
}
