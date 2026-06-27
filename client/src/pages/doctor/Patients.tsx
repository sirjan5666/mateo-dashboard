import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Archive, ChevronRight, MessageSquare, Plus, Search, Users, X } from 'lucide-react';
import { ApiError } from '../../api/client';
import { archivePatient, createPatient, listPatients, listTemplates } from '../../api/doctorPatients';
import type { CreatePatientInput, Patient, Template } from '../../api/doctorPatients';
import { getDoctorNotifications } from '../../api/notifications';
import { useT } from '../../i18n/context';
import { Card } from '../../components/ui/Card';
import { StatusPill } from '../../components/ui/StatusPill';
import { BrandTile } from '../../components/ui/BrandTile';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { Table, TBody, TD, TH, THead, TR } from '../../components/ui/Table';
import { buttonClass } from '../../components/ui/buttonStyles';
import { inputCls } from '../../components/ui/field';
import { toneDot } from '../../components/ui/tones';
import type { Tone } from '../../components/ui/tones';
import { statusIcon, statusTone } from '../../components/doctor/status';
import { formatAge, formatDateIST } from '../../lib/age';
import { cn } from '../../lib/cn';

const TONES: Tone[] = ['emerald', 'amber', 'rose', 'sky', 'violet', 'stone'];
function asTone(t?: string): Tone {
  return TONES.includes(t as Tone) ? (t as Tone) : 'stone';
}

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Persisted list filters ("saved filters") so the roster opens how you left it.
const FILTER_KEY = 'mateo:doctorPatientsFilter';
function readFilter(): { status: string; archived: boolean } {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { status?: unknown; archived?: unknown };
      return { status: typeof v.status === 'string' ? v.status : '', archived: !!v.archived };
    }
  } catch {
    /* ignore */
  }
  return { status: '', archived: false };
}
function writeFilter(v: { status: string; archived: boolean }) {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export default function Patients() {
  const t = useT();
  const navigate = useNavigate();
  const initial = readFilter();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initial.status);
  const [includeArchived, setIncludeArchived] = useState(initial.archived);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    writeFilter({ status: statusFilter, archived: includeArchived });
  }, [statusFilter, includeArchived]);

  // statusKey -> {label,tone} resolved through each patient's template.
  const statusByTemplate = useMemo(() => {
    const m = new Map<string, Map<string, { label: string; tone: Tone }>>();
    for (const tpl of templates) {
      const inner = new Map<string, { label: string; tone: Tone }>();
      for (const s of tpl.statuses) inner.set(s.key, { label: s.label, tone: asTone(s.tone) });
      m.set(tpl.id, inner);
    }
    return m;
  }, [templates]);

  function resolveStatus(p: Patient): { label: string; tone: Tone } {
    const r = statusByTemplate.get(p.specialtyTemplateId)?.get(p.status);
    return { label: r?.label ?? titleCase(p.status), tone: r?.tone ?? statusTone(p.status) };
  }

  function load(showArchived: boolean) {
    return Promise.all([listPatients({ includeArchived: showArchived }), listTemplates()]).then(([pts, tpls]) => {
      setPatients(pts.patients);
      setTemplates(tpls.templates);
    });
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
        if (!cancelled) setError(e instanceof ApiError ? e.message : t('doctor.patients.loadError'));
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
  }, [includeArchived, t]);

  // Distinct statuses present in the roster, for the filter dropdown.
  const statusOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of patients ?? []) {
      if (!seen.has(p.status)) seen.set(p.status, resolveStatus(p).label);
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, statusByTemplate]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (patients ?? []).filter(
      (p) => (!needle || p.displayName.toLowerCase().includes(needle)) && (!statusFilter || p.status === statusFilter),
    );
  }, [patients, q, statusFilter]);

  // Roster summary (active patients only) for the stat strip.
  const summary = useMemo(() => {
    const list = (patients ?? []).filter((p) => !p.archivedAt);
    const byStatus = new Map<string, { label: string; tone: Tone; count: number }>();
    for (const p of list) {
      const { label, tone } = resolveStatus(p);
      const ex = byStatus.get(label);
      if (ex) ex.count += 1;
      else byStatus.set(label, { label, tone, count: 1 });
    }
    return { total: list.length, statuses: [...byStatus.values()].sort((a, b) => b.count - a.count) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, statusByTemplate]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (filtered.every((p) => prev.has(p.id))) return new Set();
      return new Set(filtered.map((p) => p.id));
    });
  }

  async function archiveSelected() {
    setArchiving(true);
    await Promise.allSettled([...selected].map((id) => archivePatient(id)));
    await load(includeArchived).catch(() => undefined);
    setSelected(new Set());
    setArchiving(false);
    setConfirmArchive(false);
  }

  return (
    <div>
      <header className="flex flex-wrap items-center gap-3">
        <BrandTile icon={Users} iconClassName="h-6 w-6" className="h-12 w-12 rounded-2xl shadow-soft" />
        <div>
          <p className="eyebrow">Doctor</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">{t('doctor.patients.title')}</h1>
          <p className="text-sm text-stone-500">{t('doctor.patients.subtitle')}</p>
        </div>
        <button onClick={() => setAdding(true)} className={buttonClass('primary', 'md', 'ml-auto shadow-card')}>
          <Plus className="h-4 w-4" />
          {t('doctor.patients.add')}
        </button>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {patients && patients.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-[0.68rem] font-bold uppercase tracking-wide text-stone-400">{t('doctor.patients.total')}</p>
            <p className="mt-1 font-display text-2xl font-extrabold leading-none tabular-nums text-stone-900">{summary.total}</p>
          </Card>
          {summary.statuses.slice(0, 3).map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', toneDot[s.tone])} />
                <p className="truncate text-[0.68rem] font-bold uppercase tracking-wide text-stone-400">{s.label}</p>
              </div>
              <p className="mt-1 font-display text-2xl font-extrabold leading-none tabular-nums text-stone-900">{s.count}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('doctor.patients.search')} className={`${inputCls} mt-0 pl-9`} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} mt-0 w-auto`} aria-label={t('doctor.patients.colStatus')}>
          <option value="">{t('doctor.patients.allStatuses')}</option>
          {statusOptions.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-600">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="h-4 w-4 rounded border-stone-300" />
          {t('doctor.patients.showArchived')}
        </label>
      </div>

      {/* Bulk-select bar */}
      {selected.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--accent)] px-4 py-2.5 text-sm">
          <span className="font-semibold text-[var(--accent-foreground)] tabular-nums">
            {t(selected.size === 1 ? 'doctor.patients.selectedOne' : 'doctor.patients.selectedMany', { n: selected.size })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setConfirmArchive(true)} className={buttonClass('secondary', 'sm')}>
              <Archive className="h-4 w-4" />
              {t('doctor.patients.archive')}
            </button>
            <button onClick={() => setSelected(new Set())} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-stone-500 hover:text-stone-700">
              <X className="h-4 w-4" />
              {t('doctor.patients.clear')}
            </button>
          </div>
        </div>
      )}

      {patients === null ? (
        <p className="mt-8 text-sm text-stone-500">{t('doctor.patients.loading')}</p>
      ) : filtered.length === 0 ? (
        <Card className="mt-6 px-6 py-12 text-center">
          <h2 className="font-display text-lg font-semibold text-stone-900">{q || statusFilter ? t('doctor.patients.noMatches') : t('doctor.patients.empty')}</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stone-500">{q || statusFilter ? t('doctor.patients.noMatchesHint') : t('doctor.patients.emptyHint')}</p>
          {!q && !statusFilter && (
            <button onClick={() => setAdding(true)} className={buttonClass('primary', 'md', 'mt-4')}>
              <Plus className="h-4 w-4" />
              {t('doctor.patients.add')}
            </button>
          )}
        </Card>
      ) : (
        <Card className="mt-5 overflow-hidden p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="h-4 w-4 rounded border-stone-300 align-middle"
                  />
                </TH>
                <TH>{t('doctor.patients.colPatient')}</TH>
                <TH>{t('doctor.patients.colStatus')}</TH>
                <TH>{t('doctor.patients.colDob')}</TH>
                <TH>{t('doctor.patients.colUpdated')}</TH>
                <TH className="w-10" />
              </TR>
            </THead>
            <TBody>
              {filtered.map((p) => {
                const st = resolveStatus(p);
                const isSel = selected.has(p.id);
                return (
                  <TR key={p.id} className={cn(isSel && 'bg-[var(--accent)]')}>
                    <TD>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggle(p.id)}
                        aria-label={`Select ${p.displayName}`}
                        className="h-4 w-4 rounded border-stone-300 align-middle"
                      />
                    </TD>
                    <TD>
                      <Link to={`/doctor/patients/${p.id}`} className="group/name flex items-center gap-3">
                        <Avatar name={p.displayName} size="sm" hashColor />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-stone-900 group-hover/name:text-[var(--primary)]">{p.displayName}</span>
                            {p.archivedAt && <Archive className="h-3.5 w-3.5 shrink-0 text-stone-400" />}
                            {unread[p.id] > 0 && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums text-white">
                                <MessageSquare className="h-3 w-3" />
                                {unread[p.id]}
                              </span>
                            )}
                          </span>
                          {p.sex && p.sex !== 'unspecified' && <span className="block truncate text-xs capitalize text-stone-400">{p.sex}</span>}
                        </span>
                      </Link>
                    </TD>
                    <TD>
                      <StatusPill label={st.label} tone={st.tone} icon={statusIcon(p.status)} />
                    </TD>
                    <TD className="whitespace-nowrap text-stone-600">
                      {p.dob ? (
                        <>
                          <span className="font-medium text-stone-800">{formatAge(p.dob)}</span>
                          <span className="text-stone-400"> · {formatDateIST(p.dob)}</span>
                        </>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-stone-500">{formatDateIST(p.updatedAt)}</TD>
                    <TD>
                      <Link to={`/doctor/patients/${p.id}`} aria-label={t('doctor.patients.openChart')} className="grid h-8 w-8 place-items-center rounded-lg text-stone-300 hover:bg-[var(--surface-sunken)] hover:text-stone-600">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
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

      <Modal open={confirmArchive} title={t('doctor.patients.archiveTitle')} onClose={() => !archiving && setConfirmArchive(false)} size="sm">
        <p className="text-sm text-stone-600">{t('doctor.patients.archiveBody', { n: selected.size })}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setConfirmArchive(false)} disabled={archiving} className={buttonClass('secondary', 'md')}>
            {t('doctor.patients.cancel')}
          </button>
          <button onClick={() => void archiveSelected()} disabled={archiving} className={buttonClass('primary', 'md')}>
            <Archive className="h-4 w-4" />
            {archiving ? t('doctor.patients.archiving') : t('doctor.patients.archive')}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function AddPatientModal({ templates, onClose, onCreated }: { templates: Template[]; onClose: () => void; onCreated: (p: Patient) => void }) {
  const t = useT();
  const [form, setForm] = useState<CreatePatientInput>({
    templateId: templates[0]?.id ?? '',
    displayName: '',
    sex: 'unspecified',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.templateId || !form.displayName.trim()) {
      setError(t('doctor.patients.nameRequired'));
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
      setError(e instanceof ApiError ? e.message : t('doctor.patients.createError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={t('doctor.patients.modalTitle')} onClose={onClose} size="md">
      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-stone-700">
          {t('doctor.patients.fullName')}
          <input className={inputCls} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} autoFocus />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          {t('doctor.patients.recordTemplate')}
          <select className={inputCls} value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-stone-700">
            {t('doctor.patients.dateOfBirth')}
            <input type="date" className={inputCls} value={form.dob ?? ''} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            {t('doctor.patients.sex')}
            <select className={inputCls} value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
              <option value="unspecified">{t('doctor.patients.sexUnspecified')}</option>
              <option value="male">{t('doctor.patients.sexMale')}</option>
              <option value="female">{t('doctor.patients.sexFemale')}</option>
              <option value="other">{t('doctor.patients.sexOther')}</option>
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium text-stone-700">
          {t('doctor.patients.phone')}
          <input className={inputCls} value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <p className="text-xs text-stone-400">{t('doctor.patients.encNote')}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={buttonClass('secondary', 'md')}>
          {t('doctor.patients.cancel')}
        </button>
        <button onClick={() => void submit()} disabled={saving} className={buttonClass('primary', 'md')}>
          {saving ? t('doctor.patients.adding') : t('doctor.patients.add')}
        </button>
      </div>
    </Modal>
  );
}
