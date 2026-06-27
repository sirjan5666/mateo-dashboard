import type { HydratedDocument } from 'mongoose';
import { PatientRecord } from '../models/PatientRecord.js';
import type { IPatientRecord } from '../models/PatientRecord.js';
import type { ISpecialtyTemplate } from '../models/SpecialtyTemplate.js';
import type { IPatient } from '../models/Patient.js';
import { encryptSensitiveFields } from './recordCrypto.js';
import type { FieldDefinition } from './types.js';

export interface PersistRecordInput {
  fields: Record<string, unknown>; // already validated by zodForTemplate at the route
  status: string;
  tags: string[];
}

/** Build the NON-PHI search blob from searchable (never sensitive) fields only. */
export function buildSearchText(fields: FieldDefinition[], values: Record<string, unknown>): string {
  return fields
    .filter((f) => f.searchable && !f.sensitive)
    .map((f) => values[f.key])
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase()
    .trim();
}

/**
 * THE single write choke point for a PatientRecord (one per patient). Encrypts
 * sensitive values, denormalizes searchText, stamps the template version, and
 * upserts via document .save() so the encryption + update-bypass guards apply.
 * Returns the saved record and the field keys written (for the audit row).
 *
 * Caller MUST have validated `input.fields` with zodForTemplate(template.fields)
 * and `status`/`tags` against the template's keys first.
 */
export async function writePatientRecord(
  patient: HydratedDocument<IPatient>,
  template: HydratedDocument<ISpecialtyTemplate>,
  input: PersistRecordInput,
): Promise<{ record: HydratedDocument<IPatientRecord>; changedFieldKeys: string[] }> {
  const fieldDefs = template.fields as unknown as FieldDefinition[];
  const values = new Map<string, unknown>(Object.entries(input.fields));
  encryptSensitiveFields(fieldDefs, values);
  const searchText = buildSearchText(fieldDefs, input.fields);

  let record = await PatientRecord.findOne({ doctorUserId: patient.doctorUserId, patientId: patient._id });
  if (!record) {
    record = new PatientRecord({
      doctorUserId: patient.doctorUserId,
      patientId: patient._id,
      templateId: template._id,
      templateVersion: template.version,
      status: input.status,
      tags: input.tags,
      fields: values,
      searchText,
    });
  } else {
    record.templateId = template._id;
    record.templateVersion = template.version;
    record.status = input.status;
    record.tags = input.tags;
    record.fields = values;
    record.searchText = searchText;
  }
  await record.save();
  return { record, changedFieldKeys: Object.keys(input.fields) };
}
