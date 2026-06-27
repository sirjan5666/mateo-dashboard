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
  },
  { timestamps: true },
);
// Tenant-scoped schedule queries (by time).
appointmentSchema.index({ doctorUserId: 1, start: 1 });

encryptedFields(appointmentSchema, ['reason']);

export const DoctorAppointment = model<IDoctorAppointment>('DoctorAppointment', appointmentSchema);
