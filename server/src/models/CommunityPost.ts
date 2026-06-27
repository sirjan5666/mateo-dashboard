import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A post in the parents' community feed (a place for mothers to share and ask).
export interface ICommunityPost {
  authorUserId: Types.ObjectId;
  body: string;
  createdAt: Date;
}

const communityPostSchema = new Schema<ICommunityPost>(
  {
    authorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const CommunityPost = model<ICommunityPost>('CommunityPost', communityPostSchema);
