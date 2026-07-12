import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A product review written by a VERIFIED BUYER (a user with a delivered, paid
// order containing that product). One review per product per user (unique index).
// Photos use the app's local-disk upload pattern (middleware/upload.ts), streamed
// back through an authenticated route — same as skin logs.
//
// IMS Act 1992: infant formula (brand 'neucomed') is NON-REVIEWABLE. The route
// rejects formula productIds before a document is ever created — the model stays
// brand-agnostic but the write path enforces the carve-out.

export interface IProductReview {
  productId: string; // catalog slug
  userId: Types.ObjectId;
  orderId: Types.ObjectId; // the order that verifies the purchase
  rating: number; // 1..5
  title: string;
  body: string;
  photoFile?: string; // local-disk filename
  helpfulCount: number;
  status: 'published' | 'hidden';
  rewardedLedgerId?: Types.ObjectId; // set when the ★ review reward was granted
  createdAt: Date;
  updatedAt: Date;
}

const productReviewSchema = new Schema<IProductReview>(
  {
    productId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    photoFile: { type: String },
    helpfulCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['published', 'hidden'], default: 'published' },
    rewardedLedgerId: { type: Schema.Types.ObjectId, ref: 'PointsLedger' },
  },
  { timestamps: true },
);

productReviewSchema.index({ productId: 1, status: 1, createdAt: -1 }); // PDP list
productReviewSchema.index({ productId: 1, userId: 1 }, { unique: true }); // one review / product / user

export const ProductReview = model<IProductReview>('ProductReview', productReviewSchema);
