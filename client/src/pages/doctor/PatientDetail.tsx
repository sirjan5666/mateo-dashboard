import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Activity, AlertTriangle, ArrowLeft, Archive, Baby, Calculator, CalendarClock, ChevronRight, FileText, FlaskConical, KeyRound, Pencil, Pill as PillIcon, Plus, Save, ShieldCheck, Stethoscope, Syringe, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ApiError } from '../../api/client';
import { archivePatient, createPortalLogin, getPatient, savePatientRecord, updatePatient } from '../../api/doctorPatients';
import type { FieldDef, Patient, PortalStatus, RecordData, Template } from '../../api/doctorPatients';
import { createEncounter, listEncounters, updateEncounter } from '../../api/doctorEncounters';
import type { Encounter, EncounterInput, EncounterKind } from '../../api/doctorEncounters';
import { createAppointment, listPatientAppointments, updateAppointment } from '../../api/doctorAppointments';
import type { Appointment, AppointmentMode, AppointmentStatus } from '../../api/doctorAppointments';
import { createPrescription, listPrescriptions, updatePrescription } from '../../api/doctorPrescriptions';
import type { Prescription, RxStatus } from '../../api/doctorPrescriptions';
import { listMessages, sendMessage } from '../../api/doctorMessages';
import { MessageThread } from '../../components/MessageThread';
import type { ThreadMessage } from '../../components/MessageThread';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { buttonClass } from '../../components/ui/buttonStyles';
import { inputCls } from '../../components/ui/field';
import { cn } from '../../lib/cn';
import { formatAge } from '../../lib/age';
import { useT } from '../../i18n/context';
import { StatusPill } from '../../components/ui/StatusPill';
import { Tabs } from '../../components/ui/Tabs';
import type { TabItem } from '../../components/ui/Tabs';
import { statusIcon, statusTone } from '../../components/doctor/status';
import { toneBadge } from '../../components/ui/tones';
import type { Tone } from '../../components/ui/tones';

const TONES: Tone[] = ['emerald', 'amber', 'rose', 'sky', 'violet', 'stone'];
const asTone = (t?: string): Tone => (TONES.includes(t as Tone) ? (t as Tone) : 'stone');
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

type PdTab = 'record' | 'encounters' | 'prescriptions' | 'appointments' | 'messages' | 'tools';

const KIND_LABEL: Record<EncounterKind, string> = { visit: 'Visit', follow_up: 'Follow-up', phone: 'Phone', procedure: 'Procedure', note: 'Note' };
const KIND_TONE: Record<EncounterKind, Tone> = { visit: 'sky', follow_up: 'amber', phone: 'violet', procedure: 'rose', note: 'stone' };
const SOAP: { key: keyof Pick<Encounter, 'subjective' | 'objective' | 'assessment' | 'plan'>; label: string }[] = [
  { key: 'subjective', label: 'Subjective' },
  { key: 'objective', label: 'Objective' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'plan', label: 'Plan' },
];

const APPT_STATUS_TONE: Record<AppointmentStatus, Tone> = { scheduled: 'sky', completed: 'emerald', cancelled: 'stone', no_show: 'rose' };
const APPT_STATUS_LABEL: Record<AppointmentStatus, string> = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };
const APPT_MODE_LABEL: Record<AppointmentMode, string> = { in_person: 'In person', phone: 'Phone', video: 'Video' };

