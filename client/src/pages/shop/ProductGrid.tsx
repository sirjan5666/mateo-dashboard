import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronRight, Search, SearchX } from 'lucide-react';
import { listShopProducts } from '../../api/shop';
import type { Brand, ShopProduct } from '../../api/shop';
import { ApiError } from '../../api/client';
import { useCart } from '../../shop/cart-context';
import { categoryFor, CATEGORIES } from '../../shop/presentation';
import type { ShopCategory } from '../../shop/presentation';
import { BRAND_LABEL } from '../../shop/brands';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProductCard } from '../../components/shop/ProductCard';
import { QuickViewModal } from '../../components/shop/QuickViewModal';
import { cn } from '../../lib/cn';

type SortKey = 'featured' | 'name' | 'price-asc' | 'price-desc';

// Category route slug ('all' | 'wash' | …) ↔ the presentation category label.
function labelForSlug(slug: string): ShopCategory | 'All' {
  const match = CATEGORIES.find((c) => c.toLowerCase() === slug.toLowerCase());
  return match ?? 'All';
}

export default function ProductGrid() {
  const { brand, category } = useParams();
  const brandKey: Brand = brand === 'neucomed' ? 'neucomed' : 'mateo';
  const catLabel = labelForSlug(category ?? 'all');
  const cart = useCart();

  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [quickView, setQuickView] = useState<ShopProduct | null>(null);

  useEffect(() => {
    let cancelled = false;
    listShopProducts(brandKey)
      .then((d) => !cancelled && setProducts(d.products))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load products.'));
    return () => {
      cancelled = true;
    };
  }, [brandKey]);

  const filtered = useMemo(() => {
    let items = products ?? [];
    if (catLabel !== 'All') items = items.filter((p) => categoryFor(p.id) === catLabel);
    const q = query.trim().toLowerCase();
    if (q) items = items.filter((p) => `${p.name} ${p.tagline}`.toLowerCase().includes(q));
    const out = [...items];
    if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'price-asc') out.sort((a, b) => a.priceInr - b.priceInr);
    else if (sort === 'price-desc') out.sort((a, b) => b.priceInr - a.priceInr);
    return out;
  }, [products, catLabel, query, sort]);

  const loading = products === null;

  function quickAdd(p: ShopProduct) {
    cart.add(p);
    cart.flashToast();
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-[13px] font-medium text-stone-400">
        <Link to="/shop" className="hover:text-stone-700">Shop</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to={`/shop/b/${brandKey}`} className="hover:text-stone-700">{BRAND_LABEL[brandKey]}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-stone-700">{catLabel}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900">{catLabel === 'All' ? `All ${BRAND_LABEL[brandKey]}` : catLabel}</h1>
          <p className="mt-1 text-sm text-stone-500">{loading ? 'Loading…' : `${filtered.length} product${filtered.length === 1 ? '' : 's'}`}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
          <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-2">
            <Search className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              className="w-full border-none bg-transparent text-sm text-stone-700 outline-none placeholder:text-stone-400 sm:w-40"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort products"
            className="rounded-full border border-stone-200 bg-white px-3.5 py-2 text-[13.5px] font-bold text-stone-600"
          >
            <option value="featured">Featured</option>
            <option value="name">Name A–Z</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
      </div>

      {/* Category chips */}
      <div className="scrollbar-thin mt-4 flex gap-2.5 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => {
          const slug = c.toLowerCase();
          const active = catLabel === c;
          return (
            <Link
              key={c}
              to={`/shop/b/${brandKey}/${slug}`}
              className={cn('shrink-0 rounded-full px-4 py-2 text-[13.5px] font-bold transition-colors', active ? 'bg-violet-600 text-white shadow-[0_8px_16px_-6px_rgba(124,92,252,0.5)]' : 'bg-white text-stone-500 shadow-soft hover:text-stone-700')}
            >
              {c}
            </Link>
          );
        })}
      </div>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-[26px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-3 p-10 text-center">
          <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-3xl bg-stone-100">
            <SearchX className="h-7 w-7 text-stone-400" />
          </span>
          <p className="text-sm text-stone-500">{query.trim() ? `No products match “${query.trim()}”.` : 'Nothing here yet.'}</p>
          <Link to={`/shop/b/${brandKey}`} className="rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white">Browse categories</Link>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={quickAdd} onQuickView={setQuickView} />
          ))}
        </div>
      )}

      {quickView && (
        <QuickViewModal product={quickView} onClose={() => setQuickView(null)} onAdd={(p, size) => { cart.add(p, 1, size); cart.flashToast(); }} />
      )}
    </div>
  );
}
