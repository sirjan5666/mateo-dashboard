import { CheckCircle2 } from 'lucide-react';
import { useCart } from '../../shop/cart-context';
import { useT } from '../../i18n/context';

// Transient "added to cart" toast shown after a quick-add from the grid.
export function CartToast() {
  const { toastShown } = useCart();
  const t = useT();
  if (!toastShown) return null;
  return (
    <div className="animate-popin fixed bottom-7 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-stone-900 px-5 py-3 text-sm font-bold text-white shadow-lift">
      <CheckCircle2 className="h-[18px] w-[18px]" /> {t('shop.addedToCart')}
    </div>
  );
}
