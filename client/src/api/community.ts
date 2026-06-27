import { api } from './client';

export type CommunityRole = 'parent' | 'doctor' | 'admin';
export interface CommunityAuthor {
  name: string;
  role: CommunityRole;
}
export interface CommunityPost {
  id: string;
  body: string;
  createdAt: string;
  author: CommunityAuthor;
  replyCount: number;
  mine: boolean;
}
export interface CommunityReply {
  id: string;
  body: string;
  createdAt: string;
  author: CommunityAuthor;
  mine: boolean;
}

export function listPosts() {
  return api<{ posts: CommunityPost[] }>('/community/posts');
}
export function createPost(body: string) {
  return api<{ post: CommunityPost }>('/community/posts', { method: 'POST', body: JSON.stringify({ body }) });
}
export function listReplies(postId: string) {
  return api<{ replies: CommunityReply[] }>(`/community/posts/${postId}/replies`);
}
export function createReply(postId: string, body: string) {
  return api<{ reply: CommunityReply }>(`/community/posts/${postId}/replies`, { method: 'POST', body: JSON.stringify({ body }) });
}
export function deletePost(postId: string) {
  return api<{ ok: true }>(`/community/posts/${postId}`, { method: 'DELETE' });
}
export function deleteReply(postId: string, replyId: string) {
  return api<{ ok: true }>(`/community/posts/${postId}/replies/${replyId}`, { method: 'DELETE' });
}
