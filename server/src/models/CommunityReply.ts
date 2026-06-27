import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A reply to a community post.
export interface ICommunityReply {
  postId: Types.ObjectId;
  authorUserId: Types.ObjectId;
  body: string;
  createdAt: Date;
}

const communityReplySchema = new Schema<ICommunityReply>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
    authorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const CommunityReply = model<ICommunityReply>('CommunityReply', communityReplySchema);
