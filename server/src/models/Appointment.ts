import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IAppointment {
  babyId: Types.ObjectId;
  scheduledAt: Date;
  reason: string;
  location?: string;
  notes?: string;
  completed: boolean;
  createdAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    babyId: { type: Schema.Types.ObjectId, ref: 'Baby', required: true, index: true },
    scheduledAt: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    notes: { type: String, trim: true },
    completed: { type: Boolean, required: true, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Appointment = model<IAppointment>('Appointment', appointmentSchema);
