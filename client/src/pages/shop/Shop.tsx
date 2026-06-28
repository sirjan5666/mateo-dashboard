import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, ArrowUpDown, ChevronRight, Droplet, Leaf, Lock, PackageCheck, Plus, Search, SearchX, ShieldCheck, Smile, Sparkles, Truck } from 'lucide-react';
import { listShopProducts } from '../../api/shop';
import type { Brand, ShopProduct } from '../../api/shop';
import { ApiError } from '../../api/client';
import { useT } from '../../i18n/context';
import { useReveal } from '../../lib/gsap';
import { useCart } from '../../shop/cart-context';
import { useNeucomedAck } from '../../shop/neucomed';
import { CATEGORIES, categoryFor, tintFor } from '../../shop/presentation';
import type { ShopCategory } from '../../shop/presentation';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProductCard } from '../../components/shop/ProductCard';
import { CategoryTile } from '../../components/shop/CategoryTile';
import { QuickViewModal } from '../../components/shop/QuickViewModal';
import { FormulaInfoCard } from '../../components/shop/FormulaInfoCard';
import { NeucomedNotice } from '../../components/shop/NeucomedNotice';
import { NeucomedGate } from '../../components/shop/NeucomedGate';
import { cn } from '../../lib/cn';

type SortKey = 'featured' | 'name' | 'price-asc' | 'price-desc';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
];

// Real-attribute trust pillars (verbatim baby-skincare facts, never health claims).
const FEATURES: { Icon: LucideIcon; title: string; sub: string; tint: string; color: string }[] = [
  { Icon: Droplet, title: 'pH 5.5 balanced', sub: 'Matched to delicate baby skin', tint: 'var(--cat-skin-bg)', color: 'var(--cat-skin-text)' },
  { Icon: Smile, title: 'Tear-free', sub: 'Gentle enough for hair & face', tint: 'var(--cat-food-bg)', color: 'var(--cat-food-text)' },
  { Icon: ShieldCheck, title: 'Dermatologically tested', sub: 'Tested for sensitive skin', tint: 'var(--cat-growth-bg)', color: 'var(--cat-growth-text)' },
  { Icon: Sparkles, title: 'Free from harsh chemicals', sub: 'No sulphates, parabens or mineral oil', tint: '#ede7ff', color: 'var(--brand-purple-deep)' },
];

// Head-to-toe routine — real products by id, shown individually at MRP (no bundle).
const ROUTINE: { id: string; step: string; tint: string; color: string }[] = [
  { id: 'mateo-tip-to-toe-wash', step: 'Bathe', tint: 'var(--cat-sleep-bg)', color: 'var(--cat-sleep-text)' },
  { id: 'mateo-moisture-lotion', step: 'Moisturise', tint: '#ede7ff', color: 'var(--brand-purple-deep)' },
  { id: 'mateo-massage-oil', step: 'Massage', tint: 'var(--cat-food-bg)', color: 'var(--cat-food-text)' },
];

const SERVICES: { Icon: LucideIcon; title: string; sub: string }[] = [
  { Icon: Lock, title: 'Secure checkout', sub: 'Server-verified payments' },
  { Icon: Truck, title: 'Pan-India delivery', sub: 'Shipped to your door' },
  { Icon: PackageCheck, title: 'Easy order tracking', sub: 'Live status on every order' },
];

