import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Check, Copy, Info, Loader2, Mail, Plus, ShieldPlus, Trash2, Users, X } from 'lucide-react';
import {
  createRole, deleteMember, deleteRole, inviteMember, listMembers, listRoles, setMemberActive,
  teamCatalogue, updateRole,
} from '../../api/doctorTeam';
import type {
  CatalogueResponse, InviteResult, PermissionLevel, RolesResponse, StaffMemberDto, StaffRoleDto,
  StaffStatus,
} from '../../api/doctorTeam';
import { ApiError } from '../../api/client';
import { cn } from '../../lib/cn';

const CARD =
  'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';

/** How each level paints in the matrix. */
const LEVEL_STYLE: Record<PermissionLevel, { bg: string; fg: string; label: string }> = {
  full: { bg: '#DCF7E6', fg: '#12A150', label: 'Full' },
  edit: { bg: '#E4EBFD', fg: '#2B6FF0', label: 'Edit' },
  view: { bg: '#EEF2FF', fg: '#6366F1', label: 'View' },
  none: { bg: '#F1F3F9', fg: '#94A3B8', label: '—' },
};

/** Clicking a cell walks the levels in order. */
const NEXT: Record<PermissionLevel, PermissionLevel> = { none: 'view', view: 'edit', edit: 'full', full: 'none' };

/** How each account state paints in the members table. */
const STATUS_STYLE: Record<StaffStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: '#DCF7E6', fg: '#12A150', label: 'Active' },
  invited: { bg: '#FEF3C7', fg: '#B45309', label: 'Invited' },
  disabled: { bg: '#F1F3F9', fg: '#64748B', label: 'Disabled' },
};

const IST_DATE = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});

/** roleId -> module -> level, so a cell edit is one lookup. */
type Matrix = Record<string, Record<string, PermissionLevel>>;

function toMatrix(roles: StaffRoleDto[]): Matrix {
  return Object.fromEntries(roles.map((r) => [r.id, { ...r.permissions }]));
}

