import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ChevronDown, ChevronRight, FileSpreadsheet, Info, Loader2, Mail, Pill, ShieldCheck, ShieldPlus,
  Stethoscope, UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createMember, listRoles, teamCatalogue } from '../../api/doctorTeam';
import type { CatalogueResponse, PermissionLevel, StaffRoleDto } from '../../api/doctorTeam';
import { ApiError } from '../../api/client';
import { useActiveLocation } from '../../lib/doctorLocation';
import type { ClinicLocation } from '../../lib/doctorLocation';
import { PermissionSummaryTable } from '../../components/doctor/v2/subuser/PermissionSummaryTable';
import { LEVEL_LABEL } from '../../lib/permissions';
import {
  DateInput, FieldError, INPUT, INPUT_ERR, Label, PhoneNumberInput, PrimaryLocationSelect,
} from '../../components/doctor/v2/subuser/fields';
import { cn } from '../../lib/cn';

const CARD =
  'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';

/** Icons by role name, with a neutral fallback for roles the doctor invents. */
const ROLE_ICONS: Record<string, LucideIcon> = {
  'super admin': ShieldPlus,
  'clinic admin': ShieldPlus,
  doctor: Stethoscope,
  receptionist: UserRound,
  nurse: Stethoscope,
  pharmacist: Pill,
  'lab technician': FileSpreadsheet,
  accountant: FileSpreadsheet,
};

const LEGEND: { level: PermissionLevel; color: string }[] = [
  { level: 'full', color: '#16A34A' },
  { level: 'edit', color: '#2B6FF0' },
  { level: 'view', color: '#6366F1' },
  { level: 'none', color: '#CBD5E1' },
];

interface Errors {
  fullName?: string;
  email?: string;
  phone?: string;
}

