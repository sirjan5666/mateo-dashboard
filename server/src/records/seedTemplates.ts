import type { FieldDefinition, HistoryTag, StatusOption } from './types.js';

// Global starter templates (ownerUserId unset = system seed). A doctor picks one
// at onboarding and may then clone+customise it. These prove the engine is
// specialty-agnostic: each specialty defines its OWN fields, statuses, and tags —
// nothing here is referenced by name anywhere in the schemas. Clinical content is
// a starting point for the doctor to adapt, not authoritative.
export interface SeedTemplate {
  specialization: string;
  name: string;
  fields: FieldDefinition[];
  statuses: StatusOption[];
  historyTags: HistoryTag[];
}

export const GLOBAL_TEMPLATES: SeedTemplate[] = [
  {
    specialization: 'general',
    name: 'General Practice',
    fields: [
      { key: 'chief_complaint', label: 'Chief complaint', type: 'text', required: true, maxLength: 200, searchable: true, order: 1 },
      { key: 'history', label: 'History of presenting illness', type: 'textarea', maxLength: 4000, order: 2 },
      { key: 'allergies', label: 'Allergies', type: 'textarea', sensitive: true, maxLength: 1000, order: 3 },
      { key: 'current_medications', label: 'Current medications', type: 'textarea', sensitive: true, maxLength: 2000, order: 4 },
      { key: 'bp_systolic', label: 'BP systolic (mmHg)', type: 'number', min: 40, max: 300, order: 5 },
      { key: 'bp_diastolic', label: 'BP diastolic (mmHg)', type: 'number', min: 20, max: 200, order: 6 },
      { key: 'notes', label: 'Clinical notes', type: 'textarea', sensitive: true, maxLength: 8000, order: 7 },
    ],
    statuses: [
      { key: 'active', label: 'Active', tone: 'sky', isDefault: true },
      { key: 'follow_up', label: 'Follow-up', tone: 'amber' },
      { key: 'discharged', label: 'Discharged', tone: 'stone', isTerminal: true },
    ],
    historyTags: [
      { key: 'hypertension', label: 'Hypertension', color: 'rose' },
      { key: 'diabetes', label: 'Diabetes', color: 'amber' },
      { key: 'asthma', label: 'Asthma', color: 'sky' },
      { key: 'drug_allergy', label: 'Drug allergy', color: 'rose' },
      { key: 'smoker', label: 'Smoker', color: 'stone' },
    ],
  },
  {
    specialization: 'dermatology',
    name: 'Dermatology',
    fields: [
      { key: 'chief_complaint', label: 'Chief complaint', type: 'text', required: true, maxLength: 200, searchable: true, order: 1 },
      { key: 'skin_type', label: 'Fitzpatrick skin type', type: 'select', options: ['I', 'II', 'III', 'IV', 'V', 'VI'], order: 2 },
      { key: 'affected_area', label: 'Affected area', type: 'text', maxLength: 200, searchable: true, order: 3 },
      { key: 'lesion_description', label: 'Lesion description', type: 'textarea', maxLength: 4000, order: 4 },
      { key: 'onset', label: 'Onset date', type: 'date', order: 5 },
      { key: 'allergies', label: 'Allergies', type: 'textarea', sensitive: true, maxLength: 1000, order: 6 },
      { key: 'notes', label: 'Clinical notes', type: 'textarea', sensitive: true, maxLength: 8000, order: 7 },
    ],
    statuses: [
      { key: 'active', label: 'Active', tone: 'sky', isDefault: true },
      { key: 'clearing', label: 'Clearing', tone: 'emerald' },
      { key: 'maintenance', label: 'Maintenance', tone: 'violet' },
      { key: 'discharged', label: 'Discharged', tone: 'stone', isTerminal: true },
    ],
    historyTags: [
      { key: 'eczema', label: 'Eczema', color: 'amber' },
      { key: 'psoriasis', label: 'Psoriasis', color: 'rose' },
      { key: 'acne', label: 'Acne', color: 'violet' },
      { key: 'sun_sensitivity', label: 'Sun sensitivity', color: 'amber' },
      { key: 'drug_allergy', label: 'Drug allergy', color: 'rose' },
    ],
  },
  {
    specialization: 'pediatrics',
    name: 'Pediatrics',
    fields: [
      { key: 'chief_complaint', label: 'Chief complaint', type: 'text', required: true, maxLength: 200, searchable: true, order: 1 },
      { key: 'weight_kg', label: 'Weight (kg)', type: 'number', min: 0, max: 150, order: 2 },
      { key: 'height_cm', label: 'Height (cm)', type: 'number', min: 0, max: 250, order: 3 },
      { key: 'immunization_status', label: 'Immunization status', type: 'select', options: ['up_to_date', 'delayed', 'unknown'], order: 4 },
      { key: 'allergies', label: 'Allergies', type: 'textarea', sensitive: true, maxLength: 1000, order: 5 },
      { key: 'developmental_notes', label: 'Developmental notes', type: 'textarea', sensitive: true, maxLength: 4000, order: 6 },
    ],
    statuses: [
      { key: 'active', label: 'Active', tone: 'sky', isDefault: true },
      { key: 'monitoring', label: 'Monitoring', tone: 'amber' },
      { key: 'discharged', label: 'Discharged', tone: 'stone', isTerminal: true },
    ],
    historyTags: [
      { key: 'preterm', label: 'Preterm', color: 'violet' },
      { key: 'asthma', label: 'Asthma', color: 'sky' },
      { key: 'food_allergy', label: 'Food allergy', color: 'rose' },
      { key: 'immunization_delay', label: 'Immunization delay', color: 'amber' },
    ],
  },
  {
    // Newborns 0–28 days & NICU follow-up. Fields are structural (what to capture);
    // corrected-age growth curves and bilirubin thresholds are NOT applied here —
    // those need clinical sign-off before any interpretation ships. Feeding stays
    // brand-neutral / breastfeeding-first (IMS Act 1992) — formula never appears.
    specialization: 'neonatology',
    name: 'Neonatology',
    fields: [
      { key: 'chief_complaint', label: 'Chief complaint', type: 'text', required: true, maxLength: 200, searchable: true, order: 1 },
      { key: 'gestational_age_weeks', label: 'Gestational age at birth (weeks)', type: 'number', min: 20, max: 45, order: 2 },
      { key: 'birth_weight_g', label: 'Birth weight (g)', type: 'number', min: 200, max: 6000, order: 3 },
      { key: 'current_weight_g', label: 'Current weight (g)', type: 'number', min: 200, max: 20000, order: 4 },
      { key: 'length_cm', label: 'Length (cm)', type: 'number', min: 20, max: 120, order: 5 },
      { key: 'head_circumference_cm', label: 'Head circumference (cm)', type: 'number', min: 15, max: 60, order: 6 },
      { key: 'apgar', label: 'APGAR (1 & 5 min)', type: 'text', maxLength: 40, order: 7 },
      { key: 'delivery_type', label: 'Delivery type', type: 'select', options: ['Vaginal', 'C-section', 'Assisted'], order: 8 },
      { key: 'feeding', label: 'Feeding', type: 'select', options: ['Breastfeeding', 'Expressed breast milk'], order: 9 },
      { key: 'respiratory_support', label: 'Respiratory support', type: 'select', options: ['None', 'Oxygen', 'CPAP', 'Ventilator'], order: 10 },
      { key: 'jaundice_note', label: 'Jaundice / phototherapy note', type: 'textarea', sensitive: true, maxLength: 2000, order: 11 },
      { key: 'notes', label: 'Clinical notes', type: 'textarea', sensitive: true, maxLength: 8000, order: 12 },
    ],
    statuses: [
      { key: 'nicu', label: 'NICU', tone: 'sky', isDefault: true },
      { key: 'stable', label: 'Stable', tone: 'emerald' },
      { key: 'follow_up', label: 'Follow-up', tone: 'amber' },
      { key: 'discharged', label: 'Discharged', tone: 'stone', isTerminal: true },
    ],
    historyTags: [
      { key: 'preterm', label: 'Preterm', color: 'violet' },
      { key: 'low_birth_weight', label: 'Low birth weight', color: 'amber' },
      { key: 'jaundice', label: 'Jaundice', color: 'amber' },
      { key: 'respiratory_distress', label: 'Respiratory distress', color: 'rose' },
    ],
  },
  {
    // Women's health & antenatal care — lives in the doctor EHR only (separate from
    // the parent baby-app). EDD calculation, fundal-height norms and GDM screening
    // thresholds are left to clinical sign-off; these fields only capture values.
    specialization: 'gynaecology',
    name: 'Gynaecology',
    fields: [
      { key: 'chief_complaint', label: 'Chief complaint', type: 'text', required: true, maxLength: 200, searchable: true, order: 1 },
      { key: 'lmp', label: 'LMP (last menstrual period)', type: 'date', order: 2 },
      { key: 'edd', label: 'EDD (estimated due date)', type: 'date', order: 3 },
      { key: 'gravida_para', label: 'Gravida / Para (G/P)', type: 'text', maxLength: 40, order: 4 },
      { key: 'menstrual_cycle', label: 'Menstrual cycle', type: 'select', options: ['Regular', 'Irregular'], order: 5 },
      { key: 'contraception', label: 'Contraception', type: 'text', maxLength: 120, order: 6 },
      { key: 'bp_systolic', label: 'BP systolic (mmHg)', type: 'number', min: 40, max: 300, order: 7 },
      { key: 'bp_diastolic', label: 'BP diastolic (mmHg)', type: 'number', min: 20, max: 200, order: 8 },
      { key: 'weight_kg', label: 'Weight (kg)', type: 'number', min: 0, max: 300, order: 9 },
      { key: 'allergies', label: 'Allergies', type: 'textarea', sensitive: true, maxLength: 1000, order: 10 },
      { key: 'obstetric_history', label: 'Obstetric history', type: 'textarea', sensitive: true, maxLength: 4000, order: 11 },
      { key: 'notes', label: 'Clinical notes', type: 'textarea', sensitive: true, maxLength: 8000, order: 12 },
    ],
    statuses: [
      { key: 'active', label: 'Active', tone: 'sky', isDefault: true },
      { key: 'antenatal', label: 'Antenatal', tone: 'violet' },
      { key: 'postnatal', label: 'Postnatal', tone: 'emerald' },
      { key: 'discharged', label: 'Discharged', tone: 'stone', isTerminal: true },
    ],
    historyTags: [
      { key: 'pcos', label: 'PCOS', color: 'violet' },
      { key: 'hypertension', label: 'Hypertension', color: 'rose' },
      { key: 'gdm', label: 'GDM', color: 'amber' },
      { key: 'prev_c_section', label: 'Previous C-section', color: 'stone' },
    ],
  },
  {
    // General adult medicine & chronic care. BMI/BP categorisation and blood-sugar
    // thresholds require clinical sign-off; fields here only capture values.
    specialization: 'physician',
    name: 'Physician',
    fields: [
      { key: 'chief_complaint', label: 'Chief complaint', type: 'text', required: true, maxLength: 200, searchable: true, order: 1 },
      { key: 'history', label: 'History of presenting illness', type: 'textarea', maxLength: 4000, order: 2 },
      { key: 'bp_systolic', label: 'BP systolic (mmHg)', type: 'number', min: 40, max: 300, order: 3 },
      { key: 'bp_diastolic', label: 'BP diastolic (mmHg)', type: 'number', min: 20, max: 200, order: 4 },
      { key: 'pulse_bpm', label: 'Pulse (bpm)', type: 'number', min: 20, max: 250, order: 5 },
      { key: 'temperature_c', label: 'Temperature (°C)', type: 'number', min: 30, max: 45, order: 6 },
      { key: 'weight_kg', label: 'Weight (kg)', type: 'number', min: 0, max: 400, order: 7 },
      { key: 'height_cm', label: 'Height (cm)', type: 'number', min: 0, max: 250, order: 8 },
      { key: 'allergies', label: 'Allergies', type: 'textarea', sensitive: true, maxLength: 1000, order: 9 },
      { key: 'current_medications', label: 'Current medications', type: 'textarea', sensitive: true, maxLength: 2000, order: 10 },
      { key: 'comorbidities', label: 'Comorbidities', type: 'textarea', maxLength: 2000, order: 11 },
      { key: 'notes', label: 'Clinical notes', type: 'textarea', sensitive: true, maxLength: 8000, order: 12 },
    ],
    statuses: [
      { key: 'active', label: 'Active', tone: 'sky', isDefault: true },
      { key: 'chronic_care', label: 'Chronic care', tone: 'violet' },
      { key: 'follow_up', label: 'Follow-up', tone: 'amber' },
      { key: 'discharged', label: 'Discharged', tone: 'stone', isTerminal: true },
    ],
    historyTags: [
      { key: 'hypertension', label: 'Hypertension', color: 'rose' },
      { key: 'diabetes', label: 'Diabetes', color: 'amber' },
      { key: 'thyroid', label: 'Thyroid', color: 'sky' },
      { key: 'cardiac', label: 'Cardiac', color: 'rose' },
      { key: 'smoker', label: 'Smoker', color: 'stone' },
    ],
  },
];
