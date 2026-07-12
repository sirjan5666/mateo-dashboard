import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Droplet, Lock, PackageCheck, ShieldCheck, Smile, Sparkles, Stethoscope, Truck } from 'lucide-react';
import { listShopProducts } from '../../api/shop';
import type { Brand, ShopProduct } from '../../api/shop';
import { ApiError } from '../../api/client';
import { useT } from '../../i18n/context';
import { BRAND_BLURB } from '../../shop/brands';
import { Card } from '../../components/ui/Card';
import { SitareCoin } from '../../components/sitare/SitareBits';

// Real-attribute trust pillars (verbatim baby-skincare facts, never health claims).
const FEATURES: { Icon: LucideIcon; title: string; sub: string; tint: string; color: string }[] = [
  { Icon: Droplet, title: 'pH 5.5 balanced', sub: 'Matched to delicate baby skin', tint: 'var(--cat-skin-bg)', color: 'var(--cat-skin-text)' },
  { Icon: Smile, title: 'Tear-free', sub: 'Gentle enough for hair & face', tint: 'var(--cat-food-bg)', color: 'var(--cat-food-text)' },
  { Icon: ShieldCheck, title: 'Dermatologically tested', sub: 'Tested for sensitive skin', tint: 'var(--cat-growth-bg)', color: 'var(--cat-growth-text)' },
  { Icon: Sparkles, title: 'Free from harsh chemicals', sub: 'No sulphates, parabens or mineral oil', tint: '#ede7ff', color: 'var(--brand-purple-deep)' },
];

const SERVICES: { Icon: LucideIcon; title: string; sub: string }[] = [
  { Icon: Lock, title: 'Secure checkout', sub: 'Server-verified payments' },
  { Icon: Truck, title: 'Pan-India delivery', sub: 'Shipped to your door' },
  { Icon: PackageCheck, title: 'Easy order tracking', sub: 'Live status on every order' },
];

function Hero() {
  const t = useT();
  return (
    <div className="relative overflow-hidden rounded-[28px] px-6 py-10 sm:rounded-[36px] sm:px-14 sm:py-12" style={{ minHeight: 280, background: 'linear-gradient(125deg, #efe7ff 0%, #f8f4ff 45%, #ffe7f3 100%)' }}>
      <div aria-hidden="true" className="blob absolute -top-10 right-[22%] h-56 w-56 rounded-full" style={{ background: '#cbb8ff' }} />
      <div aria-hidden="true" className="blob absolute -bottom-20 right-10 h-64 w-64 rounded-full" style={{ background: '#ffc7e6', animationDelay: '-5s' }} />
      <div className="relative z-[2] max-w-[560px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-1.5 text-[12.5px] font-extrabold uppercase tracking-wider text-emerald-800">
          <Sparkles className="h-3.5 w-3.5" /> {t('shop.heroEyebrow')}
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-[1.08] text-stone-900 sm:text-[48px] sm:leading-[1.05]">{t('shop.heroTitle')}</h1>
        <p className="mt-4 max-w-[440px] text-base leading-relaxed text-stone-500">{t('shop.heroSub')}</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-3.5 py-2 text-[13px] font-bold" style={{ color: 'var(--sitare-deep)' }}>
          <SitareCoin size={16} /> Earn Sitare on every order — redeem for money off
        </div>
      </div>
    </div>
  );
}

function BrandCard({ to, name, blurb, image, count, formula }: { to: string; name: string; blurb: string; image: string; count: number | null; formula?: boolean }) {
  return (
    <Link to={to} className="pop-hover group flex flex-col overflow-hidden rounded-[28px] bg-white shadow-soft">
      <div className="relative grid h-52 place-items-center" style={{ background: formula ? 'var(--cat-record-bg)' : 'linear-gradient(135deg, #ede7ff, #fff)' }}>
        <img src={`/shop/${image}`} alt="" aria-hidden className="max-h-40 max-w-[52%] object-contain transition-transform duration-300 group-hover:scale-105" style={{ filter: 'drop-shadow(0 18px 26px rgba(0,0,0,0.14))' }} />
        {formula && (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">
            <Stethoscope className="h-3 w-3" /> On medical advice
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-stone-900">{name}</h2>
          {count != null && !formula && <span className="text-[12px] font-bold text-stone-400">{count} products</span>}
        </div>
        <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-stone-500">{blurb}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-extrabold" style={{ color: formula ? 'var(--cat-record-text)' : 'var(--brand-purple-deep)' }}>
          {formula ? 'View information' : 'Shop skincare'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export default function Shop() {
  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listShopProducts()
      .then((d) => !cancelled && setProducts(d.products))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load the shop. Please try again.'));
    return () => {
      cancelled = true;
    };
  }, []);

  const countFor = (b: Brand) => (products ? products.filter((p) => p.brand === b).length : null);

  return (
    <div className="mx-auto max-w-6xl">
      <Hero />

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* Brands */}
      <section className="mt-10">
        <p className="eyebrow">Our brands</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-stone-900">Shop by brand</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <BrandCard to="/shop/b/mateo" name="Mateo" blurb={BRAND_BLURB.mateo} image="mateo-lotion.png" count={countFor('mateo')} />
          <BrandCard to="/shop/b/neucomed" name="Neucomed" blurb={BRAND_BLURB.neucomed} image="neucomil-stage-1.png" count={countFor('neucomed')} formula />
        </div>
      </section>

      {/* Trust strip */}
      <section className="mt-10 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex items-start gap-3 rounded-[22px] bg-white p-4 shadow-soft">
            <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: f.tint }}>
              <f.Icon className="h-5 w-5" style={{ color: f.color }} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[14px] font-bold leading-tight text-stone-900">{f.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-stone-500">{f.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Head-to-toe hint band */}
      <section className="mt-9 flex flex-wrap items-center justify-between gap-4 rounded-[28px] p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, var(--brand-purple-tint), #ffffff)' }}>
        <div>
          <p className="eyebrow">Daily care</p>
          <h2 className="mt-1 font-display text-xl font-bold text-stone-900">Your baby&apos;s care, head to toe</h2>
          <p className="mt-1 max-w-md text-[13.5px] text-stone-500">Bathe, moisturise and massage with gentle, pH-balanced skincare made for delicate baby skin.</p>
        </div>
        <Link to="/shop/b/mateo/all" className="brand-gradient inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[14.5px] font-extrabold text-white shadow-[0_14px_28px_-10px_rgba(124,92,252,0.6)]">
          Explore all products <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Service / trust footer */}
      <section className="mt-9 rounded-[28px] border border-stone-200/60 bg-white p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.title} className="flex items-center gap-3">
              <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50">
                <s.Icon className="h-5 w-5 text-emerald-700" />
              </span>
              <div>
                <p className="font-display text-[14px] font-bold text-stone-900">{s.title}</p>
                <p className="text-[12px] text-stone-500">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
