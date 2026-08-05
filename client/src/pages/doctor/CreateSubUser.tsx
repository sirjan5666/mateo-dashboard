import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronDown, ChevronRight, Info, ShieldCheck, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FileSpreadsheet, Pill, ShieldPlus, Stethoscope } from 'lucide-react';
import { MODULES, PERMISSION_LABEL, ROLES, roleProfile } from '../../data/team';
import type { ModuleId, PermissionState, RoleId } from '../../data/team';
import { useActiveLocation } from '../../lib/doctorLocation';
import { createMember, listRoles } from '../../api/doctorTeam';
import { ApiError } from '../../api/client';
import type { ClinicLocation } from '../../lib/doctorLocation';
import { PermissionSummaryTable } from '../../components/doctor/v2/subuser/PermissionSummaryTable';
import {
  DateInput,
  FieldError,
  INPUT,
  INPUT_ERR,
  Label,
  PasswordInput,
  PhoneNumberInput,
  PrimaryLocationSelect,
  StatusSelect,
} from '../../components/doctor/v2/subuser/fields';
import { cn } from '../../lib/cn';

const CARD =
  'rounded-[14px] border border-[#ECEEF4] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.10)]';

const ROLE_ICONS: Record<string, LucideIcon> = { ShieldPlus, Stethoscope, UserRound, FileSpreadsheet, Pill };

const LEGEND = [
  { color: '#16A34A', label: 'Full Access' },
  { color: '#1D6FF2', label: 'Limited Access' },
  { color: '#CBD5E1', label: 'No Access' },
];

interface Errors {
  fullName?: string;
  email?: string;
  phone?: string;
  username?: string;
  password?: string;
}

