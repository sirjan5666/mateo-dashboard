import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Clock, FileText, Info, Loader2, Search,
  Stethoscope, User, X,
} from 'lucide-react';
import { useAuth } from '../../auth/context';
import { createAppointment, getAppointment, listSchedule, updateAppointment } from '../../api/doctorAppointments';
import type { AppointmentMode } from '../../api/doctorAppointments';
import { createPatient, listPatients, listTemplates, patientNumber } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { useActiveLocation } from '../../lib/doctorLocation';
// Clinic day in IST — shared with the calendar grid so the two cannot drift.
import { DAY_END_HOUR, DAY_START_HOUR } from '../../lib/clinicHours';
import { formatTimeIST, todayInputValueIST } from '../../lib/age';
import { ageParts } from '../../data/patients';
import { cn } from '../../lib/cn';

const CARD = 'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';
const LABEL = 'block text-[12.5px] font-semibold text-[#334155]';
const FIELD = 'mt-1.5 flex h-[52px] w-full items-center gap-2.5 rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 text-[13.5px] text-[#0F172A] focus-within:border-[#3B4FE0]';
const BARE = 'min-w-0 flex-1 bg-transparent text-[13.5px] text-[#0F172A] outline-none';
const SECTION = 'font-display text-[15px] font-bold tracking-[-0.01em] text-[#0F172A]';

const STEPS = ['Patient Details', 'Appointment Details', 'Confirm & Save'];

const MODES: { value: AppointmentMode; label: string }[] = [
  { value: 'in_person', label: 'In person' },
  { value: 'phone', label: 'Phone' },
  { value: 'video', label: 'Video call' },
];
const MODE_LABEL = Object.fromEntries(MODES.map((m) => [m.value, m.label])) as Record<AppointmentMode, string>;

const DURATIONS = [15, 20, 30, 45, 60];

/** Common paediatric booking reasons; "Other" reveals a free-text field. */
const REASONS = ['Fever', 'Cough & Cold', 'Vaccination', 'Well-baby checkup', 'Follow-up', 'Growth review', 'Rash / skin', 'Other'];

/**
 * The clinic runs on IST and CLAUDE.md requires IST display, so the whole page
 * works in IST wall-clock rather than the browser's zone. India has no DST, so
 * the offset is a constant and a slot means the same instant on every machine —
 * previously a doctor on a laptop set to another zone would pick "11:30" and
 * store 11:30 in THEIR zone, which every other screen then rendered as
 * something else.
 */
const IST_OFFSET_MIN = 330;

/** The UTC instant of an IST wall-clock time on a `yyyy-mm-dd` day. */
function istInstant(dayISO: string, minutesFromMidnight: number): Date {
  const [y, m, d] = dayISO.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, minutesFromMidnight) - IST_OFFSET_MIN * 60_000);
}

/** Minutes past IST midnight for an instant — the inverse of `istInstant`. */
function istMinutesOfDay(iso: string): number {
  const ist = new Date(new Date(iso).getTime() + IST_OFFSET_MIN * 60_000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
const clock = (d: Date) => formatTimeIST(d.toISOString());
const longDate = (dayISO: string) =>
  istInstant(dayISO, 12 * 60).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', weekday: 'long',
  });
const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

