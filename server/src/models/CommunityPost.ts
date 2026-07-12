import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A post in the parents' community feed (a place for mothers to share and ask).
// A post has an optional KIND (question/tip/milestone/celebration) and TOPIC so the
// feed can badge, filter and trend on real data — no fabricated categories.

export type CommunityPostType = 'general' | 'question' | 'tip' | 'milestone' | 'celebration';
export const COMMUNITY_POST_TYPES: CommunityPostType[] = ['general', 'question', 'tip', 'milestone', 'celebration'];

// Topic slugs — the scrollable chips. Kept in one place so client + server agree.
export const COMMUNITY_TOPICS = [
  'general',
  'new-parents',
  'feeding',
  'sleep',
  'vaccination',
  'health',
  'milestones',
  'nutrition',
  'activities',
  'mental-health',
  'toddler',
  'pregnancy',
] as const;
export type CommunityTopic = (typeof COMMUNITY_TOPICS)[number];

export interface ICommunityPost {
  authorUserId: Types.ObjectId;
  body: string;
  type: CommunityPostType;
  topic: CommunityTopic;
  helpfulCount: number;
  createdAt: Date;
}

const communityPostSchema = new Schema<ICommunityPost>(
  {
    authorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    type: { type: String, enum: COMMUNITY_POST_TYPES, default: 'general', index: true },
    topic: { type: String, enum: COMMUNITY_TOPICS, default: 'general', index: true },
    helpfulCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const CommunityPost = model<ICommunityPost>('CommunityPost', communityPostSchema);
