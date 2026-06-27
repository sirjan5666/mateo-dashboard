import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarClock, Check, MessageCircle, Video } from 'lucide-react';
import { listConsultations, updateConsultation } from '../../api/consultations';
import type { Consultation, ConsultationStatus } from '../../api/consultations';
import { ApiError } from '../../api/client';
import { useT } from '../../i18n/context';
import { Card } from '../../components/ui/Card';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { BrandTile } from '../../components/ui/BrandTile';
import { buttonClass } from '../../components/ui/buttonStyles';
import {
  CompactConsultationCard,
  ConsultationHero,
  ConsultationSectionHeader,
  ConsultationsLoading,
  ConsultationsMiniEmpty,
} from '../../components/consultations/parts';

type Tab = 'upcoming' | 'completed' | 'cancelled' | 'all';

function EmptyState() {
  const t = useT();
  return (
    <Card className="px-6 py-10 text-center">
      <img src="/bear-mascot.png" alt="" className="mx-auto h-32 w-auto" />
      <h2 className="mt-3.5 font-display text-xl font-semibold text-stone-900">{t('doctor.consults.emptyTitle')}</h2>
      <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-stone-500">{t('doctor.consults.emptyBody')}</p>
    </Card>
  );
}

export default function DoctorAppointments() {
  const t = useT();
  const [items, setItems] = useState<Consultation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('upcoming');

  async function load() {
    try {
      const d = await listConsultations();
      setItems(d.consultations);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('doctor.consults.errGeneric'));
    }
  }

  useEffect(() => {
    let cancelled = false;
    listConsultations()
      .then((d) => !cancelled && setItems(d.consultations))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again'));
    return () => {
      cancelled = true;
    };
  }, []);

  async function setStatus(id: string, status: 'completed' | 'cancelled') {
    setBusyId(id);
    try {
      await updateConsultation(id, status);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('doctor.consults.errGeneric'));
    } finally {
      setBusyId(null);
    }
  }

  const byStatus = useMemo(() => {
    const g: Record<ConsultationStatus, Consultation[]> = { booked: [], completed: [], cancelled: [] };
    (items ?? []).forEach((c) => g[c.status]?.push(c));
    g.booked.sort((a, b) => +new Date(a.slotStart) - +new Date(b.slotStart));
    g.completed.sort((a, b) => +new Date(b.slotStart) - +new Date(a.slotStart));
    g.cancelled.sort((a, b) => +new Date(b.slotStart) - +new Date(a.slotStart));
    return g;
  }, [items]);

  const counts = { upcoming: byStatus.booked.length, completed: byStatus.completed.length, cancelled: byStatus.cancelled.length, all: items?.length ?? 0 };
  const heroId = byStatus.booked[0]?.id;

  // The doctor sees the PATIENT (parent) on each card, and acts on the booking.
  const chatLink = (c: Consultation) => (
    <Link to={`/doctor/consultations/${c.id}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-700 hover:text-violet-800">
      <MessageCircle className="h-[15px] w-[15px]" />
      {c.status === 'completed' ? t('doctor.consults.viewSummary') : t('doctor.consults.openChat')}
    </Link>
  );
  const cancelBtn = (c: Consultation) => (
    <button onClick={() => void setStatus(c.id, 'cancelled')} disabled={busyId === c.id} className="px-2 text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50">
      {t('doctor.consults.cancel')}
    </button>
  );

  const footer = (c: Consultation) => (
    <>
      {chatLink(c)}
      {c.status === 'booked' && (
        <div className="ml-auto flex items-center gap-2">
          {cancelBtn(c)}
          {c.meetLink && (
            <a href={c.meetLink} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
              <Video className="h-3.5 w-3.5" />
              {t('doctor.consults.join')}
            </a>
          )}
          <button onClick={() => void setStatus(c.id, 'completed')} disabled={busyId === c.id} className={buttonClass('primary', 'sm')}>
            <Check className="h-3.5 w-3.5" />
            {t('doctor.consults.markCompleted')}
          </button>
        </div>
      )}
    </>
  );

  const heroActions = (c: Consultation) => (
    <>
      {cancelBtn(c)}
      <Link to={`/doctor/consultations/${c.id}`} className={buttonClass('secondary', 'md')}>
        <MessageCircle className="h-4 w-4" />
        {t('doctor.consults.openChat')}
      </Link>
      {c.meetLink && (
        <a href={c.meetLink} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md')}>
          <Video className="h-4 w-4" />
          {t('doctor.consults.join')}
        </a>
      )}
      <button onClick={() => void setStatus(c.id, 'completed')} disabled={busyId === c.id} className={buttonClass('primary', 'md', 'shadow-card')}>
        <Check className="h-4 w-4" />
        {t('doctor.consults.markCompleted')}
      </button>
    </>
  );

  const card = (c: Consultation) => <CompactConsultationCard key={c.id} c={c} name={c.parent.name} title={c.parent.name} footer={footer(c)} />;
  const renderUpcoming = (list: Consultation[]) =>
    list.map((c) => (c.id === heroId ? <ConsultationHero key={c.id} c={c} name={c.parent.name} title={c.parent.name} actions={heroActions(c)} /> : card(c)));

  const tabOptions: { value: Tab; label: string; count: number }[] = [
    { value: 'upcoming', label: t('doctor.consults.tabUpcoming'), count: counts.upcoming },
    { value: 'completed', label: t('doctor.consults.tabCompleted'), count: counts.completed },
    { value: 'cancelled', label: t('doctor.consults.tabCancelled'), count: counts.cancelled },
    { value: 'all', label: t('doctor.consults.tabAll'), count: counts.all },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex items-center gap-3">
        <BrandTile icon={CalendarClock} iconClassName="h-6 w-6" className="h-12 w-12 rounded-2xl shadow-soft" />
        <div>
          <p className="eyebrow">Doctor</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">{t('doctor.consults.title')}</h1>
          <p className="text-sm text-stone-500">{t('doctor.consults.subtitle')}</p>
        </div>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {items === null ? (
        <div className="mt-6">
          <ConsultationsLoading />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6">
          <EmptyState />
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {/* Segmented filter keeps statuses from ever mixing */}
          <div className="-mx-1 overflow-x-auto px-1">
            <SegmentedControl value={tab} onChange={setTab} options={tabOptions} />
          </div>

          {tab === 'upcoming' &&
            (counts.upcoming === 0 ? (
              <ConsultationsMiniEmpty msg={t('doctor.consults.noUpcoming')} />
            ) : (
              <div className="flex flex-col gap-3.5">{renderUpcoming(byStatus.booked)}</div>
            ))}

          {tab === 'completed' &&
            (counts.completed === 0 ? (
              <ConsultationsMiniEmpty msg={t('doctor.consults.noCompleted')} />
            ) : (
              <div className="flex flex-col gap-3">{byStatus.completed.map(card)}</div>
            ))}

          {tab === 'cancelled' &&
            (counts.cancelled === 0 ? (
              <ConsultationsMiniEmpty msg={t('doctor.consults.noCancelled')} />
            ) : (
              <div className="flex flex-col gap-3">{byStatus.cancelled.map(card)}</div>
            ))}

          {tab === 'all' && (
            <div className="flex flex-col gap-6">
              {byStatus.booked.length > 0 && (
                <section className="flex flex-col gap-3">
                  <ConsultationSectionHeader label={t('doctor.consults.tabUpcoming')} count={counts.upcoming} dotClass="bg-sky-500" />
                  {renderUpcoming(byStatus.booked)}
                </section>
              )}
              {byStatus.completed.length > 0 && (
                <section className="flex flex-col gap-3">
                  <ConsultationSectionHeader label={t('doctor.consults.tabCompleted')} count={counts.completed} dotClass="bg-green-500" />
                  {byStatus.completed.map(card)}
                </section>
              )}
              {byStatus.cancelled.length > 0 && (
                <section className="flex flex-col gap-3">
                  <ConsultationSectionHeader label={t('doctor.consults.tabCancelled')} count={counts.cancelled} dotClass="bg-stone-400" />
                  {byStatus.cancelled.map(card)}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