const RX_STATUS_TONE: Record<RxStatus, Tone> = { active: 'emerald', completed: 'stone', stopped: 'rose' };
const RX_STATUS_LABEL: Record<RxStatus, string> = { active: 'Active', completed: 'Completed', stopped: 'Stopped' };

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PatientDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [record, setRecord] = useState<RecordData | null>(null);
  const [encounters, setEncounters] = useState<Encounter[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);
  const [portal, setPortal] = useState<PortalStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [tab, setTab] = useState<PdTab>('record');

  useEffect(() => {
    let cancelled = false;
    getPatient(id)
      .then((d) => {
        if (cancelled) return;
        setPatient(d.patient);
        setTemplate(d.template);
        setRecord(d.record);
        setPortal(d.portal);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load this patient');
      });
    listEncounters(id)
      .then((d) => !cancelled && setEncounters(d.encounters))
      .catch(() => !cancelled && setEncounters([]));
    listPatientAppointments(id)
      .then((d) => !cancelled && setAppointments(d.appointments))
      .catch(() => !cancelled && setAppointments([]));
    listPrescriptions(id)
      .then((d) => !cancelled && setPrescriptions(d.prescriptions))
      .catch(() => !cancelled && setPrescriptions([]));
    return () => {
      cancelled = true;
    };
  }, [id]);

  function refetchEncounters() {
    listEncounters(id).then((d) => setEncounters(d.encounters)).catch(() => undefined);
  }
  function refetchAppointments() {
    listPatientAppointments(id).then((d) => setAppointments(d.appointments)).catch(() => undefined);
  }
  function refetchPrescriptions() {
    listPrescriptions(id).then((d) => setPrescriptions(d.prescriptions)).catch(() => undefined);
  }

  const statusOpt = useMemo(() => template?.statuses.find((s) => s.key === patient?.status), [template, patient]);

  if (error) return <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>;
  if (!patient) return <p className="text-sm text-stone-500">{t('doctor.pd.loading')}</p>;

  return (
    <div>
      <Link to="/doctor/patients" className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-stone-700">
        <ArrowLeft className="h-4 w-4" />
        {t('doctor.pd.allPatients')}
      </Link>

      {/* Header */}
      <Card className="hero-aurora relative mt-3 overflow-hidden p-6">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="relative flex flex-wrap items-start gap-4">
          <Avatar name={patient.displayName} size="xl" hashColor />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">{patient.displayName}</h1>
              <StatusPill
                label={statusOpt?.label ?? titleCase(patient.status)}
                tone={statusOpt ? asTone(statusOpt.tone) : statusTone(patient.status)}
                icon={statusIcon(patient.status)}
              />
              {patient.archivedAt && (
                <Pill tone="stone">
                  <Archive className="h-3 w-3" /> {t('doctor.pd.archived')}
                </Pill>
              )}
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {patient.dob ? `${formatAge(patient.dob)} · ` : ''}
              {patient.sex !== 'unspecified' ? `${patient.sex} · ` : ''}
              {template ? template.name : 'No template'}
            </p>
            {record && record.tags.length > 0 && template && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {record.tags.map((key) => {
                  const tag = template.historyTags.find((h) => h.key === key);
                  return (
                    <Pill key={key} tone={asTone(tag?.color)}>
                      {tag?.label ?? key}
                    </Pill>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPortalOpen(true)} className={buttonClass('secondary', 'sm')}>
              <KeyRound className="h-3.5 w-3.5" />
              {portal?.active ? t('doctor.pd.portalAccess') : t('doctor.pd.invitePortal')}
            </button>
            <button onClick={() => setEditing(true)} className={buttonClass('secondary', 'sm')}>
              <Pencil className="h-3.5 w-3.5" />
              {t('doctor.pd.editDetails')}
            </button>
          </div>
        </div>
        {portal?.active && (
          <p className="relative mt-3 inline-flex items-center gap-1.5 text-xs text-stone-500">
            <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
            {t('doctor.pd.portalActive', { email: portal.email ?? '' })}
          </p>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main column — tabbed hub. Sections stay mounted (show/hide) so the
            record form keeps unsaved edits and lists don't refetch on tab change. */}
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Tabs<PdTab>
            items={[
              { value: 'record', label: t('doctor.pd.tabRecord') },
              { value: 'encounters', label: t('doctor.pd.tabNotes'), count: encounters?.length },
              { value: 'prescriptions', label: t('doctor.pd.tabRx'), count: prescriptions?.length },
              { value: 'appointments', label: t('doctor.pd.tabAppts'), count: appointments?.length },
              { value: 'messages', label: t('doctor.pd.tabMessages') },
              { value: 'tools', label: t('doctor.pd.tabTools') },
            ] as TabItem<PdTab>[]}
            value={tab}
            onChange={setTab}
          />

          <div className={cn(tab !== 'record' && 'hidden')}>
            {template ? (
              <RecordForm key={record?.updatedAt ?? 'new'} patientId={id} template={template} record={record} onSaved={(r) => setRecord(r)} />
            ) : (
              <Card className="p-5 text-sm text-stone-500">{t('doctor.pd.noTemplate')}</Card>
            )}
          </div>
          <div className={cn(tab !== 'encounters' && 'hidden')}>
            <EncountersSection patientId={id} items={encounters} onChanged={refetchEncounters} />
          </div>
          <div className={cn(tab !== 'prescriptions' && 'hidden')}>
            <PrescriptionsSection patientId={id} items={prescriptions} onChanged={refetchPrescriptions} />
          </div>
          <div className={cn(tab !== 'appointments' && 'hidden')}>
            <AppointmentsSection patientId={id} items={appointments} onChanged={refetchAppointments} />
          </div>
          <div className={cn(tab !== 'messages' && 'hidden')}>
            <MessagesSection patientId={id} />
          </div>
          <div className={cn(tab !== 'tools' && 'hidden')}>
            <ClinicalToolsTab patient={patient} />
          </div>
        </div>

        {/* Right rail summary (sticky) */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SummaryRail
            patient={patient}
            template={template}
            record={record}
            encounters={encounters}
            appointments={appointments}
            prescriptions={prescriptions}
          />
        </aside>
      </div>

      {editing && (
        <EditDetailsModal
          patient={patient}
          template={template}
          onClose={() => setEditing(false)}
          onSaved={(p) => {
            setPatient(p);
            setEditing(false);
          }}
          onArchived={() => navigate('/doctor/patients')}
        />
      )}

      {portalOpen && (
        <PortalLoginModal
          patientId={id}
          portal={portal}
          onClose={() => setPortalOpen(false)}
          onSaved={(p) => {
            setPortal(p);
            setPortalOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── in-context clinical tools (pre-scoped to this child) ────────────────────
function ClinicalToolsTab({ patient }: { patient: Patient }) {
  const t = useT();
  const q = `?patient=${patient.id}`;
  const tools: { icon: LucideIcon; labelKey: string; descKey: string; to: string; tone: Tone }[] = [
    { icon: TrendingUp, labelKey: 'doctor.home.modGrowth', descKey: 'doctor.home.modGrowthD', to: `/doctor/growth${q}`, tone: 'emerald' },
    { icon: Syringe, labelKey: 'doctor.home.modVaccines', descKey: 'doctor.home.modVaccinesD', to: `/doctor/vaccines${q}`, tone: 'rose' },
    { icon: Calculator, labelKey: 'doctor.home.modDose', descKey: 'doctor.home.modDoseD', to: `/doctor/dose${q}`, tone: 'sky' },
    { icon: Activity, labelKey: 'doctor.home.modDev', descKey: 'doctor.home.modDevD', to: `/doctor/development${q}`, tone: 'violet' },
    { icon: FlaskConical, labelKey: 'doctor.home.modLabs', descKey: 'doctor.home.modLabsD', to: `/doctor/labs${q}`, tone: 'sky' },
    { icon: Baby, labelKey: 'doctor.home.modNeo', descKey: 'doctor.home.modNeoD', to: `/doctor/neonatology${q}`, tone: 'amber' },
  ];
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold text-stone-900">{t('doctor.pd.tabTools')}</h2>
      <p className="mt-0.5 text-sm text-stone-500">{t('doctor.pd.toolsIntro', { name: patient.displayName })}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link key={tool.to} to={tool.to} className="group">
            <Card className="pop-hover flex h-full items-start gap-3 p-4">
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', toneBadge[tool.tone])}>
                <tool.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-stone-800">{t(tool.labelKey)}</p>
                <p className="mt-0.5 truncate text-xs text-stone-400">{t(tool.descKey)}</p>
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-stone-300 transition-colors group-hover:text-stone-500" />
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-stone-400">{t('doctor.pd.toolsNote')}</p>
    </Card>
  );
}

// ── patient portal login (doctor sets credentials) ──────────────────────────
function PortalLoginModal({
  patientId,
  portal,
  onClose,
  onSaved,
}: {
  patientId: string;
  portal: PortalStatus | null;
  onClose: () => void;
  onSaved: (p: PortalStatus) => void;
}) {
  const active = !!portal?.active;
  const [form, setForm] = useState({ email: portal?.email ?? '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!active && !form.email.trim()) {
      setError('Enter an email for the patient login.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { portal: updated } = await createPortalLogin(patientId, { email: form.email.trim(), password: form.password });
      onSaved(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not set up portal access');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={active ? 'Portal access' : 'Invite to portal'} onClose={onClose} size="md">
      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <p className="mb-3 text-sm text-stone-500">
        {active
          ? 'Reset this patient’s portal password. Share the new password with them securely.'
          : 'Create a read-only portal login so this patient can view their own record. Share the email and password with them securely.'}
      </p>
      <div className="space-y-3">
        <label className="block text-sm font-medium text-stone-700">
          Email
          <input
            type="email"
            className={inputCls}
            value={form.email}
            disabled={active}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="patient@example.com"
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          {active ? 'New password' : 'Temporary password'}
          <input type="text" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" />
        </label>
        <p className="text-xs text-stone-400">The patient signs in at the normal login. They only ever see their own record (read-only).</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={buttonClass('secondary', 'md')}>
          Cancel
        </button>
        <button onClick={() => void save()} disabled={saving} className={buttonClass('primary', 'md')}>
          {saving ? 'Saving…' : active ? 'Reset password' : 'Create login'}
        </button>
      </div>
    </Modal>
  );
}

// ── right-rail clinical summary ─────────────────────────────────────────────
function SummaryRail({
  patient,
  template,
  record,
  encounters,
  appointments,
  prescriptions,
}: {
  patient: Patient;
  template: Template | null;
  record: RecordData | null;
  encounters: Encounter[] | null;
  appointments: Appointment[] | null;
  prescriptions: Prescription[] | null;
}) {
  function fieldValue(match: (f: FieldDef) => boolean): string | null {
    if (!template || !record) return null;
    const f = template.fields.find(match);
    if (!f) return null;
    const v = record.fields[f.key];
    return typeof v === 'string' && v.trim() ? v : null;
  }
  const allergies = fieldValue((f) => f.key === 'allergies' || /allerg/i.test(f.label));
  const meds = fieldValue((f) => f.key === 'current_medications' || /medication/i.test(f.label));
  // "none known" / NKDA is reassuring, not a warning — don't show it as a red alert.
  const noKnownAllergy = !!allergies && /^(none|nil|nka|nkda|no known|n\/?a)\b/i.test(allergies.trim());

  const now = +new Date();
  const nextAppt = (appointments ?? [])
    .filter((a) => a.status === 'scheduled' && +new Date(a.start) >= now)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
  const lastVisit = (encounters ?? [])[0]; // server returns newest-first

  return (
    <Card className="p-5">
      <h2 className="font-display text-base font-semibold text-stone-900">At a glance</h2>

      {allergies &&
        (noKnownAllergy ? (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 p-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" />
            <p className="text-sm font-medium text-green-800">No known allergies</p>
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <div className="min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-wide text-rose-500">Allergies</p>
              <p className="text-sm font-medium text-rose-800">{allergies}</p>
            </div>
          </div>
        ))}

      {meds && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-stone-50 p-3">
          <PillIcon className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-wide text-stone-400">Current meds</p>
            <p className="text-sm text-stone-700">{meds}</p>
          </div>
        </div>
      )}

      <dl className="mt-4 space-y-3 text-sm">
        <SummaryRow icon={CalendarClock} label="Next appointment" value={nextAppt ? fmtDateTime(nextAppt.start) : 'None scheduled'} tone={nextAppt ? 'sky' : 'stone'} />
        <SummaryRow icon={Stethoscope} label="Last visit" value={lastVisit ? fmtDate(lastVisit.date) : 'No visits yet'} tone={lastVisit ? 'emerald' : 'stone'} />
        {patient.phone && <SummaryRow icon={Activity} label="Phone" value={patient.phone} tone="violet" />}
      </dl>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <MiniStat label="Visit notes" value={encounters?.length ?? 0} />
        <MiniStat label="Active Rx" value={(prescriptions ?? []).filter((p) => p.status === 'active').length} />
        <MiniStat label="Appts" value={appointments?.length ?? 0} />
      </div>

      <p className="mt-4 inline-flex items-center gap-1.5 text-[0.7rem] text-stone-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        PHI encrypted at rest
      </p>
    </Card>
  );
}

function SummaryRow({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string; tone: Tone }) {
  const TONE_TEXT: Record<Tone, string> = {
    emerald: 'text-green-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    sky: 'text-sky-600',
    violet: 'text-violet-600',
    stone: 'text-stone-400',
  };
  return (
    <div className="flex items-center gap-3">
      <Icon className={cn('h-4 w-4 shrink-0', TONE_TEXT[tone])} />
      <div className="min-w-0 flex-1">
        <dt className="text-[0.68rem] font-bold uppercase tracking-wide text-stone-400">{label}</dt>
        <dd className="truncate font-medium text-stone-800">{value}</dd>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-stone-50 px-3 py-2.5 text-center">
      <p className="font-display text-xl font-extrabold leading-none text-stone-900">{value}</p>
      <p className="mt-1 text-[0.68rem] font-medium text-stone-500">{label}</p>
    </div>
  );
}

// ── the template-driven record form ─────────────────────────────────────────
function RecordForm({
  patientId,
  template,
  record,
  onSaved,
}: {
  patientId: string;
  template: Template;
  record: RecordData | null;
  onSaved: (r: RecordData) => void;
}) {
  const activeFields = useMemo(
    () => template.fields.filter((f) => !f.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [template],
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of template.fields) {
      const v = record?.fields?.[f.key];
      if (v != null) init[f.key] = String(v);
    }
    return init;
  });
  const [tags, setTags] = useState<string[]>(record?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(record?.updatedAt ?? null);

  function toggleTag(key: string) {
    setTags((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const fields: Record<string, unknown> = {};
    for (const f of activeFields) {
      const raw = values[f.key];
      if (raw == null || raw === '') continue;
      if (f.type === 'number') {
        const n = Number(raw);
        if (!Number.isNaN(n)) fields[f.key] = n;
      } else if (f.type === 'date') {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) fields[f.key] = d.toISOString();
      } else {
        fields[f.key] = raw;
      }
    }
    try {
      const { record: saved } = await savePatientRecord(patientId, { fields, tags });
      setSavedAt(saved.updatedAt);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the record');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-stone-900">Record</h2>
        {savedAt && <span className="text-xs text-stone-400">Saved {fmtDate(savedAt)}</span>}
      </div>

      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="mt-4 space-y-4">
        {activeFields.map((f) => (
          <RecordField key={f.key} field={f} value={values[f.key] ?? ''} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
        ))}
      </div>

      {template.historyTags.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-stone-700">History tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {template.historyTags.map((t) => {
              const on = tags.includes(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleTag(t.key)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    on ? 'border-transparent bg-violet-100 text-violet-800' : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button onClick={() => void save()} disabled={saving} className={buttonClass('primary', 'md')}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save record'}
        </button>
      </div>
    </Card>
  );
}

function RecordField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const label = (
    <span className="text-sm font-medium text-stone-700">
      {field.label}
      {field.required && <span className="text-rose-500"> *</span>}
      {field.sensitive && <span className="ml-1 text-[11px] font-normal text-emerald-600">· encrypted</span>}
    </span>
  );

  if (field.type === 'textarea') {
    return (
      <label className="block">
        {label}
        <textarea rows={3} className={inputCls} maxLength={field.maxLength} value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  if (field.type === 'select') {
    return (
      <label className="block">
        {label}
        <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.type === 'number') {
    return (
      <label className="block">
        {label}
        <input type="number" className={inputCls} min={field.min} max={field.max} value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  if (field.type === 'date') {
    return (
      <label className="block">
        {label}
        <input type="date" className={inputCls} value={value ? value.slice(0, 10) : ''} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  return (
    <label className="block">
      {label}
      <input type="text" className={inputCls} maxLength={field.maxLength} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// ── doctor<->patient messages ───────────────────────────────────────────────
function MessagesSection({ patientId }: { patientId: string }) {
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMessages(patientId)
      .then((d) => !cancelled && setMessages(d.messages))
      .catch(() => !cancelled && setMessages([]));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  async function onSend(body: string) {
    const { message } = await sendMessage(patientId, body);
    setMessages((prev) => [...(prev ?? []), message]);
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold text-stone-900">Messages</h2>
      <p className="mt-0.5 text-sm text-stone-500">Secure, encrypted messages with this patient’s portal.</p>
      <div className="mt-4">
        <MessageThread messages={messages} onSend={onSend} emptyHint="No messages yet. Send the first one." />
      </div>
    </Card>
  );
}

// ── prescriptions ───────────────────────────────────────────────────────────
function PrescriptionsSection({ patientId, items, onChanged }: { patientId: string; items: Prescription[] | null; onChanged: () => void }) {
  const [modal, setModal] = useState<{ editing: Prescription | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function stop(rxId: string) {
    setBusyId(rxId);
    try {
      await updatePrescription(rxId, { status: 'stopped' });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-stone-900">Prescriptions</h2>
        <button onClick={() => setModal({ editing: null })} className={buttonClass('secondary', 'sm')}>
          <Plus className="h-3.5 w-3.5" />
          Prescribe
        </button>
      </div>

      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {items === null ? (
        <p className="mt-3 text-sm text-stone-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-1 rounded-2xl border border-dashed border-stone-200 py-8 text-center">
          <PillIcon className="h-6 w-6 text-stone-300" />
          <p className="text-sm text-stone-500">No prescriptions yet.</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((p) => (
            <li key={p.id} className="rounded-2xl border border-stone-200/70 p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                  <PillIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-900">{p.drug}</span>
                    <Pill tone={RX_STATUS_TONE[p.status]}>{RX_STATUS_LABEL[p.status]}</Pill>
                    <span className="ml-auto text-xs text-stone-400">{fmtDate(p.date)}</span>
                  </div>
                  {(p.dose || p.frequency || p.duration) && (
                    <p className="mt-0.5 text-sm text-stone-600">{[p.dose, p.frequency, p.duration].filter(Boolean).join(' · ')}</p>
                  )}
                  {p.instructions && <p className="mt-0.5 text-xs text-stone-500">{p.instructions}</p>}
                  <div className="mt-2 flex gap-3">
                    <button onClick={() => setModal({ editing: p })} className="text-xs font-semibold text-stone-500 hover:text-stone-700">
                      Edit
                    </button>
                    {p.status === 'active' && (
                      <button onClick={() => void stop(p.id)} disabled={busyId === p.id} className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50">
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <PrescriptionModal
          patientId={patientId}
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function PrescriptionModal({
  patientId,
  editing,
  onClose,
  onSaved,
}: {
  patientId: string;
  editing: Prescription | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    drug: editing?.drug ?? '',
    dose: editing?.dose ?? '',
    frequency: editing?.frequency ?? '',
    duration: editing?.duration ?? '',
    instructions: editing?.instructions ?? '',
    status: editing?.status ?? ('active' as RxStatus),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!form.drug.trim()) {
      setError('Drug name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updatePrescription(editing.id, {
          drug: form.drug.trim(),
          dose: form.dose,
          frequency: form.frequency,
          duration: form.duration,
          instructions: form.instructions,
          status: form.status,
        });
      } else {
        await createPrescription(patientId, {
          drug: form.drug.trim(),
          dose: form.dose || undefined,
          frequency: form.frequency || undefined,
          duration: form.duration || undefined,
          instructions: form.instructions || undefined,
          status: form.status,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the prescription');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={editing ? 'Edit prescription' : 'New prescription'} onClose={onClose} size="md">
      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-stone-700">
          Drug<span className="text-rose-500"> *</span>
          <span className="ml-1 text-[11px] font-normal text-emerald-600">· encrypted</span>
          <input className={inputCls} value={form.drug} onChange={(e) => setForm({ ...form, drug: e.target.value })} placeholder="e.g. Amoxicillin" autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-stone-700">
            Dose
            <input className={inputCls} value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="e.g. 250 mg" />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Frequency
            <input className={inputCls} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="e.g. Twice daily" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-stone-700">
            Duration
            <input className={inputCls} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 5 days" />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Status
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RxStatus })}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="stopped">Stopped</option>
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium text-stone-700">
          Instructions
          <input className={inputCls} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="e.g. After food" />
        </label>
        <p className="text-xs text-stone-400">Medication details are encrypted at rest.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={buttonClass('secondary', 'md')}>
          Cancel
        </button>
        <button onClick={() => void save()} disabled={saving} className={buttonClass('primary', 'md')}>
          {saving ? 'Saving…' : editing ? 'Save' : 'Prescribe'}
        </button>
      </div>
    </Modal>
  );
}

// ── appointments ────────────────────────────────────────────────────────────
function AppointmentsSection({ patientId, items, onChanged }: { patientId: string; items: Appointment[] | null; onChanged: () => void }) {
  const [scheduling, setScheduling] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(apptId: string, status: AppointmentStatus) {
    setBusyId(apptId);
    try {
      await updateAppointment(apptId, { status });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-stone-900">Appointments</h2>
        <button onClick={() => setScheduling(true)} className={buttonClass('secondary', 'sm')}>
          <Plus className="h-3.5 w-3.5" />
          Schedule visit
        </button>
      </div>

      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {items === null ? (
        <p className="mt-3 text-sm text-stone-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">No appointments scheduled.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((a) => (
            <li key={a.id} className="rounded-2xl border border-stone-200/70 p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-stone-800">{fmtDateTime(a.start)}</span>
                <span className="text-xs text-stone-400">
                  {a.durationMin}m · {APPT_MODE_LABEL[a.mode]}
                </span>
                <Pill tone={APPT_STATUS_TONE[a.status]} className="ml-auto">
                  {APPT_STATUS_LABEL[a.status]}
                </Pill>
              </div>
              {a.reason && <p className="mt-1 text-sm text-stone-600">{a.reason}</p>}
              {a.status === 'scheduled' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => void setStatus(a.id, 'completed')} disabled={busyId === a.id} className={buttonClass('primary', 'sm')}>
                    Complete
                  </button>
                  <button onClick={() => void setStatus(a.id, 'cancelled')} disabled={busyId === a.id} className="px-2 text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50">
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {scheduling && (
        <ScheduleVisitModal
          patientId={patientId}
          onClose={() => setScheduling(false)}
          onSaved={() => {
            setScheduling(false);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function ScheduleVisitModal({ patientId, onClose, onSaved }: { patientId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ start: '', durationMin: 30, mode: 'in_person' as AppointmentMode, reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!form.start) {
      setError('Pick a date and time.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAppointment(patientId, {
        start: new Date(form.start).toISOString(),
        durationMin: form.durationMin,
        mode: form.mode,
        reason: form.reason.trim() || undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not schedule the visit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Schedule visit" onClose={onClose} size="md">
      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-stone-700">
          Date &amp; time
          <input type="datetime-local" className={inputCls} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-stone-700">
            Duration (min)
            <input type="number" min={5} max={480} className={inputCls} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Mode
            <select className={inputCls} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as AppointmentMode })}>
              <option value="in_person">In person</option>
              <option value="phone">Phone</option>
              <option value="video">Video</option>
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium text-stone-700">
          Reason <span className="ml-1 text-[11px] font-normal text-emerald-600">· encrypted</span>
          <input className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. follow-up" />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={buttonClass('secondary', 'md')}>
          Cancel
        </button>
        <button onClick={() => void save()} disabled={saving} className={buttonClass('primary', 'md')}>
          {saving ? 'Scheduling…' : 'Schedule'}
        </button>
      </div>
    </Modal>
  );
}

// ── clinical encounters (SOAP visit notes) ──────────────────────────────────
function EncountersSection({ patientId, items, onChanged }: { patientId: string; items: Encounter[] | null; onChanged: () => void }) {
  const [modal, setModal] = useState<{ editing: Encounter | null } | null>(null);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-stone-900">Visit notes</h2>
        <button onClick={() => setModal({ editing: null })} className={buttonClass('secondary', 'sm')}>
          <Plus className="h-3.5 w-3.5" />
          Add note
        </button>
      </div>

      {items === null ? (
        <p className="mt-3 text-sm text-stone-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-1 rounded-2xl border border-dashed border-stone-200 py-8 text-center">
          <FileText className="h-6 w-6 text-stone-300" />
          <p className="text-sm text-stone-500">No visit notes yet.</p>
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((e) => (
            <li key={e.id} className="rounded-2xl border border-stone-200/70 p-4">
              <div className="flex items-center gap-2">
                <Pill tone={KIND_TONE[e.kind]}>{KIND_LABEL[e.kind]}</Pill>
                <span className="text-sm font-semibold text-stone-700">{fmtDate(e.date)}</span>
                <button onClick={() => setModal({ editing: e })} className="ml-auto text-xs font-semibold text-stone-500 hover:text-stone-700">
                  Edit
                </button>
              </div>
              <dl className="mt-2 space-y-1.5">
                {SOAP.filter((s) => e[s.key]).map((s) => (
                  <div key={s.key} className="text-sm">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">{s.label}</dt>
                    <dd className="whitespace-pre-wrap text-stone-700">{e[s.key]}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      )}

      {modal && (
        <EncounterModal
          patientId={patientId}
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function EncounterModal({
  patientId,
  editing,
  onClose,
  onSaved,
}: {
  patientId: string;
  editing: Encounter | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    kind: editing?.kind ?? ('visit' as EncounterKind),
    date: editing ? editing.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    subjective: editing?.subjective ?? '',
    objective: editing?.objective ?? '',
    assessment: editing?.assessment ?? '',
    plan: editing?.plan ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const body: EncounterInput = {
      kind: form.kind,
      date: form.date ? new Date(form.date).toISOString() : undefined,
      subjective: form.subjective,
      objective: form.objective,
      assessment: form.assessment,
      plan: form.plan,
    };
    try {
      if (editing) await updateEncounter(editing.id, body);
      else await createEncounter(patientId, body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the note');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={editing ? 'Edit visit note' : 'New visit note'} onClose={onClose} size="lg">
      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-stone-700">
            Type
            <select className={inputCls} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as EncounterKind })}>
              {(Object.keys(KIND_LABEL) as EncounterKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Date
            <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
        </div>
        {SOAP.map((s) => (
          <label key={s.key} className="block text-sm font-medium text-stone-700">
            {s.label}
            <span className="ml-1 text-[11px] font-normal text-emerald-600">· encrypted</span>
            <textarea rows={2} className={inputCls} value={form[s.key]} onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} />
          </label>
        ))}
        <p className="text-xs text-stone-400">Visit notes are encrypted at rest. At least one field is required.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={buttonClass('secondary', 'md')}>
          Cancel
        </button>
        <button onClick={() => void save()} disabled={saving} className={buttonClass('primary', 'md')}>
          {saving ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </Modal>
  );
}

// ── edit demographics + status + archive ────────────────────────────────────
function EditDetailsModal({
  patient,
  template,
  onClose,
  onSaved,
  onArchived,
}: {
  patient: Patient;
  template: Template | null;
  onClose: () => void;
  onSaved: (p: Patient) => void;
  onArchived: () => void;
}) {
  const [form, setForm] = useState({
    displayName: patient.displayName,
    dob: patient.dob ? patient.dob.slice(0, 10) : '',
    sex: patient.sex,
    phone: patient.phone ?? '',
    status: patient.status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { patient: updated } = await updatePatient(patient.id, {
        displayName: form.displayName.trim(),
        dob: form.dob || undefined,
        sex: form.sex,
        phone: form.phone.trim() || undefined,
        status: form.status,
      });
      onSaved(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!window.confirm('Archive this patient? Their record is kept but hidden from the active roster.')) return;
    setSaving(true);
    try {
      await archivePatient(patient.id);
      onArchived();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not archive');
      setSaving(false);
    }
  }

  return (
    <Modal open title="Edit details" onClose={onClose} size="md">
      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-stone-700">
          Full name
          <input className={inputCls} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-stone-700">
            Date of birth
            <input type="date" className={inputCls} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Sex
            <select className={inputCls} value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
              <option value="unspecified">Unspecified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium text-stone-700">
          Phone
          <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        {template && (
          <label className="block text-sm font-medium text-stone-700">
            Status
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {template.statuses.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <button onClick={() => void archive()} disabled={saving} className="text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50">
          Archive patient
        </button>
        <div className="flex gap-2">
          <button onClick={onClose} className={buttonClass('secondary', 'md')}>
            Cancel
          </button>
          <button onClick={() => void save()} disabled={saving} className={buttonClass('primary', 'md')}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
