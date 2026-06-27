import { Link, useLocation } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { useT } from '../../i18n/context';

// path segment → i18n label key. Unknown segments (ids) fall back to "Record".
const SEG_LABEL: Record<string, string> = {
  patients: 'doctor.nav.patients',
  schedule: 'doctor.nav.schedule',
  messages: 'doctor.nav.messages',
  appointments: 'doctor.nav.consultations',
  consultations: 'doctor.nav.consultations',
  growth: 'doctor.nav.growth',
  vaccines: 'doctor.nav.vaccines',
  dose: 'doctor.nav.dose',
  development: 'doctor.nav.development',
  labs: 'doctor.nav.labs',
  neonatology: 'doctor.nav.neonatology',
  analytics: 'doctor.nav.analytics',
  billing: 'doctor.nav.billing',
  profile: 'doctor.nav.profile',
};

/** "Home / Patients / Record" trail derived from the current /doctor path. */
export function Breadcrumbs() {
  const t = useT();
  const { pathname } = useLocation();
  const segs = pathname.replace(/^\/doctor\/?/, '').split('/').filter(Boolean);

  const crumbs: { label: string; to?: string }[] = [{ label: t('doctor.nav.home'), to: segs.length ? '/doctor' : undefined }];
  let acc = '/doctor';
  segs.forEach((seg, i) => {
    acc += `/${seg}`;
    const key = SEG_LABEL[seg];
    crumbs.push({ label: key ? t(key) : t('doctor.breadcrumb.record'), to: i === segs.length - 1 ? undefined : acc });
  });

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      {crumbs.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />}
          {c.to ? (
            <Link to={c.to} className="truncate text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]">
              {c.label}
            </Link>
          ) : (
            <span className="truncate font-semibold text-[var(--foreground)]" aria-current="page">
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
