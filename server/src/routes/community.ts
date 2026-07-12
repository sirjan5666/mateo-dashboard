import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { CommunityPost } from '../models/CommunityPost.js';
import { CommunityReply } from '../models/CommunityReply.js';
import { User } from '../models/User.js';
import type { UserRole } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { award, reverse } from '../points/service.js';
import { SITARE } from '../points/economics.js';

const router = Router();

// Mateo Sitare: reward a community contribution (post or reply), capped per IST
// day to stop farming. "Approval" = creation (there's no moderation queue), so
// the earn is clawed back if the content is later deleted.
async function awardCommunity(userId: string, refType: 'community_post' | 'community_reply', refId: string, dedupeKey: string) {
  await award({
    userId,
    source: 'community_contribution',
    amount: SITARE.COMMUNITY_PER_CONTRIBUTION,
    refType,
    refId,
    dedupeKey,
    dailyCap: { source: 'community_contribution', cap: SITARE.COMMUNITY_DAILY_CAP },
  }).catch((e) => console.error('sitare community award failed:', e));
}

const bodySchema = z.object({ body: z.string().trim().min(1, 'Write something first').max(2000) });

type Author = { name: string; role: UserRole };

// Resolve author name + role for a set of user ids (one query).
async function authorMap(userIds: Set<string>): Promise<Map<string, Author>> {
  const users = await User.find({ _id: { $in: [...userIds] } }).select('name role');
  return new Map(users.map((u) => [u.id, { name: u.name, role: u.role }]));
}

const FALLBACK_AUTHOR: Author = { name: 'A parent', role: 'parent' };

// ── Feed: newest posts first, with author + reply count ────────────────
router.get('/community/posts', requireAuth, async (req, res) => {
  const posts = await CommunityPost.find({}).sort({ createdAt: -1 }).limit(200);
  const ids = posts.map((p) => p._id);
  const counts = await CommunityReply.aggregate<{ _id: unknown; n: number }>([
    { $match: { postId: { $in: ids } } },
    { $group: { _id: '$postId', n: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
  const authors = await authorMap(new Set(posts.map((p) => p.authorUserId.toString())));
  res.json({
    posts: posts.map((p) => ({
      id: p.id,
      body: p.body,
      createdAt: p.createdAt,
      author: authors.get(p.authorUserId.toString()) ?? FALLBACK_AUTHOR,
      replyCount: countMap.get(p.id) ?? 0,
      mine: p.authorUserId.toString() === req.userId,
    })),
  });
});

router.post('/community/posts', requireAuth, async (req, res) => {
  const { body } = bodySchema.parse(req.body);
  const post = await CommunityPost.create({ authorUserId: req.userId, body });
  await awardCommunity(req.userId!, 'community_post', post.id, `earn:cpost:${post.id}`);
  const authors = await authorMap(new Set([req.userId!]));
  res.status(201).json({
    post: { id: post.id, body: post.body, createdAt: post.createdAt, author: authors.get(req.userId!) ?? FALLBACK_AUTHOR, replyCount: 0, mine: true },
  });
});

// ── Replies ────────────────────────────────────────────────────────────
router.get('/community/posts/:id/replies', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  const replies = await CommunityReply.find({ postId: id }).sort({ createdAt: 1 }).limit(500);
  const authors = await authorMap(new Set(replies.map((r) => r.authorUserId.toString())));
  res.json({
    replies: replies.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      author: authors.get(r.authorUserId.toString()) ?? FALLBACK_AUTHOR,
      mine: r.authorUserId.toString() === req.userId,
    })),
  });
});

router.post('/community/posts/:id/replies', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const post = isValidObjectId(id) ? await CommunityPost.findById(id) : null;
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  const { body } = bodySchema.parse(req.body);
  const reply = await CommunityReply.create({ postId: post._id, authorUserId: req.userId, body });
  await awardCommunity(req.userId!, 'community_reply', reply.id, `earn:creply:${reply.id}`);
  const authors = await authorMap(new Set([req.userId!]));
  res.status(201).json({
    reply: { id: reply.id, body: reply.body, createdAt: reply.createdAt, author: authors.get(req.userId!) ?? FALLBACK_AUTHOR, mine: true },
  });
});

// ── Delete (author or admin) — removes the post and its replies ────────
router.delete('/community/posts/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const post = isValidObjectId(id) ? await CommunityPost.findById(id) : null;
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  const isAuthor = post.authorUserId.toString() === req.userId;
  const isAdmin = (await User.findById(req.userId).select('role'))?.role === 'admin';
  if (!isAuthor && !isAdmin) {
    res.status(403).json({ error: 'You can only delete your own posts.' });
    return;
  }
  // Claw back the ★ earned for this post and every reply under it (anti-farming).
  const replies = await CommunityReply.find({ postId: post._id }).select('_id');
  await reverse({ dedupeKey: `earn:cpost:${post.id}`, reason: 'post_deleted' }).catch((e) => console.error('reverse failed:', e));
  for (const r of replies) {
    await reverse({ dedupeKey: `earn:creply:${r.id}`, reason: 'post_deleted' }).catch((e) => console.error('reverse failed:', e));
  }
  await CommunityReply.deleteMany({ postId: post._id });
  await post.deleteOne();
  res.json({ ok: true });
});

router.delete('/community/posts/:id/replies/:replyId', requireAuth, async (req, res) => {
  const replyId = String(req.params.replyId);
  const reply = isValidObjectId(replyId) ? await CommunityReply.findById(replyId) : null;
  if (!reply) {
    res.status(404).json({ error: 'Reply not found' });
    return;
  }
  const isAuthor = reply.authorUserId.toString() === req.userId;
  const isAdmin = (await User.findById(req.userId).select('role'))?.role === 'admin';
  if (!isAuthor && !isAdmin) {
    res.status(403).json({ error: 'You can only delete your own replies.' });
    return;
  }
  await reverse({ dedupeKey: `earn:creply:${reply.id}`, reason: 'reply_deleted' }).catch((e) => console.error('reverse failed:', e));
  await reply.deleteOne();
  res.json({ ok: true });
});

export default router;
