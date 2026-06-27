import { BadgeCheck, Ban, ExternalLink, Package, PackageCheck, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Order, OrderStatus } from '../../api/shop';
import { cn } from '../../lib/cn';
import { formatDateTimeIST } from '../../lib/age';
import { ORDER_STATUS_META } from '../../shop/format';

const STEPS: { status: Extract<OrderStatus, 'confirmed' | 'packed' | 'shipped' | 'delivered'>; label: string; icon: LucideIcon }[] = [
  { status: 'confirmed', label: 'Confirmed', icon: BadgeCheck },
  { status: 'packed', label: 'Packed', icon: Package },
  { status: 'shipped', label: 'Shipped', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: PackageCheck },
];

export function OrderStatusTimeline({ order }: { order: Order }) {
  if (order.status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
        <Ban className="h-5 w-5" />
        <span className="text-sm font-semibold">This order was cancelled.</span>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.status === order.status);
  const tracking = order.tracking;

  return (
    <div className="flex flex-col gap-5">
      {/* Stepper */}
      <ol className="flex items-center">
        {STEPS.map((s, i) => {
          const reached = stepIndex >= i;
          const Icon = s.icon;
          return (
            <li key={s.status} className={cn('flex flex-1 items-center', i === STEPS.length - 1 && 'flex-none')}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-full border-2 transition-colors',
                    reached ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-200 bg-white text-stone-300',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className={cn('text-[0.7rem] font-semibold', reached ? 'text-stone-800' : 'text-stone-400')}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <span className={cn('mx-1 h-0.5 flex-1 rounded-full', stepIndex > i ? 'bg-emerald-600' : 'bg-stone-200')} />}
            </li>
          );
        })}
      </ol>

      {/* Tracking */}
      {(tracking.trackingNumber || tracking.carrier) && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm">
          <p className="font-semibold text-stone-800">Tracking</p>
          <p className="mt-1 text-stone-600">
            {tracking.carrier && <span>{tracking.carrier}</span>}
            {tracking.carrier && tracking.trackingNumber && <span> · </span>}
            {tracking.trackingNumber && <span className="font-mono">{tracking.trackingNumber}</span>}
          </p>
          {tracking.url && (
            <a href={tracking.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline">
              Track shipment <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      {/* History */}
      <ul className="space-y-2">
        {[...order.statusHistory].reverse().map((e, i) => (
          <li key={`${e.status}-${i}`} className="flex items-center gap-2 text-sm">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', i === 0 ? 'bg-emerald-600' : 'bg-stone-300')} />
            <span className="font-medium text-stone-700">{ORDER_STATUS_META[e.status].label}</span>
            <span className="text-stone-400">·</span>
            <span className="text-stone-500">{formatDateTimeIST(e.at)}</span>
            {e.note && <span className="text-stone-400">— {e.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
