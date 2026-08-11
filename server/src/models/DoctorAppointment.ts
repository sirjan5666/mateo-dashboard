import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { encryptedFields } from '../lib/crypto/mongooseEncryption.js';

// A doctor's own appointment with one of their patients (distinct from the baby/parent
// side `Appointment` model). Doctor-owned + tenant-scoped. `reason` is short free-text
// PHI and is field-encrypted at rest (decrypted only in the response shaper).
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['scheduled', 'completed', 'cancelled', 'no_show'];
export type AppointmentMode = 'in_person' | 'phone' | 'video';
export const APPOINTMENT_MODES: AppointmentMode[] = ['in_person', 'phone', 'video'];

export interface IDoctorAppointment {
  doctorUserId: Types.ObjectId; // TENANT
  patientId: Types.ObjectId;
  start: Date;
  durationMin: number;
  mode: AppointmentMode;
  status: AppointmentStatus;
  reason?: string; // PHI — encrypted at rest
  symptoms?: string; // PHI — encrypted at rest
  notes?: string; // PHI — encrypted at rest
  /** Why the status is what it is — "rescheduled, doctor out", "patient no-show".
   *  Free text a receptionist adds when they change the status. PHI, encrypted. */
  statusRemark?: string;
  locationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IDoctorAppointment>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    start: { type: Date, required: true },
    durationMin: { type: Number, default: 30 },
    mode: { type: String, enum: APPOINTMENT_MODES, default: 'in_person' },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'scheduled' },
    reason: { type: String },
    symptoms: { type: String },
    notes: { type: String },
    statusRemark: { type: String },
    locationId: { type: Schema.Types.ObjectId, ref: 'ClinicLocation', index: true },
  },
  { timestamps: true },
);
// Tenant-scoped schedule queries (by time).
appointmentSchema.index({ doctorUserId: 1, start: 1 });

/**
 * Two patients cannot hold the SAME scheduled start with one doctor. The route's
 * `findClash` check catches this sequentially, but two simultaneous bookings both
 * read "no clash" before either inserts (a TOCTOU race) — so a real double-book
 * slipped through. This partial unique index is the atomic backstop: the second
 * concurrent insert fails with E11000 and the route turns that into a 409.
 *
 * `status` is part of the KEY (not just the partial filter) purely so this index
 * has a different key spec from the plain `{doctorUserId, start}` above —
 * MongoDB refuses two indexes with an identical key, and the plain one is still
 * needed for range queries across ALL statuses. Inside the partial index every
 * doc has status 'scheduled', so uniqueness is effectively on (doctor, start).
 * Partial so a cancelled/completed/no-show slot can be rebooked.
 */
appointmentSchema.index(
  { doctorUserId: 1, start: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'scheduled' } },
);

encryptedFields(appointmentSchema, ['reason', 'symptoms', 'notes', 'statusRemark']);

export const DoctorAppointment = model<IDoctorAppointment>('DoctorAppointment', appointmentSchema);
