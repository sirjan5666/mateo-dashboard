import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, CalendarClock, CalendarHeart, CalendarPlus, MessageCircle, RotateCcw, Stethoscope, Video } from 'lucide-react';
import { listConsultations, listFollowUps, updateConsultation } from '../api/consultations';
import type { Consultation, ConsultationStatus, FollowUp } from '../api/consultations';
import { ApiError } from '../api/client';
import { formatDateIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { BrandTile } from '../components/ui/BrandTile';
import { buttonClass } from '../components/ui/buttonStyles';
import {
  CompactConsultationCard,
  ConsultationHero,
  ConsultationSectionHeader,
  ConsultationsLoading,
  ConsultationsMiniEmpty,
} from '../components/consultations/parts';

type Tab = 'upcoming' | 'completed' | 'cancelled' | 'all';

// ── Follow-ups due — a gentle, brand-tinted rebook prompt at the very top ──
function FollowUpBanner({ followUps }: { followUps: FollowUp[] }) {
  if (followUps.length === 0) return null;
  return (
    <Card className="overflow-hidden p-0" style={{ border: '1px solid var(--brand-purple-tint)' }} role="region" aria-label="Follow-ups due">
      <div className="flex gap-3.5 p-5" style={{ background: 'linear-gradient(120deg, var(--brand-purple-tint), #fff 70%)' }}>
        <BrandTile icon={CalendarHeart} iconClassName="h-6 w-6" className="h-12 w-12 shrink-0 rounded-2xl shadow-soft" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[1.05rem] font-semibold text-stone-900">Follow-ups due</h2>
          <p className="mt-0.5 text-sm text-stone-500">Your doctor suggested a follow-up visit. Rebook in one tap.</p>
          <ul className="mt-3.5 space-y-2.5">
            {followUps.map((f) => (
              <li key={f.prescriptionId} className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-white p-3 shadow-soft">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Avatar name={f.doctorName} size="sm" tone="violet" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-900">Dr. {f.doctorName}{f.babyName ? ` · ${f.babyName}` : ''}</p>
                    <p className="text-xs text-stone-500">Suggested for {formatDateIST(f.followUpDate)}</p>
                  </div>
                </div>
                <Link to={`/find-doctor/${f.doctorProfileId}${f.babyId ? `?baby=${f.babyId}&followup=1` : '?followup=1'}`} className={buttonClass('primary', 'sm')}>
                  <CalendarPlus className="h-4 w-4" /> Book follow-up
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="px-6 py-10 text-center">
      <img src="/bear-mascot.png" alt="" className="mx-auto h-32 w-auto" />
      <h2 className="mt-3.5 font-display text-xl font-semibold text-stone-900">No consultations yet</h2>
      <p className="mx-auto mt-1 mb-4 max-w-xs text-sm leading-relaxed text-stone-500">
        When you book a doctor, your appointments will show up here — neatly grouped and easy to join.
      </p>
      <Link to="/find-doctor" className={buttonClass('primary', 'md')}><Stethoscope className="h-4 w-4" />Find a doctor</Link>
    </Card>
  );
}

export default function MyConsultations() {
  const [items, setItems] = useState<Consultation[] | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('upcoming');

  async function load() {
    try {
      const d = await listConsultations();
      setItems(d.consultations);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
    }
  }

  useEffect(() => {
    let cancelled = false;
    listConsultations()
      .then((d) => !cancelled && setItems(d.consultations))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again'));
    listFollowUps()
      .then((d) => !cancelled && setFollowUps(d.followUps))
      .catch(() => {
        /* non-critical */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingFollowUps = followUps.filter((f) => f.doctorProfileId);

  async function cancel(id: string) {
    setBusyId(id);
    try {
      await updateConsultation(id, 'cancelled');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
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

  // The parent sees the DOCTOR on each card.
  const footer = (c: Consultation) => {
    const upcoming = c.status === 'booked';
    const cancelled = c.status === 'cancelled';
    return (
      <>
        <Link to={`/consultations/${c.id}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-700 hover:text-violet-800">
          <MessageCircle className="h-[15px] w-[15px]" />{c.status === 'completed' ? 'View summary' : 'Open chat'}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {cancelled && (
            <Link to={`/find-doctor/${c.doctor.profileId}`} className={buttonClass('secondary', 'sm')}>
              <RotateCcw className="h-3.5 w-3.5" />Rebook
            </Link>
          )}
          {upcoming && (
            <>
              <button onClick={() => cancel(c.id)} disabled={busyId === c.id} className="px-2 text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50">Cancel</button>
              {c.meetLink && <a href={c.meetLink} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'sm')}><Video className="h-3.5 w-3.5" />Join</a>}
            </>
          )}
        </div>
      </>
    );
  };

  const heroActions = (c: Consultation) => (
    <>
      <button onClick={() => cancel(c.id)} disabled={busyId === c.id} className="px-2 text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50">Cancel</button>
      <Link to={`/consultations/${c.id}`} className={buttonClass('secondary', 'md')}><MessageCircle className="h-4 w-4" />Open chat</Link>
      {c.meetLink && <a href={c.meetLink} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'md', 'shadow-card')}><Video className="h-4 w-4" />Join now</a>}
    </>
  );

  const card = (c: Consultation) => <CompactConsultationCard key={c.id} c={c} name={c.doctor.name} title={`Dr. ${c.doctor.name}`} footer={footer(c)} />;
  const renderUpcoming = (list: Consultation[]) =>
    list.map((c) => (c.id === heroId ? <ConsultationHero key={c.id} c={c} name={c.doctor.name} title={`Dr. ${c.doctor.name}`} actions={heroActions(c)} /> : card(c)));

  const tabOptions: { value: Tab; label: string; count: number }[] = [
    { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { value: 'completed', label: 'Completed', count: counts.completed },
    { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
    { value: 'all', label: 'All', count: counts.all },
  ];

  const findDoctorBtn = <Link to="/find-doctor" className={buttonClass('secondary', 'sm')}><Stethoscope className="h-4 w-4" />Find a doctor</Link>;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandTile icon={CalendarClock} iconClassName="h-6 w-6" className="h-12 w-12 rounded-2xl shadow-soft" />
          <div>
            <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">My consultations</h1>
            <p className="text-sm text-stone-500">Your doctor bookings, all in one place.</p>
          </div>
        </div>
        <Link to="/find-doctor" className={buttonClass('secondary', 'md')}><Stethoscope className="h-4 w-4" />Find a doctor</Link>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {items === null ? (
        <div className="mt-6"><ConsultationsLoading /></div>
      ) : items.length === 0 ? (
        <div className="mt-6"><EmptyState /></div>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          <FollowUpBanner followUps={upcomingFollowUps} />

          {/* Segmented filter keeps statuses from ever mixing */}
          <div className="-mx-1 overflow-x-auto px-1">
            <SegmentedControl value={tab} onChange={setTab} options={tabOptions} />
          </div>

          {tab === 'upcoming' &&
            (counts.upcoming === 0 ? (
              <ConsultationsMiniEmpty msg="No upcoming consultations. Book one to see it here." action={findDoctorBtn} />
            ) : (
              <div className="flex flex-col gap-3.5">{renderUpcoming(byStatus.booked)}</div>
            ))}

          {tab === 'completed' &&
            (counts.completed === 0 ? (
              <ConsultationsMiniEmpty msg="No completed consultations yet." action={findDoctorBtn} />
            ) : (
              <div className="flex flex-col gap-3">{byStatus.completed.map(card)}</div>
            ))}

          {tab === 'cancelled' &&
            (counts.cancelled === 0 ? (
              <ConsultationsMiniEmpty msg="No cancelled consultations." action={findDoctorBtn} />
            ) : (
              <div className="flex flex-col gap-3">{byStatus.cancelled.map(card)}</div>
            ))}

          {tab === 'all' && (
            <div className="flex flex-col gap-6">
              {byStatus.booked.length > 0 && (
                <section className="flex flex-col gap-3">
                  <ConsultationSectionHeader label="Upcoming" count={counts.upcoming} dotClass="bg-sky-500" />
                  {renderUpcoming(byStatus.booked)}
                </section>
              )}
              {byStatus.completed.length > 0 && (
                <section className="flex flex-col gap-3">
                  <ConsultationSectionHeader label="Completed" count={counts.completed} dotClass="bg-green-500" />
                  {byStatus.completed.map(card)}
                </section>
              )}
              {byStatus.cancelled.length > 0 && (
                <section className="flex flex-col gap-3">
                  <ConsultationSectionHeader label="Cancelled" count={counts.cancelled} dotClass="bg-stone-400" />
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
