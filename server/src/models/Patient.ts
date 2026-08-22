import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { encryptedFields } from '../lib/crypto/mongooseEncryption.js';

// A doctor's patient — the DOCTOR-OWNED tenant root of the EHR domain. Every
// patient-owned document is scoped by doctorUserId (the tenant boundary); Doctor A
// can never reach Doctor B's patients. Demographic PHI (name/dob/phone) is
// field-encrypted at rest; decryption happens in the response shaper, never via
// getters. patientUserId links a portal login (set once, later phase).
export type PatientSex = 'male' | 'female' | 'other' | 'unspecified';
export const PATIENT_SEXES: PatientSex[] = ['male', 'female', 'other', 'unspecified'];

export interface IPatient {
  doctorUserId: Types.ObjectId; // TENANT
  patientUserId?: Types.ObjectId; // portal link (sparse, until claimed)
  // Parent-app bridge (doctor "invite parent" flow): the parent User + Baby that
  // were created FROM this patient's demographics. Provenance-only, one-time copy
  // — later edits to Baby never sync back here and doctor routes never read Baby
  // data through these ids. Used for idempotent re-invites + erasure unlinking.
  parentUserId?: Types.ObjectId;
  babyId?: Types.ObjectId;
  /**
   * The 5-digit patient number shown on screen and printed on prescriptions.
   * Sequential PER DOCTOR, not derived from the ObjectId: five hex characters
   * off an id collide with ~85% probability once a clinic passes 2,000
   * patients (birthday paradox over 16^5), and two children sharing a printed
   * patient ID is not an acceptable failure on a prescription.
   */
  code?: number;
  specialtyTemplateId: Types.ObjectId;
  /** Which of the doctor's clinics this patient was registered at. */
  locationId?: Types.ObjectId;
  displayName: string; // PHI — encrypted at rest
  dob?: string; // PHI — encrypted ISO date string at rest
  sex: PatientSex;
  phone?: string; // PHI — encrypted at rest
  /**
   * Core demographics the registration form already collects. These are NOT
   * specialty fields — every clinic needs a guardian, an address and someone to
   * call in an emergency — so they live on the patient rather than in a
   * doctor-defined template. All PHI, all encrypted at rest.
   *
   * Before this they were asked for and then thrown away: the form gathered
   * twenty-odd fields and stored five, so re-opening a patient showed blanks.
   */
  address?: string; // PHI (printed on prescriptions)
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  bloodGroup?: string;
  guardianName?: string;
  guardianRelationship?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  /** Birth record — plain numbers so growth work can use them without decrypting. */
  birthWeightKg?: number;
  birthHeightCm?: number;
  birthHeadCircumferenceCm?: number;
  deliveryType?: string;
  gestationalAgeWeeks?: number;
  status: string; // a status key defined by the template
  archivedAt?: Date; // soft-delete
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
    parentUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', index: true, sparse: true },
    code: { type: Number },
    specialtyTemplateId: { type: Schema.Types.ObjectId, ref: 'SpecialtyTemplate', required: true },
    // Plain (not PHI) so per-clinic counts can aggregate in the DB.
    locationId: { type: Schema.Types.ObjectId, ref: 'ClinicLocation', index: true },
    displayName: { type: String, required: true },
    dob: { type: String },
    sex: { type: String, enum: PATIENT_SEXES, default: 'unspecified' },
    phone: { type: String },
    address: { type: String },
    addressLine2: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    email: { type: String },
    bloodGroup: { type: String, trim: true, maxlength: 8 },
    guardianName: { type: String },
    guardianRelationship: { type: String, trim: true, maxlength: 40 },
    guardianPhone: { type: String },
    guardianEmail: { type: String },
    emergencyName: { type: String },
    emergencyRelationship: { type: String, trim: true, maxlength: 40 },
    emergencyPhone: { type: String },
    birthWeightKg: { type: Number, min: 0, max: 12 },
    birthHeightCm: { type: Number, min: 0, max: 80 },
    birthHeadCircumferenceCm: { type: Number, min: 0, max: 60 },
    deliveryType: { type: String, trim: true, maxlength: 40 },
    gestationalAgeWeeks: { type: Number, min: 20, max: 45 },
    status: { type: String, required: true },
    archivedAt: { type: Date },
  },
  { timestamps: true },
);

// Tenant-scoped list/query indexes (doctorUserId always leads).
patientSchema.index({ doctorUserId: 1, archivedAt: 1 });
// Unique per doctor, so a concurrent create is a duplicate-key error to retry
// rather than two patients quietly sharing a printed number.
// `partialFilterExpression`, NOT `sparse`. On a COMPOUND index sparse only skips
// a document when every indexed field is missing — doctorUserId is always there,
// so two patients without a code both indexed as `code: null` and collided on
// the second one. A partial index leaves un-coded rows out of the index entirely.
patientSchema.index(
  { doctorUserId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'number' } } },
);
patientSchema.index({ doctorUserId: 1, status: 1 });

// Encrypt PHI demographics at rest (idempotent; decrypt in the response shaper).
encryptedFields(patientSchema, [
  'displayName', 'dob', 'phone', 'email',
  'address', 'addressLine2', 'city', 'state', 'pincode',
  'guardianName', 'guardianPhone', 'guardianEmail',
  'emergencyName', 'emergencyPhone',
]);

export const Patient = model<IPatient>('Patient', patientSchema);
