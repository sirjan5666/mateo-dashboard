import type { ReactNode } from 'react';
import { Baby, CalendarClock, Clock, Radio } from 'lucide-react';
import type { Consultation, ConsultationStatus } from '../../api/consultations';
import { dayDiffIST, formatDateIST, formatDateTimeIST, relativePastIST, relativeUpcomingIST } from '../../lib/age';
import { Card } from '../ui/Card';
import { Pill } from '../ui/Pill';
import { Skeleton } from '../ui/Skeleton';
import { Avatar } from '../ui/Avatar';
import type { Tone } from '../ui/tones';
import { cn } from '../../lib/cn';

// Shared consultation presentation, used by BOTH the parent "My consultations"
// and the doctor "Appointments" pages. The card/hero are perspective-agnostic:
// the caller passes the subject `name` (avatar) + display `title` and renders the
// page-specific actions via `actions` / `footer`.

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const STATUS_META: Record<ConsultationStatus, { label: string; tone: Tone; dot: string }> = {
  booked: { label: 'Upcoming', tone: 'sky', dot: 'bg-sky-500' },
  completed: { label: 'Completed', tone: 'emerald', dot: 'bg-green-500' },
  cancelled: { label: 'Cancelled', tone: 'stone', dot: 'bg-stone-400' },
};

function PaymentText({ status }: { status: 'paid' | 'pending' }) {
  return <span className={cn('text-xs font-bold', status === 'paid' ? 'text-green-700' : 'text-amber-700')}>{status === 'paid' ? 'Paid' : 'Pending'}</span>;
}

// Hero: the soonest upcoming appointment, given a loud, premium treatment.
export function ConsultationHero({ c, name, title, actions }: { c: Consultation; name: string; title: string; actions: ReactNode }) {
  const rel = relativeUpcomingIST(c.slotStart);
  const isToday = dayDiffIST(c.slotStart) === 0;
  return (
    <Card className="overflow-hidden p-0 shadow-card" style={{ border: '1px solid var(--status-info-bg)' }} role="article" aria-label={`Next appointment: ${title}`}>
      {/* Soft blue→lavender band keys the hero to "upcoming" without shouting */}
      <div className="relative p-5 sm:p-6" style={{ background: 'linear-gradient(135deg, #eef4ff 0%, #f6f1ff 100%)' }}>
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, rgba(124,92,252,0.18), transparent 70%)' }} />

        <div className="relative mb-4 flex items-center justify-between gap-2">
          <span className="eyebrow" style={{ color: 'var(--status-info-text)' }}>Next appointment</span>
          {/* Live countdown chip — solid + pulses when it's today */}
          <span
            className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[0.82rem] font-extrabold shadow-soft', isToday ? 'animate-pulse text-white' : 'bg-white')}
            style={{ background: isToday ? 'var(--status-info-text)' : undefined, color: isToday ? '#fff' : 'var(--status-info-text)' }}
          >
            {isToday ? <Radio className="h-[15px] w-[15px]" /> : <Clock className="h-[15px] w-[15px]" />}
            {rel}
          </span>
        </div>

        <div className="relative flex items-start gap-4">
          <Avatar name={name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-semibold leading-tight text-stone-900">{title}</h2>
              <Pill tone="sky">Upcoming</Pill>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-stone-600">
              <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-stone-400" />{formatDateTimeIST(c.slotStart)}</span>
              {c.baby?.name && <span className="inline-flex items-center gap-1.5"><Baby className="h-4 w-4 text-stone-400" />For {c.baby.name}</span>}
            </div>
            {c.reason && <p className="mt-2 text-sm italic text-stone-700">“{c.reason}”</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 border-t border-stone-100 p-4 sm:px-6">
        <span className="inline-flex items-center gap-2 text-[0.95rem] font-extrabold text-stone-900">{rupee(c.payment.amount)} <PaymentText status={c.payment.status} /></span>
        <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </Card>
  );
}

// Compact card for every non-hero consultation. `footer` is the full action row.
export function CompactConsultationCard({ c, name, title, footer }: { c: Consultation; name: string; title: string; footer: ReactNode }) {
  const upcoming = c.status === 'booked';
  const cancelled = c.status === 'cancelled';
  const meta = STATUS_META[c.status];
  const when = upcoming ? relativeUpcomingIST(c.slotStart) : relativePastIST(c.slotStart);

  return (
    <Card className={cn('overflow-hidden p-0', cancelled && 'opacity-90')} role="article" aria-label={`Consultation: ${title}, ${meta.label}`}>
      <div className="flex items-start gap-3 p-4">
        <Avatar name={name} size={upcoming ? 'lg' : 'md'} tone={cancelled ? 'stone' : upcoming ? undefined : 'emerald'} className={cancelled ? 'grayscale' : undefined} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <h3 className="font-display text-[1.05rem] font-semibold text-stone-900">{title}</h3>
              <Pill tone={meta.tone}>{meta.label}</Pill>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn('text-sm font-extrabold', cancelled ? 'text-stone-400' : 'text-stone-900')}>{rupee(c.payment.amount)}</p>
              <PaymentText status={c.payment.status} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[0.82rem] text-stone-600">
            <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-stone-400" />{when}{!upcoming ? ` · ${formatDateIST(c.slotStart)}` : ''}</span>
            {c.baby?.name && <span className="inline-flex items-center gap-1.5"><Baby className="h-3.5 w-3.5 text-stone-400" />{c.baby.name}</span>}
          </div>
          {c.reason && <p className={cn('mt-1.5 text-sm italic', cancelled ? 'text-stone-400' : 'text-stone-700')}>“{c.reason}”</p>}
        </div>
      </div>

      <div className={cn('flex flex-wrap items-center gap-2 border-t border-stone-100 px-4 py-2.5', !upcoming && 'bg-stone-50')}>{footer}</div>
    </Card>
  );
}

export function ConsultationSectionHeader({ label, count, dotClass }: { label: string; count: number; dotClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', dotClass)} />
      <h2 className="font-display text-[0.95rem] font-semibold text-stone-900">{label}</h2>
      <span className="text-sm font-bold text-stone-400">{count}</span>
    </div>
  );
}

export function ConsultationsLoading() {
  return (
    <div className="space-y-3.5">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="space-y-3 p-5">
          <div className="flex gap-3">
            <Skeleton className={i === 0 ? 'h-16 w-16 rounded-full' : 'h-11 w-11 rounded-full'} />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          {i === 0 && <Skeleton className="h-10 w-full rounded-xl" />}
        </Card>
      ))}
    </div>
  );
}

export function ConsultationsMiniEmpty({ msg, action }: { msg: string; action?: ReactNode }) {
  return (
    <Card className="px-6 py-8 text-center">
      <p className={cn('text-sm text-stone-500', action ? 'mb-3.5' : undefined)}>{msg}</p>
      {action}
    </Card>
  );
}
