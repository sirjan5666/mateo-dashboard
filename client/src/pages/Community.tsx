import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import {
  BadgeCheck,
  Bot,
  ChevronRight,
  Clock,
  Heart,
  MessageCircle,
  MessagesSquare,
  Send,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import {
  COMMUNITY_TOPICS,
  createPost,
  createReply,
  deletePost,
  deleteReply,
  getCommunityStats,
  getContributors,
  getTrending,
  listPosts,
  listReplies,
  markHelpful,
  topicLabel,
} from '../api/community';
import type {
  CommunityContributor,
  CommunityPost,
  CommunityPostType,
  CommunityReply,
  CommunityRole,
  CommunityStats,
  CommunityTrendingTopic,
} from '../api/community';
import { listBabies } from '../api/babies';
import { ApiError } from '../api/client';
import { formatDateTimeIST } from '../lib/age';
import { refreshSitare } from '../lib/sitare';
import { askAssistantLink } from '../lib/assistant';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';

/* ── little helpers ─────────────────────────────────────────────────── */

const nf = new Intl.NumberFormat('en-IN');

// Compact relative time ("just now", "3h", "2d") with the full IST date on hover.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTimeIST(iso);
}

const PARENT_GRADIENTS = [
  'linear-gradient(135deg,#8b6bff,#6d4aff)',
  'linear-gradient(135deg,#ff9ec4,#ff6f9c)',
  'linear-gradient(135deg,#5fd0a6,#2fb37a)',
  'linear-gradient(135deg,#78b0ff,#4f8dff)',
  'linear-gradient(135deg,#ffce7a,#f6b42c)',
];
function avatarGradient(name: string, role: CommunityRole): string {
  if (role === 'doctor') return 'linear-gradient(135deg,#78b0ff,#4f8dff)';
  if (role === 'admin') return 'linear-gradient(135deg,#5fd0a6,#2fb37a)';
  const code = name.trim().charCodeAt(0) || 0;
  return PARENT_GRADIENTS[code % PARENT_GRADIENTS.length];
}

function displayName(name: string, role: CommunityRole) {
  return role === 'doctor' ? `Dr. ${name}` : name;
}

function Avatar({ name, role, size = 44 }: { name: string; role: CommunityRole; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size * 0.34, background: avatarGradient(name, role) }}
    >
      {name.trim().charAt(0).toUpperCase() || 'P'}
    </span>
  );
}

// Role badge. Every account is Mateo-created (no open sign-up), so parents are
// honestly "Verified Parent"; doctors + Mateo staff get their own mark.
function RoleBadge({ role }: { role: CommunityRole }) {
  if (role === 'doctor')
    return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">Doctor</span>;
  if (role === 'admin')
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Mateo</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
      <BadgeCheck className="h-3 w-3" />
      Verified Parent
    </span>
  );
}

/* ── post kinds + topics presentation ───────────────────────────────── */

type ComposerType = CommunityPostType;

const POST_TYPES: { value: ComposerType; label: string; emoji: string }[] = [
  { value: 'general', label: 'General', emoji: '💬' },
  { value: 'question', label: 'Question', emoji: '❓' },
  { value: 'tip', label: 'Tip', emoji: '💡' },
  { value: 'milestone', label: 'Milestone', emoji: '🎉' },
  { value: 'celebration', label: 'Celebration', emoji: '🎊' },
];

const TYPE_BADGE: Record<CommunityPostType, { label: string; emoji: string; cls: string } | null> = {
  general: null,
  question: { label: 'Question', emoji: '❓', cls: 'bg-blue-50 text-blue-700' },
  tip: { label: 'Tip', emoji: '💡', cls: 'bg-emerald-50 text-emerald-700' },
  milestone: { label: 'Milestone', emoji: '🎉', cls: 'bg-amber-50 text-amber-700' },
  celebration: { label: 'Celebration', emoji: '🎊', cls: 'bg-pink-50 text-pink-700' },
};

