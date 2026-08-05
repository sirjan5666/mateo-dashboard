/**
 * Team & Roles (Clinic OS spec 04).
 *
 * ⚠ PLACEHOLDER DATA — not wired to the API yet.
 *
 * Two different counts live in this product and they are NOT the same thing:
 *   • `ClinicLocation.teamMembers` (Screen 03) = everyone who works at a clinic,
 *     including nursing and housekeeping who have no login. Sums to 52.
 *   • `TOTAL_ACCOUNTS` below = people who hold a Clinic OS account and therefore
 *     have a role and permissions. 22, and equal to the sum of ROLES[].count.
 * A staff member without an account has no role, so this page can only ever
 * count the 22. The overview card says so explicitly.
 */

export type RoleId = 'super-admin' | 'doctor' | 'receptionist' | 'accountant' | 'pharmacist';
export type ModuleId =
  | 'dashboard'
  | 'appointments'
  | 'consultations'
  | 'patients'
  | 'charts'
  | 'pharmacy'
  | 'invoices'
  | 'revenue'
  | 'staff'
  | 'audit'
  | 'settings';

export type PermissionState = 'full' | 'limited' | 'none';

export interface Role {
  id: RoleId;
  name: string;
  /** Plural label used in the Team Overview breakdown. */
  plural: string;
  description: string;
  chip?: string;
  icon: string;
  tint: string;
  hue: string;
  /** Dot colour in the overview breakdown (differs from the tile hue for Receptionist). */
  dot: string;
  count: number;
  /** Column header in the matrix. */
  columnLabel: string;
}

export const ROLES: Role[] = [
  {
    id: 'super-admin',
    name: 'Super Admin',
    plural: 'Super Admin',
    description: 'Complete access to all modules and settings',
    chip: 'Full Access',
    icon: 'ShieldPlus',
    tint: '#EDE9FE',
    hue: '#6D5AE0',
    dot: '#7C5CFF',
    count: 2,
    columnLabel: 'Super Admin',
  },
  {
    id: 'doctor',
    name: 'Doctor',
    plural: 'Doctors',
    description: 'Access to clinical, patients and charts',
    icon: 'Stethoscope',
    tint: '#E4EBFD',
    hue: '#2563EB',
    dot: '#2563EB',
    count: 5,
    columnLabel: 'Doctor',
  },
  {
    id: 'receptionist',
    name: 'Receptionist',
    plural: 'Receptionists',
    description: 'Manage appointments, patients and bills',
    icon: 'UserRound',
    tint: '#EDE9FE',
    hue: '#7C5CFF',
    dot: '#8B5CF6',
    count: 8,
    columnLabel: 'Receptionist',
  },
  {
    id: 'accountant',
    name: 'Accountant',
    plural: 'Accountants',
    description: 'Access to invoices, payments and reports',
    icon: 'FileSpreadsheet',
    tint: '#E0F5EA',
    hue: '#12A150',
    dot: '#12A150',
    count: 3,
    columnLabel: 'Accountant',
  },
  {
    id: 'pharmacist',
    name: 'Pharmacist',
    plural: 'Pharmacists',
    description: 'Manage pharmacy and inventory',
    icon: 'Pill',
    tint: '#FDE8CF',
    hue: '#F59E0B',
    dot: '#F59E0B',
    count: 4,
    columnLabel: 'Pharmacist',
  },
];

/** 2 + 5 + 8 + 3 + 4 — computed so the card can never drift from the breakdown. */
export const TOTAL_ACCOUNTS = ROLES.reduce((t, r) => t + r.count, 0);

export interface AppModule {
  id: ModuleId;
  label: string;
  icon: string;
  /** Only Pharmacy and Revenue Reports are coloured; the rest are dark navy. */
  iconColor: string;
}

export const MODULES: AppModule[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Monitor', iconColor: '#1E2A5A' },
  { id: 'appointments', label: 'Appointments', icon: 'CalendarDays', iconColor: '#1E2A5A' },
  { id: 'consultations', label: 'Consultations', icon: 'Stethoscope', iconColor: '#1E2A5A' },
  { id: 'patients', label: 'Patients', icon: 'UserRound', iconColor: '#1E2A5A' },
  { id: 'charts', label: 'Charts (Growth/Vacc.)', icon: 'BarChart3', iconColor: '#1E2A5A' },
  { id: 'pharmacy', label: 'Pharmacy', icon: 'BriefcaseMedical', iconColor: '#F97316' },
  { id: 'invoices', label: 'Invoices & Billing', icon: 'FileText', iconColor: '#1E2A5A' },
  { id: 'revenue', label: 'Revenue Reports', icon: 'IndianRupee', iconColor: '#16A34A' },
  { id: 'staff', label: 'Staff & Payroll', icon: 'Users', iconColor: '#1E2A5A' },
  { id: 'audit', label: 'Audit Logs', icon: 'ShieldCheck', iconColor: '#1E2A5A' },
  { id: 'settings', label: 'Settings', icon: 'Settings', iconColor: '#1E2A5A' },
];

/**
 * 11 modules × 5 roles = 55 cells. Super Admin is full on every row by
 * definition — the role exists to be unrestricted.
 */
