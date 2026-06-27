import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, MessageCircle, Send, Trash2, Users } from 'lucide-react';
import { createPost, createReply, deletePost, deleteReply, listPosts, listReplies } from '../api/community';
import type { CommunityPost, CommunityReply, CommunityRole } from '../api/community';
import { ApiError } from '../api/client';
import { formatDateTimeIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { Link } from 'react-router';

const AVATAR_BG: Record<CommunityRole, string> = {
  parent: 'bg-purple-100 text-purple-700',
  doctor: 'bg-blue-100 text-blue-700',
  admin: 'bg-emerald-100 text-emerald-700',
};

function displayName(name: string, role: CommunityRole) {
  return role === 'doctor' ? `Dr. ${name}` : name;
}

function RoleBadge({ role }: { role: CommunityRole }) {
  if (role === 'doctor') return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Doctor</span>;
  if (role === 'admin') return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Mateo</span>;
  return null;
}

function Avatar({ name, role, size = 'md' }: { name: string; role: CommunityRole; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span className={`grid ${dim} shrink-0 place-items-center rounded-full font-bold ${AVATAR_BG[role]}`}>
      {name.trim().charAt(0).toUpperCase() || 'P'}
    </span>
  );
}

export default function Community() {
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPosts()
      .then((d) => {
        if (!cancelled) setPosts(d.posts);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitPost(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setPosting(true);
    try {
      const { post } = await createPost(body.trim());
      setPosts((prev) => [post, ...(prev ?? [])]);
      setBody('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post, please try again');
    } finally {
      setPosting(false);
    }
  }

  function onDeleted(id: string) {
    setPosts((prev) => (prev ?? []).filter((p) => p.id !== id));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple-50">
          <Users className="h-6 w-6 text-purple-600" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Community</h1>
          <p className="text-sm text-stone-500">A space for parents to share, ask and support each other.</p>
        </div>
      </header>

      {/* Composer */}
      <Card className="mt-5 p-4">
        <form onSubmit={submitPost}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Share a tip, ask a question, or just say hi to other parents…"
            className="w-full resize-none rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-purple-300 focus:ring-2 focus:ring-purple-200"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-stone-400">Be kind. This space is for support, not medical advice.</span>
            <Button type="submit" disabled={posting || !body.trim()} className="gap-1.5">
              <Send className="h-4 w-4" />
              {posting ? 'Posting…' : 'Post'}
            </Button>
          </div>
        </form>
      </Card>

      {error && <Card className="mt-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* Feed */}
      <div className="mt-4 space-y-3">
        {posts === null ? (
          <>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </>
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-stone-300" />
            <p className="mt-2 text-sm text-stone-500">No posts yet — be the first to start a conversation.</p>
          </Card>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} onDeleted={onDeleted} />)
        )}
      </div>
    </div>
  );
}

function PostCard({ post, onDeleted }: { post: CommunityPost; onDeleted: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [replies, setReplies] = useState<CommunityReply[] | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [count, setCount] = useState(post.replyCount);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <Avatar name={post.author.name} role={post.author.role} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold text-stone-800">{displayName(post.author.name, post.author.role)}</span>
            <RoleBadge role={post.author.role} />
            <span className="text-xs text-stone-400">· {formatDateTimeIST(post.createdAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-stone-700">{post.body}</p>

          <div className="mt-3 flex items-center gap-4">
            <button type="button" onClick={toggleReplies} className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-purple-700">
              <MessageCircle className="h-4 w-4" />
              {count} {count === 1 ? 'reply' : 'replies'}
            </button>
            {post.mine && !confirmDelete && (
              <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1 text-sm font-medium text-stone-400 hover:text-rose-600">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
            {post.mine && confirmDelete && (
              <span className="inline-flex items-center gap-2 text-xs">
                <span className="text-rose-600">Delete this post?</span>
                <button type="button" onClick={() => void removePost()} disabled={deleting} className="font-bold text-rose-700 hover:text-rose-800 disabled:opacity-50">
                  Yes
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="font-medium text-stone-500 hover:text-stone-700">
                  Cancel
                </button>
              </span>
            )}
          </div>

          {expanded && (
            <div className="mt-3 border-t border-stone-100 pt-3">
              {loadingReplies ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="space-y-3">
                  {(replies ?? []).map((r) => (
                    <div key={r.id} className="flex items-start gap-2.5">
                      <Avatar name={r.author.name} role={r.author.role} size="sm" />
                      <div className="min-w-0 flex-1 rounded-xl bg-stone-50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="text-sm font-semibold text-stone-800">{displayName(r.author.name, r.author.role)}</span>
                          <RoleBadge role={r.author.role} />
                          <span className="text-xs text-stone-400">· {formatDateTimeIST(r.createdAt)}</span>
                          {r.mine && (
                            <button type="button" onClick={() => void removeReply(r.id)} aria-label="Delete reply" className="ml-auto text-stone-300 hover:text-rose-600">
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
                      className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-stone-400 focus:border-purple-300 focus:ring-2 focus:ring-purple-200"
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
