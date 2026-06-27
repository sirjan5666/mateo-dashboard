import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Users, Plus, Search, Archive, MessageSquare } from 'lucide-react';
import { ApiError } from '../../api/client';
import { createPatient, listPatients, listTemplates } from '../../api/doctorPatients';
import type { CreatePatientInput, Patient, Template } from '../../api/doctorPatients';
import { getDoctorNotifications } from '../../api/notifications';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { BrandTile } from '../../components/ui/BrandTile';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { buttonClass } from '../../components/ui/buttonStyles';
import { inputCls } from '../../components/ui/field';
import { toneDot } from '../../components/ui/tones';
import type { Tone } from '../../components/ui/tones';
import { cn } from '../../lib/cn';

const TONES: Tone[] = ['emerald', 'amber', 'rose', 'sky', 'violet', 'stone'];
function asTone(t?: string): Tone {
  return TONES.includes(t as Tone) ? (t as Tone) : 'stone';
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [adding, setAdding] = useState(false);

  // statusKey -> {label,tone} resolved through each patient's template.
  const statusByTemplate = useMemo(() => {
    const m = new Map<string, Map<string, { label: string; tone: Tone }>>();
    for (const t of templates) {
      const inner = new Map<string, { label: string; tone: Tone }>();
      for (const s of t.statuses) inner.set(s.key, { label: s.label, tone: asTone(s.tone) });
      m.set(t.id, inner);
    }
    return m;
  }, [templates]);

  function statusChip(p: Patient) {
    const resolved = statusByTemplate.get(p.specialtyTemplateId)?.get(p.status);
    return <Pill tone={resolved?.tone ?? 'stone'}>{resolved?.label ?? p.status}</Pill>;
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPatients({ includeArchived }), listTemplates()])
      .then(([pts, tpls]) => {
        if (cancelled) return;
        setPatients(pts.patients);
        setTemplates(tpls.templates);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
      });
    getDoctorNotifications()
      .then((d) => {
        if (cancelled) return;
        setUnread(Object.fromEntries(d.messages.byPatient.map((b) => [String(b.patientId), b.count])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [includeArchived]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return patients ?? [];
    return (patients ?? []).filter((p) => p.displayName.toLowerCase().includes(needle));
  }, [patients, q]);

  // Roster summary (active patients only) for the stat strip.
  const summary = useMemo(() => {
    const list = (patients ?? []).filter((p) => !p.archivedAt);
    const byStatus = new Map<string, { label: string; tone: Tone; count: number }>();
    for (const p of list) {
      const resolved = statusByTemplate.get(p.specialtyTemplateId)?.get(p.status);
      const label = resolved?.label ?? p.status;
      const ex = byStatus.get(label);
      if (ex) ex.count += 1;
      else byStatus.set(label, { label, tone: resolved?.tone ?? 'stone', count: 1 });
    }
    return { total: list.length, statuses: [...byStatus.values()].sort((a, b) => b.count - a.count) };
  }, [patients, statusByTemplate]);

  return (
    <div>
      <header className="flex flex-wrap items-center gap-3">
        <BrandTile icon={Users} iconClassName="h-6 w-6" className="h-12 w-12 rounded-2xl shadow-soft" />
        <div>
          <p className="eyebrow">Doctor</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">Patients</h1>
          <p className="text-sm text-stone-500">Your patient roster — records are private to your practice.</p>
        </div>
        <button onClick={() => setAdding(true)} className={buttonClass('primary', 'md', 'ml-auto shadow-card')}>
          <Plus className="h-4 w-4" />
          Add patient
        </button>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {patients && patients.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-[0.68rem] font-bold uppercase tracking-wide text-stone-400">Total</p>
            <p className="mt-1 font-display text-2xl font-extrabold leading-none text-stone-900">{summary.total}</p>
          </Card>
          {summary.statuses.slice(0, 3).map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', toneDot[s.tone])} />
                <p className="truncate text-[0.68rem] font-bold uppercase tracking-wide text-stone-400">{s.label}</p>
              </div>
              <p className="mt-1 font-display text-2xl font-extrabold leading-none text-stone-900">{s.count}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className={`${inputCls} mt-0 pl-9`}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-600">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="h-4 w-4 rounded border-stone-300" />
          Show archived
        </label>
      </div>

      {patients === null ? (
        <p className="mt-8 text-sm text-stone-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="mt-6 px-6 py-12 text-center">
          <h2 className="font-display text-lg font-semibold text-stone-900">{q ? 'No matches' : 'No patients yet'}</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stone-500">
            {q ? 'Try a different name.' : 'Add your first patient to start a record.'}
          </p>
          {!q && (
            <button onClick={() => setAdding(true)} className={buttonClass('primary', 'md', 'mt-4')}>
              <Plus className="h-4 w-4" />
              Add patient
            </button>
          )}
        </Card>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/doctor/patients/${p.id}`}
              className="group rounded-[26px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            >
              <Card className="h-full p-4 transition-shadow hover:shadow-card">
                <div className="flex items-start gap-3">
                  <Avatar name={p.displayName} className="h-11 w-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-stone-900">{p.displayName}</p>
                      {p.archivedAt && <Archive className="h-3.5 w-3.5 shrink-0 text-stone-400" />}
                      {unread[p.id] > 0 && (
                        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[0.7rem] font-bold text-white">
                          <MessageSquare className="h-3 w-3" />
                          {unread[p.id]}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {p.sex !== 'unspecified' ? `${p.sex} · ` : ''}DOB {fmtDate(p.dob)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {statusChip(p)}
                  <span className="text-xs text-stone-400">Updated {fmtDate(p.updatedAt)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {adding && (
        <AddPatientModal
          templates={templates}
          onClose={() => setAdding(false)}
          onCreated={(p) => {
            setAdding(false);
            navigate(`/doctor/patients/${p.id}`);
          }}
        />
      )}
    </div>
  );
}

function AddPatientModal({
  templates,
  onClose,
  onCreated,
}: {
  templates: Template[];
  onClose: () => void;
  onCreated: (p: Patient) => void;
}) {
  const [form, setForm] = useState<CreatePatientInput>({
    templateId: templates[0]?.id ?? '',
    displayName: '',
    sex: 'unspecified',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.templateId || !form.displayName.trim()) {
      setError('Name and a record template are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: CreatePatientInput = {
        templateId: form.templateId,
        displayName: form.displayName.trim(),
        sex: form.sex,
        dob: form.dob || undefined,
        phone: form.phone?.trim() || undefined,
      };
      const { patient } = await createPatient(body);
      onCreated(patient);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create the patient.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Add patient" onClose={onClose} size="md">
      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-stone-700">
          Full name
          <input className={inputCls} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} autoFocus />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Record template
          <select className={inputCls} value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-stone-700">
            Date of birth
            <input type="date" className={inputCls} value={form.dob ?? ''} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
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
          <input className={inputCls} value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <p className="text-xs text-stone-400">Name, date of birth and phone are encrypted at rest.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={buttonClass('secondary', 'md')}>
          Cancel
        </button>
        <button onClick={() => void submit()} disabled={saving} className={buttonClass('primary', 'md')}>
          {saving ? 'Adding…' : 'Add patient'}
        </button>
      </div>
    </Modal>
  );
}
