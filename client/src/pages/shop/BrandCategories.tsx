import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { listShopProducts } from '../../api/shop';
import type { Brand, ShopProduct } from '../../api/shop';
import { ApiError } from '../../api/client';
import { categoryFor, CATEGORIES } from '../../shop/presentation';
import type { ShopCategory } from '../../shop/presentation';
import { BRAND_LABEL, BRAND_BLURB } from '../../shop/brands';
import { useNeucomedAck } from '../../shop/neucomed';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { CategoryTile } from '../../components/shop/CategoryTile';
import { FormulaInfoCard } from '../../components/shop/FormulaInfoCard';
import { NeucomedNotice } from '../../components/shop/NeucomedNotice';
import { NeucomedGate } from '../../components/shop/NeucomedGate';

export default function BrandCategories() {
  const { brand } = useParams();
  const brandKey: Brand = brand === 'neucomed' ? 'neucomed' : 'mateo';
  const navigate = useNavigate();
  const { acked, ack } = useNeucomedAck();

  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Neucomed is gated: show the IMS-Act interstitial until acknowledged.
  const [gateOpen, setGateOpen] = useState(brandKey === 'neucomed' && !acked);

  useEffect(() => {
    let cancelled = false;
    listShopProducts(brandKey)
      .then((d) => !cancelled && setProducts(d.products))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load the shop.'));
    return () => {
      cancelled = true;
    };
  }, [brandKey]);

  const categoryCount = useMemo(() => {
    const map = new Map<ShopCategory, number>();
    for (const p of products ?? []) {
      const c = categoryFor(p.id);
      if (c) map.set(c, (map.get(c) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const loading = products === null;

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-1 text-[13px] font-medium text-stone-400">
      <Link to="/shop" className="hover:text-stone-700">Shop</Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className="text-stone-700">{BRAND_LABEL[brandKey]}</span>
    </nav>
  );

  // ── Neucomed: gated, information-first formula list (no categories, no rewards) ──
  if (brandKey === 'neucomed') {
    return (
      <div className="mx-auto max-w-5xl">
        {breadcrumb}
        <div className="mt-3">
          <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-stone-500">Information</span>
          <h1 className="mt-2 font-display text-2xl font-bold text-stone-900">Neucomil infant nutrition</h1>
          <p className="mt-1 text-sm text-stone-500">{BRAND_BLURB.neucomed}</p>
        </div>
        <div className="mt-4">
          <NeucomedNotice />
        </div>
        {error && <Card className="mt-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}
        {loading ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full rounded-[24px]" />
            ))}
          </div>
        ) : (
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
            {(products ?? []).map((p) => (
              <FormulaInfoCard key={p.id} product={p} />
            ))}
          </div>
        )}

        <NeucomedGate
          open={gateOpen}
          onAccept={() => {
            ack();
            setGateOpen(false);
          }}
          onDecline={() => navigate('/shop')}
        />
      </div>
    );
  }

  // ── Mateo: category tiles → product grid ──
  return (
    <div className="mx-auto max-w-6xl">
      {breadcrumb}
      <div className="mt-3">
        <h1 className="font-display text-2xl font-bold text-stone-900">{BRAND_LABEL.mateo} skincare</h1>
        <p className="mt-1 text-sm text-stone-500">{BRAND_BLURB.mateo}</p>
      </div>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      <p className="eyebrow mt-7">Browse</p>
      <h2 className="mt-1 font-display text-xl font-bold text-stone-900">Shop by need</h2>
      <div className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
        {/* "All" tile first, then each real category. */}
        <Link
          to={`/shop/b/mateo/all`}
          className="flex flex-col justify-between rounded-[22px] bg-white p-4 shadow-soft transition-transform hover:-translate-y-0.5"
        >
          <span className="font-display text-[15px] font-bold text-stone-900">All products</span>
          <span className="mt-6 text-[12px] font-semibold text-stone-400">{loading ? '…' : `${products?.length ?? 0} items`}</span>
        </Link>
        {CATEGORIES.filter((c): c is Exclude<ShopCategory, 'All'> => c !== 'All').map((c) => (
          <CategoryTile key={c} category={c} count={categoryCount.get(c) ?? 0} active={false} onSelect={() => navigate(`/shop/b/mateo/${c.toLowerCase()}`)} />
        ))}
      </div>
    </div>
  );
}