function Hero() {
  const t = useT();
  return (
    <div className="relative overflow-hidden rounded-[28px] px-6 py-10 sm:rounded-[36px] sm:px-14 sm:py-12" style={{ minHeight: 300, background: 'linear-gradient(125deg, #efe7ff 0%, #f8f4ff 45%, #ffe7f3 100%)' }}>
      <div aria-hidden="true" className="blob absolute -top-10 right-[22%] h-56 w-56 rounded-full" style={{ background: '#cbb8ff' }} />
      <div aria-hidden="true" className="blob absolute -bottom-20 right-10 h-64 w-64 rounded-full" style={{ background: '#ffc7e6', animationDelay: '-5s' }} />
      <div className="relative z-[2] flex items-center gap-6">
        <div className="max-w-[540px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-1.5 text-[12.5px] font-extrabold uppercase tracking-wider text-emerald-800">
            <Sparkles className="h-3.5 w-3.5" /> {t('shop.heroEyebrow')}
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.08] text-stone-900 sm:text-[52px] sm:leading-[1.05]">{t('shop.heroTitle')}</h2>
          <p className="mt-4 max-w-[420px] text-base leading-relaxed text-stone-500">{t('shop.heroSub')}</p>
          <button
            type="button"
            onClick={() => document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth' })}
            className="brand-gradient mt-6 inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-white shadow-[0_14px_28px_-10px_rgba(124,92,252,0.6)]"
          >
            {t('shop.heroCta')} <ArrowRight className="h-4 w-4" />
          </button>
          <div className="mt-5 flex flex-wrap gap-2">
            {['pH 5.5 balanced', 'Tear-free', 'Dermatologically tested'].map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-[12px] font-bold text-stone-600">
                <Leaf className="h-3.5 w-3.5 text-green-700" /> {a}
              </span>
            ))}
          </div>
        </div>
        <div className="relative ml-auto hidden h-[280px] w-[300px] place-items-center md:grid">
          <span aria-hidden="true" className="blob absolute left-4 top-8 h-20 w-28 rounded-full bg-white/80" />
          <span aria-hidden="true" className="blob absolute bottom-6 right-2 h-16 w-24 rounded-full bg-white/70" style={{ animationDelay: '-7s' }} />
          <div aria-hidden="true" className="absolute inset-8 rounded-full" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.95), rgba(255,255,255,0))' }} />
          <img src="/shop/mateo-lotion.png" alt="" aria-hidden="true" className="animate-float relative max-h-full max-w-full object-contain" style={{ filter: 'drop-shadow(0 26px 34px rgba(124,92,252,0.28))' }} />
        </div>
      </div>
    </div>
  );
}

