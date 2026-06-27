import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

export interface IEmergencyContact {
  userId: Types.ObjectId;
  name: string;
  relation?: string;
  phone: string;
  createdAt: Date;
}

const emergencyContactSchema = new Schema<IEmergencyContact>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    relation: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const EmergencyContact = model<IEmergencyContact>('EmergencyContact', emergencyContactSchema);