export default function TeamAndRoles() {
  const [data, setData] = useState<RolesResponse | null>(null);
  const [members, setMembers] = useState<StaffMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [draft, setDraft] = useState<Matrix | null>(null);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [catalogue, setCatalogue] = useState<CatalogueResponse | null>(null);
  const { state } = useLocation();
  /** Set by a resend; the one handed over by Create Sub-User arrives in router state. */
  const [resent, setResent] = useState<(InviteResult & { name: string }) | null>(null);

  const load = useCallback(async () => {
    const [r, m] = await Promise.all([listRoles(), listMembers()]);
    setData(r);
    setMembers(m.members);
  }, []);

  /** Module id -> label, straight from the catalogue the API enforces. */
  const moduleLabel = (id: string) => catalogue?.modules.find((m) => m.id === id)?.label ?? id;

  // Inlined so every setState is provably after an await.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([listRoles(), listMembers(), teamCatalogue()])
      .then(([r, m, c]) => {
        if (cancelled) return;
        setData(r);
        setMembers(m.members);
        setCatalogue(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your team');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const roles = data?.roles ?? [];
  const modules = data?.modules ?? [];
  // While editing, the draft is what renders; otherwise it comes straight from the server.
  const shown: Matrix = draft ?? toMatrix(roles);
  const editing = draft !== null;

  const cycle = (roleId: string, moduleId: string) =>
    setDraft((d) => (d ? { ...d, [roleId]: { ...d[roleId], [moduleId]: NEXT[d[roleId]?.[moduleId] ?? 'none'] } } : d));

  /** Saves only the roles whose matrix actually changed. */
  async function savePermissions() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const original = toMatrix(roles);
      const changed = roles.filter((r) => JSON.stringify(original[r.id]) !== JSON.stringify(draft[r.id]));
      await Promise.all(changed.map((r) => updateRole(r.id, { permissions: draft[r.id] })));
      await load();
      setDraft(null);
      setNotice(changed.length ? `Saved permissions for ${changed.length} role${changed.length === 1 ? '' : 's'}.` : 'Nothing changed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save permissions');
    } finally {
      setSaving(false);
    }
  }

  async function addRole() {
    const name = newRole.trim();
    if (name.length < 2) {
      setError('Give the role a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createRole({ name, description: newDesc.trim() || undefined });
      await load();
      setNewRole('');
      setNewDesc('');
      setAddOpen(false);
      setNotice(`Role “${name}” created — set its permissions below.`);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? 'A role with that name already exists.' : 'Could not create the role');
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  // The Create Sub-User form hands back whether the invite email actually went
  // out — without SMTP it did not, and the doctor gets the link to pass on
  // instead. Derived during render rather than copied into state.
  const handed = (state as { invite?: InviteResult & { name: string } } | null)?.invite ?? null;
  const invite = resent ?? handed;
  const shownNotice = notice ?? (invite?.emailed
    ? `Invite sent to ${invite.name} — they set their own password from the emailed link.`
    : null);

  const activeMembers = members.filter((m) => m.status === 'active').length;
  const pending = members.filter((m) => m.status === 'invited').length;

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-[#64748B]">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading your team…
      </p>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3.5">
            <span aria-hidden="true" className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px]"
              style={{ background: 'linear-gradient(135deg, #4F63F5 0%, #3B3FE0 100%)' }}>
              <ShieldPlus className="h-5 w-5 text-white" />
            </span>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">
              Team &amp; Roles
            </h1>
          </div>
          <p className="mt-2 text-sm text-[#64748B]">Manage your team members, assign roles and control access permissions.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <button type="button" onClick={() => setAddOpen((v) => !v)} aria-expanded={addOpen}
            className="flex h-[46px] items-center gap-2 rounded-[11px] border-[1.5px] border-[#C7CEF5] bg-white px-5 text-[#3B4FE0] hover:bg-[#F5F7FF]">
            <Plus className="h-[17px] w-[17px]" />
            <span className="text-[14px] font-bold">Add New Role</span>
          </button>
          <Link to="/doctor/team/new"
            className="flex h-[46px] items-center gap-2 rounded-[11px] px-[22px] text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] hover:brightness-105"
            style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}>
            <Plus className="h-[18px] w-[18px]" />
            <span className="text-[14px] font-bold">Create Sub-User</span>
          </Link>
        </div>
      </div>

      {addOpen && (
        <section className={cn(CARD, 'mb-4 px-[22px] py-5')}>
          <h2 className="font-display text-[15.5px] font-bold text-[#0F172A]">New Role</h2>
          <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-[240px_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="r-name" className="mb-[7px] block text-[12.5px] font-bold text-[#334155]">Role Name</label>
              <input id="r-name" value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Lab Technician"
                className="h-11 w-full rounded-[10px] border border-[#E4E8F1] px-3.5 text-[13.5px] focus:border-[#3B4FE0] focus:outline-none" />
            </div>
            <div>
              <label htmlFor="r-desc" className="mb-[7px] block text-[12.5px] font-bold text-[#334155]">Description</label>
              <input id="r-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What this role does"
                className="h-11 w-full rounded-[10px] border border-[#E4E8F1] px-3.5 text-[13.5px] focus:border-[#3B4FE0] focus:outline-none" />
            </div>
            <button type="button" onClick={() => void addRole()} disabled={saving}
              className="flex h-11 items-center gap-2 rounded-[10px] bg-[#3B4FE0] px-6 text-[13.5px] font-bold text-white disabled:opacity-60">
              {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              Create Role
            </button>
          </div>
          <p className="mt-2.5 text-[12px] text-[#64748B]">A new role starts with no access to anything — grant it below.</p>
        </section>
      )}

      {error && (
        <p role="alert" className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
          <X aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />{error}
        </p>
      )}
      {shownNotice && (
        <p role="status" className="mb-4 flex items-center gap-2.5 rounded-[10px] border border-[#C8EDD8] bg-[#ECFAF1] px-4 py-3 text-[13px] font-medium text-[#0F7A46]">
          <Check aria-hidden="true" className="h-4 w-4 shrink-0" />{shownNotice}
        </p>
      )}
      {/* Shown once, and only when no email could go out: without it a clinic
          with no SMTP would create accounts nobody can ever sign into. It is a
          one-time token, so it is never stored — reload and it is gone. */}
      {invite && !invite.emailed && invite.link && (
        <section role="status" className="mb-4 rounded-[12px] border border-[#F8E3B8] bg-[#FEF8EC] px-4 py-3.5">
          <p className="flex items-start gap-2.5 text-[13px] font-medium text-[#8A5A0B]">
            <Info aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-[#E8890B]" />
            <span>
              No invite email was sent — email is not configured on this server. Send {invite.name} this
              activation link yourself; it works once and expires in 3 days.
            </span>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[8px] border border-[#F0DCB0] bg-white px-3 py-2 text-[12px] text-[#334155]">
              {invite.link}
            </code>
            <button type="button"
              onClick={() => { void navigator.clipboard?.writeText(invite.link ?? ''); setNotice('Activation link copied.'); }}
              className="flex h-9 items-center gap-1.5 rounded-[8px] border border-[#E2E6F0] bg-white px-3 text-[12.5px] font-bold text-[#334155] hover:bg-[#F7F8FC]">
              <Copy aria-hidden="true" className="h-[14px] w-[14px]" />
              Copy
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_264px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Permission matrix */}
          <section className={cn(CARD, 'pb-4 pt-5')}>
            <div className="flex flex-wrap items-start gap-3 px-[22px]">
              <div className="min-w-0">
                <h2 className="font-display text-[15.5px] font-bold text-[#0F172A]">Role Permissions</h2>
                <p className="mt-1 text-[12.5px] text-[#64748B]">
                  {editing ? 'Click a cell to cycle: none → view → edit → full.' : 'What each role can reach across the panel.'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                {editing ? (
                  <>
                    <button type="button" onClick={() => setDraft(null)}
                      className="h-10 rounded-[10px] border border-[#E2E6F0] bg-white px-4 text-[13px] font-bold text-[#1E2A5A] hover:bg-[#F7F8FC]">
                      Cancel
                    </button>
                    <button type="button" onClick={() => void savePermissions()} disabled={saving}
                      className="flex h-10 items-center gap-2 rounded-[10px] bg-[#3B4FE0] px-5 text-[13px] font-bold text-white disabled:opacity-60">
                      {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                      Save Permissions
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setDraft(toMatrix(roles))} disabled={roles.length === 0}
                    className="h-10 rounded-[10px] border-[1.5px] border-[#C7CEF5] bg-white px-5 text-[13px] font-bold text-[#3B4FE0] hover:bg-[#F5F7FF] disabled:opacity-50">
                    Edit Permissions
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 px-[22px]">
              {(['full', 'edit', 'view', 'none'] as PermissionLevel[]).map((l) => (
                <span key={l} className="flex items-center gap-2 text-[11.5px] font-medium text-[#475569]">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ background: LEVEL_STYLE[l].fg }} />
                  {l === 'none' ? 'No access' : LEVEL_STYLE[l].label}
                </span>
              ))}
            </div>

            {roles.length === 0 ? (
              <p className="px-[22px] py-12 text-center text-sm text-[#64748B]">No roles yet — add one above.</p>
            ) : (
              <div className="mt-3.5 overflow-x-auto">
                <table className="w-full min-w-[680px] border-separate border-spacing-0">
                  <caption className="sr-only">Role-based module permissions</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="h-10 border-y border-[#ECEEF4] bg-[#FAFBFD] pl-[22px] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                        Module
                      </th>
                      {roles.map((r) => (
                        <th key={r.id} scope="col" className="h-10 border-y border-[#ECEEF4] bg-[#FAFBFD] px-2 text-center text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                          {r.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((mod) => (
                      <tr key={mod} className="hover:bg-[#FAFBFF]">
                        <th scope="row" className="h-[46px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left text-[13px] font-semibold text-[#0F172A]">
                          {moduleLabel(mod)}
                        </th>
                        {roles.map((r) => {
                          const lvl = shown[r.id]?.[mod] ?? 'none';
                          const s = LEVEL_STYLE[lvl];
                          return (
                            <td key={r.id} className="border-b border-[#F1F3F9] px-2 text-center">
                              {editing ? (
                                <button type="button" onClick={() => cycle(r.id, mod)}
                                  aria-label={`${moduleLabel(mod)} for ${r.name}: ${s.label}. Click to change.`}
                                  className="mx-auto block w-[68px] rounded-[7px] py-1.5 text-[11.5px] font-bold transition-colors hover:brightness-95"
                                  style={{ background: s.bg, color: s.fg }}>
                                  {s.label}
                                </button>
                              ) : (
                                <span className="mx-auto block w-[68px] rounded-[7px] py-1.5 text-[11.5px] font-bold"
                                  style={{ background: s.bg, color: s.fg }}>
                                  {s.label}
                                  <span className="sr-only"> access for {r.name}</span>
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Members */}
          <section className={cn(CARD, 'pb-4 pt-5')}>
            <div className="px-[22px]">
              <h2 className="font-display text-[15.5px] font-bold text-[#0F172A]">Team Members ({members.length})</h2>
              <p className="mt-1 text-[12.5px] text-[#64748B]">Sub-user accounts in your practice.</p>
            </div>

            {members.length === 0 ? (
              <div className="px-[22px] py-12 text-center">
                <span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#EEF2FF]">
                  <Users className="h-6 w-6 text-[#3B4FE0]" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-[#0F172A]">No team members yet</h3>
                <p className="mt-2 text-sm text-[#64748B]">Create a sub-user and assign them one of the roles above.</p>
              </div>
            ) : (
              <div className="mt-3.5 overflow-x-auto">
                <table className="w-full min-w-[820px] border-separate border-spacing-0">
                  <caption className="sr-only">Team members</caption>
                  <thead>
                    <tr>
                      {['Name', 'Email', 'Role', 'Location', 'Status', 'Last sign-in', 'Actions'].map((h, i) => (
                        <th key={h} scope="col"
                          className={cn('h-10 border-y border-[#ECEEF4] bg-[#FAFBFD] text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#64748B]',
                            i === 0 && 'pl-[22px]', i === 6 && 'pr-[22px]')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-[#FAFBFF]">
                        <th scope="row" className="h-[54px] border-b border-[#F1F3F9] pl-[22px] pr-3 text-left font-normal">
                          <span className="flex items-center gap-3">
                            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EEF2FF] text-[12px] font-bold text-[#3B4FE0]">
                              {m.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-bold text-[#0F172A]">{m.name}</span>
                              {m.employeeCode && <span className="block text-[11.5px] text-[#94A3B8]">{m.employeeCode}</span>}
                            </span>
                          </span>
                        </th>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">{m.email}</td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-[7px] bg-[#EEF2FF] px-2.5 py-1 text-[11.5px] font-bold text-[#3B4FE0]">{m.roleName}</span>
                            {/* This person has exceptions of their own, so their
                                access is not simply what the matrix above shows. */}
                            {m.customPermissions && (
                              <span
                                title={`Own exceptions: ${Object.entries(m.overrides).map(([mod, lvl]) => `${moduleLabel(mod)} → ${lvl}`).join(', ')}`}
                                className="rounded-[7px] bg-[#FDECD3] px-2 py-1 text-[11px] font-bold text-[#D97706]"
                              >
                                Custom
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">
                          {m.locationName ?? <span className="text-[#94A3B8]">All locations</span>}
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3">
                          <span className="rounded-[7px] px-2.5 py-1 text-[11.5px] font-bold"
                            style={{ background: STATUS_STYLE[m.status].bg, color: STATUS_STYLE[m.status].fg }}>
                            {STATUS_STYLE[m.status].label}
                          </span>
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-3 text-[12.5px] font-medium text-[#334155]">
                          {/* "Never" is a real answer here — an invited account
                              that has never signed in is exactly what a doctor
                              needs to spot. */}
                          {m.lastLoginAt
                            ? IST_DATE.format(new Date(m.lastLoginAt))
                            : <span className="text-[#94A3B8]">Never</span>}
                        </td>
                        <td className="border-b border-[#F1F3F9] pr-[22px]">
                          {busy === m.id ? (
                            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[#64748B]" />
                          ) : (
                            <span className="flex items-center gap-2">
                              {/* Only for someone who has not activated yet.
                                  A member with a password resets it themselves
                                  from the staff sign-in page. */}
                              {m.status === 'invited' && (
                                <button type="button"
                                  onClick={() => void act(m.id, async () => {
                                    const r = await inviteMember(m.id);
                                    setNotice(r.emailed ? `Invite resent to ${m.email}.` : null);
                                    // A fresh link supersedes whatever was shown before.
                                    setResent({ ...r, name: m.name });
                                  })}
                                  className="flex h-8 items-center gap-1.5 rounded-[8px] border border-[#E2E6F0] px-3 text-[12px] font-bold text-[#334155] hover:bg-[#F7F8FC]">
                                  <Mail aria-hidden="true" className="h-[13px] w-[13px]" />
                                  Resend invite
                                </button>
                              )}
                              <button type="button" onClick={() => void act(m.id, () => setMemberActive(m.id, m.status === 'disabled'))}
                                className="h-8 rounded-[8px] border border-[#E2E6F0] px-3 text-[12px] font-bold text-[#334155] hover:bg-[#F7F8FC]">
                                {m.status === 'disabled' ? 'Reactivate' : 'Deactivate'}
                              </button>
                              <button type="button" aria-label={`Remove ${m.name}`}
                                onClick={() => void act(m.id, () => deleteMember(m.id))}
                                className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#FDF0F0] hover:bg-[#FBE0E0]">
                                <Trash2 className="h-[15px] w-[15px] text-[#EF4444]" />
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Rail */}
        <aside className="flex flex-col gap-5">
          <section className={cn(CARD, 'px-[18px] py-5')}>
            <h2 className="font-display text-[15px] font-bold text-[#0F172A]">Team Overview</h2>
            <div className="mt-3.5 flex items-center gap-3 rounded-[12px] bg-[#F0EEFD] px-3.5 py-4">
              <span aria-hidden="true" className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-[#DDD6FE]">
                <Users className="h-[21px] w-[21px] text-[#6D5AE0]" />
              </span>
              <div className="min-w-0">
                <p className="text-[22px] font-extrabold leading-none text-[#0F172A]">{members.length}</p>
                <p className="mt-1 text-[12px] font-medium text-[#64748B]">{activeMembers} active</p>
              </div>
            </div>
            <dl className="mt-4 space-y-3">
              {roles.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <dt className="min-w-0 truncate text-[12.5px] font-medium text-[#475569]">{r.name}</dt>
                  <dd className="ml-auto flex items-center gap-2">
                    <span className="text-[12.5px] font-bold text-[#0F172A]">{r.memberCount}</span>
                    {!r.isSystem && r.memberCount === 0 && (
                      <button type="button" aria-label={`Delete the ${r.name} role`}
                        onClick={() => void act(r.id, () => deleteRole(r.id))}
                        className="grid h-6 w-6 place-items-center rounded-[6px] text-[#94A3B8] hover:bg-[#FDF0F0] hover:text-[#EF4444]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="flex items-start gap-2.5 rounded-[12px] border border-[#C7D7F5] bg-[#EEF3FE] px-4 py-3.5 text-[12px] leading-5 text-[#1E3A8A]">
            <Info aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-[#2563EB]" />
            <span>
              Staff sign in at <strong>/staff/login</strong> with their own email and password — never yours. Deactivating
              someone ends their live sessions immediately.
              {pending > 0 && ` ${pending} invite${pending === 1 ? '' : 's'} not yet accepted.`}
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}
