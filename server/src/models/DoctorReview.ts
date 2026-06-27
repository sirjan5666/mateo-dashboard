import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A parent's rating + review of a doctor, tied to one consultation (one review
// per consultation). Powers the doctor's average rating in the directory.
export interface IDoctorReview {
  consultationId: Types.ObjectId;
  doctorUserId: Types.ObjectId;
  doctorProfileId: Types.ObjectId;
  parentUserId: Types.ObjectId;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
}

const doctorReviewSchema = new Schema<IDoctorReview>(
  {
    consultationId: { type: Schema.Types.ObjectId, ref: 'Consultation', required: true, unique: true },
    doctorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorProfileId: { type: Schema.Types.ObjectId, ref: 'DoctorProfile', required: true },
    parentUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

export const DoctorReview = model<IDoctorReview>('DoctorReview', doctorReviewSchema);
