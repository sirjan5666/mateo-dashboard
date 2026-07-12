import { api } from './client';

export type CommunityRole = 'parent' | 'doctor' | 'admin';
export type CommunityPostType = 'general' | 'question' | 'tip' | 'milestone' | 'celebration';

export interface CommunityAuthor {
  name: string;
  role: CommunityRole;
}
export interface CommunityPost {
  id: string;
  body: string;
  type: CommunityPostType;
  topic: string;
  createdAt: string;
  author: CommunityAuthor;
  replyCount: number;
  helpfulCount: number;
  helpfulMine: boolean;
  mine: boolean;
}
export interface CommunityReply {
  id: string;
  body: string;
  createdAt: string;
  author: CommunityAuthor;
  mine: boolean;
}

export interface CommunityStats {
  parents: number;
  discussions: number;
  helpfulAnswers: number;
  activeThisWeek: number;
}
export interface CommunityContributor {
  name: string;
  role: CommunityRole;
  contributions: number;
}
export interface CommunityTrendingTopic {
  topic: string;
  posts: number;
}

// Topic chips — shared slugs (must match server COMMUNITY_TOPICS) + display labels.
export const COMMUNITY_TOPICS: { slug: string; label: string }[] = [
  { slug: 'general', label: 'General' },
  { slug: 'new-parents', label: 'New Parents' },
  { slug: 'feeding', label: 'Feeding' },
  { slug: 'sleep', label: 'Sleep' },
  { slug: 'vaccination', label: 'Vaccination' },
  { slug: 'health', label: 'Health' },
  { slug: 'milestones', label: 'Milestones' },
  { slug: 'nutrition', label: 'Nutrition' },
  { slug: 'activities', label: 'Activities' },
  { slug: 'mental-health', label: 'Mental Health' },
  { slug: 'toddler', label: 'Toddler' },
  { slug: 'pregnancy', label: 'Pregnancy' },
];

export function topicLabel(slug: string): string {
  return COMMUNITY_TOPICS.find((t) => t.slug === slug)?.label ?? slug;
}

export interface ListPostsOptions {
  topic?: string;
  type?: CommunityPostType | 'all';
}
export function listPosts(opts: ListPostsOptions = {}) {
  const params = new URLSearchParams();
  if (opts.topic && opts.topic !== 'all') params.set('topic', opts.topic);
  if (opts.type && opts.type !== 'all') params.set('type', opts.type);
  const qs = params.toString();
  return api<{ posts: CommunityPost[] }>(`/community/posts${qs ? `?${qs}` : ''}`);
}

export interface CreatePostInput {
  body: string;
  type?: CommunityPostType;
  topic?: string;
}
export function createPost(input: CreatePostInput) {
  return api<{ post: CommunityPost }>('/community/posts', { method: 'POST', body: JSON.stringify(input) });
}
export function listReplies(postId: string) {
  return api<{ replies: CommunityReply[] }>(`/community/posts/${postId}/replies`);
}
export function createReply(postId: string, body: string) {
  return api<{ reply: CommunityReply }>(`/community/posts/${postId}/replies`, { method: 'POST', body: JSON.stringify({ body }) });
}
export function markHelpful(postId: string) {
  return api<{ ok: true; helpfulCount: number; already: boolean }>(`/community/posts/${postId}/helpful`, { method: 'POST' });
}
export function deletePost(postId: string) {
  return api<{ ok: true }>(`/community/posts/${postId}`, { method: 'DELETE' });
}
export function deleteReply(postId: string, replyId: string) {
  return api<{ ok: true }>(`/community/posts/${postId}/replies/${replyId}`, { method: 'DELETE' });
}

export function getCommunityStats() {
  return api<CommunityStats>('/community/stats');
}
export function getContributors() {
  return api<{ contributors: CommunityContributor[] }>('/community/contributors');
}
export function getTrending() {
  return api<{ topics: CommunityTrendingTopic[] }>('/community/trending');
}