export default function CreateSubUser() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const { clinics } = useActiveLocation();
  const [pickedLocation, setLocation] = useState<ClinicLocation | null>(null);
  // Falls back to the first clinic until the doctor picks one explicitly.
  const location = pickedLocation ?? clinics[0] ?? null;
  const [joining, setJoining] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Roles and modules both come from the server, so the matrix shown here is
  // the one the API actually enforces.
  const [roles, setRoles] = useState<StaffRoleDto[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [roleId, setRoleId] = useState<string>('');
  const [roleOpen, setRoleOpen] = useState(false);
  const [perms, setPerms] = useState<Record<string, PermissionLevel>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listRoles(), teamCatalogue()])
      .then(([r, c]) => {
        if (cancelled) return;
        setRoles(r.roles);
        setCatalogue(c);
        const first = r.roles[0];
        if (first) {
          setRoleId(first.id);
          setPerms({ ...first.permissions });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load your roles');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const role = roles.find((r) => r.id === roleId) ?? null;
  const RoleIcon = ROLE_ICONS[(role?.name ?? '').toLowerCase()] ?? UserRound;
  // Memoised so it is not a fresh array every render, which would defeat the
  // `customised` memo below.
  const modules = useMemo(() => catalogue?.modules ?? [], [catalogue]);

  const customised = useMemo(
    () => (role ? modules.some((m) => (perms[m.id] ?? 'none') !== (role.permissions[m.id] ?? 'none')) : false),
    [perms, role, modules],
  );

  function selectRole(r: StaffRoleDto) {
    setRoleId(r.id);
    setPerms({ ...r.permissions });
    setRoleOpen(false);
  }

  function validate(): Errors {
    const e: Errors = {};
    if (fullName.trim().length < 2) e.fullName = 'Enter the full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address.';
    // Optional, but a number that IS given has to be usable.
    if (phone.trim() && phone.replace(/\D/g, '').length !== 10) e.phone = 'Enter a 10-digit mobile number.';
    return e;
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!role) {
      setSubmitError('Pick a role first.');
      return;
    }
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(`#${first}`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    void (async () => {
      setSaving(true);
      setSubmitError(null);
      try {
        const { emailed, link } = await createMember({
          name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          roleId: role.id,
          locationId: location?.id,
          employeeCode: employeeId.trim() || undefined,
          joinedOn: joining || undefined,
          // Sent in full; the server keeps only what differs from the role.
          permissions: perms,
        });
        // Router state, not a query string: the activation link carries a
        // one-time token and must not land in the URL bar or browser history.
        navigate('/doctor/team', { state: { invite: { name: fullName.trim(), emailed, link } } });
      } catch (err) {
        setSubmitError(
          err instanceof ApiError && err.status === 409
            ? 'Someone with this email is already on your team.'
            : err instanceof Error ? err.message : 'Could not create this account',
        );
        setSaving(false);
      }
    })();
  }

  return (
    <form id="create-sub-user" ref={formRef} onSubmit={onSubmit} noValidate>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-2.5">
        <ol className="flex items-center gap-2.5">
          <li>
            <Link to="/doctor/team" className="text-[13.5px] font-semibold text-[#3B4FE0] hover:underline">
              Team &amp; Roles
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-[15px] w-[15px] text-[#94A3B8]" />
          </li>
          <li aria-current="page" className="text-[13.5px] font-semibold text-[#334155]">
            Create Sub-User
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">Create Sub-User</h1>
          <p className="mt-1.5 text-sm text-[#64748B]">Add a new team member and assign role with permissions.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <button
            type="button"
            onClick={() => navigate('/doctor/team')}
            className="h-12 flex-1 rounded-[11px] border border-[#E2E6F0] bg-white px-[30px] text-[14.5px] font-bold text-[#1E2A5A] transition-colors hover:bg-[#F7F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2 sm:flex-none"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading || !role}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[11px] px-7 text-[14.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] transition-[filter] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2 disabled:opacity-60 sm:flex-none"
            style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}
          >
            {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {saving ? 'Sending invite…' : 'Create Sub-User'}
          </button>
        </div>
      </div>

      {(submitError ?? loadError) && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
          {submitError ?? loadError}
        </p>
      )}

      {/* Body */}
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
        {/* ── User Information ─────────────────────────────────────────── */}
        <section className={`${CARD} min-w-0 px-[26px] py-6`}>
          <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-[#0F172A]">User Information</h2>

          <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-[18px] sm:grid-cols-2">
            <div>
              <Label htmlFor="fullName" required>Full Name</Label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rohit Verma"
                aria-required="true"
                aria-invalid={errors.fullName ? true : undefined}
                aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                className={cn(INPUT, errors.fullName && INPUT_ERR)}
              />
              <FieldError id="fullName-error" message={errors.fullName} />
            </div>

            <div>
              <Label htmlFor="email" required>Email Address</Label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rohit@yourclinic.com"
                aria-required="true"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'email-error' : 'email-help'}
                className={cn(INPUT, errors.email && INPUT_ERR)}
              />
              {errors.email ? (
                <FieldError id="email-error" message={errors.email} />
              ) : (
                <p id="email-help" className="mt-1.5 text-[11.5px] text-[#94A3B8]">They sign in with this address.</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <PhoneNumberInput
                value={phone}
                onChange={setPhone}
                error={!!errors.phone}
                describedBy={errors.phone ? 'phone-error' : undefined}
              />
              <FieldError id="phone-error" message={errors.phone} />
            </div>

            <div>
              <Label htmlFor="employeeId">Employee ID (Optional)</Label>
              <input id="employeeId" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="GV-EMP-024" className={INPUT} />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="primary-location" required>Primary Location</Label>
              <PrimaryLocationSelect value={location} onChange={setLocation} />
            </div>

            <div>
              <Label htmlFor="joining">Date of Joining</Label>
              <DateInput id="joining" value={joining} onChange={setJoining} />
            </div>

            <div>
              <span className="mb-2 block text-[13px] font-bold text-[#334155]">Status</span>
              {/* Not a choice: a new account is Invited until the person sets
                  their own password, so offering "Active" here would be a lie. */}
              <p className="flex h-12 items-center gap-2.5 rounded-[10px] border border-[#E4E8F1] bg-[#F9FAFD] px-[15px]">
                <span className="rounded-[7px] bg-[#FEF3C7] px-2.5 py-1 text-[11.5px] font-bold text-[#B45309]">Invited</span>
                <span className="text-[12.5px] text-[#64748B]">until they activate</span>
              </p>
            </div>
          </div>

          {/* Sign-in */}
          <div className="mt-[26px] border-t border-[#F1F3F9] pt-[26px]">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-[#0F172A]">Sign-in</h2>
              <span
                title="You never see or set their password. The invite link lets them choose one."
                className="grid h-[15px] w-[15px] place-items-center"
              >
                <Info className="h-[15px] w-[15px] text-[#94A3B8]" />
                <span className="sr-only">You never see or set their password. The invite link lets them choose one.</span>
              </span>
            </div>

            <ul className="mt-4 space-y-2.5 text-[13.5px] text-[#334155]">
              <li className="flex items-start gap-2.5">
                <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#3B4FE0]" />
                <span>An activation link is emailed to them and is valid for 3 days.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#3B4FE0]" />
                <span>They choose their own password — it is never set, seen or stored here in plain text.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <UserRound aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#3B4FE0]" />
                <span>
                  Staff sign in at <code className="rounded bg-[#F1F3F9] px-1.5 py-0.5 text-[12.5px] font-semibold text-[#334155]">/staff/login</code>,
                  not the doctor login.
                </span>
              </li>
            </ul>
          </div>

          {/* Purple callout */}
          <div className="mt-[26px] flex items-center gap-3.5 rounded-[11px] bg-[#F3F0FE] px-[17px] py-[15px]">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] bg-[#7C5CFF]">
              <ShieldCheck className="h-[15px] w-[15px] text-white" />
            </span>
            <p className="text-[13.5px] font-medium text-[#1E2A5A]">
              If email is not configured on this server, you can resend the invite from Team &amp; Roles.
            </p>
          </div>
        </section>

        {/* ── Role & Permissions ───────────────────────────────────────── */}
        <section className={`${CARD} min-w-0 px-[26px] py-6`}>
          <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-[#0F172A]">Role &amp; Permissions</h2>

          {loading ? (
            <p className="flex items-center gap-2 py-16 text-sm text-[#64748B]">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Loading roles…
            </p>
          ) : !role ? (
            <p className="py-16 text-center text-sm text-[#64748B]">
              No roles yet — <Link to="/doctor/team" className="font-semibold text-[#3B4FE0] hover:underline">open Team &amp; Roles</Link> to create them.
            </p>
          ) : (
            <>
              <div className="relative mt-4">
                <Label htmlFor="role-select" required>Select Role</Label>
                <button
                  type="button"
                  id="role-select"
                  onClick={() => setRoleOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={roleOpen}
                  className="flex h-[78px] w-full items-center gap-4 rounded-[11px] border border-[#E4E8F1] bg-white px-[18px] text-left transition-colors hover:bg-[#FAFBFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2"
                >
                  <span aria-hidden="true" className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full" style={{ background: role.tint }}>
                    <RoleIcon className="h-6 w-6" style={{ color: role.fg }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-bold text-[#0F172A]">{role.name}</span>
                    <span className="mt-1 block truncate text-[13px] text-[#64748B]">{role.description ?? 'No description'}</span>
                  </span>
                  <ChevronDown className={cn('h-[21px] w-[21px] shrink-0 text-[#64748B] transition-transform', roleOpen && 'rotate-180')} />
                </button>

                {roleOpen && (
                  <ul role="listbox" aria-label="Select role" className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[320px] overflow-y-auto rounded-[12px] border border-[#ECEEF4] bg-white p-1.5 shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]">
                    {roles.map((r) => {
                      const Icon = ROLE_ICONS[r.name.toLowerCase()] ?? UserRound;
                      return (
                        <li key={r.id} role="option" aria-selected={r.id === roleId}>
                          <button
                            type="button"
                            onClick={() => selectRole(r)}
                            className={cn('flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2.5 text-left', r.id === roleId ? 'bg-[#F5F5FF]' : 'hover:bg-[#F6F7FB]')}
                          >
                            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: r.tint }}>
                              <Icon className="h-[18px] w-[18px]" style={{ color: r.fg }} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13.5px] font-bold text-[#0F172A]">{r.name}</span>
                              <span className="block truncate text-[12px] text-[#64748B]">{r.description ?? 'No description'}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Permission summary */}
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                <h3 className="font-display text-base font-bold tracking-[-0.01em] text-[#0F172A]">Permission Summary</h3>
                {customised && (
                  <>
                    <span className="rounded-[7px] bg-[#FDECD3] px-2.5 py-1 text-[11px] font-bold text-[#D97706]">Customised</span>
                    <button
                      type="button"
                      onClick={() => setPerms({ ...role.permissions })}
                      className="text-[12.5px] font-bold text-[#3B4FE0] hover:underline"
                    >
                      Reset to role defaults
                    </button>
                  </>
                )}
                <div aria-hidden="true" className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {LEGEND.map((l) => (
                    <span key={l.level} className="flex items-center gap-2">
                      <span className="h-[9px] w-[9px] rounded-full" style={{ background: l.color }} />
                      <span className="text-[12.5px] font-medium text-[#475569]">{LEVEL_LABEL[l.level]}</span>
                    </span>
                  ))}
                </div>
              </div>

              <PermissionSummaryTable
                modules={modules}
                permissions={perms}
                onChange={(m, level) => setPerms((p) => ({ ...p, [m]: level }))}
              />

              {/* Blue callout */}
              <div className="mt-5 flex items-center gap-3.5 rounded-[11px] bg-[#EEF3FE] px-[18px] py-[15px]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#2563EB]">
                  <Info className="h-3.5 w-3.5 text-white" />
                </span>
                <p className="text-[13.5px] font-medium text-[#1E3A8A]">
                  Anything you change here is saved as an exception for this person only. Modules you leave alone keep
                  following the role, so editing the role later still reaches them.
                </p>
              </div>

              <p className="sr-only" aria-live="polite">
                {Object.keys(errors).length ? `${Object.keys(errors).length} fields need attention.` : ''}
              </p>
            </>
          )}
        </section>
      </div>
    </form>
  );
}
