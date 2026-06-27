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
];
