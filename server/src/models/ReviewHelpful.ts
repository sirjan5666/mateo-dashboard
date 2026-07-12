import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// One "was this helpful?" vote per user per review. The unique index makes the
// helpful-count increment idempotent — a duplicate insert throws and the route
// treats it as "already voted" instead of double-counting.

export interface IReviewHelpful {
  reviewId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}

const reviewHelpfulSchema = new Schema<IReviewHelpful>(
  {
    reviewId: { type: Schema.Types.ObjectId, ref: 'ProductReview', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

reviewHelpfulSchema.index({ reviewId: 1, userId: 1 }, { unique: true });

export const ReviewHelpful = model<IReviewHelpful>('ReviewHelpful', reviewHelpfulSchema);
