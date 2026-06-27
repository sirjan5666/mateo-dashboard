import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert } from 'lucide-react';
import { useT } from '../../i18n/context';

// Mandatory IMS-Act interstitial shown BEFORE entering the Neucomed (infant
// formula) section. Matches the mateo-shop-desktop concept: amber shield tile,
// statutory warning, and "no offers/discounts/promotions" wording. Must be
// acknowledged to continue; "Go back" stays on Mateo.
export function NeucomedGate({
  open,
  onAccept,
  onDecline,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDecline();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('button, a, input')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      prevFocus?.focus?.();
    };
  }, [open, onDecline]);

  if (!open) return null;

  return createPortal(
    <div onClick={onDecline} className="fixed inset-0 z-[80] grid place-items-center bg-stone-900/50 p-5" role="dialog" aria-modal="true" aria-label={t('shop.gateTitle')}>
      <div ref={panelRef} onClick={(e) => e.stopPropagation()} className="animate-popin w-full max-w-[460px] rounded-[26px] bg-white p-7 shadow-lift">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50">
            <ShieldAlert className="h-[22px] w-[22px] text-amber-700" />
          </span>
          <h2 className="font-display text-lg font-extrabold text-stone-900">{t('shop.gateTitle')}</h2>
        </div>
        <p className="text-sm leading-relaxed text-stone-500">{t('shop.gateBody')}</p>
        <div className="mt-5 flex gap-2.5">
          <button type="button" onClick={onDecline} className="h-[46px] flex-1 rounded-2xl border border-stone-200 bg-white text-sm font-bold text-stone-500 transition-colors hover:bg-stone-50">
            {t('shop.gateBack')}
          </button>
          <button type="button" onClick={onAccept} className="brand-gradient h-[46px] flex-1 rounded-2xl text-sm font-extrabold text-white shadow-[0_10px_20px_-8px_rgba(124,92,252,0.6)]">
            {t('shop.gateContinue')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
