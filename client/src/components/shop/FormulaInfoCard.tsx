import { Link } from 'react-router';
import { ChevronRight, Stethoscope } from 'lucide-react';
import type { ShopProduct } from '../../api/shop';
import { tintFor } from '../../shop/presentation';
import { inr } from '../../shop/format';
import { useT } from '../../i18n/context';

// Calm, information-first infant-formula card (IMS Act 1992). Deliberately carries
// NONE of the skincare marketing affordances — no highlight "benefit" framing, no
// quick-view upsell, no gradient Add CTA, no ratings/offers. Price appears once as
// neutral MRP. Every card shows the statutory warning + an "On medical advice"
// badge + the medical-supervision note. Anchor id lets the decision strip scroll here.
function Row({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-stone-400">{k}</span>
      <span className="text-right font-medium text-stone-700">{v}</span>
    </div>
  );
}

function Fold({ label, body }: { label: string; body?: string }) {
  if (!body) return null;
  return (
    <details className="border-t border-stone-200/70 pt-2.5">
      <summary className="cursor-pointer list-none text-[13.5px] font-bold text-stone-700 [&::-webkit-details-marker]:hidden">{label}</summary>
      <p className="mt-2 text-[13px] leading-relaxed text-stone-500">{body}</p>
    </details>
  );
}

export function FormulaInfoCard({ product }: { product: ShopProduct }) {
  const t = useT();
  const supervisionNote = product.medicalSupervision && !/supervision/i.test(product.warning ?? '') ? ' Use only under medical supervision.' : '';
  return (
    <div id={product.id} data-reveal className="flex scroll-mt-6 flex-col rounded-[24px] border border-stone-200/70 bg-white p-5 shadow-soft">
      <div className="flex items-start gap-4">
        <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-2xl" style={{ background: tintFor(product.id) }}>
          <img src={`/shop/${product.image}`} alt={product.name} className="max-h-[80%] max-w-[80%] object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[17px] font-bold text-stone-900">{product.name}</h3>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">
              <Stethoscope className="h-3 w-3" /> {t('shop.onMedicalAdvice')}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] text-stone-500">{product.tagline}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-stone-100 p-3.5">
        <Row k={t('shop.type')} v={product.type} />
        <Row k={t('shop.age')} v={product.ageRange} />
        <Row k={t('shop.size')} v={product.sizes?.join(' · ')} />
      </div>

      {/* IMS Act: formula highlights are nutrient-feature phrases ("With DHA & ARA",
          "Energy-dense …") — NOT shown as ticked "benefit" chips (an inducement). The
          same facts stay available factually in the description + the Ingredients fold. */}
      <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-stone-500">{product.description}</p>

      <div className="mt-3 flex flex-col gap-1">
        <Fold label={t('shop.preparation')} body={product.directions} />
        <Fold label={t('shop.storage')} body={product.storage} />
        <Fold label={t('shop.ingredients')} body={product.ingredients} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-stone-200/70 pt-3.5">
        <div>
          <p className="font-display text-[15px] font-bold text-stone-900">MRP {inr(product.priceInr)}</p>
          <p className="text-[11px] text-stone-400">incl. of all taxes</p>
        </div>
        <Link to={`/shop/p/${product.id}`} className="inline-flex items-center gap-1 rounded-xl border border-stone-300 px-3.5 py-2 text-[13px] font-bold text-stone-600 hover:bg-stone-50">
          View details <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {product.warning && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[12.5px] font-medium leading-relaxed text-amber-900">
          {product.warning}
          {supervisionNote}
        </p>
      )}
    </div>
  );
}
