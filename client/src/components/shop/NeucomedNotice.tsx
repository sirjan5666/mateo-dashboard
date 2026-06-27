import { ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/cn';
import { NEUCOMED_NOTICE } from '../../shop/neucomed';

// IMS Act statutory warning banner, shown on the Neucomed section + product pages.
export function NeucomedNotice({ className, text }: { className?: string; text?: string }) {
  return (
    <div className={cn('flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900', className)} role="note">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <p className="text-sm leading-relaxed">{text ?? NEUCOMED_NOTICE}</p>
    </div>
  );
}
