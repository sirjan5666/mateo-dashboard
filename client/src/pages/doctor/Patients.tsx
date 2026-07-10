import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Archive, ArrowDown, ArrowUp, Eye, MessageSquare, Pencil, Plus, Search } from 'lucide-react';
import { ApiError } from '../../api/client';
import { archivePatient, createPatient, listPatients, listTemplates, updatePatient } from '../../api/doctorPatients';
import type { CreatePatientInput, Patient, Template } from '../../api/doctorPatients';
import { getDoctorNotifications } from '../../api/notifications';
import { useT } from '../../i18n/context';
import { Card } from '../../components/ui/Card';
import { StatusPill } from '../../components/ui/StatusPill';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { Table, TBody, TD, TH, THead, TR } from '../../components/ui/Table';
import { DropdownMenu } from '../../components/ui/DropdownMenu';
import type { DropdownEntry } from '../../components/ui/DropdownMenu';
import { Pagination } from '../../components/ui/Pagination';
import { buttonClass } from '../../components/ui/buttonStyles';
import { inputCls } from '../../components/ui/field';
import type { Tone } from '../../components/ui/tones';
import { statusIcon, statusTone } from '../../components/doctor/status';
import { formatAge, formatDateIST } from '../../lib/age';

const PAGE_SIZE = 10;
const TONES: Tone[] = ['emerald', 'amber', 'rose', 'sky', 'violet', 'stone'];
function asTone(t?: string): Tone {
  return TONES.includes(t as Tone) ? (t as Tone) : 'stone';
}
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

