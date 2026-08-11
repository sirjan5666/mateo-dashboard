/**
 * The permission catalogue: what a practice can be given access to, and which
 * access LEVEL grants which ACTION.
 *
 * The Team & Roles UI edits one level per module (none / view / edit / full) —
 * that is the matrix the doctor already sees, and it is not being redesigned.
 * The API, however, checks ACTIONS (`requirePermission('patient', 'delete')`),
 * because "can edit patients" and "can delete patients" are not the same
 * question. This file is the single mapping between the two, so a role's level
 * and an endpoint's action can never drift apart in two places.
 *
 * A module absent from a role's permissions reads as `none` — new modules are
 * therefore denied by default rather than silently granted.
 */

export const PERMISSION_LEVELS = ['none', 'view', 'edit', 'full'] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

/** Ordered, so a check is "is the granted level at least the required level". */
const LEVEL_RANK: Record<PermissionLevel, number> = { none: 0, view: 1, edit: 2, full: 3 };

export const MODULES = [
  'dashboard',
  'patients',
  'appointments',
  'consultations',
  'prescriptions',
  'growth',
  'vaccinations',
  'billing',
  'pharmacy',
  'reports',
  'locations',
  'team',
  'settings',
  'audit',
] as const;
export type ModuleId = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleId, string> = {
  dashboard: 'Dashboard',
  patients: 'Patients',
  appointments: 'Appointments',
  consultations: 'Consultations',
  prescriptions: 'Prescriptions',
  growth: 'Growth & Development',
  vaccinations: 'Vaccinations',
  billing: 'Billing & Invoices',
  pharmacy: 'Pharmacy',
  reports: 'Reports & Analytics',
  locations: 'Locations',
  team: 'Team & Roles',
  settings: 'Settings',
  audit: 'Audit & Email Logs',
};

/**
 * Every action the API can demand, and the minimum level that grants it.
 *
 * The rule of thumb, applied consistently:
 *   view  — read anything in the module
 *   edit  — create and change
 *   full  — destroy, refund, or otherwise take an irreversible/financial action
 *
 * Deletions and refunds sit at `full` deliberately: a receptionist who can book
 * an appointment should not be able to erase a clinical record.
 */
export const MODULE_ACTIONS: Record<ModuleId, Record<string, PermissionLevel>> = {
  dashboard: { view: 'view' },
  patients: {
    view: 'view', create: 'edit', edit: 'edit', invite: 'edit', archive: 'full', delete: 'full',
  },
  appointments: {
    view: 'view', create: 'edit', edit: 'edit', reschedule: 'edit', cancel: 'edit', delete: 'full',
  },
  consultations: { view: 'view', create: 'edit', edit: 'edit', delete: 'full' },
  prescriptions: { view: 'view', create: 'edit', edit: 'edit', print: 'view', delete: 'full' },
  growth: { view: 'view', create: 'edit', edit: 'edit', delete: 'full' },
  vaccinations: { view: 'view', create: 'edit', edit: 'edit', delete: 'full' },
  billing: {
    view: 'view', create: 'edit', edit: 'edit', print: 'view', refund: 'full', cancel: 'full', delete: 'full',
  },
  pharmacy: {
    view: 'view', sale: 'edit', purchase: 'edit', adjust: 'edit', transfer: 'edit',
    import: 'full', delete: 'full',
  },
  reports: { view: 'view', export: 'view' },
  locations: { view: 'view', create: 'edit', edit: 'edit', deactivate: 'full' },
  team: { view: 'view', invite: 'edit', edit: 'edit', deactivate: 'full', delete: 'full' },
  settings: { view: 'view', edit: 'edit' },
  audit: { view: 'view', export: 'view' },
};

export type PermissionMap = Partial<Record<ModuleId, PermissionLevel>>;

/** Fills in every module, so an unknown or missing key reads as `none`. */
export function normalisePermissions(input: unknown): Record<ModuleId, PermissionLevel> {
  const raw = (input ?? {}) as Record<string, unknown>;
  const out = {} as Record<ModuleId, PermissionLevel>;
  for (const m of MODULES) {
    const v = raw[m];
    out[m] = typeof v === 'string' && (PERMISSION_LEVELS as readonly string[]).includes(v)
      ? (v as PermissionLevel)
      : 'none';
  }
  return out;
}