function StepRail({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <ol className="flex items-start">
      {STEPS.map((label, i) => (
        <li key={label} className={cn('flex min-w-0 items-start', i > 0 && 'flex-1')}>
          {i > 0 && <span aria-hidden="true" className={cn('mt-[18px] h-[2px] min-w-6 flex-1', i <= step ? 'bg-[#4F46E5]' : 'bg-[#E4E8F1]')} />}
          <div className="flex w-[136px] shrink-0 flex-col items-center gap-2">
            {/* Completed steps are clickable so a review can be corrected without
                losing the rest of the form. */}
            <button
              type="button"
              disabled={i > step}
              aria-current={i === step ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${label}`}
              onClick={() => onJump(i)}
              className={cn('grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold transition-colors',
                i < step ? 'bg-[#4F46E5] text-white hover:brightness-110'
                  : i === step ? 'bg-[#4F46E5] text-white ring-4 ring-[#E7E5FD]'
                    : 'cursor-not-allowed bg-[#EEF1F8] text-[#94A3B8]')}
            >
              {i < step ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </button>
            <span className={cn('text-center text-[12.5px]', i === step ? 'font-bold text-[#0F172A]' : 'font-medium text-[#94A3B8]')}>
              {label}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SummaryBlock({ icon: Icon, label, children }: { icon?: typeof User; label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[#F1F3F9] pt-4">
      <p className="text-[11.5px] font-semibold text-[#64748B]">{label}</p>
      <div className="mt-2 flex items-start gap-2.5">
        {Icon && (
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#EEF1FE]">
            <Icon className="h-[17px] w-[17px] text-[#4F46E5]" />
          </span>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Read-only `label : value` pair for the confirm step. */
function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-[7px]">
      <dt className="w-[150px] shrink-0 text-[12.5px] font-medium text-[#64748B]">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13px] font-semibold text-[#0F172A]">{value}</dd>
    </div>
  );
}

/**
 * Book (or reschedule) an appointment.
 *
 * Single-doctor platform, so the provider is the signed-in doctor and is shown
 * read-only rather than as a dropdown that could only ever hold one name.
 * "Department" from the reference is the clinic location, which this app models.
 */
export default function BookAppointment() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { user } = useAuth();
  const { clinics, active } = useActiveLocation();
  const topRef = useRef<HTMLDivElement>(null);

  const editId = search.get('edit');
  const presetPatient = search.get('patient');

  const [step, setStep] = useState(0);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [booked, setBooked] = useState<{ start: string; durationMin: number }[]>([]);
  // 0 until the first tick, so nothing is wrongly marked "passed" on first paint.
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── form ──
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [patientId, setPatientId] = useState(presetPatient ?? '');
  const [newPatient, setNewPatient] = useState({ displayName: '', dob: '', sex: 'female', phone: '' });
  const [date, setDate] = useState(todayInputValueIST());
  const [slot, setSlot] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [mode, setMode] = useState<AppointmentMode>('in_person');
  const [locationOverride, setLocationOverride] = useState('');
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');

  const today = todayInputValueIST();
  const selectedPatient = patients.find((p) => p.id === patientId) ?? null;
  const finalReason = reason === 'Other' ? otherReason.trim() : reason;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { patients: list } = await listPatients();
        if (cancelled) return;
        setPatients(list);

        if (editId) {
          // Fetched by id, NOT scanned out of a date window — an appointment
          // outside the window used to render a silently blank form that then
          // overwrote the real booking on save.
          const { appointment } = await getAppointment(editId);
          if (cancelled) return;
          const startMins = istMinutesOfDay(appointment.start);
          setPatientId(appointment.patientId);
          setDate(new Date(new Date(appointment.start).getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10));
          setSlot(hhmm(startMins));
          setDurationMin(appointment.durationMin);
          setMode(appointment.mode);
          const known = REASONS.includes(appointment.reason ?? '');
          setReason(known ? (appointment.reason as string) : appointment.reason ? 'Other' : '');
          setOtherReason(known ? '' : appointment.reason ?? '');
          setSymptoms(appointment.symptoms ?? '');
          setNotes(appointment.notes ?? '');
          if (appointment.locationId) setLocationOverride(appointment.locationId);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : (editId ? 'Could not load this appointment' : 'Could not load patients'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    // Deferred by a task so this is never a synchronous setState in an effect.
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  // Derived, not stored: the clinic defaults to whichever one the shell is
  // scoped to until the doctor picks a different one. No effect, no cascade.
  const defaultClinicId = active && active.id !== 'overall'
    ? active.id
    : clinics.find((c) => c.primary)?.id ?? clinics[0]?.id ?? '';
  const locationId = locationOverride || defaultClinicId;

  // Which slots are already taken on the chosen day.
  useEffect(() => {
    const from = istInstant(date, 0).toISOString();
    const to = istInstant(date, 24 * 60).toISOString();
    let cancelled = false;
    void listSchedule({ from, to })
      .then(({ appointments }) => {
        if (cancelled) return;
        setBooked(appointments
          .filter((a) => a.status === 'scheduled' && a.id !== editId)
          .map((a) => ({ start: a.start, durationMin: a.durationMin })));
      })
      .catch(() => {
        if (!cancelled) setBooked([]);
      });
    return () => {
      cancelled = true;
    };
  }, [date, editId]);

  const slots = useMemo(() => {
    const out: { value: string; label: string; taken: boolean; past: boolean }[] = [];
    for (let m = DAY_START_HOUR * 60; m + durationMin <= DAY_END_HOUR * 60; m += durationMin) {
      const start = istInstant(date, m);
      const end = new Date(start.getTime() + durationMin * 60_000);
      const taken = booked.some((b) => {
        const bs = new Date(b.start).getTime();
        const be = bs + b.durationMin * 60_000;
        return start.getTime() < be && bs < end.getTime();
      });
      // A slot that has already begun cannot be booked — the server rejects it,
      // so offering it would only produce a confusing error at the last step.
      out.push({ value: hhmm(m), label: `${clock(start)} - ${clock(end)}`, taken, past: now > 0 && start.getTime() < now });
    }

    // An appointment being rescheduled may sit off the grid — an 11:00 booking
    // is not on a 45-minute ladder that starts at 09:00. Without this its own
    // time silently vanishes from the picker and the form looks incomplete.
    if (slot && !out.some((s) => s.value === slot)) {
      const mins = Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3));
      const start = istInstant(date, mins);
      const end = new Date(start.getTime() + durationMin * 60_000);
      out.push({
        value: slot,
        label: `${clock(start)} - ${clock(end)} — current time`,
        taken: false,
        past: now > 0 && start.getTime() < now,
      });
      out.sort((a, b) => a.value.localeCompare(b.value));
    }
    return out;
  }, [date, durationMin, booked, now, slot]);

  /** The chosen slot may have been taken or expired since it was picked. */
  const chosenSlot = slots.find((s) => s.value === slot) ?? null;
  const slotUnavailable = !!slot && (!chosenSlot || chosenSlot.taken || chosenSlot.past);

  const startsAt = slot ? istInstant(date, Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3))) : null;
  const endsAt = startsAt ? new Date(startsAt.getTime() + durationMin * 60_000) : null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients.slice(0, 6);
    return patients
      .filter((p) => p.displayName.toLowerCase().includes(q) || (p.phone ?? '').includes(q) || (p.code ?? '').includes(q))
      .slice(0, 6);
  }, [patients, query]);

  // A patient id from the URL (or a stale one) must resolve to a real record —
  // otherwise the form would look complete and fail with a 404 on save.
  const existingReady = !!patientId && !!selectedPatient;
  const newReady = newPatient.displayName.trim().length > 1
    && (!newPatient.dob || newPatient.dob <= today);
  const patientReady = tab === 'existing' ? existingReady : newReady;
  const detailsReady = !!slot && !slotUnavailable && !!finalReason && !!date && date >= today;

  function goTo(next: number) {
    setStep(next);
    setError(null);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      let id = patientId;
      if (tab === 'new') {
        const { templates } = await listTemplates();
        const templateId = templates[0]?.id;
        if (!templateId) throw new Error('No patient template configured — add one in Settings first.');
        const created = await createPatient({
          templateId,
          displayName: newPatient.displayName.trim(),
          dob: newPatient.dob || undefined,
          sex: newPatient.sex,
          phone: newPatient.phone.trim() || undefined,
          locationId: locationId || undefined,
        });
        id = created.patient.id;
      }
      const body = {
        start: istInstant(date, Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3))).toISOString(),
        durationMin,
        mode,
        reason: finalReason || undefined,
        symptoms: symptoms.trim() || undefined,
        notes: notes.trim() || undefined,
        locationId: locationId || undefined,
      };
      if (editId) await updateAppointment(editId, body);
      else await createAppointment(id, body);
      navigate('/doctor/appointments');
    } catch (e: unknown) {
      // Surfaces the server's own words, including the 409 slot-clash message.
      setError(e instanceof Error ? e.message : 'Could not save the appointment');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-[#64748B]">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading…
      </p>
    );
  }

  // A reschedule that could not load its appointment must NOT fall through to a
  // blank form — saving it would overwrite the real booking.
  if (loadError && editId) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-lg font-bold text-[#0F172A]">Appointment not found</h1>
        <p className="mt-2 text-sm text-[#64748B]">{loadError}</p>
        <button type="button" onClick={() => navigate('/doctor/appointments')}
          className="mx-auto mt-5 h-11 rounded-[10px] border border-[#E2E6F0] bg-white px-5 text-[13.5px] font-bold text-[#1E2A5A]">
          Back to Appointments
        </button>
      </div>
    );
  }

  const summaryName = tab === 'new' ? newPatient.displayName.trim() : selectedPatient?.displayName ?? '';
  const summaryDob = tab === 'new' ? newPatient.dob : selectedPatient?.dob ?? '';
  const summarySex = tab === 'new' ? newPatient.sex : selectedPatient?.sex ?? '';
  const summaryAge = summaryDob ? `${ageParts(summaryDob).years}Y ${ageParts(summaryDob).months}M` : '';
  const sexLabel = summarySex === 'male' ? 'Male' : summarySex === 'female' ? 'Female' : 'Unspecified';
  const clinicName = clinics.find((c) => c.id === locationId)?.name ?? '—';

  return (
    <div className="min-w-0">
      <div ref={topRef} className="mb-5">
        <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">
          {editId ? 'Reschedule Appointment' : 'Book New Appointment'}
        </h1>
        <p className="mt-1.5 text-sm text-[#64748B]">Schedule an appointment for your patient</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
        <div className={`${CARD} min-w-0`}>
          <div className="overflow-x-auto px-6 py-6">
            <StepRail step={step} onJump={goTo} />
          </div>

          {loadError && !editId && (
            <p role="alert" className="mx-6 rounded-[10px] border border-[#F5C2C2] bg-[#FDF2F2] px-4 py-2.5 text-[12.5px] font-medium text-[#B42318]">
              {loadError}
            </p>
          )}

          {/* ── Step 1 · Patient ── */}
          {step === 0 && (
            <section className="border-t border-[#ECEEF4] px-6 py-6">
              <h2 className={SECTION}>1. Patient Information</h2>

              {!editId && (
                <div role="radiogroup" aria-label="Patient type" className="mt-3.5 flex flex-wrap gap-6">
                  {([['existing', 'Existing Patient'], ['new', 'New Patient']] as const).map(([v, label]) => (
                    <label key={v} className="flex cursor-pointer items-center gap-2.5">
                      <input type="radio" name="ptype" checked={tab === v} onChange={() => setTab(v)}
                        className="h-[18px] w-[18px] accent-[#4F46E5]" />
                      <span className="text-[13.5px] font-medium text-[#334155]">{label}</span>
                    </label>
                  ))}
                </div>
              )}

              {tab === 'existing' ? (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="relative">
                    <label htmlFor="bk-search" className={LABEL}>Select Patient <span className="text-[#EF4444]">*</span></label>
                    <div className={FIELD}>
                      <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                      <input id="bk-search" value={query} disabled={!!editId} autoComplete="off"
                        onChange={(e) => { setQuery(e.target.value); setPickerOpen(true); }}
                        onFocus={() => setPickerOpen(true)}
                        placeholder="Search by name, phone or patient ID" className={BARE} />
                      {pickerOpen && !editId && (
                        <button type="button" aria-label="Close patient list" onClick={() => setPickerOpen(false)}
                          className="shrink-0 text-[#94A3B8] hover:text-[#334155]">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {pickerOpen && !editId && (
                      <ul className="absolute z-20 mt-2 max-h-[240px] w-full overflow-y-auto rounded-[10px] border border-[#E2E6F0] bg-white py-1 shadow-[0_10px_28px_-14px_rgba(15,23,42,.25)]">
                        {matches.length === 0 && <li className="px-3.5 py-2.5 text-[12.5px] text-[#64748B]">No patient matches that.</li>}
                        {matches.map((p) => (
                          <li key={p.id}>
                            <button type="button" onClick={() => { setPatientId(p.id); setQuery(''); setPickerOpen(false); }}
                              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[#F5F7FF]">
                              <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EDE9FE] text-[11px] font-bold text-[#6D5AE0]">
                                {initialsOf(p.displayName)}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-bold text-[#0F172A]">{p.displayName}</span>
                                <span className="block text-[11.5px] text-[#64748B]">{patientNumber(p.code)}{p.phone ? ` • ${p.phone}` : ''}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <span className={LABEL}>Selected</span>
                    {selectedPatient ? (
                      <div className="mt-1.5 flex h-[52px] items-center gap-3 rounded-[10px] border border-[#E2E6F0] bg-[#FAFBFD] px-3.5">
                        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EDE9FE] text-[12px] font-bold text-[#6D5AE0]">
                          {initialsOf(selectedPatient.displayName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-[#0F172A]">
                            {selectedPatient.displayName} <span className="font-medium text-[#64748B]">({patientNumber(selectedPatient.code)})</span>
                          </span>
                          <span className="block text-[11.5px] text-[#64748B]">
                            {selectedPatient.dob ? `${ageParts(selectedPatient.dob).years}Y ${ageParts(selectedPatient.dob).months}M • ` : ''}
                            {selectedPatient.sex === 'male' ? 'Male' : selectedPatient.sex === 'female' ? 'Female' : 'Unspecified'}
                          </span>
                        </span>
                        {!editId && (
                          <button type="button" aria-label="Clear selected patient" onClick={() => setPatientId('')}
                            className="shrink-0 text-[#94A3B8] hover:text-[#334155]">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1.5 flex h-[52px] items-center rounded-[10px] border border-dashed border-[#DDE3F5] px-3.5 text-[12.5px] text-[#94A3B8]">
                        {patientId ? 'That patient is no longer on your roster' : 'No patient selected yet'}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="np-name" className={LABEL}>Full name <span className="text-[#EF4444]">*</span></label>
                    <div className={FIELD}>
                      <input id="np-name" value={newPatient.displayName} onChange={(e) => setNewPatient((p) => ({ ...p, displayName: e.target.value }))}
                        placeholder="Child's full name" className={BARE} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="np-dob" className={LABEL}>Date of birth</label>
                    <div className={FIELD}>
                      {/* No child is born tomorrow. */}
                      <input id="np-dob" type="date" max={today} value={newPatient.dob}
                        onChange={(e) => setNewPatient((p) => ({ ...p, dob: e.target.value }))} className={BARE} />
                    </div>
                    {newPatient.dob && newPatient.dob > today && (
                      <p className="mt-1 text-[11.5px] font-medium text-[#B42318]">Date of birth cannot be in the future.</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="np-sex" className={LABEL}>Sex</label>
                    <div className={FIELD}>
                      <select id="np-sex" value={newPatient.sex} onChange={(e) => setNewPatient((p) => ({ ...p, sex: e.target.value }))} className={cn(BARE, 'appearance-none')}>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="unspecified">Unspecified</option>
                      </select>
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="np-phone" className={LABEL}>Guardian phone</label>
                    <div className={FIELD}>
                      <input id="np-phone" type="tel" inputMode="tel" value={newPatient.phone}
                        onChange={(e) => setNewPatient((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+91 …" className={BARE} />
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Step 2 · Appointment + visit info ── */}
          {step === 1 && (
            <>
              <section className="border-t border-[#ECEEF4] px-6 py-6">
                <h2 className={SECTION}>2. Appointment Details</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <span className={LABEL}>Doctor</span>
                    <div className="mt-1.5 flex h-[52px] items-center gap-3 rounded-[10px] border border-[#E2E6F0] bg-[#FAFBFD] px-3.5">
                      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EDE9FE] text-[12px] font-bold text-[#6D5AE0]">
                        {initialsOf(user?.name ?? 'Doctor')}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold text-[#0F172A]">{user?.name ?? 'Doctor'}</span>
                        <span className="block text-[11.5px] text-[#64748B]">Your clinic&rsquo;s only provider</span>
                      </span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="bk-date" className={LABEL}>Date <span className="text-[#EF4444]">*</span></label>
                    <div className={FIELD}>
                      <CalendarDays aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[#4F46E5]" />
                      {/* The server refuses past bookings; the picker refuses first. */}
                      <input id="bk-date" type="date" min={today} value={date}
                        onChange={(e) => { setDate(e.target.value); setSlot(''); }} className={BARE} />
                    </div>
                    {date < today && (
                      <p className="mt-1 text-[11.5px] font-medium text-[#B42318]">Pick today or a later date.</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="bk-clinic" className={LABEL}>Clinic</label>
                    <div className={FIELD}>
                      <Stethoscope aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[#12A150]" />
                      <select id="bk-clinic" value={locationId} onChange={(e) => setLocationOverride(e.target.value)} className={cn(BARE, 'appearance-none')}>
                        {clinics.length === 0 && <option value="">No clinics added yet</option>}
                        {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="bk-slot" className={LABEL}>Time Slot <span className="text-[#EF4444]">*</span></label>
                    <div className={FIELD}>
                      <Clock aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[#4F46E5]" />
                      <select id="bk-slot" value={slot} onChange={(e) => setSlot(e.target.value)} className={cn(BARE, 'appearance-none')}>
                        <option value="">Choose a slot</option>
                        {slots.map((s) => (
                          <option key={s.value} value={s.value} disabled={s.taken || s.past}>
                            {s.label}{s.taken ? ' — booked' : s.past ? ' — passed' : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                    </div>
                    {slotUnavailable && (
                      <p className="mt-1 text-[11.5px] font-medium text-[#B42318]">
                        {chosenSlot?.taken ? 'That slot was just booked — pick another.' : 'That slot is no longer available — pick another.'}
                      </p>
                    )}
                    {!slots.some((s) => !s.taken && !s.past) && (
                      <p className="mt-1 text-[11.5px] font-medium text-[#E8890B]">No slots left on this date.</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="bk-mode" className={LABEL}>Visit Type <span className="text-[#EF4444]">*</span></label>
                    <div className={FIELD}>
                      <Stethoscope aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[#4F46E5]" />
                      <select id="bk-mode" value={mode} onChange={(e) => setMode(e.target.value as AppointmentMode)} className={cn(BARE, 'appearance-none')}>
                        {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="bk-dur" className={LABEL}>Duration</label>
                    <div className={FIELD}>
                      <Clock aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[#4F46E5]" />
                      <select id="bk-dur" value={durationMin} onChange={(e) => { setDurationMin(Number(e.target.value)); setSlot(''); }} className={cn(BARE, 'appearance-none')}>
                        {DURATIONS.map((d) => <option key={d} value={d}>{d} Minutes</option>)}
                      </select>
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                    </div>
                  </div>
                </div>
              </section>

              <section className="border-t border-[#ECEEF4] px-6 py-6">
                <h2 className={SECTION}>3. Visit Information</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label htmlFor="bk-reason" className={LABEL}>Reason for Visit <span className="text-[#EF4444]">*</span></label>
                    <div className={FIELD}>
                      <FileText aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[#4F46E5]" />
                      <select id="bk-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={cn(BARE, 'appearance-none')}>
                        <option value="">Choose a reason</option>
                        {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                    </div>
                    {reason === 'Other' && (
                      <div className={cn(FIELD, 'mt-2.5')}>
                        <input aria-label="Reason for visit" value={otherReason} onChange={(e) => setOtherReason(e.target.value)}
                          placeholder="Describe the reason" maxLength={200} className={BARE} />
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="bk-symptoms" className={LABEL}>Symptoms <span className="font-normal text-[#94A3B8]">(Optional)</span></label>
                    <textarea id="bk-symptoms" value={symptoms} onChange={(e) => setSymptoms(e.target.value.slice(0, 250))} rows={3}
                      placeholder="Fever since 2 days, mild cough and cold."
                      className="mt-1.5 w-full rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 py-3 text-[13.5px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
                    <p className="mt-1 text-right text-[11px] text-[#94A3B8]">{symptoms.length}/250</p>
                  </div>

                  <div className="lg:col-span-2">
                    <label htmlFor="bk-notes" className={LABEL}>Additional Notes <span className="font-normal text-[#94A3B8]">(Optional)</span></label>
                    <textarea id="bk-notes" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 250))} rows={3}
                      placeholder="Any additional information…"
                      className="mt-1.5 w-full rounded-[10px] border border-[#E2E6F0] bg-white px-3.5 py-3 text-[13.5px] text-[#0F172A] focus:border-[#3B4FE0] focus:outline-none" />
                    <p className="mt-1 text-right text-[11px] text-[#94A3B8]">{notes.length}/250</p>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── Step 3 · Confirm ── */}
          {step === 2 && (
            <section className="border-t border-[#ECEEF4] px-6 py-6">
              <h2 className={SECTION}>Confirm &amp; Save</h2>
              <p className="mt-1 text-[12.5px] text-[#64748B]">Check the details before booking. Tap a completed step above to change anything.</p>

              <dl className="mt-4 divide-y divide-[#F1F3F9] rounded-[12px] border border-[#E4E8F1] px-5 py-2">
                <ReviewRow label="Patient" value={
                  <>
                    {summaryName || '—'}
                    <span className="ml-2 font-medium text-[#64748B]">
                      {[summaryAge, sexLabel].filter(Boolean).join(' • ')}
                      {tab === 'new' ? ' — will be registered' : ''}
                    </span>
                  </>
                } />
                <ReviewRow label="Doctor" value={user?.name ?? 'Doctor'} />
                <ReviewRow label="Clinic" value={clinicName} />
                <ReviewRow label="Date" value={longDate(date)} />
                <ReviewRow label="Time" value={startsAt && endsAt ? `${clock(startsAt)} – ${clock(endsAt)} (${durationMin} min)` : '—'} />
                <ReviewRow label="Visit type" value={MODE_LABEL[mode]} />
                <ReviewRow label="Reason" value={finalReason || '—'} />
                {symptoms.trim() && <ReviewRow label="Symptoms" value={symptoms.trim()} />}
                {notes.trim() && <ReviewRow label="Notes" value={notes.trim()} />}
              </dl>
            </section>
          )}

          {error && (
            <p role="alert" className="mx-6 mb-4 rounded-[10px] border border-[#F5C2C2] bg-[#FDF2F2] px-4 py-2.5 text-[12.5px] font-medium text-[#B42318]">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center gap-3 border-t border-[#ECEEF4] px-6 py-5">
            <button type="button" onClick={() => navigate('/doctor/appointments')}
              className="h-[46px] rounded-[10px] border border-[#E2E6F0] bg-white px-6 text-[14px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
              Cancel
            </button>
            {step > 0 && (
              <button type="button" onClick={() => goTo(step - 1)}
                className="flex h-[46px] items-center gap-2 rounded-[10px] border border-[#E2E6F0] bg-white px-6 text-[14px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
                <ArrowLeft className="h-[17px] w-[17px]" />Back
              </button>
            )}
            {step < 2 ? (
              <button type="button"
                disabled={step === 0 ? !patientReady : !detailsReady}
                onClick={() => goTo(step + 1)}
                className="ml-auto flex h-[46px] items-center gap-2.5 rounded-[10px] px-7 text-[14px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105 disabled:opacity-50 disabled:shadow-none"
                style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
                {step === 0 ? 'Continue' : 'Proceed to Confirm'}
                <ArrowRight className="h-[17px] w-[17px]" />
              </button>
            ) : (
              <button type="button" disabled={saving || !patientReady || !detailsReady} onClick={() => void confirm()}
                className="ml-auto flex h-[46px] items-center gap-2.5 rounded-[10px] px-7 text-[14px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
                {saving ? <Loader2 aria-hidden="true" className="h-[17px] w-[17px] animate-spin" /> : <Check className="h-[17px] w-[17px]" />}
                {editId ? 'Save changes' : 'Confirm & Save'}
              </button>
            )}
          </div>
        </div>

        {/* ── Summary rail ── */}
        <aside className={`${CARD} min-w-0 px-5 py-5`}>
          <h2 className="font-display text-[15.5px] font-bold tracking-[-0.01em] text-[#0F172A]">Appointment Summary</h2>

          <span aria-hidden="true" className="mt-4 grid h-11 w-11 place-items-center rounded-[12px] bg-[#EEF1FE]">
            <CalendarDays className="h-5 w-5 text-[#4F46E5]" />
          </span>

          <div className="mt-4 flex flex-col gap-4">
            <SummaryBlock icon={User} label="Patient">
              {summaryName ? (
                <>
                  <p className="text-[13.5px] font-bold text-[#0F172A]">{summaryName}</p>
                  <p className="text-[12px] text-[#64748B]">{[summaryAge, sexLabel].filter(Boolean).join(' • ')}</p>
                  {tab === 'existing' && selectedPatient && (
                    <p className="text-[12px] text-[#94A3B8]">{patientNumber(selectedPatient.code)}</p>
                  )}
                </>
              ) : <p className="text-[12.5px] text-[#94A3B8]">Not selected</p>}
            </SummaryBlock>

            <SummaryBlock icon={Stethoscope} label="Doctor">
              <p className="text-[13.5px] font-bold text-[#0F172A]">{user?.name ?? 'Doctor'}</p>
              <p className="text-[12px] text-[#64748B]">{clinicName}</p>
            </SummaryBlock>

            <SummaryBlock icon={CalendarDays} label="Date & Time">
              <p className="text-[13.5px] font-bold text-[#0F172A]">{longDate(date)}</p>
              <p className="text-[12px] text-[#64748B]">
                {startsAt && endsAt ? `${clock(startsAt)} - ${clock(endsAt)}` : 'No slot chosen'}
              </p>
              <p className="text-[12px] text-[#94A3B8]">{durationMin} Minutes</p>
            </SummaryBlock>

            <SummaryBlock icon={Stethoscope} label="Visit Type">
              <p className="text-[13.5px] font-bold text-[#0F172A]">{MODE_LABEL[mode]}</p>
            </SummaryBlock>

            <SummaryBlock icon={FileText} label="Reason for Visit">
              <p className="text-[13.5px] font-bold text-[#0F172A]">{finalReason || '—'}</p>
              {symptoms.trim() && <p className="mt-1 text-[12px] text-[#64748B]">{symptoms.trim()}</p>}
            </SummaryBlock>
          </div>

          <div className="mt-5 rounded-[11px] bg-[#F1F4FE] px-4 py-3.5">
            <p className="flex items-center gap-2 text-[12.5px] font-bold text-[#334155]">
              <Info aria-hidden="true" className="h-4 w-4 text-[#4F46E5]" />
              Important Note
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[#475569]">
              Please arrive 10 minutes before the scheduled time.
              <br />
              Carry previous medical reports, if any.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