const FILTER_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'question', label: 'Questions' },
  { value: 'tip', label: 'Tips' },
  { value: 'milestone', label: 'Milestones' },
  { value: 'celebration', label: 'Celebrations' },
];

const TOPIC_EMOJI: Record<string, string> = {
  general: '💬',
  'new-parents': '🌱',
  feeding: '🍼',
  sleep: '🌙',
  vaccination: '💉',
  health: '💚',
  milestones: '🎈',
  nutrition: '🥕',
  activities: '🧸',
  'mental-health': '🧘',
  toddler: '🚼',
  pregnancy: '🤰',
};
const topicEmoji = (slug: string) => TOPIC_EMOJI[slug] ?? '💬';

/* ── page ────────────────────────────────────────────────────────────── */

export default function Community() {
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sort, setSort] = useState<'latest' | 'helpful'>('latest');
  const [activeBabyId, setActiveBabyId] = useState<string | null>(null);

  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [contributors, setContributors] = useState<CommunityContributor[] | null>(null);
  const [trending, setTrending] = useState<CommunityTrendingTopic[] | null>(null);

  // Feed — refetches whenever the topic chip or type tab changes. The skeleton
  // reset lives in the change handlers below (an event, not the effect) so we
  // never call setState synchronously inside an effect.
  useEffect(() => {
    let cancelled = false;
    listPosts({ topic, type: typeFilter as CommunityPostType | 'all' })
      .then((d) => {
        if (cancelled) return;
        setPosts(d.posts);
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again'));
    return () => {
      cancelled = true;
    };
  }, [topic, typeFilter]);

  const changeTopic = (t: string) => {
    setPosts(null);
    setTopic(t);
  };
  const changeType = (t: string) => {
    setPosts(null);
    setTypeFilter(t);
  };

  // Right-rail (real, computed) + the active baby for the "Ask Dai Maa" hand-off.
  useEffect(() => {
    let cancelled = false;
    getCommunityStats().then((d) => !cancelled && setStats(d)).catch(() => undefined);
    getContributors().then((d) => !cancelled && setContributors(d.contributors)).catch(() => undefined);
    getTrending().then((d) => !cancelled && setTrending(d.topics)).catch(() => undefined);
    listBabies()
      .then((r) => {
        if (cancelled) return;
        const saved = localStorage.getItem('mateo:activeBaby');
        setActiveBabyId(r.babies.find((b) => b.id === saved)?.id ?? r.babies[0]?.id ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePosts = useMemo(() => {
    if (!posts) return posts;
    if (sort === 'helpful') return [...posts].sort((a, b) => b.helpfulCount - a.helpfulCount);
    return posts;
  }, [posts, sort]);

  function onCreated(post: CommunityPost) {
    // Show it immediately if it belongs in the current view; always bump the count.
    const fits = (topic === 'all' || post.topic === topic) && (typeFilter === 'all' || post.type === typeFilter);
    if (fits) setPosts((prev) => [post, ...(prev ?? [])]);
    setStats((s) => (s ? { ...s, discussions: s.discussions + 1 } : s));
    refreshSitare();
  }

  function onDeleted(id: string) {
    setPosts((prev) => (prev ?? []).filter((p) => p.id !== id));
    setStats((s) => (s ? { ...s, discussions: Math.max(0, s.discussions - 1) } : s));
  }

  return (
    <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
      {/* MAIN COLUMN */}
      <div className="min-w-0 space-y-5">
        <Hero />

        <TopicChips topic={topic} onPick={changeTopic} />

        <Composer onCreated={onCreated} onError={setError} />

        {error && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

        <FilterBar typeFilter={typeFilter} onType={changeType} sort={sort} onSort={setSort} />

        <div className="space-y-4">
          {visiblePosts === null ? (
            <>
              <Skeleton className="h-40 w-full rounded-3xl" />
              <Skeleton className="h-40 w-full rounded-3xl" />
            </>
          ) : visiblePosts.length === 0 ? (
            <Card className="p-10 text-center">
              <MessagesSquare className="mx-auto h-9 w-9 text-stone-300" />
              <p className="mt-3 text-sm font-semibold text-stone-700">
                {topic === 'all' && typeFilter === 'all' ? 'No posts yet' : 'Nothing here yet'}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {topic === 'all' && typeFilter === 'all'
                  ? 'Be the first to start a conversation with other parents.'
                  : 'Try another topic or filter — or share something yourself.'}
              </p>
            </Card>
          ) : (
            visiblePosts.map((post) => (
              <PostCard key={post.id} post={post} activeBabyId={activeBabyId} onDeleted={onDeleted} onTopic={changeTopic} />
            ))
          )}
        </div>
      </div>

      {/* RIGHT RAIL */}
      <aside className="mt-6 space-y-5 lg:mt-0">
        <StatsCard stats={stats} />
        <TrendingCard topics={trending} onPick={changeTopic} />
        <ContributorsCard contributors={contributors} />
        <p className="px-1 text-center text-[11.5px] leading-relaxed text-stone-400">
          A space for support, not medical advice. For anything urgent, talk to a doctor.
        </p>
      </aside>
    </div>
  );
}

/* ── hero ────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/60 p-7 shadow-sm"
      style={{ background: 'linear-gradient(120deg,#efe7ff 0%,#f5efff 44%,#ffe7f3 100%)' }}
    >
      <span aria-hidden className="pointer-events-none absolute -top-16 right-[26%] h-44 w-44 rounded-full bg-[#cdb8ff] opacity-60 blur-sm" />
      <span aria-hidden className="pointer-events-none absolute -bottom-14 right-2 h-36 w-36 rounded-full bg-[#ffc4e2] opacity-60 blur-sm" />
      <div className="relative z-10 flex items-center gap-5">
        <div className="max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-violet-700 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Parent Community
          </span>
          <h1 className="mt-3 text-balance text-3xl font-extrabold leading-tight tracking-tight text-stone-900">
            You’re not doing this alone
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
            Ask questions, share milestones, swap parenting tips and connect with parents walking the same path.
          </p>
        </div>
        <div className="ml-auto hidden shrink-0 sm:block">
          <FamilyArt />
        </div>
      </div>
    </section>
  );
}

function FamilyArt() {
  return (
    <img
      src="/community-family.jpg"
      alt="A mother, father and baby smiling together"
      width={220}
      height={165}
      className="h-auto w-[220px] rounded-3xl object-cover shadow-sm ring-1 ring-white/60"
    />
  );
}

/* ── topic chips ─────────────────────────────────────────────────────── */

function TopicChips({ topic, onPick }: { topic: string; onPick: (t: string) => void }) {
  const chips = [{ slug: 'all', label: 'All Topics' }, ...COMMUNITY_TOPICS];
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {chips.map((c) => {
        const on = topic === c.slug;
        return (
          <button
            key={c.slug}
            type="button"
            onClick={() => onPick(c.slug)}
            className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold transition ${
              on
                ? 'border-transparent bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm'
                : 'border-stone-200 bg-white text-stone-600 hover:text-stone-900'
            }`}
          >
            <span aria-hidden className="text-[15px] leading-none">
              {c.slug === 'all' ? '🧭' : topicEmoji(c.slug)}
            </span>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── composer ────────────────────────────────────────────────────────── */

function Composer({ onCreated, onError }: { onCreated: (p: CommunityPost) => void; onError: (m: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [type, setType] = useState<ComposerType>('general');
  const [topic, setTopic] = useState('general');
  const [posting, setPosting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    onError(null);
    setPosting(true);
    try {
      const { post } = await createPost({ body: body.trim(), type, topic });
      onCreated(post);
      setBody('');
      setType('general');
      setTopic('general');
      setOpen(false);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not post, please try again');
    } finally {
      setPosting(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit}>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white"
            style={{ background: 'linear-gradient(135deg,#8b6bff,#6d4aff)' }}
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setOpen(true)}
            rows={open || body ? 3 : 1}
            maxLength={2000}
            placeholder="What’s on your mind today? Ask a question, share a tip, celebrate a milestone…"
            className="w-full resize-none rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-200"
          />
        </div>

        {(open || body) && (
          <div className="mt-3 space-y-3 pl-0 sm:pl-14">
            {/* Kind */}
            <div className="flex flex-wrap gap-2">
              {POST_TYPES.map((pt) => {
                const on = type === pt.value;
                return (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setType(pt.value)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] font-bold transition ${
                      on ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-stone-200 bg-white text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span aria-hidden>{pt.emoji}</span>
                    {pt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                Topic
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-stone-700 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                >
                  {COMMUNITY_TOPICS.map((tp) => (
                    <option key={tp.slug} value={tp.slug}>
                      {tp.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={posting || !body.trim()} className="gap-1.5">
                <Send className="h-4 w-4" />
                {posting ? 'Posting…' : 'Post'}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}

/* ── filter bar ──────────────────────────────────────────────────────── */

function FilterBar({
  typeFilter,
  onType,
  sort,
  onSort,
}: {
  typeFilter: string;
  onType: (t: string) => void;
  sort: 'latest' | 'helpful';
  onSort: (s: 'latest' | 'helpful') => void;
}) {
  return (
    <Card className="flex flex-wrap items-center gap-1 p-1.5">
      {FILTER_TABS.map((tab) => {
        const on = typeFilter === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onType(tab.value)}
            className={`rounded-xl px-3.5 py-2 text-[13px] font-bold transition ${
              on ? 'bg-violet-50 text-violet-700' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSort('latest')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${
            sort === 'latest' ? 'text-violet-700' : 'text-stone-400 hover:text-stone-700'
          }`}
        >
          <Clock className="h-4 w-4" />
          Latest
        </button>
        <button
          type="button"
          onClick={() => onSort('helpful')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${
            sort === 'helpful' ? 'text-violet-700' : 'text-stone-400 hover:text-stone-700'
          }`}
        >
          <Heart className="h-4 w-4" />
          Most helpful
        </button>
      </div>
    </Card>
  );
}

/* ── post card ───────────────────────────────────────────────────────── */

function PostCard({
  post,
  activeBabyId,
  onDeleted,
  onTopic,
}: {
  post: CommunityPost;
  activeBabyId: string | null;
  onDeleted: (id: string) => void;
  onTopic: (t: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replies, setReplies] = useState<CommunityReply[] | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [count, setCount] = useState(post.replyCount);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [helpful, setHelpful] = useState(post.helpfulCount);
  const [helpfulMine, setHelpfulMine] = useState(post.helpfulMine);
  const badge = TYPE_BADGE[post.type];

  function toggleReplies() {
    const next = !expanded;
    setExpanded(next);
    if (next && replies === null && !loadingReplies) {
      setLoadingReplies(true);
      listReplies(post.id)
        .then((d) => setReplies(d.replies))
        .catch(() => setReplies([]))
        .finally(() => setLoadingReplies(false));
    }
  }

  async function toggleHelpful() {
    if (helpfulMine) return;
    setHelpful((h) => h + 1);
    setHelpfulMine(true);
    try {
      const res = await markHelpful(post.id);
      setHelpful(res.helpfulCount);
    } catch {
      setHelpful((h) => Math.max(0, h - 1));
      setHelpfulMine(false);
    }
  }

  async function submitReply(e: FormEvent) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setReplyPosting(true);
    setReplyError(null);
    try {
      const { reply } = await createReply(post.id, replyBody.trim());
      setReplies((prev) => [...(prev ?? []), reply]);
      setCount((c) => c + 1);
      setReplyBody('');
      refreshSitare();
    } catch (err) {
      setReplyError(err instanceof ApiError ? err.message : 'Could not post your reply. Please try again.');
    } finally {
      setReplyPosting(false);
    }
  }

  async function removePost() {
    setDeleting(true);
    try {
      await deletePost(post.id);
      onDeleted(post.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function removeReply(replyId: string) {
    try {
      await deleteReply(post.id, replyId);
      setReplies((prev) => (prev ?? []).filter((r) => r.id !== replyId));
      setCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  }

  return (
    <Card className="p-5 transition hover:shadow-md sm:p-6">
      <div className="flex items-start gap-3">
        <Avatar name={post.author.name} role={post.author.role} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-extrabold text-stone-800">{displayName(post.author.name, post.author.role)}</span>
            <RoleBadge role={post.author.role} />
            <span className="ml-auto whitespace-nowrap text-xs text-stone-400" title={formatDateTimeIST(post.createdAt)}>
              {timeAgo(post.createdAt)}
            </span>
          </div>

          {badge && (
            <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${badge.cls}`}>
              <span aria-hidden>{badge.emoji}</span>
              {badge.label}
            </span>
          )}

          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-stone-700">{post.body}</p>

          {post.topic !== 'general' && (
            <button
              type="button"
              onClick={() => onTopic(post.topic)}
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[11.5px] font-semibold text-violet-700 transition hover:bg-violet-100"
            >
              <span aria-hidden>{topicEmoji(post.topic)}</span># {topicLabel(post.topic)}
            </button>
          )}

          {/* actions */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={() => void toggleHelpful()}
              disabled={helpfulMine}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold transition ${
                helpfulMine ? 'text-pink-600' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
              }`}
            >
              <Heart className={`h-4 w-4 ${helpfulMine ? 'fill-pink-500 text-pink-500' : ''}`} />
              <span className="tabular-nums">{helpful > 0 ? helpful : ''}</span> Helpful
            </button>

            <button
              type="button"
              onClick={toggleReplies}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold text-stone-500 transition hover:bg-stone-50 hover:text-stone-800"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="tabular-nums">{count > 0 ? count : ''}</span> {count === 1 ? 'Reply' : 'Replies'}
            </button>

            {activeBabyId && (
              <Link
                to={askAssistantLink(
                  activeBabyId,
                  `A parent asked in the community: "${post.body}"\n\nWhat gentle guidance would you give?`,
                )}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold text-white shadow-sm transition hover:brightness-105"
                style={{ background: 'linear-gradient(135deg,#8b6bff,#6d4aff)' }}
              >
                <Bot className="h-4 w-4" />
                Ask Dai Maa
              </Link>
            )}

            {post.mine && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-semibold text-stone-400 transition hover:text-rose-600 ${activeBabyId ? '' : 'ml-auto'}`}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
            {post.mine && confirmDelete && (
              <span className={`inline-flex items-center gap-2 text-xs ${activeBabyId ? '' : 'ml-auto'}`}>
                <span className="text-rose-600">Delete this post?</span>
                <button
                  type="button"
                  onClick={() => void removePost()}
                  disabled={deleting}
                  className="font-bold text-rose-700 hover:text-rose-800 disabled:opacity-50"
                >
                  Yes
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="font-medium text-stone-500 hover:text-stone-700">
                  Cancel
                </button>
              </span>
            )}
          </div>

          {/* replies */}
          {expanded && (
            <div className="mt-3 border-t border-stone-100 pt-3">
              {loadingReplies ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="space-y-3">
                  {(replies ?? []).map((r) => (
                    <div key={r.id} className="flex items-start gap-2.5">
                      <Avatar name={r.author.name} role={r.author.role} size={32} />
                      <div className="min-w-0 flex-1 rounded-2xl bg-stone-50 px-3.5 py-2.5">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="text-sm font-bold text-stone-800">{displayName(r.author.name, r.author.role)}</span>
                          <RoleBadge role={r.author.role} />
                          <span className="text-xs text-stone-400" title={formatDateTimeIST(r.createdAt)}>
                            · {timeAgo(r.createdAt)}
                          </span>
                          {r.mine && (
                            <button
                              type="button"
                              onClick={() => void removeReply(r.id)}
                              aria-label="Delete reply"
                              className="ml-auto text-stone-300 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-stone-700">{r.body}</p>
                      </div>
                    </div>
                  ))}

                  <form onSubmit={submitReply} className="flex items-center gap-2">
                    <input
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      maxLength={2000}
                      placeholder="Write a reply…"
                      className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-stone-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                    />
                    <Button type="submit" size="sm" disabled={replyPosting || !replyBody.trim()} className="shrink-0">
                      {replyPosting ? '…' : 'Reply'}
                    </Button>
                  </form>
                  {replyError && <p className="text-xs text-rose-600">{replyError}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ── right rail ──────────────────────────────────────────────────────── */

function StatsCard({ stats }: { stats: CommunityStats | null }) {
  const tiles = [
    { key: 'parents', label: 'Parents', value: stats?.parents, tint: 'from-violet-50 to-purple-50', icon: <Users className="h-4 w-4 text-violet-600" />, iconBg: 'bg-violet-100' },
    { key: 'discussions', label: 'Discussions', value: stats?.discussions, tint: 'from-emerald-50 to-teal-50', icon: <MessagesSquare className="h-4 w-4 text-emerald-600" />, iconBg: 'bg-emerald-100' },
    { key: 'helpful', label: 'Helpful replies', value: stats?.helpfulAnswers, tint: 'from-pink-50 to-rose-50', icon: <Heart className="h-4 w-4 text-pink-600" />, iconBg: 'bg-pink-100' },
    { key: 'active', label: 'Active this week', value: stats?.activeThisWeek, tint: 'from-amber-50 to-orange-50', icon: <Clock className="h-4 w-4 text-amber-600" />, iconBg: 'bg-amber-100', live: true },
  ];
  return (
    <Card className="p-4">
      <h4 className="mb-3 text-[15px] font-extrabold text-stone-800">Community at a glance</h4>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <div key={t.key} className={`rounded-2xl bg-gradient-to-br ${t.tint} p-3.5`}>
            <span className={`grid h-8 w-8 place-items-center rounded-xl ${t.iconBg}`}>{t.icon}</span>
            <div className="mt-2.5 text-xl font-extrabold tabular-nums leading-none text-stone-900">
              {t.value == null ? '—' : nf.format(t.value)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] font-medium text-stone-500">
              {t.live && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
              {t.label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TrendingCard({ topics, onPick }: { topics: CommunityTrendingTopic[] | null; onPick: (t: string) => void }) {
  if (topics && topics.length === 0) return null;
  return (
    <Card className="p-4">
      <h4 className="mb-2 text-[15px] font-extrabold text-stone-800">Trending topics</h4>
      {topics === null ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="space-y-0.5">
          {topics.map((t) => (
            <button
              key={t.topic}
              type="button"
              onClick={() => onPick(t.topic)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-stone-50"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-[17px]">{topicEmoji(t.topic)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-bold text-stone-800">{topicLabel(t.topic)}</span>
                <span className="text-[11.5px] text-stone-400">{nf.format(t.posts)} {t.posts === 1 ? 'post' : 'posts'}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_BADGE = [
  { label: 'Gold', cls: 'bg-amber-100 text-amber-800' },
  { label: 'Silver', cls: 'bg-stone-100 text-stone-600' },
  { label: 'Bronze', cls: 'bg-orange-100 text-orange-800' },
];

function ContributorsCard({ contributors }: { contributors: CommunityContributor[] | null }) {
  if (contributors && contributors.length === 0) return null;
  return (
    <Card className="p-4">
      <h4 className="mb-2 text-[15px] font-extrabold text-stone-800">Top contributors</h4>
      {contributors === null ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="space-y-1">
          {contributors.map((c, i) => (
            <div key={`${c.name}-${i}`} className="flex items-center gap-3 py-1.5">
              <span className="relative shrink-0">
                <Avatar name={c.name} role={c.role} size={38} />
                {i < 3 && <span className="absolute -bottom-1 -right-1 text-sm">{MEDALS[i]}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold text-stone-800">{displayName(c.name, c.role)}</div>
                <div className="text-[11.5px] text-stone-400">
                  {nf.format(c.contributions)} {c.contributions === 1 ? 'contribution' : 'contributions'}
                </div>
              </div>
              {i < 3 && (
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${MEDAL_BADGE[i].cls}`}>{MEDAL_BADGE[i].label}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
