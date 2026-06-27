import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../shop/cart-context';

export function CartButton() {
  const { count, openDrawer } = useCart();
  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={count > 0 ? `Cart, ${count} items` : 'Cart'}
      title="Cart"
      className="relative grid h-9 w-9 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-100"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[0.6rem] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
