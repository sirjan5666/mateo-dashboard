import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  ArrowRight, CalendarDays, Check, ChevronDown, Clock, FileText, Info, Loader2, Search,
  Stethoscope, User, X,
} from 'lucide-react';
import { useAuth } from '../../auth/context';
import { createAppointment, listSchedule, updateAppointment } from '../../api/doctorAppointments';
import type { AppointmentMode } from '../../api/doctorAppointments';
import { createPatient, listPatients, listTemplates } from '../../api/doctorPatients';
import type { Patient } from '../../api/doctorPatients';
import { useActiveLocation } from '../../lib/doctorLocation';
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

/** Clinic day, in whole hours. Slots are cut at the chosen duration. */
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 20;

const pad = (n: number) => String(n).padStart(2, '0');
const dateInputValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
const longDate = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'long' });
const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
const patientCode = (id: string) => `PT-${id.slice(-6).toUpperCase()}`;

function StepRail({ step }: { step: number }) {
  return (
    <ol className="flex items-start">
      {STEPS.map((label, i) => (
        <li key={label} className={cn('flex min-w-0 items-start', i > 0 && 'flex-1')}>
          {i > 0 && <span aria-hidden="true" className={cn('mt-[18px] h-[2px] min-w-6 flex-1', i <= step ? 'bg-[#4F46E5]' : 'bg-[#E4E8F1]')} />}
          <div className="flex w-[136px] shrink-0 flex-col items-center gap-2">
            <span
              aria-current={i === step ? 'step' : undefined}
              className={cn('grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold',
                i < step ? 'bg-[#4F46E5] text-white' : i === step ? 'bg-[#4F46E5] text-white ring-4 ring-[#E7E5FD]' : 'bg-[#EEF1F8] text-[#94A3B8]')}
            >
              {i < step ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </span>
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

/**
 * Book (or reschedule) an appointment.
 *
 * This is a single-doctor platform, so the provider is the signed-in doctor and
 * is shown read-only rather than as a dropdown that could only ever hold one
 * name. "Department" from the reference is replaced by the clinic location,
 * which this app actually models.
 */
export default function BookAppointment() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { user } = useAuth();
  const { clinics, active } = useActiveLocation();

  const editId = search.get('edit');
  const presetPatient = search.get('patient');

  const [step, setStep] = useState(0);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [booked, setBooked] = useState<{ start: string; durationMin: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── form ──
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [query, setQuery] = useState('');
  const [patientId, setPatientId] = useState(presetPatient ?? '');
  const [newPatient, setNewPatient] = useState({ displayName: '', dob: '', sex: 'female', phone: '' });
  const [date, setDate] = useState(dateInputValue(new Date()));
  const [slot, setSlot] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [mode, setMode] = useState<AppointmentMode>('in_person');
  const [locationOverride, setLocationOverride] = useState('');
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');

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
          // Rescheduling: hydrate from the appointment being moved.
          const day = new Date();
          const { appointments } = await listSchedule({
            from: new Date(day.getFullYear(), day.getMonth() - 1, 1).toISOString(),
            to: new Date(day.getFullYear(), day.getMonth() + 2, 1).toISOString(),
          });
          const target = appointments.find((a) => a.id === editId);
          if (target && !cancelled) {
            const start = new Date(target.start);
            setPatientId(target.patientId);
            setDate(dateInputValue(start));
            setSlot(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
            setDurationMin(target.durationMin);
            setMode(target.mode);
            setReason(REASONS.includes(target.reason ?? '') ? (target.reason as string) : target.reason ? 'Other' : '');
            setOtherReason(REASONS.includes(target.reason ?? '') ? '' : target.reason ?? '');
            setSymptoms(target.symptoms ?? '');
            setNotes(target.notes ?? '');
            if (target.locationId) setLocationOverride(target.locationId);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load patients');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  // Derived, not stored: the clinic defaults to whichever one the shell is
  // scoped to until the doctor picks a different one. No effect, no cascade.
  const defaultClinicId = active && active.id !== 'overall'
    ? active.id
    : clinics.find((c) => c.primary)?.id ?? clinics[0]?.id ?? '';
  const locationId = locationOverride || defaultClinicId;

  // Which slots are already taken on the chosen day.
  useEffect(() => {
    const d = new Date(`${date}T00:00:00`);
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
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
    const out: { value: string; label: string; taken: boolean }[] = [];
    const base = new Date(`${date}T00:00:00`);
    for (let m = DAY_START_HOUR * 60; m + durationMin <= DAY_END_HOUR * 60; m += durationMin) {
      const start = new Date(base.getTime() + m * 60_000);
      const end = new Date(start.getTime() + durationMin * 60_000);
      const overlaps = booked.some((b) => {
        const bs = new Date(b.start).getTime();
        const be = bs + b.durationMin * 60_000;
        return start.getTime() < be && bs < end.getTime();
      });
      out.push({ value: `${pad(start.getHours())}:${pad(start.getMinutes())}`, label: `${clock(start)} - ${clock(end)}`, taken: overlaps });
    }
    return out;
  }, [date, durationMin, booked]);

  const startsAt = slot ? new Date(`${date}T${slot}:00`) : null;
  const endsAt = startsAt ? new Date(startsAt.getTime() + durationMin * 60_000) : null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients.slice(0, 6);
    return patients
      .filter((p) => p.displayName.toLowerCase().includes(q) || (p.phone ?? '').includes(q) || patientCode(p.id).toLowerCase().includes(q))
      .slice(0, 6);
  }, [patients, query]);

  const patientReady = tab === 'existing' ? !!patientId : newPatient.displayName.trim().length > 1;
  const detailsReady = !!slot && !!finalReason;

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
        start: new Date(`${date}T${slot}:00`).toISOString(),
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

  const summaryName = tab === 'new' ? newPatient.displayName.trim() : selectedPatient?.displayName ?? '';
  const summaryDob = tab === 'new' ? newPatient.dob : selectedPatient?.dob ?? '';
  const summarySex = tab === 'new' ? newPatient.sex : selectedPatient?.sex ?? '';
  const summaryAge = summaryDob ? `${ageParts(summaryDob).years}Y ${ageParts(summaryDob).months}M` : '';
  const clinicName = clinics.find((c) => c.id === locationId)?.name ?? '—';

  return (
    <div className="min-w-0">
      <div className="mb-5">
        <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">
          {editId ? 'Reschedule Appointment' : 'Book New Appointment'}
        </h1>
        <p className="mt-1.5 text-sm text-[#64748B]">Schedule an appointment for your patient</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_336px]">
        <div className={`${CARD} min-w-0`}>
          <div className="overflow-x-auto px-6 py-6">
            <StepRail step={step} />
          </div>

          {/* ── 1 · Patient ── */}
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
                <div>
                  <label htmlFor="bk-search" className={LABEL}>Select Patient <span className="text-[#EF4444]">*</span></label>
                  <div className={FIELD}>
                    <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                    <input id="bk-search" value={query} onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name, phone or patient ID" className={BARE} disabled={!!editId} />
                  </div>
                  {!editId && query.trim() && (
                    <ul className="mt-2 max-h-[220px] overflow-y-auto rounded-[10px] border border-[#E2E6F0] bg-white py-1 shadow-[0_10px_28px_-14px_rgba(15,23,42,.25)]">
                      {matches.length === 0 && <li className="px-3.5 py-2.5 text-[12.5px] text-[#64748B]">No patient matches that.</li>}
                      {matches.map((p) => (
                        <li key={p.id}>
                          <button type="button" onClick={() => { setPatientId(p.id); setQuery(''); }}
                            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[#F5F7FF]">
                            <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EDE9FE] text-[11px] font-bold text-[#6D5AE0]">
                              {initialsOf(p.displayName)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-bold text-[#0F172A]">{p.displayName}</span>
                              <span className="block text-[11.5px] text-[#64748B]">{patientCode(p.id)}{p.phone ? ` • ${p.phone}` : ''}</span>
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
                          {selectedPatient.displayName} <span className="font-medium text-[#64748B]">({patientCode(selectedPatient.id)})</span>
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
                      No patient selected yet
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
                    <input id="np-dob" type="date" value={newPatient.dob} onChange={(e) => setNewPatient((p) => ({ ...p, dob: e.target.value }))} className={BARE} />
                  </div>
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
                    <input id="np-phone" value={newPatient.phone} onChange={(e) => setNewPatient((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+91 …" className={BARE} />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── 2 · Appointment ── */}
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
                  <input id="bk-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlot(''); }} className={BARE} />
                </div>
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
                      <option key={s.value} value={s.value} disabled={s.taken}>
                        {s.label}{s.taken ? ' — booked' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                </div>
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

          {/* ── 3 · Visit information ── */}
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
              <button type="button" onClick={() => setStep((s) => s - 1)}
                className="h-[46px] rounded-[10px] border border-[#E2E6F0] bg-white px-6 text-[14px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
                Back
              </button>
            )}
            {step < 2 ? (
              <button type="button"
                disabled={step === 0 ? !patientReady : !detailsReady}
                onClick={() => setStep((s) => s + 1)}
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
                  <p className="text-[12px] text-[#64748B]">
                    {[summaryAge, summarySex === 'male' ? 'Male' : summarySex === 'female' ? 'Female' : 'Unspecified'].filter(Boolean).join(' • ')}
                  </p>
                  {tab === 'existing' && selectedPatient && (
                    <p className="text-[12px] text-[#94A3B8]">{patientCode(selectedPatient.id)}</p>
                  )}
                </>
              ) : <p className="text-[12.5px] text-[#94A3B8]">Not selected</p>}
            </SummaryBlock>

            <SummaryBlock icon={Stethoscope} label="Doctor">
              <p className="text-[13.5px] font-bold text-[#0F172A]">{user?.name ?? 'Doctor'}</p>
              <p className="text-[12px] text-[#64748B]">{clinicName}</p>
            </SummaryBlock>

            <SummaryBlock icon={CalendarDays} label="Date & Time">
              <p className="text-[13.5px] font-bold text-[#0F172A]">{longDate(new Date(`${date}T00:00:00`))}</p>
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