type SortKey = 'name' | 'status' | 'joined';

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
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'joined', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<Patient | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    writeFilter({ status: statusFilter, archived: includeArchived });
  }, [statusFilter, includeArchived]);

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

  function reload() {
    return Promise.all([listPatients({ includeArchived }), listTemplates()]).then(([pts, tpls]) => {
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
    const list = (patients ?? []).filter(
      (p) => (!needle || p.displayName.toLowerCase().includes(needle) || (p.phone ?? '').includes(needle)) && (!statusFilter || p.status === statusFilter),
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const [av, bv] =
        sort.key === 'name'
          ? [a.displayName.toLowerCase(), b.displayName.toLowerCase()]
          : sort.key === 'status'
            ? [resolveStatus(a).label.toLowerCase(), resolveStatus(b).label.toLowerCase()]
            : [a.createdAt, b.createdAt];
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, q, statusFilter, sort, statusByTemplate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'joined' ? 'desc' : 'asc' }));
    setPage(1);
  }

  async function doArchive(p: Patient) {
    setArchiving(true);
    await archivePatient(p.id).catch(() => undefined);
    await reload().catch(() => undefined);
    setArchiving(false);
    setConfirm(null);
  }

  function rowItems(p: Patient): DropdownEntry[] {
    const items: DropdownEntry[] = [
      { key: 'open', label: t('doctor.patients.rowOpen'), icon: Eye },
      { key: 'edit', label: t('doctor.patients.rowEdit'), icon: Pencil },
    ];
    if (!p.archivedAt) {
      items.push('separator', { key: 'archive', label: t('doctor.patients.archive'), icon: Archive, danger: true });
    }
    return items;
  }
  function onRowAction(p: Patient, key: string) {
    if (key === 'open') navigate(`/doctor/patients/${p.id}`);
    else if (key === 'edit') setEditing(p);
    else if (key === 'archive') setConfirm(p);
  }

  const sortIcon = (key: SortKey) => (sort.key !== key ? null : sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />);
  const sortBtn = 'inline-flex items-center gap-1 font-bold text-stone-500 transition-colors hover:text-stone-800';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">{t('doctor.patients.title')}</h1>
          <p className="text-sm text-stone-500">{t('doctor.patients.subtitle')}</p>
        </div>
        <button onClick={() => setAdding(true)} className={buttonClass('primary', 'md', 'shadow-card')}>
          <Plus className="h-4 w-4" />
          {t('doctor.patients.add')}
        </button>
      </div>

      {error && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      <Card className="overflow-hidden p-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--hairline)] p-4">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={t('doctor.patients.search')}
              className={`${inputCls} mt-0 pl-9`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={`${inputCls} mt-0 w-auto`}
            aria-label={t('doctor.patients.colStatus')}
          >
            <option value="">{t('doctor.patients.allStatuses')}</option>
            {statusOptions.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-600">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => {
                setIncludeArchived(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-stone-300"
            />
            {t('doctor.patients.showArchived')}
          </label>
        </div>

        {patients === null ? (
          <p className="p-8 text-sm text-stone-500">{t('doctor.patients.loading')}</p>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h2 className="font-display text-lg font-semibold text-stone-900">{q || statusFilter ? t('doctor.patients.noMatches') : t('doctor.patients.empty')}</h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-stone-500">{q || statusFilter ? t('doctor.patients.noMatchesHint') : t('doctor.patients.emptyHint')}</p>
            {!q && !statusFilter && (
              <button onClick={() => setAdding(true)} className={buttonClass('primary', 'md', 'mt-4')}>
                <Plus className="h-4 w-4" />
                {t('doctor.patients.add')}
              </button>
            )}
          </div>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>
                    <button type="button" onClick={() => toggleSort('name')} className={sortBtn}>
                      {t('doctor.patients.colPatient')}
                      {sortIcon('name')}
                    </button>
                  </TH>
                  <TH>
                    <button type="button" onClick={() => toggleSort('status')} className={sortBtn}>
                      {t('doctor.patients.colStatus')}
                      {sortIcon('status')}
                    </button>
                  </TH>
                  <TH>{t('doctor.patients.colDob')}</TH>
                  <TH>
                    <button type="button" onClick={() => toggleSort('joined')} className={sortBtn}>
                      {t('doctor.patients.joined')}
                      {sortIcon('joined')}
                    </button>
                  </TH>
                  <TH className="w-10 text-right" />
                </TR>
              </THead>
              <TBody>
                {pageRows.map((p) => {
                  const st = resolveStatus(p);
                  return (
                    <TR key={p.id}>
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
                      <TD className="whitespace-nowrap text-stone-500">{formatDateIST(p.createdAt)}</TD>
                      <TD className="text-right">
                        <DropdownMenu items={rowItems(p)} onSelect={(k) => onRowAction(p, k)} label={`Actions for ${p.displayName}`} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <div className="p-4">
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                onChange={setPage}
                totalLabel={t('doctor.patients.showing', { n: pageRows.length, total: filtered.length })}
              />
            </div>
          </>
        )}
      </Card>

      {(adding || editing) && (
        <PatientModal
          templates={templates}
          patient={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={(p, isNew) => {
            setAdding(false);
            setEditing(null);
            if (isNew) navigate(`/doctor/patients/${p.id}`);
            else void reload();
          }}
        />
      )}

      <Modal open={!!confirm} title={t('doctor.patients.archiveOneTitle')} onClose={() => !archiving && setConfirm(null)} size="sm">
        <p className="text-sm text-stone-600">{t('doctor.patients.archiveOneBody', { name: confirm?.displayName ?? '' })}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setConfirm(null)} disabled={archiving} className={buttonClass('secondary', 'md')}>
            {t('doctor.patients.cancel')}
          </button>
          <button onClick={() => confirm && void doArchive(confirm)} disabled={archiving} className={buttonClass('primary', 'md')}>
            <Archive className="h-4 w-4" />
            {archiving ? t('doctor.patients.archiving') : t('doctor.patients.archive')}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// Add OR edit a patient. Edit mode (patient set) updates name/dob/sex/phone; the
// record template is fixed once created, so it only shows when adding.
function PatientModal({ templates, patient, onClose, onSaved }: { templates: Template[]; patient: Patient | null; onClose: () => void; onSaved: (p: Patient, isNew: boolean) => void }) {
  const t = useT();
  const isEdit = !!patient;
  const [form, setForm] = useState<CreatePatientInput>({
    templateId: patient?.specialtyTemplateId ?? templates[0]?.id ?? '',
    displayName: patient?.displayName ?? '',
    sex: patient?.sex ?? 'unspecified',
    dob: patient?.dob ?? undefined,
    phone: patient?.phone ?? undefined,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!isEdit && (!form.templateId || !form.displayName.trim())) {
      setError(t('doctor.patients.nameRequired'));
      return;
    }
    if (!form.displayName.trim()) {
      setError(t('doctor.patients.nameRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && patient) {
        const { patient: updated } = await updatePatient(patient.id, {
          displayName: form.displayName.trim(),
          sex: form.sex,
          dob: form.dob || undefined,
          phone: form.phone?.trim() || undefined,
        });
        onSaved(updated, false);
      } else {
        const { patient: created } = await createPatient({
          templateId: form.templateId,
          displayName: form.displayName.trim(),
          sex: form.sex,
          dob: form.dob || undefined,
          phone: form.phone?.trim() || undefined,
        });
        onSaved(created, true);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('doctor.patients.createError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={isEdit ? t('doctor.patients.editTitle') : t('doctor.patients.modalTitle')} onClose={onClose} size="md">
      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-stone-700">
          {t('doctor.patients.fullName')}
          <input className={inputCls} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} autoFocus />
        </label>
        {!isEdit && (
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
        )}
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
          {saving ? t('doctor.patients.saving') : isEdit ? t('doctor.patients.save') : t('doctor.patients.add')}
        </button>
      </div>
    </Modal>
  );
}