function SortMenu({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const current = SORTS.find((s) => s.key === value) ?? SORTS[0];
  return (
    <div ref={ref} className="relative">
      <button ref={triggerRef} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-[13.5px] font-bold text-stone-600 hover:bg-stone-50">
        <ArrowUpDown className="h-4 w-4 text-stone-400" /> {current.label}
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-lift">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="option"
              aria-selected={s.key === value}
              onClick={() => {
                onChange(s.key);
                setOpen(false);
              }}
              className={cn('block w-full rounded-xl px-3 py-2 text-left text-sm font-medium', s.key === value ? 'bg-emerald-50 text-emerald-800' : 'text-stone-600 hover:bg-stone-100')}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FormulaDecisionStrip({ products }: { products: ShopProduct[] }) {
  return (
    <div className="rounded-[24px] border border-stone-200/70 bg-white p-5 shadow-soft">
      <h3 className="font-display text-[17px] font-bold text-stone-900">Which type, by your baby&apos;s needs</h3>
      <p className="mt-1 text-[13px] text-stone-500">Your doctor will advise which is right — this is for information only.</p>
      <div className="mt-2 flex flex-col divide-y divide-stone-100">
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => document.getElementById(p.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex items-center gap-3 py-3 text-left"
          >
            <span className="inline-flex shrink-0 items-center rounded-full bg-stone-100 px-3 py-1 text-[12px] font-bold text-stone-600">{p.ageRange}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-700">{p.type}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Shop() {
  const t = useT();
  const cart = useCart();
  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<Brand>('mateo');
  const [gateOpen, setGateOpen] = useState(false);
  const [category, setCategory] = useState<ShopCategory>('All');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [quickView, setQuickView] = useState<ShopProduct | null>(null);
  const { acked, ack } = useNeucomedAck();

  useEffect(() => {
    let cancelled = false;
    listShopProducts()
      .then((d) => !cancelled && setProducts(d.products))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load the shop. Please try again.'));
    return () => {
      cancelled = true;
    };
  }, []);

  const isMateo = brand === 'mateo';
  const loading = products === null;
  const counts = useMemo(
    () => ({
      mateo: (products ?? []).filter((p) => p.brand === 'mateo').length,
      neucomed: (products ?? []).filter((p) => p.brand === 'neucomed').length,
    }),
    [products],
  );
  const neucomedProducts = useMemo(() => (products ?? []).filter((p) => p.brand === 'neucomed'), [products]);

  const filtered = useMemo(() => {
    let items = (products ?? []).filter((p) => p.brand === brand);
    if (isMateo && category !== 'All') items = items.filter((p) => categoryFor(p.id) === category);
    const q = query.trim().toLowerCase();
    if (q) items = items.filter((p) => `${p.name} ${p.tagline}`.toLowerCase().includes(q));
    return items;
  }, [products, brand, isMateo, category, query]);

  const sortedFiltered = useMemo(() => {
    const items = [...filtered];
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'price-asc') items.sort((a, b) => a.priceInr - b.priceInr);
    else if (sort === 'price-desc') items.sort((a, b) => b.priceInr - a.priceInr);
    return items; // 'featured' keeps catalog order
  }, [filtered, sort]);

  function selectBrand(next: Brand) {
    if (next === 'neucomed' && !acked) {
      setGateOpen(true);
      return;
    }
    setBrand(next);
    setCategory('All');
    setQuery('');
  }

  function quickAdd(p: ShopProduct) {
    cart.add(p);
    cart.flashToast();
  }
  function categoryCount(c: Exclude<ShopCategory, 'All'>) {
    return (products ?? []).filter((p) => p.brand === 'mateo' && categoryFor(p.id) === c).length;
  }
  function selectCategory(c: ShopCategory) {
    setCategory(c);
    setTimeout(() => document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }

  const gridRef = useReveal<HTMLDivElement>([sortedFiltered.length, brand, category, sort], { selector: '[data-reveal]', y: 14, stagger: 0.04 });
  const formulaRef = useReveal<HTMLDivElement>([neucomedProducts.length, brand], { selector: '[data-reveal]', y: 14, stagger: 0.04 });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex justify-center overflow-x-auto">
        <SegmentedControl
          value={brand}
          onChange={selectBrand}
          options={[
            { value: 'mateo' as Brand, label: t('shop.tab.mateo'), count: counts.mateo || undefined },
            { value: 'neucomed' as Brand, label: t('shop.tab.neucomed'), count: counts.neucomed || undefined },
          ]}
        />
      </div>

      {error && <Card className="mb-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {isMateo ? (
        <>
          <Hero />

          {/* Shop by need */}
          <section className="mt-10">
            <p className="eyebrow">Find what you need</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-stone-900">Shop by need</h2>
            <div className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-5">
              {CATEGORIES.filter((c): c is Exclude<ShopCategory, 'All'> => c !== 'All').map((c) => (
                <CategoryTile key={c} category={c} count={categoryCount(c)} active={category === c} onSelect={() => selectCategory(c)} />
              ))}
            </div>
          </section>

          {/* Trust strip */}
          <section className="mt-9 grid grid-cols-2 gap-3.5 md:grid-cols-4">
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

          {/* Section header + discovery toolbar */}
          <div id="shop-grid" className="mb-5 mt-10 flex scroll-mt-6 flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-stone-900">{t('shop.skincareTitle')}</h2>
              <p className="mt-1 text-sm text-stone-500">
                {loading ? t('shop.skincareSub') : `${sortedFiltered.length} ${sortedFiltered.length === 1 ? 'product' : 'products'}${query.trim() ? ` for “${query.trim()}”` : ''}`}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
              <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-2">
                <Search className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('shop.searchPlaceholder')}
                  aria-label={t('shop.searchPlaceholder')}
                  className="w-full border-none bg-transparent text-sm text-stone-700 outline-none placeholder:text-stone-400 sm:w-36"
                />
              </div>
              <div className="scrollbar-thin -mx-1 flex min-w-0 flex-1 gap-2.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:p-0">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    aria-pressed={category === c}
                    className={cn('shrink-0 rounded-full px-4 py-2 text-[13.5px] font-bold transition-colors', category === c ? 'bg-emerald-600 text-white shadow-[0_8px_16px_-6px_rgba(124,92,252,0.5)]' : 'bg-white text-stone-500 shadow-soft hover:text-stone-700')}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <SortMenu value={sort} onChange={setSort} />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-72 w-full rounded-[26px]" />
              ))}
            </div>
          ) : sortedFiltered.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 p-10 text-center">
              <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-3xl bg-stone-100">
                <SearchX className="h-7 w-7 text-stone-400" />
              </span>
              <p className="text-sm text-stone-500">
                {query.trim() ? `No skincare matches “${query.trim()}”.` : `Nothing in ${category} yet.`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCategory('All');
                  setQuery('');
                }}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
              >
                Clear filters
              </button>
            </Card>
          ) : (
            <div ref={gridRef} className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {sortedFiltered.map((p) => (
                <ProductCard key={p.id} product={p} onAdd={quickAdd} onQuickView={setQuickView} />
              ))}
            </div>
          )}

          {/* Head-to-toe routine */}
          {!loading && (
            <section className="mt-14 rounded-[28px] p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, var(--brand-purple-tint), #ffffff)' }}>
              <p className="eyebrow">Daily care</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-stone-900">Your baby&apos;s care, head to toe</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {ROUTINE.map((r, i) => {
                  const p = (products ?? []).find((x) => x.id === r.id);
                  if (!p) return null;
                  return (
                    <div key={r.id} className="flex items-center gap-3.5 rounded-[24px] bg-white p-4 shadow-soft">
                      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-base font-extrabold" style={{ background: r.tint, color: r.color }}>
                        {i + 1}
                      </span>
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl" style={{ background: tintFor(p.id) }}>
                        <img src={`/shop/${p.image}`} alt="" aria-hidden="true" className="max-h-[80%] max-w-[80%] object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{r.step}</p>
                        <p className="truncate font-display text-[14px] font-bold text-stone-900">{p.name}</p>
                        <p className="truncate text-[12px] text-stone-500">{p.highlights[0]}</p>
                      </div>
                      <button type="button" onClick={() => quickAdd(p)} aria-label={`Add ${p.name} to cart`} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-emerald-800 transition-colors hover:bg-emerald-600 hover:text-white">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

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
            <p className="mt-5 border-t border-stone-100 pt-4 text-center text-[13px] text-stone-500">{t('shop.freeShippingHint')}</p>
          </section>
        </>
      ) : (
        /* ── Neucomed infant-formula: calm, gated, information-first (IMS Act) ── */
        <section className="mt-2">
          <div className="mb-4">
            <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-stone-500">Information</span>
            <h2 className="mt-2 font-display text-2xl font-bold text-stone-900">{t('shop.formulaTitle')}</h2>
            <p className="mt-1 text-sm text-stone-500">{t('shop.formulaSub')}</p>
          </div>
          <NeucomedNotice />
          {loading ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-80 w-full rounded-[24px]" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-5">
                <FormulaDecisionStrip products={neucomedProducts} />
              </div>
              <div ref={formulaRef} className="mt-5 grid items-start gap-5 lg:grid-cols-2">
                {neucomedProducts.map((p) => (
                  <FormulaInfoCard key={p.id} product={p} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <NeucomedGate
        open={gateOpen}
        onAccept={() => {
          ack();
          setGateOpen(false);
          setBrand('neucomed');
          setCategory('All');
        }}
        onDecline={() => setGateOpen(false)}
      />

      {quickView && <QuickViewModal product={quickView} onClose={() => setQuickView(null)} onAdd={(p, size) => { cart.add(p, 1, size); cart.flashToast(); }} />}
    </div>
  );
}
