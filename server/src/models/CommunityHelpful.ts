import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// One "helpful" vote per user per community post. The unique index makes the
// helpfulCount increment idempotent — a duplicate insert throws and the route
// treats it as "already marked". Mirrors ReviewHelpful.

export interface ICommunityHelpful {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}

const communityHelpfulSchema = new Schema<ICommunityHelpful>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'CommunityPost', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

communityHelpfulSchema.index({ postId: 1, userId: 1 }, { unique: true });

export const CommunityHelpful = model<ICommunityHelpful>('CommunityHelpful', communityHelpfulSchema);
