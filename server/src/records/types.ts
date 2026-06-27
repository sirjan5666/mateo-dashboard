// Specialty-agnostic record engine — shared types. A SpecialtyTemplate (owned by
// a doctor, or a global seed) defines the fields/statuses/history-tags for that
// practice; a PatientRecord stores typed VALUES keyed by these field keys. No
// specialty is ever hardcoded in a Mongoose schema — this is the configurable core.

// Phase 1 field types. multiselect/boolean/phone are deferred to Phase 2; the
// enum is forward-compatible (new types are additive).
export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldDefinition {
  key: string; // immutable slug, generated once; label may change freely
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // for `select`
  min?: number; // for `number`
  max?: number; // for `number`
  maxLength?: number; // for `text` / `textarea`
  sensitive?: boolean; // PHI → value MUST be field-encrypted at rest by recordCrypto (mutually exclusive with `searchable`)
  searchable?: boolean; // value is denormalized into the non-PHI PatientRecord.searchText (mutually exclusive with `sensitive`)
  archived?: boolean; // soft-removed: no longer collected, but stored values still render
  order?: number; // display order
}

export interface StatusOption {
  key: string; // immutable; stored on PatientRecord.status
  label: string;
  tone?: string; // maps onto the existing Pill/tone system for the status badge
  isDefault?: boolean; // assigned to new patients
  isTerminal?: boolean; // e.g. discharged / closed
}

export interface HistoryTag {
  key: string; // immutable; stored in PatientRecord.tags[]
  label: string;
  color?: string;
}
