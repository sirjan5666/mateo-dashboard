import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { CommunityPost, COMMUNITY_TOPICS, COMMUNITY_POST_TYPES } from '../models/CommunityPost.js';
import type { CommunityPostType, CommunityTopic } from '../models/CommunityPost.js';
import { CommunityReply } from '../models/CommunityReply.js';
import { CommunityHelpful } from '../models/CommunityHelpful.js';
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

// A new post also carries a KIND and a TOPIC (both optional; default 'general').
// Validated against the shared enums so client + server never drift.
const createSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(2000),
  type: z.enum(COMMUNITY_POST_TYPES as unknown as [CommunityPostType, ...CommunityPostType[]]).optional().default('general'),
  topic: z.enum(COMMUNITY_TOPICS as unknown as [CommunityTopic, ...CommunityTopic[]]).optional().default('general'),
});

type Author = { name: string; role: UserRole };

// Resolve author name + role for a set of user ids (one query).
async function authorMap(userIds: Set<string>): Promise<Map<string, Author>> {
  const users = await User.find({ _id: { $in: [...userIds] } }).select('name role');
  return new Map(users.map((u) => [u.id, { name: u.name, role: u.role }]));
}

const FALLBACK_AUTHOR: Author = { name: 'A parent', role: 'parent' };

// ── Feed: newest posts first, with author + reply count ────────────────
// Optional filters: ?topic=<slug> (chip) and ?type=<kind> (tab). Both are
// validated against the shared enums; anything else is ignored (shows all).
router.get('/community/posts', requireAuth, async (req, res) => {
  const filter: Record<string, unknown> = {};
  const topic = typeof req.query.topic === 'string' ? req.query.topic : '';
  const type = typeof req.query.type === 'string' ? req.query.type : '';
  if (topic && topic !== 'all' && (COMMUNITY_TOPICS as readonly string[]).includes(topic)) filter.topic = topic;
  if (type && type !== 'all' && (COMMUNITY_POST_TYPES as readonly string[]).includes(type)) filter.type = type;

  const posts = await CommunityPost.find(filter).sort({ createdAt: -1 }).limit(200);
  const ids = posts.map((p) => p._id);
  const [counts, myHelpful] = await Promise.all([
    CommunityReply.aggregate<{ _id: unknown; n: number }>([
      { $match: { postId: { $in: ids } } },
      { $group: { _id: '$postId', n: { $sum: 1 } } },
    ]),
    CommunityHelpful.find({ postId: { $in: ids }, userId: req.userId }).select('postId'),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
  const helpfulSet = new Set(myHelpful.map((h) => h.postId.toString()));
  const authors = await authorMap(new Set(posts.map((p) => p.authorUserId.toString())));
  res.json({
    posts: posts.map((p) => ({
      id: p.id,
      body: p.body,
      type: p.type,
      topic: p.topic,
      createdAt: p.createdAt,
      author: authors.get(p.authorUserId.toString()) ?? FALLBACK_AUTHOR,
      replyCount: countMap.get(p.id) ?? 0,
      helpfulCount: p.helpfulCount,
      helpfulMine: helpfulSet.has(p.id),
      mine: p.authorUserId.toString() === req.userId,
    })),
  });
});

router.post('/community/posts', requireAuth, async (req, res) => {
  const { body, type, topic } = createSchema.parse(req.body);
  const post = await CommunityPost.create({ authorUserId: req.userId, body, type, topic });
  await awardCommunity(req.userId!, 'community_post', post.id, `earn:cpost:${post.id}`);
  const authors = await authorMap(new Set([req.userId!]));
  res.status(201).json({
    post: {
      id: post.id,
      body: post.body,
      type: post.type,
      topic: post.topic,
      createdAt: post.createdAt,
      author: authors.get(req.userId!) ?? FALLBACK_AUTHOR,
      replyCount: 0,
      helpfulCount: 0,
      helpfulMine: false,
      mine: true,
    },
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

// ── "Helpful" vote — one per user per post (idempotent via unique index) ─
router.post('/community/posts/:id/helpful', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const post = isValidObjectId(id) ? await CommunityPost.findById(id) : null;
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  try {
    await CommunityHelpful.create({ postId: post._id, userId: req.userId });
  } catch (err) {
    // Duplicate key = already marked helpful; report the current count, no double-count.
    if (err && typeof err === 'object' && (err as { code?: number }).code === 11000) {
      res.json({ ok: true, helpfulCount: post.helpfulCount, already: true });
      return;
    }
    throw err;
  }
  post.helpfulCount += 1;
  await post.save();
  res.json({ ok: true, helpfulCount: post.helpfulCount, already: false });
});

// ── Community at a glance — all REAL counts, nothing fabricated ──────────
router.get('/community/stats', requireAuth, async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [parents, discussions, helpfulAnswers, activeAuthors] = await Promise.all([
    User.countDocuments({ role: 'parent' }),
    CommunityPost.countDocuments({}),
    CommunityReply.countDocuments({}),
    CommunityPost.distinct('authorUserId', { createdAt: { $gte: weekAgo } }),
  ]);
  res.json({ parents, discussions, helpfulAnswers, activeThisWeek: activeAuthors.length });
});

// ── Top contributors — ranked by real (posts + replies) volume ──────────
router.get('/community/contributors', requireAuth, async (_req, res) => {
  const [postCounts, replyCounts] = await Promise.all([
    CommunityPost.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: '$authorUserId', n: { $sum: 1 } } }]),
    CommunityReply.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: '$authorUserId', n: { $sum: 1 } } }]),
  ]);
  const total = new Map<string, number>();
  for (const p of postCounts) total.set(String(p._id), (total.get(String(p._id)) ?? 0) + p.n);
  for (const r of replyCounts) total.set(String(r._id), (total.get(String(r._id)) ?? 0) + r.n);
  const ranked = [...total.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const authors = await authorMap(new Set(ranked.map(([uid]) => uid)));
  res.json({
    contributors: ranked.map(([uid, contributions]) => {
      const a = authors.get(uid) ?? FALLBACK_AUTHOR;
      return { name: a.name, role: a.role, contributions };
    }),
  });
});

// ── Trending topics — real post volume per topic (excludes 'general') ────
router.get('/community/trending', requireAuth, async (_req, res) => {
  const agg = await CommunityPost.aggregate<{ _id: string; n: number }>([
    { $match: { topic: { $ne: 'general' } } },
    { $group: { _id: '$topic', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 6 },
  ]);
  res.json({ topics: agg.map((t) => ({ topic: t._id, posts: t.n })) });
});

export default router;
