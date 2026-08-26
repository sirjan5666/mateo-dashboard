/**
 * Specialty-based dashboard configuration.
 *
 * The doctor picks their specialty during profile setup (see DoctorProfileForm);
 * it is stored on DoctorProfile.specialization and flows to the client via the
 * auth `user.specialization`. This maps that specialty to which sidebar modules
 * are on by default and how the dashboard is labelled.
 *
 * The app is Paediatric-centric by DEFAULT (DEFAULT_CONFIG) — an unknown or
 * unset specialty falls back to it — but the architecture supports the four
 * launch specialties below and is easy to extend.
 *
 * NOTE (honest-data): module lists are a product/ownership decision, so every
 * specialty currently exposes the full module set — nothing clinical is
 * fabricated or hidden. Deeper per-specialty adaptation (patient fields,
 * reports, clinical parameters) is intentionally NOT invented here; it needs
 * clinical sign-off before it ships.
 */

export interface SpecialtyConfig {
  /** Human label shown in the UI (e.g. the topbar role line). */
  label: string;
  /** Sidebar module keys that are ON by default for this specialty. */
  modules: string[];
  /** Dashboard quick-action labels to promote. */
  quickActions: string[];
  /** KPI cards to promote. */
  kpiHighlights: string[];
  /** Dashboard widget keys to show. */
  dashboardWidgets: string[];
}

/**
 * The four launch specialities, in display order. Single source for the picker.
 * Professional/designation names (Neonatologist, not Neonatology). Legacy stored
 * values (e.g. "Neonatology") still resolve via ALIASES / TEMPLATE_KEYS below.
 */
export const SPECIALTY_OPTIONS = [
  { value: 'Paediatrician', label: 'Paediatrician' },
  { value: 'Neonatologist', label: 'Neonatologist' },
  { value: 'Gynaecologist', label: 'Gynaecologist' },
  { value: 'Physician', label: 'Physician' },
] as const;

export type SpecialtyValue = (typeof SPECIALTY_OPTIONS)[number]['value'];

const ALL_MODULES = [
  'dashboard', 'appointments', 'patients', 'reports', 'pharmacy', 'billing',
  'consultations', 'lab', 'locations', 'team', 'audit', 'settings',
];

const BASE_ACTIONS = ['New Appointment', 'Add Patient', 'View Reports'];
const BASE_KPIS = ['patients', 'appointments', 'consultations', 'revenue'];
const BASE_WIDGETS = ['schedule', 'consultations', 'alerts', 'demographics', 'visitTrend', 'visitReasons', 'recentPatients'];

export const SPECIALTY_CONFIGS: Record<string, SpecialtyConfig> = {
  paediatrician: {
    label: 'Paediatrician',
    modules: ALL_MODULES,
    quickActions: [...BASE_ACTIONS, 'Vaccination Schedule', 'Growth Chart', 'Lab Order'],
    kpiHighlights: BASE_KPIS,
    dashboardWidgets: BASE_WIDGETS,
  },
  neonatologist: {
    label: 'Neonatologist',
    modules: ALL_MODULES,
    quickActions: [...BASE_ACTIONS, 'Growth Chart', 'Lab Order'],
    kpiHighlights: BASE_KPIS,
    dashboardWidgets: BASE_WIDGETS,
  },
  gynaecologist: {
    label: 'Gynaecologist',
    modules: ALL_MODULES,
    quickActions: [...BASE_ACTIONS, 'Create Prescription', 'Lab Order'],
    kpiHighlights: BASE_KPIS,
    dashboardWidgets: BASE_WIDGETS,
  },
  physician: {
    label: 'Physician',
    modules: ALL_MODULES,
    quickActions: [...BASE_ACTIONS, 'Create Prescription', 'Lab Order'],
    kpiHighlights: BASE_KPIS,
    dashboardWidgets: BASE_WIDGETS,
  },
};

// Spelling/legacy variants map to a canonical config key, so a stored
// "Neonatology" / "Gynaecology" (older label) or "Pediatrician" (US spelling)
// still resolves after the rename to professional designations.
const ALIASES: Record<string, string> = {
  pediatrician: 'paediatrician',
  paediatrics: 'paediatrician',
  pediatrics: 'paediatrician',
  neonatology: 'neonatologist',
  neonatologist: 'neonatologist',
  gynaecology: 'gynaecologist',
  gynecology: 'gynaecologist',
  gynecologist: 'gynaecologist',
  'general physician': 'physician',
  'general medicine': 'physician',
};

const DEFAULT_CONFIG: SpecialtyConfig = SPECIALTY_CONFIGS.paediatrician;

export function getSpecialtyConfig(specialization?: string | null): SpecialtyConfig {
  if (!specialization) return DEFAULT_CONFIG;
  const key = specialization.toLowerCase().trim();
  return SPECIALTY_CONFIGS[key] ?? SPECIALTY_CONFIGS[ALIASES[key]] ?? DEFAULT_CONFIG;
}

/**
 * Maps a doctor's speciality to the `specialization` key of the global
 * SpecialtyTemplate that should drive their patient records. Paediatrician →
 * the existing `pediatrics` template; the other three have their own seeds.
 * Falls back to `pediatrics` (the paediatric-centric default) when unknown.
 */
const TEMPLATE_KEYS: Record<string, string> = {
  paediatrician: 'pediatrics',
  pediatrician: 'pediatrics',
  paediatrics: 'pediatrics',
  pediatrics: 'pediatrics',
  neonatology: 'neonatology',
  neonatologist: 'neonatology',
  gynaecology: 'gynaecology',
  gynecology: 'gynaecology',
  gynaecologist: 'gynaecology',
  gynecologist: 'gynaecology',
  physician: 'physician',
  'general physician': 'physician',
  'general medicine': 'physician',
};

export function specialtyTemplateKey(specialization?: string | null): string {
  if (!specialization) return 'pediatrics';
  const key = specialization.toLowerCase().trim();
  return TEMPLATE_KEYS[key] ?? key;
}
