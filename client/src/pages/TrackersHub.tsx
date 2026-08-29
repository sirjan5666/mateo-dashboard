import { Link } from 'react-router';
import { useT } from '../i18n/context';
import { useBabies } from '../lib/useBabies';
import { useSubscribed } from '../lib/subscription';
import { TRACKERS } from '../lib/trackers';
import { EmptyState } from '../components/ui/EmptyState';
import { PaidBadge } from '../components/subscription/bits';
import { Baby as BabyIcon } from 'lucide-react';

/**
 * Trackers tab — a thumb-first grid of the exact 8 dashboard trackers for the
 * selected baby. Each card preserves the tracker's name, icon, mascot and
 * category colour, and links straight to its page (the route guard sends
 * unsubscribed parents to /subscribe).
 */
export default function TrackersHub() {
  const t = useT();
  const { activeBaby, activeBabyId, loading } = useBabies();
  const subscribed = useSubscribed();

  return (
    <div className="mx-auto max-w-[520px] lg:max-w-3xl">
      <header className="mb-4">
        <h1 className="font-display text-2xl font-semibold text-[var(--foreground)]">{t('trackers.hubTitle')}</h1>
        {activeBaby && (
          <p className="truncate text-sm text-[var(--muted-foreground)]">
            {t('trackers.hubSubtitle')} {activeBaby.name}
          </p>
        )}
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-[26px] bg-stone-200/70" />
          ))}
        </div>
      ) : !activeBabyId ? (
        <EmptyState
          icon={BabyIcon}
          title="No baby yet"
          description="Add your little one to start tracking vaccines, growth, food and more."
          action={
            <Link to="/babies/new" className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-700 px-5 font-semibold text-white">
              Add your baby
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TRACKERS.map((tr) => {
            const Icon = tr.icon;
            return (
              <Link
                key={tr.seg}
                to={`/babies/${activeBabyId}/${tr.seg}`}
                className="group relative flex min-h-[152px] flex-col overflow-hidden rounded-[26px] bg-[var(--surface-card)] p-3.5 shadow-soft ring-1 ring-stone-200/60 transition-transform active:scale-[0.98]"
              >
                {/* Accent rail */}
                <span aria-hidden className="absolute left-0 top-4 h-10 w-1 rounded-full" style={{ backgroundColor: tr.color }} />
                {!subscribed && <PaidBadge className="absolute right-2.5 top-2.5" />}

                {tr.mascot ? (
                  <img src={tr.mascot} alt="" className="mb-2 h-16 w-16 self-start object-contain" draggable={false} />
                ) : (
                  <span className="mb-2 grid h-16 w-16 place-items-center rounded-2xl" style={{ backgroundColor: tr.bg, color: tr.text }}>
                    <Icon className="h-7 w-7" />
                  </span>
                )}

                <span className="mt-auto">
                  <span className="block font-display text-[15px] font-semibold leading-tight text-[var(--foreground)]">{t(tr.labelKey)}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-[var(--muted-foreground)]">{t(tr.taglineKey)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