export default function CreateSubUser() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const [fullName, setFullName] = useState('Rohit Verma');
  const [email, setEmail] = useState('rohit.verma@greenviewclinic.com');
  const [phone, setPhone] = useState('98765 43210');
  const [employeeId, setEmployeeId] = useState('GV-EMP-024');
  const { clinics } = useActiveLocation();
  const [pickedLocation, setLocation] = useState<ClinicLocation | null>(null);
  // Falls back to the first clinic until the doctor picks one explicitly.
  const location = pickedLocation ?? clinics[0] ?? null;
  const [joining, setJoining] = useState('2025-05-08');
  const [status, setStatus] = useState('active');
  const [username, setUsername] = useState('rohit.verma');
  const [password, setPassword] = useState('Clinic@2025');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [roleId, setRoleId] = useState<RoleId>('receptionist');
  const [roleOpen, setRoleOpen] = useState(false);
  const [perms, setPerms] = useState<Record<ModuleId, PermissionState>>(() => roleProfile('receptionist'));

  const role = ROLES.find((r) => r.id === roleId)!;
  const RoleIcon = ROLE_ICONS[role.icon] ?? UserRound;

  const defaults = useMemo(() => roleProfile(roleId), [roleId]);
  const customised = useMemo(
    () => MODULES.some((m) => perms[m.id] !== defaults[m.id]),
    [perms, defaults],
  );

  function selectRole(id: RoleId) {
    setRoleId(id);
    setPerms(roleProfile(id));
    setRoleOpen(false);
  }

  function validate(): Errors {
    const e: Errors = {};
    if (fullName.trim().length < 2) e.fullName = 'Enter the full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address.';
    if (phone.replace(/\D/g, '').length !== 10) e.phone = 'Enter a 10-digit mobile number.';
    if (!/^[a-z0-9._]{3,}$/.test(username)) e.username = 'Lowercase letters, digits, dot and underscore only (min 3).';
    if (!(password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password) && /[^a-zA-Z0-9]/.test(password)))
      e.password = 'Minimum 8 characters with letters, numbers and a symbol.';
    return e;
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(`#${first === 'phone' ? 'phone' : first}`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    void (async () => {
      setSaving(true);
      setSubmitError(null);
      try {
        // The mock role list and the seeded server roles share their names, so
        // the picker maps onto a real StaffRole without a second selector.
        const { roles } = await listRoles();
        const match = roles.find((r) => r.name.toLowerCase() === role.name.toLowerCase()) ?? roles[0];
        if (!match) {
          setSubmitError('No roles exist yet — open Team & Roles once to create them.');
          setSaving(false);
          return;
        }
        await createMember({
          name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          roleId: match.id,
          locationId: location?.id,
          employeeCode: employeeId.trim() || undefined,
          password,
        });
        navigate('/doctor/team');
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
            disabled={saving}
            className="h-12 flex-1 rounded-[11px] px-7 text-[14.5px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(59,79,224,.65)] transition-[filter] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F63F5] focus-visible:ring-offset-2 disabled:opacity-60 sm:flex-none"
            style={{ background: 'linear-gradient(135deg, #5B5BF0 0%, #3B3FD8 100%)' }}
          >
            {saving ? 'Creating…' : 'Create Sub-User'}
          </button>
        </div>
      </div>

      {submitError && (
        <p role="alert" className="mb-4 rounded-[10px] border border-[#F8D4D4] bg-[#FDF0F0] px-4 py-3 text-[13px] font-medium text-[#B42318]">
          {submitError}
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
                aria-required="true"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={cn(INPUT, errors.email && INPUT_ERR)}
              />
              <FieldError id="email-error" message={errors.email} />
            </div>

            <div>
              <Label htmlFor="phone" required>Phone Number</Label>
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
              <input id="employeeId" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={INPUT} />
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
              <Label htmlFor="status">Status</Label>
              <StatusSelect value={status} onChange={setStatus} />
            </div>
          </div>

          {/* Login credentials */}
          <div className="mt-[26px] border-t border-[#F1F3F9] pt-[26px]">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-[#0F172A]">Login Credentials</h2>
              <span
                title="Credentials are emailed to the user; they must reset the password on first sign-in."
                className="grid h-[15px] w-[15px] place-items-center"
              >
                <Info className="h-[15px] w-[15px] text-[#94A3B8]" />
                <span className="sr-only">Credentials are emailed to the user; they must reset the password on first sign-in.</span>
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="username" required>Username</Label>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-required="true"
                  aria-invalid={errors.username ? true : undefined}
                  aria-describedby={errors.username ? 'username-error' : undefined}
                  className={cn(INPUT, errors.username && INPUT_ERR)}
                />
                <FieldError id="username-error" message={errors.username} />
              </div>

              <div>
                <Label htmlFor="password" required>Password</Label>
                <PasswordInput value={password} onChange={setPassword} error={errors.password} />
                {errors.password ? (
                  <FieldError id="password-error" message={errors.password} />
                ) : (
                  <p id="password-help" className="mt-2 text-[11.5px] text-[#94A3B8]">
                    Minimum 8 characters with letters, numbers &amp; symbol.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Purple callout */}
          <div className="mt-[26px] flex items-center gap-3.5 rounded-[11px] bg-[#F3F0FE] px-[17px] py-[15px]">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] bg-[#7C5CFF]">
              <ShieldCheck className="h-[15px] w-[15px] text-white" />
            </span>
            <p className="text-[13.5px] font-medium text-[#1E2A5A]">
              The user will receive an email invitation with login credentials and setup instructions.
            </p>
          </div>
        </section>

        {/* ── Role & Permissions ───────────────────────────────────────── */}
        <section className={`${CARD} min-w-0 px-[26px] py-6`}>
          <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-[#0F172A]">Role &amp; Permissions</h2>

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
                <RoleIcon className="h-6 w-6" style={{ color: role.hue }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-bold text-[#0F172A]">{role.name}</span>
                <span className="mt-1 block truncate text-[13px] text-[#64748B]">{role.description}</span>
              </span>
              <ChevronDown className={cn('h-[21px] w-[21px] shrink-0 text-[#64748B] transition-transform', roleOpen && 'rotate-180')} />
            </button>

            {roleOpen && (
              <ul role="listbox" aria-label="Select role" className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-[12px] border border-[#ECEEF4] bg-white p-1.5 shadow-[0_20px_48px_-16px_rgba(15,23,42,.3)]">
                {ROLES.map((r) => {
                  const Icon = ROLE_ICONS[r.icon] ?? UserRound;
                  return (
                    <li key={r.id} role="option" aria-selected={r.id === roleId}>
                      <button
                        type="button"
                        onClick={() => selectRole(r.id)}
                        className={cn('flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2.5 text-left', r.id === roleId ? 'bg-[#F5F5FF]' : 'hover:bg-[#F6F7FB]')}
                      >
                        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: r.tint }}>
                          <Icon className="h-[18px] w-[18px]" style={{ color: r.hue }} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-bold text-[#0F172A]">{r.name}</span>
                          <span className="block truncate text-[12px] text-[#64748B]">{r.description}</span>
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
                  onClick={() => setPerms(roleProfile(roleId))}
                  className="text-[12.5px] font-bold text-[#3B4FE0] hover:underline"
                >
                  Reset to role defaults
                </button>
              </>
            )}
            <div aria-hidden="true" className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1.5">
              {LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-2">
                  <span className="h-[9px] w-[9px] rounded-full" style={{ background: l.color }} />
                  <span className="text-[12.5px] font-medium text-[#475569]">{l.label}</span>
                </span>
              ))}
            </div>
          </div>

          <PermissionSummaryTable
            permissions={perms}
            onChange={(m, s) => setPerms((p) => ({ ...p, [m]: s }))}
          />

          {/* Blue callout */}
          <div className="mt-5 flex items-center gap-3.5 rounded-[11px] bg-[#EEF3FE] px-[18px] py-[15px]">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#2563EB]">
              <Info className="h-3.5 w-3.5 text-white" />
            </span>
            <p className="text-[13.5px] font-medium text-[#1E3A8A]">
              Permissions are based on the selected role. You can customize after creating the user.
            </p>
          </div>

          <p className="sr-only" aria-live="polite">
            {Object.keys(errors).length ? `${Object.keys(errors).length} fields need attention.` : ''}
          </p>
          <p className="sr-only">
            Current role {role.name}. {PERMISSION_LABEL[perms.dashboard]} to Dashboard.
          </p>
        </section>
      </div>
    </form>
  );
}
