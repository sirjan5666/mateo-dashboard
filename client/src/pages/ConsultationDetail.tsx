import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CalendarClock, FileText, IndianRupee, Video } from 'lucide-react';
import { getConsultation, setMeetLink } from '../api/consultations';
import type { Consultation } from '../api/consultations';
import { listPrescriptions } from '../api/prescriptions';
import type { Prescription } from '../api/prescriptions';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/context';
import { formatDateTimeIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { ConsultationChat } from '../components/ConsultationChat';
import { PrescriptionCard } from '../components/PrescriptionCard';
import { PrescriptionForm } from '../components/PrescriptionForm';
import { RatingSection } from '../components/RatingSection';
import { DoctorPatientSnapshot } from '../components/DoctorPatientSnapshot';
import { inputCls } from '../components/ui/field';
import { cn } from '../lib/cn';

const STATUS_STYLES: Record<Consultation['status'], string> = {
  booked: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-stone-100 text-stone-500',
};

export default function ConsultationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState<Consultation | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([getConsultation(id), listPrescriptions(id)])
      .then(([cd, pd]) => {
        if (cancelled) return;
        setC(cd.consultation);
        setLinkInput(cd.consultation.meetLink ?? '');
        setPrescriptions(pd.prescriptions);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isDoctor = user?.role === 'doctor';
  const backTo = isDoctor ? '/doctor/appointments' : '/consultations';

  async function saveLink() {
    if (id === undefined) return;
    setLinkError(null);
    setSavingLink(true);
    try {
      const { consultation } = await setMeetLink(id, linkInput.trim());
      setC(consultation);
      setLinkInput(consultation.meetLink ?? '');
    } catch (e) {
      setLinkError(e instanceof ApiError ? e.message : 'Could not save the link');
    } finally {
      setSavingLink(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {error && <Card className="mt-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {c === null ? (
        <Card className="mt-4 p-5"><Skeleton className="h-16 w-full" /></Card>
      ) : (
        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-extrabold text-stone-900">{isDoctor ? c.parent.name : `Dr. ${c.doctor.name}`}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-600">
                <CalendarClock className="h-4 w-4 text-stone-400" />
                {formatDateTimeIST(c.slotStart)}
              </p>
              {c.baby?.name && <p className="text-sm text-stone-500">For {c.baby.name}</p>}
              {c.reason && <p className="mt-1 text-sm text-stone-600">“{c.reason}”</p>}
            </div>
            <div className="text-right">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', STATUS_STYLES[c.status])}>{c.status}</span>
              <p className="mt-1 flex items-center justify-end text-sm font-semibold text-stone-700">
                <IndianRupee className="h-3.5 w-3.5" />
                {c.payment.amount}
              </p>
            </div>
          </div>

          {/* Video meeting — doctor sets the link, parent gets "Join now" */}
          <div className="mt-4 border-t border-stone-100 pt-4">
            {isDoctor ? (
              <div>
                <label htmlFor="meetLink" className="flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                  <Video className="h-4 w-4 text-stone-400" /> Meeting link
                </label>
                <p className="mt-0.5 text-xs text-stone-500">Paste the Google Meet link. The parent sees a “Join now” button + the scheduled time.</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="meetLink"
                    type="url"
                    inputMode="url"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    className={inputCls}
                  />
                  <Button onClick={() => void saveLink()} disabled={savingLink} className="shrink-0">
                    {savingLink ? 'Saving…' : c.meetLink ? 'Update' : 'Save link'}
                  </Button>
                </div>
                {linkError && <p className="mt-1 text-sm text-rose-600">{linkError}</p>}
                {c.meetLink && (
                  <a href={c.meetLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline">
                    <Video className="h-4 w-4" /> Open meeting
                  </a>
                )}
              </div>
            ) : c.meetLink ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-800">
                    <Video className="h-4 w-4 text-emerald-600" /> Video consultation
                  </p>
                  <p className="text-xs text-stone-500">{formatDateTimeIST(c.slotStart)}</p>
                </div>
                <a
                  href={c.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-colors hover:bg-emerald-700"
                >
                  <Video className="h-4 w-4" /> Join now
                </a>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-stone-400">
                <Video className="h-4 w-4" /> The doctor will add a meeting link here before your appointment.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Doctor's clinical view of the consulted baby */}
      {c && isDoctor && c.baby?.id && id && (
        <div className="mt-5">
          <DoctorPatientSnapshot consultationId={id} />
        </div>
      )}

      {/* Parent rates the doctor — only after the doctor marks the consult completed */}
      {c && !isDoctor && id && c.status === 'completed' && (
        <div className="mt-5">
          <RatingSection consultationId={id} doctorName={c.doctor.name} />
        </div>
      )}

      {/* Prescriptions */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-stone-800">Prescriptions</h2>
          {isDoctor && !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
              <FileText className="h-4 w-4" />
              Write prescription
            </Button>
          )}
        </div>

        {isDoctor && showForm && id && (
          <div className="mt-3">
            <PrescriptionForm
              consultationId={id}
              onCreated={(rx) => {
                setPrescriptions((prev) => [rx, ...(prev ?? [])]);
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        <div className="mt-3 space-y-3">
          {prescriptions === null ? (
            <Skeleton className="h-24 w-full" />
          ) : prescriptions.length === 0 ? (
            <p className="text-sm text-stone-400">{isDoctor ? 'No prescriptions issued yet.' : 'No prescriptions yet.'}</p>
          ) : (
            prescriptions.map((rx) => <PrescriptionCard key={rx.id} rx={rx} />)
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="mt-5">
        <h2 className="mb-2 font-bold text-stone-800">Chat</h2>
        {id && <ConsultationChat consultationId={id} />}
      </div>
    </div>
  );
}
