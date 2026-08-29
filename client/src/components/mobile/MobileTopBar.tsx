import { SitarePill } from '../sitare/SitareBits';
import { CartButton } from '../shop/CartButton';
import { BabySwitcherButton } from './BabySwitcher';

/**
 * The parent mobile app bar (below lg) — replaces the desktop Topbar. Left: the
 * persistent baby-context switcher (avatar · name · age → bottom sheet). Right:
 * the Sitare rewards pill and the cart. Respects the notch (--safe-top).
 */
export function MobileTopBar() {
  return (
    <header
      className="sticky top-[var(--imp-bar-h)] z-30 flex items-center gap-2 border-b border-stone-200/70 bg-[var(--surface-app)]/85 px-3 pb-2 backdrop-blur-md lg:hidden"
      style={{ paddingTop: 'calc(0.5rem + var(--safe-top))' }}
    >
      <BabySwitcherButton />
      <div className="ml-auto flex items-center gap-2">
        <SitarePill />
        <CartButton />
      </div>
    </header>
  );
}
