import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CalendarClock, Check, FileText, Trash2 } from 'lucide-react';
import {
  addAppointment,
  addRecord,
  deleteAppointment,
  deleteRecord,
  listAppointments,
  listRecords,
  setAppointmentDone,
} from '../api/health';
import type { Appointment, HealthRecord, RecordType } from '../api/health';
import { ApiError } from '../api/client';
import { formatDateIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';
import { Skeleton } from '../components/ui/Skeleton';
import { DatePicker } from '../components/ui/DatePicker';
import { inputCls } from '../components/ui/field';
import type { Tone } from '../components/ui/tones';
import { cn } from '../lib/cn';

const RECORD_TYPES: { value: RecordType; label: string; tone: Tone }[] = [
  { value: 'checkup', label: 'Check-up', tone: 'sky' },
  { value: 'illness', label: 'Illness', tone: 'rose' },
  { value: 'medication', label: 'Medication', tone: 'violet' },
  { value: 'allergy', label: 'Allergy', tone: 'amber' },
  { value: 'measurement', label: 'Measurement', tone: 'emerald' },
  { value: 'note', label: 'Note', tone: 'stone' },
  { value: 'other', label: 'Other', tone: 'stone' },
];
const RECORD_META = Object.fromEntries(RECORD_TYPES.map((r) => [r.value, r])) as Record<RecordType, (typeof RECORD_TYPES)[number]>;

export default function Health() {
  const { id } = useParams();
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [records, setRecords] = useState<HealthRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // appointment form
  const [aDate, setADate] = useState(todayInputValueIST());
  const [aReason, setAReason] = useState('');
  const [aLocation, setALocation] = useState('');
  const [aSaving, setASaving] = useState(false);

  // record form
  const [rType, setRType] = useState<RecordType>('checkup');
  const [rTitle, setRTitle] = useState('');
  const [rDate, setRDate] = useState(todayInputValueIST());
  const [rProvider, setRProvider] = useState('');
  const [rNotes, setRNotes] = useState('');
  const [rSaving, setRSaving] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAppts = useCallback(async () => {
    if (id === undefined) return;
    setAppts((await listAppointments(id)).appointments);
  }, [id]);
  const loadRecords = useCallback(async () => {
    if (id === undefined) return;
    setRecords((await listRecords(id)).records);
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([listAppointments(id), listRecords(id)])
      .then(([a, r]) => {
        if (cancelled) return;
        setAppts(a.appointments);
        setRecords(r.records);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function fail(err: unknown) {
    setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
  }

  async function submitAppt(e: FormEvent) {
    e.preventDefault();
    if (id === undefined) return;
    setError(null);
    setASaving(true);
    try {
      await addAppointment(id, { scheduledAt: aDate, reason: aReason.trim(), location: aLocation.trim() || undefined });
      setAReason('');
      setALocation('');
      await loadAppts();
    } catch (err) {
      fail(err);
    } finally {
      setASaving(false);
    }
  }

  async function submitRecord(e: FormEvent) {
    e.preventDefault();
    if (id === undefined) return;
    setError(null);
    setRSaving(true);
    try {
      await addRecord(id, { recordType: rType, title: rTitle.trim(), recordDate: rDate, provider: rProvider.trim() || undefined, notes: rNotes.trim() || undefined });
      setRTitle('');
      setRProvider('');
      setRNotes('');
      await loadRecords();
    } catch (err) {
      fail(err);
    } finally {
      setRSaving(false);
    }
  }

  async function toggleAppt(a: Appointment) {
    if (id === undefined) return;
    setBusyId(a.id);
    try {
      await setAppointmentDone(id, a.id, !a.completed);
      await loadAppts();
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  }

  async function removeAppt(apptId: string) {
    if (id === undefined) return;
    setBusyId(apptId);
    try {
      await deleteAppointment(id, apptId);
      await loadAppts();
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  }

  async function removeRecord(recordId: string) {
    if (id === undefined) return;
    setBusyId(recordId);
    try {
      await deleteRecord(id, recordId);
      await loadRecords();
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  }

  const todayStart = new Date(todayInputValueIST()).getTime();
  const upcoming = (appts ?? []).filter((a) => !a.completed && new Date(a.scheduledAt).getTime() >= todayStart);
  const pastAppts = (appts ?? []).filter((a) => a.completed || new Date(a.scheduledAt).getTime() < todayStart).reverse();

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: 'var(--cat-record-bg)' }}>
          <FileText className="h-6 w-6" style={{ color: 'var(--cat-record-text)' }} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Health records</h1>
          <p className="text-sm text-stone-500">Appointments, check-ups, and notes — all in one place</p>
        </div>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* Appointments */}
      <Card className="mt-5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4" style={{ color: 'var(--cat-record)' }} />
          <h2 className="font-bold text-stone-800">Appointments</h2>
        </div>
        <form onSubmit={submitAppt} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs font-medium text-stone-600">
            Date
            <DatePicker required value={aDate} onChange={setADate} className={cn(inputCls, 'mt-1 w-40')} />
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col text-xs font-medium text-stone-600">
            Reason
            <input type="text" required maxLength={120} placeholder="e.g. 6-month check-up" value={aReason} onChange={(e) => setAReason(e.target.value)} className={cn(inputCls, 'mt-1')} />
          </label>
          <label className="flex min-w-[8rem] flex-1 flex-col text-xs font-medium text-stone-600">
            Where (optional)
            <input type="text" maxLength={120} placeholder="Clinic / doctor" value={aLocation} onChange={(e) => setALocation(e.target.value)} className={cn(inputCls, 'mt-1')} />
          </label>
          <Button type="submit" size="sm" disabled={aSaving}>{aSaving ? 'Adding…' : 'Add'}</Button>
        </form>

        <div className="mt-4">
          {appts === null ? (
            <Skeleton className="h-12 w-full" />
          ) : upcoming.length === 0 && pastAppts.length === 0 ? (
            <p className="text-sm text-stone-500">No appointments yet. Add the next visit above.</p>
          ) : (
            <>
              {upcoming.length > 0 && (
                <ul className="space-y-2">
                  {upcoming.map((a) => (
                    <AppointmentRow key={a.id} a={a} busy={busyId === a.id} onToggle={() => void toggleAppt(a)} onDelete={() => void removeAppt(a.id)} />
                  ))}
                </ul>
              )}
              {pastAppts.length > 0 && (
                <>
                  <p className="mt-4 mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">Past &amp; completed</p>
                  <ul className="space-y-2">
                    {pastAppts.map((a) => (
                      <AppointmentRow key={a.id} a={a} busy={busyId === a.id} onToggle={() => void toggleAppt(a)} onDelete={() => void removeAppt(a.id)} muted />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Records */}
      <Card className="mt-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" style={{ color: 'var(--cat-record)' }} />
          <h2 className="font-bold text-stone-800">Records</h2>
        </div>
        <form onSubmit={submitRecord} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col text-xs font-medium text-stone-600">
            Type
            <select value={rType} onChange={(e) => setRType(e.target.value as RecordType)} className={cn(inputCls, 'mt-1')}>
              {RECORD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs font-medium text-stone-600">
            Date
            <DatePicker required value={rDate} max={todayInputValueIST()} onChange={setRDate} className={cn(inputCls, 'mt-1')} />
          </label>
          <label className="flex flex-col text-xs font-medium text-stone-600 sm:col-span-2">
            Title
            <input type="text" required maxLength={120} placeholder="e.g. Fever, prescribed paracetamol" value={rTitle} onChange={(e) => setRTitle(e.target.value)} className={cn(inputCls, 'mt-1')} />
          </label>
          <label className="flex flex-col text-xs font-medium text-stone-600 sm:col-span-2">
            Doctor / clinic (optional)
            <input type="text" maxLength={120} placeholder="Dr. / hospital name" value={rProvider} onChange={(e) => setRProvider(e.target.value)} className={cn(inputCls, 'mt-1')} />
          </label>
          <label className="flex flex-col text-xs font-medium text-stone-600 sm:col-span-2">
            Notes (optional)
            <textarea rows={2} maxLength={2000} placeholder="What the doctor said, dosage, follow-up…" value={rNotes} onChange={(e) => setRNotes(e.target.value)} className={cn(inputCls, 'mt-1 resize-none')} />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={rSaving}>{rSaving ? 'Saving…' : 'Add record'}</Button>
          </div>
        </form>

        <div className="mt-4">
          {records === null ? (
            <Skeleton className="h-12 w-full" />
          ) : records.length === 0 ? (
            <p className="text-sm text-stone-500">No records yet. Keep check-ups, illnesses and prescriptions here.</p>
          ) : (
            <ol className="space-y-2">
              {records.map((r) => {
                const meta = RECORD_META[r.recordType];
                return (
                  <li key={r.id}>
                    <div className="flex items-start gap-3 rounded-xl border border-stone-100 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                          <span className="text-sm font-semibold text-stone-800">{r.title}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {formatDateIST(r.recordDate)}
                          {r.provider && <> · {r.provider}</>}
                        </p>
                        {r.notes && <p className="mt-1 text-sm text-stone-700">{r.notes}</p>}
                      </div>
                      <button onClick={() => void removeRecord(r.id)} disabled={busyId === r.id} aria-label="Delete record" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </Card>

      <p className="mt-4 text-xs text-stone-500">
        Your records are private to your account. This is a personal log to share with your doctor — not a substitute for medical advice.
      </p>
    </div>
  );
}

function AppointmentRow({ a, busy, onToggle, onDelete, muted }: { a: Appointment; busy: boolean; onToggle: () => void; onDelete: () => void; muted?: boolean }) {
  return (
    <li className={cn('flex items-center gap-3 rounded-xl border border-stone-100 p-3', muted && 'opacity-70')}>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={a.completed}
        aria-label={a.completed ? 'Mark as not done' : 'Mark as done'}
        className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-50', a.completed ? 'border-transparent text-white' : 'border-stone-300 text-transparent hover:border-stone-400')}
        style={a.completed ? { backgroundColor: 'var(--cat-record)' } : undefined}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold text-stone-800', a.completed && 'line-through')}>{a.reason}</p>
        <p className="text-xs text-stone-500">
          {formatDateIST(a.scheduledAt)}
          {a.location && <> · {a.location}</>}
        </p>
      </div>
      {a.completed && <Pill tone="emerald">Done</Pill>}
      <button onClick={onDelete} disabled={busy} aria-label="Delete appointment" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
