import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CartContext, lineKey } from './cart-context';
import type { CartContextValue } from './cart-context';
import type { CartLine, ShopProduct } from '../api/shop';

const STORAGE_KEY = 'mateo:cart';

function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as CartLine[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(readCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const add = useCallback((product: ShopProduct, quantity = 1, size?: string) => {
    setItems((cur) => {
      const key = lineKey(product.id, size);
      const idx = cur.findIndex((l) => lineKey(l.productId, l.size) === key);
      if (idx >= 0) {
        const next = [...cur];
        next[idx] = { ...next[idx], quantity: Math.min(99, next[idx].quantity + quantity) };
        return next;
      }
      return [
        ...cur,
        {
          productId: product.id,
          name: product.name,
          brand: product.brand,
          priceInr: product.priceInr,
          image: product.image,
          size,
          quantity: Math.min(99, Math.max(1, quantity)),
        },
      ];
    });
  }, []);

  const setQty = useCallback((productId: string, size: string | undefined, quantity: number) => {
    setItems((cur) => {
      const key = lineKey(productId, size);
      if (quantity <= 0) return cur.filter((l) => lineKey(l.productId, l.size) !== key);
      return cur.map((l) => (lineKey(l.productId, l.size) === key ? { ...l, quantity: Math.min(99, quantity) } : l));
    });
  }, []);

  const remove = useCallback((productId: string, size?: string) => {
    const key = lineKey(productId, size);
    setItems((cur) => cur.filter((l) => lineKey(l.productId, l.size) !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  // Slide-in drawer + transient toast (storefront UX from the design).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const [toastShown, setToastShown] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const flashToast = useCallback(() => {
    setToastShown(true);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastShown(false), 1700);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const count = useMemo(() => items.reduce((n, l) => n + l.quantity, 0), [items]);
  const subtotalInr = useMemo(() => items.reduce((s, l) => s + l.priceInr * l.quantity, 0), [items]);

  const value: CartContextValue = useMemo(
    () => ({ items, count, subtotalInr, add, setQty, remove, clear, drawerOpen, openDrawer, closeDrawer, toastShown, flashToast }),
    [items, count, subtotalInr, add, setQty, remove, clear, drawerOpen, openDrawer, closeDrawer, toastShown, flashToast],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