export const PERMISSIONS: Record<ModuleId, Record<RoleId, PermissionState>> = {
  dashboard: { 'super-admin': 'full', doctor: 'full', receptionist: 'full', accountant: 'full', pharmacist: 'full' },
  appointments: { 'super-admin': 'full', doctor: 'full', receptionist: 'full', accountant: 'none', pharmacist: 'none' },
  consultations: { 'super-admin': 'full', doctor: 'full', receptionist: 'none', accountant: 'none', pharmacist: 'none' },
  patients: { 'super-admin': 'full', doctor: 'full', receptionist: 'full', accountant: 'limited', pharmacist: 'limited' },
  charts: { 'super-admin': 'full', doctor: 'full', receptionist: 'limited', accountant: 'none', pharmacist: 'none' },
  pharmacy: { 'super-admin': 'full', doctor: 'none', receptionist: 'none', accountant: 'none', pharmacist: 'full' },
  invoices: { 'super-admin': 'full', doctor: 'full', receptionist: 'full', accountant: 'full', pharmacist: 'none' },
  revenue: { 'super-admin': 'full', doctor: 'full', receptionist: 'limited', accountant: 'full', pharmacist: 'none' },
  staff: { 'super-admin': 'full', doctor: 'none', receptionist: 'none', accountant: 'full', pharmacist: 'none' },
  audit: { 'super-admin': 'full', doctor: 'limited', receptionist: 'limited', accountant: 'limited', pharmacist: 'none' },
  settings: { 'super-admin': 'full', doctor: 'limited', receptionist: 'limited', accountant: 'full', pharmacist: 'none' },
};

export const PERMISSION_LABEL: Record<PermissionState, string> = {
  full: 'Full access',
  limited: 'Limited access',
  none: 'No access',
};

/**
 * The Create Sub-User summary (spec 05) previews a 9-module subset — Charts and
 * Audit Logs are deliberately absent there.
 */
export const SUBUSER_MODULE_IDS: ModuleId[] = [
  'dashboard',
  'appointments',
  'consultations',
  'patients',
  'invoices',
  'pharmacy',
  'revenue',
  'staff',
  'settings',
];

/**
 * The description column is state-dependent: the reference shows capability text
 * for granted rows ("Schedule and manage appointments") and absence text for
 * denied ones ("No access to pharmacy module"). Keying it by state keeps the
 * sentence true when a radio or role changes.
 */
export const MODULE_DESCRIPTIONS: Record<ModuleId, Record<PermissionState, string>> = {
  dashboard: {
    full: 'View dashboard and overview',
    limited: 'View limited dashboard widgets',
    none: 'No access to dashboard',
  },
  appointments: {
    full: 'Schedule and manage appointments',
    limited: 'View appointments only',
    none: 'No access to appointments',
  },
  consultations: {
    full: 'Full access to consultation records',
    limited: 'Access basic consultation info',
    none: 'No access to consultations',
  },
  patients: {
    full: 'Full access to patient records',
    limited: 'View patient basic details',
    none: 'No access to patients',
  },
  charts: {
    full: 'View and record growth and vaccination',
    limited: 'View charts only',
    none: 'No access to charts',
  },
  invoices: {
    full: 'Create, edit and void invoices',
    limited: 'Create invoices and collect payments',
    none: 'No access to invoices',
  },
  pharmacy: {
    full: 'Manage stock, sales and purchases',
    limited: 'View stock levels only',
    none: 'No access to pharmacy module',
  },
  revenue: {
    full: 'View all revenue reports',
    limited: 'View own collections only',
    none: 'No access to revenue reports',
  },
  staff: {
    full: 'Manage staff records and payroll',
    limited: 'View staff directory only',
    none: 'No access to staff or payroll',
  },
  audit: {
    full: 'View and export all activity',
    limited: 'View own activity only',
    none: 'No access to audit logs',
  },
  settings: {
    full: 'Manage all clinic settings',
    limited: 'View settings only',
    none: 'No access to settings',
  },
};

/**
 * A role's defaults for the sub-user form, read from the SAME `PERMISSIONS`
 * matrix that spec 04 renders. Permissions are an access-control boundary, so
 * there is exactly one source of truth: a role cannot mean one thing on the
 * matrix screen and another on the create-user screen.
 */
export function roleProfile(roleId: RoleId): Record<ModuleId, PermissionState> {
  return Object.fromEntries(MODULES.map((m) => [m.id, PERMISSIONS[m.id][roleId]])) as Record<ModuleId, PermissionState>;
}

export interface TeamMember {
  name: string;
  role: string;
  tint: string;
  fg: string;
}

/** The five shown in the "Active Today" stack; the rest roll into the +N pill. */
export const ACTIVE_TODAY_SHOWN: TeamMember[] = [
  { name: 'Priya Nair', role: 'Receptionist', tint: '#EDE9FE', fg: '#6D5AE0' },
  { name: 'Vikram Yadav', role: 'Pharmacist', tint: '#FDE8CF', fg: '#B45309' },
  { name: 'Meera Joshi', role: 'Accountant', tint: '#E0F5EA', fg: '#12A150' },
  { name: 'Arjun Iyer', role: 'Doctor', tint: '#E4EBFD', fg: '#2563EB' },
  { name: 'Farah Khan', role: 'Receptionist', tint: '#FCDCE4', fg: '#BE123C' },
];

export const ACTIVE_TODAY_TOTAL = 18;

export interface Invitation {
  name: string;
  role: string;
  elapsed: string;
}

export const PENDING_INVITATIONS: Invitation[] = [
  { name: 'Rohit Verma', role: 'Receptionist', elapsed: 'Invited 2 days ago' },
  { name: 'Neha Gupta', role: 'Pharmacist', elapsed: 'Invited 5 days ago' },
];