/** Every module at the same level — used to build the default roles below. */
function all(level: PermissionLevel): Record<ModuleId, PermissionLevel> {
  return Object.fromEntries(MODULES.map((m) => [m, level])) as Record<ModuleId, PermissionLevel>;
}

/** `all(base)` with named overrides — keeps the role table readable. */
function withOverrides(base: PermissionLevel, overrides: PermissionMap): Record<ModuleId, PermissionLevel> {
  return { ...all(base), ...normaliseOverrides(overrides) };
}
function normaliseOverrides(o: PermissionMap): PermissionMap {
  return o;
}

/**
 * Does `permissions` allow `action` on `module`?
 *
 * Unknown module or unknown action returns FALSE. A typo in a route's
 * requirePermission call therefore locks the endpoint down rather than opening
 * it up — the safe direction to fail.
 */
export function can(permissions: unknown, module: string, action: string): boolean {
  if (!(MODULES as readonly string[]).includes(module)) return false;
  const required = MODULE_ACTIONS[module as ModuleId]?.[action];
  if (!required) return false;
  const granted = normalisePermissions(permissions)[module as ModuleId];
  return LEVEL_RANK[granted] >= LEVEL_RANK[required];
}

/** Flat list of `module:action` strings a permission map grants. For the UI. */
export function grantedActions(permissions: unknown): string[] {
  const map = normalisePermissions(permissions);
  const out: string[] = [];
  for (const m of MODULES) {
    for (const [action, required] of Object.entries(MODULE_ACTIONS[m])) {
      if (LEVEL_RANK[map[m]] >= LEVEL_RANK[required]) out.push(`${m}:${action}`);
    }
  }
  return out;
}

export interface DefaultRole {
  name: string;
  description: string;
  permissions: Record<ModuleId, PermissionLevel>;
}

/**
 * The roles every practice starts with. They are seeded per doctor and marked
 * `isSystem`, so they cannot be deleted out from under staff who hold them —
 * but their permissions REMAIN EDITABLE, because no two clinics divide work the
 * same way.
 *
 * NOTE ON "Super Admin": this product's tenancy is one practice per doctor.
 * Super Admin therefore means full control WITHIN that practice — never across
 * practices. Nothing in this file can widen the tenant boundary; that is
 * enforced separately in scopeToDoctor.
 */
export const DEFAULT_ROLES: DefaultRole[] = [
  {
    name: 'Super Admin',
    description: 'Full control of this practice, including team and settings.',
    permissions: all('full'),
  },
  {
    name: 'Clinic Admin',
    description: 'Runs the practice day to day. No access to the audit trail.',
    permissions: withOverrides('full', { audit: 'view' }),
  },
  {
    name: 'Doctor',
    description: 'Full clinical access; can see money but not change the practice setup.',
    permissions: withOverrides('full', {
      team: 'none', settings: 'view', locations: 'view', audit: 'none',
    }),
  },
  {
    name: 'Receptionist',
    description: 'Books appointments, registers patients and raises invoices.',
    permissions: withOverrides('none', {
      dashboard: 'view', patients: 'edit', appointments: 'edit', billing: 'edit',
      consultations: 'view', prescriptions: 'view', locations: 'view',
    }),
  },
  {
    name: 'Nurse',
    description: 'Records vitals, growth and vaccinations alongside the doctor.',
    permissions: withOverrides('none', {
      dashboard: 'view', patients: 'view', appointments: 'view', consultations: 'view',
      prescriptions: 'view', growth: 'edit', vaccinations: 'edit',
    }),
  },
  {
    name: 'Pharmacist',
    description: 'Runs the pharmacy: stock, purchases and counter sales.',
    permissions: withOverrides('none', {
      dashboard: 'view', pharmacy: 'full', prescriptions: 'view', patients: 'view', billing: 'view',
    }),
  },
  {
    name: 'Lab Technician',
    description: 'Reads investigation requests and files results against a patient.',
    permissions: withOverrides('none', {
      dashboard: 'view', patients: 'view', consultations: 'view', prescriptions: 'view',
    }),
  },
  {
    name: 'Accountant',
    description: 'Billing, refunds and financial reporting. No clinical records.',
    permissions: withOverrides('none', {
      dashboard: 'view', billing: 'full', reports: 'view', pharmacy: 'view', patients: 'view',
    }),
  },
];
