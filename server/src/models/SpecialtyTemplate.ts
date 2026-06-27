import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { FIELD_TYPES } from '../records/types.js';
import type { FieldDefinition, HistoryTag, StatusOption } from '../records/types.js';
import { findSensitiveSearchableConflict } from '../records/templateValidation.js';

// The specialty-agnostic ENGINE. A template (owned by a doctor, or a global seed
// when ownerUserId is unset) defines that practice's intake fields, patient
// statuses, and history-tag vocabulary. No specialty's fields are ever hardcoded
// in a schema — they live here as data. Versions are immutable: editing bumps
// `version` and appends to changeLog; records stamp the version they were written
// against (see PatientRecord) so old records never break.
export interface IChangeLogEntry {
  version: number;
  at: Date;
  summary: string;
}

export interface ISpecialtyTemplate {
  ownerUserId?: Types.ObjectId; // unset = global/system seed
  specialization: string;
  name: string;
  version: number;
  fields: FieldDefinition[];
  statuses: StatusOption[];
  historyTags: HistoryTag[];
  isActive: boolean;
  changeLog: IChangeLogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const fieldSchema = new Schema<FieldDefinition>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: FIELD_TYPES, required: true },
    required: { type: Boolean, default: false },
    options: { type: [String], default: undefined },
    min: Number,
    max: Number,
    maxLength: Number,
    sensitive: { type: Boolean, default: false },
    searchable: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    order: Number,
  },
  { _id: false },
);

const statusSchema = new Schema<StatusOption>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    tone: String,
    isDefault: { type: Boolean, default: false },
    isTerminal: { type: Boolean, default: false },
  },
  { _id: false },
);

const historyTagSchema = new Schema<HistoryTag>(
  { key: { type: String, required: true }, label: { type: String, required: true }, color: String },
  { _id: false },
);

const changeLogSchema = new Schema<IChangeLogEntry>(
  { version: { type: Number, required: true }, at: { type: Date, required: true }, summary: { type: String, default: '' } },
  { _id: false },
);

const specialtyTemplateSchema = new Schema<ISpecialtyTemplate>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    specialization: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    version: { type: Number, default: 1 },
    fields: { type: [fieldSchema], default: [] },
    statuses: { type: [statusSchema], default: [] },
    historyTags: { type: [historyTagSchema], default: [] },
    isActive: { type: Boolean, default: true },
    changeLog: { type: [changeLogSchema], default: [] },
  },
  { timestamps: true },
);
specialtyTemplateSchema.index({ ownerUserId: 1, isActive: 1 });

// Fail CLOSED: a field that is both sensitive and searchable would leak encrypted
// PHI into the non-PHI searchText index. Reject such a template at save time.
specialtyTemplateSchema.pre('validate', async function rejectSensitiveSearchable() {
  const bad = findSensitiveSearchableConflict(this.fields as unknown as FieldDefinition[]);
  if (bad) {
    throw new Error(
      `Field "${bad.key}" cannot be both sensitive and searchable: encrypted PHI must never be denormalized into the searchText index.`,
    );
  }
});

export const SpecialtyTemplate = model<ISpecialtyTemplate>('SpecialtyTemplate', specialtyTemplateSchema);
