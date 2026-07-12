import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A booked consultation between a parent and a doctor for a specific time slot.
// Chat (Phase 4) and prescriptions (Phase 5) will hang off a consultation.
export type ConsultationStatus = 'booked' | 'completed' | 'cancelled';
export const CONSULTATION_STATUSES: ConsultationStatus[] = ['booked', 'completed', 'cancelled'];

// Payment is mocked for now (no real gateway): booking marks it 'paid'.
export interface IConsultationPayment {
  amount: number; // whole INR actually charged (fee minus any Sitare discount)
  status: 'paid' | 'pending';
  method: string; // 'mock' for now
  paidAt?: Date;
  // Mateo Sitare: ★ redeemed against this booking and the ₹ they took off.
  pointsRedeemed?: number;
  discountInr?: number;
}

export interface IConsultation {
  parentUserId: Types.ObjectId;
  doctorUserId: Types.ObjectId;
  doctorProfileId: Types.ObjectId;
  babyId?: Types.ObjectId;
  slotStart: Date;
  slotEnd: Date;
  reason: string;
  status: ConsultationStatus;
  payment: IConsultationPayment;
  // Doctor-supplied video-call link (e.g. Google Meet). Parent gets a "Join now".
  meetLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IConsultationPayment>(
  {
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['paid', 'pending'], default: 'pending' },
    method: { type: String, default: 'mock' },
    paidAt: { type: Date },
    pointsRedeemed: { type: Number, min: 0 },
    discountInr: { type: Number, min: 0 },
  },
  { _id: false },
);

const consultationSchema = new Schema<IConsultation>(
  {
    parentUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorProfileId: { type: Schema.Types.ObjectId, ref: 'DoctorProfile', required: true },
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby' },
    slotStart: { type: Date, required: true },
    slotEnd: { type: Date, required: true },
    reason: { type: String, default: '', trim: true },
    status: { type: String, enum: CONSULTATION_STATUSES, default: 'booked', index: true },
    payment: { type: paymentSchema, required: true },
    meetLink: { type: String, trim: true },
  },
  { timestamps: true },
);

// A live (booked/completed) consultation owns its slot — prevents double-booking
// the same doctor + time. Cancelled ones are excluded so the slot frees up.
consultationSchema.index(
  { doctorUserId: 1, slotStart: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['booked', 'completed'] } } },
);

export const Consultation = model<IConsultation>('Consultation', consultationSchema);
