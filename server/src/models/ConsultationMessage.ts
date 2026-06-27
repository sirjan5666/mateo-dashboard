import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A message in the chat between a parent and a doctor for one consultation.
// Either party can send text and/or an image. Image files live in uploads/ and
// are streamed only through an authenticated, participant-checked route.
export interface IConsultationMessage {
  consultationId: Types.ObjectId;
  senderUserId: Types.ObjectId;
  senderRole: 'parent' | 'doctor';
  text: string;
  imageFile?: string;
  createdAt: Date;
}

const consultationMessageSchema = new Schema<IConsultationMessage>(
  {
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation', required: true, index: true },
    senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['parent', 'doctor'], required: true },
    text: { type: String, default: '', trim: true },
    imageFile: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ConsultationMessage = model<IConsultationMessage>('ConsultationMessage', consultationMessageSchema);
