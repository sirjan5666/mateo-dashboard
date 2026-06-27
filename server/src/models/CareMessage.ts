import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { encryptedFields } from '../lib/crypto/mongooseEncryption.js';

// A message in the doctor<->patient care thread (one thread per patient). Doctor-owned
// + tenant-scoped; the patient side is reached via loadMyPatient. The message body is
// PHI and is field-encrypted at rest — decrypted only in the response shaper.
export type MessageSender = 'doctor' | 'patient';
export const MESSAGE_SENDERS: MessageSender[] = ['doctor', 'patient'];

export interface ICareMessage {
  doctorUserId: Types.ObjectId; // TENANT
  patientId: Types.ObjectId;
  senderRole: MessageSender;
  senderUserId: Types.ObjectId;
  body: string; // PHI — encrypted at rest
  readByDoctorAt?: Date;
  readByPatientAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const careMessageSchema = new Schema<ICareMessage>(
  {
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    senderRole: { type: String, enum: MESSAGE_SENDERS, required: true },
    senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    readByDoctorAt: { type: Date },
    readByPatientAt: { type: Date },
  },
  { timestamps: true },
);
// Tenant-scoped thread (oldest-first read in the route).
careMessageSchema.index({ doctorUserId: 1, patientId: 1, createdAt: 1 });

encryptedFields(careMessageSchema, ['body']);

export const CareMessage = model<ICareMessage>('CareMessage', careMessageSchema);
