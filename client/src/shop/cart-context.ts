import { createContext, useContext } from 'react';
import type { CartLine, ShopProduct } from '../api/shop';

export interface CartContextValue {
  items: CartLine[];
  count: number; // total quantity across lines
  subtotalInr: number;
  add: (product: ShopProduct, quantity?: number, size?: string) => void;
  setQty: (productId: string, size: string | undefined, quantity: number) => void;
  remove: (productId: string, size?: string) => void;
  clear: () => void;
  // Storefront UI: the slide-in cart drawer + the "added to cart" toast.
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toastShown: boolean;
  flashToast: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

// Same product in a different size is a distinct cart line.
export function lineKey(productId: string, size?: string): string {
  return `${productId}|${size ?? ''}`;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
