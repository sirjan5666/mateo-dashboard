/**
 * Specialty-based dashboard configuration.
 *
 * Maps a doctor's specialization to which sidebar modules and dashboard widgets
 * are relevant. A module not listed for a specialty is still accessible (routes
 * exist) but won't appear in the sidebar unless the doctor explicitly enables it.
 *
 * `modules` lists the sidebar module keys that are ON by default for this
 * specialty. `quickActions` lists the action labels shown on the dashboard.
 * `kpiHighlights` controls which KPI cards are promoted.
 */

export interface SpecialtyConfig {
  label: string;
  modules: string[];
  quickActions: string[];
  kpiHighlights: string[];
  dashboardWidgets: string[];
}

const ALL_MODULES = [
  'dashboard', 'appointments', 'patients', 'reports', 'pharmacy', 'billing',
  'consultations', 'locations', 'team', 'audit', 'settings',
];

const BASE_ACTIONS = ['New Appointment', 'Add Patient', 'View Reports'];

export const SPECIALTY_CONFIGS: Record<string, SpecialtyConfig> = {
  pediatrician: {
    label: 'Pediatrician',
    modules: [...ALL_MODULES, 'lab'],
    quickActions: [...BASE_ACTIONS, 'Vaccination Schedule', 'Growth Chart', 'Lab Order'],
    kpiHighlights: ['patients', 'appointments', 'consultations', 'revenue'],
    dashboardWidgets: ['schedule', 'consultations', 'alerts', 'demographics', 'visitTrend', 'visitReasons', 'recentPatients'],
  },
  dermatologist: {
    label: 'Dermatologist',
    modules: ALL_MODULES,
    quickActions: [...BASE_ACTIONS, 'Skin Assessment', 'Photo Review'],
    kpiHighlights: ['patients', 'appointments', 'revenue', 'consultations'],
    dashboardWidgets: ['schedule', 'consultations', 'alerts', 'demographics', 'recentPatients'],
  },
  'general physician': {
    label: 'General Physician',
    modules: [...ALL_MODULES, 'lab'],
    quickActions: [...BASE_ACTIONS, 'Lab Order', 'Create Prescription'],
    kpiHighlights: ['patients', 'appointments', 'consultations', 'revenue'],
    dashboardWidgets: ['schedule', 'consultations', 'alerts', 'demographics', 'visitTrend', 'visitReasons', 'recentPatients'],
  },
  orthopedic: {
    label: 'Orthopedic',
    modules: ALL_MODULES,
    quickActions: [...BASE_ACTIONS, 'Create Prescription', 'Order X-Ray'],
    kpiHighlights: ['patients', 'appointments', 'revenue', 'consultations'],
    dashboardWidgets: ['schedule', 'consultations', 'alerts', 'recentPatients'],
  },
  ent: {
    label: 'ENT Specialist',
    modules: [...ALL_MODULES, 'lab'],
    quickActions: [...BASE_ACTIONS, 'Lab Order', 'Create Prescription'],
    kpiHighlights: ['patients', 'appointments', 'consultations', 'revenue'],
    dashboardWidgets: ['schedule', 'consultations', 'alerts', 'demographics', 'recentPatients'],
  },
};

const DEFAULT_CONFIG: SpecialtyConfig = {
  label: 'General',
  modules: [...ALL_MODULES, 'lab'],
  quickActions: [...BASE_ACTIONS, 'Create Prescription'],
  kpiHighlights: ['patients', 'appointments', 'consultations', 'revenue'],
  dashboardWidgets: ['schedule', 'consultations', 'alerts', 'demographics', 'visitTrend', 'visitReasons', 'recentPatients'],
};

export function getSpecialtyConfig(specialization?: string | null): SpecialtyConfig {
  if (!specialization) return DEFAULT_CONFIG;
  const key = specialization.toLowerCase().trim();
  return SPECIALTY_CONFIGS[key] ?? DEFAULT_CONFIG;
}
