import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A physical clinic a doctor practises at. Doctor-owned and tenant-scoped like
// every other doctor-domain document (doctorUserId is the tenant boundary).
//
// NOT PHI — a clinic's name, address and phone are business details the doctor
// publishes, so nothing here is field-encrypted. Patient counts and revenue are
// never stored on this doc; they are aggregated live from the tenant's own
// Patient / Invoice collections so the two can never drift.
export interface IClinicLocation {
  doctorUserId: Types.ObjectId; // TENANT
  name: string;
  code: string; // short slug used in the UI switcher, unique per doctor
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
  email?: string;
  services: string[];
  openingHours?: string;
  /** Exactly one location per doctor carries this — enforced in the route. */
  isPrimary: boolean;
  active: boolean;
  /** Accent used by the location switcher dot. */
  hue: string;
  createdAt: Date;
  updatedAt: Date;
}

const clinicLocationSchema = new Schema<IClinicLocation>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, maxlength: 40 },
    addressLine: { type: String, required: true, trim: true, maxlength: 240 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    pincode: { type: String, required: true, trim: true, maxlength: 12 },
    phone: { type: String, trim: true, maxlength: 24 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    services: { type: [String], default: [] },
    openingHours: { type: String, trim: true, maxlength: 120 },
    isPrimary: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    hue: { type: String, default: '#4F63F5' },
  },
  { timestamps: true },
);

clinicLocationSchema.index({ doctorUserId: 1, active: 1 });
// Per-doctor codes must be unique — a duplicate fails loudly (E11000) rather
// than silently creating a second clinic the switcher cannot tell apart.
clinicLocationSchema.index({ doctorUserId: 1, code: 1 }, { unique: true });

export const ClinicLocation = model<IClinicLocation>('ClinicLocation', clinicLocationSchema);
