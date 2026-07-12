import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { previewRedeem } from '../../api/wallet';
import type { RedeemPreview } from '../../api/wallet';
import { inr } from '../../shop/format';
import { formatStars } from '../../lib/sitare';
import { SitareCoin } from './SitareBits';

type Ctx =
  | { context: 'cart'; items: { productId: string; quantity: number }[]; hasFormula?: boolean }
  | { context: 'consultation'; feeInr: number };

/**
 * The "Apply Sitare" control. It asks the SERVER how much can be redeemed
 * (balance, 20% eligible cap, whole-rupee steps — never computed client-side)
 * and reports the chosen points up via onApplied. A simple max-it toggle,
 * Amazon/Flipkart style.
 */
export function ApplySitare({
  ctx,
  applied,
  onApplied,
}: {
  ctx: Ctx;
  applied: number;
  onApplied: (points: number, discountInr: number) => void;
}) {
  const [preview, setPreview] = useState<RedeemPreview | null>(null);
  const key = ctx.context === 'cart' ? JSON.stringify(ctx.items) : `c:${ctx.feeInr}`;

  useEffect(() => {
    let alive = true;
    const input =
      ctx.context === 'cart'
        ? { context: 'cart' as const, items: ctx.items }
        : { context: 'consultation' as const, feeInr: ctx.feeInr };
    previewRedeem(input)
      .then((p) => alive && setPreview(p))
      .catch(() => alive && setPreview(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!preview) return null;

  const on = applied > 0;
  const maxInr = preview.maxRedeemableInr;
  const canRedeem = preview.maxRedeemablePoints > 0;
  const formulaNote = ctx.context === 'cart' && ctx.hasFormula;

  function toggle() {
    if (on) onApplied(0, 0);
    else onApplied(preview!.maxRedeemablePoints, preview!.maxRedeemableInr);
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      {canRedeem ? (
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" checked={on} onChange={toggle} className="peer sr-only" />
          <span className="relative grid h-6 w-11 shrink-0 place-items-start rounded-full bg-stone-200 p-0.5 transition-colors peer-checked:bg-[var(--sitare)]">
            <span className="h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[14px] font-bold text-stone-800">
              <SitareCoin size={16} /> Use my Credits
            </span>
            <span className="text-[12.5px] text-stone-500">
              {on ? (
                <>Applied {formatStars(applied)} ★ — <strong className="text-emerald-600">{inr(preview.discountInr)} off</strong></>
              ) : (
                <>Redeem up to {formatStars(preview.maxRedeemablePoints)} ★ for {inr(maxInr)} off</>
              )}
            </span>
          </span>
        </label>
      ) : (
        <div className="flex items-center gap-2 text-[13px] text-stone-500">
          <SitareCoin size={16} />
          {preview.balance > 0 ? 'No credits can be applied here yet.' : 'Earn credits to redeem on future orders.'}
        </div>
      )}
      {formulaNote && (
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug text-stone-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Credits apply to eligible items only — infant formula is excluded.
        </p>
      )}
    </div>
  );
}
