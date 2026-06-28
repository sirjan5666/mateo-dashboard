import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, MessageCircle, MessagesSquare, Radio, ShieldCheck, Users, X } from 'lucide-react';
import { getAdminChats, getAdminChatTranscript } from '../../api/admin';
import type { AdminChatRow, AdminChatsResponse, AdminChatTranscript } from '../../api/admin';
import { ApiError } from '../../api/client';
import { formatDateIST } from '../../lib/age';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';

type Filter = 'all' | 'live' | 'closed' | 'redflag';

// Relative "x min ago" for the last-active column; falls back to a date for older chats.
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d ago`;
  return formatDateIST(iso);
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: number; tone: string; icon: LucideIcon }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
        <Icon className="h-4 w-4 shrink-0" style={{ color: tone }} />
      </div>
      <p className="mt-1 text-2xl font-extrabold text-stone-900">{value}</p>
    </Card>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'closed', label: 'Closed' },
  { value: 'redflag', label: 'Red-flagged' },
];

export default function AdminChats() {
  const [data, setData] = useState<AdminChatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  // Transcript modal.
  const [openId, setOpenId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<AdminChatTranscript | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const reqRef = useRef<string | null>(null); // guards against an out-of-order transcript response

  function openTranscript(id: string) {
    reqRef.current = id;
    setOpenId(id);
    setTranscript(null);
    setTranscriptLoading(true);
    getAdminChatTranscript(id)
      .then((d) => reqRef.current === id && setTranscript(d))
      .catch(() => {})
      .finally(() => reqRef.current === id && setTranscriptLoading(false));
  }

  function closeTranscript() {
    reqRef.current = null;
    setOpenId(null);
  }

  useEffect(() => {
    let cancelled = false;
    getAdminChats()
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again'));
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape closes the transcript.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeTranscript();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  const counts = data?.counts ?? null;
  const sessions = data?.sessions ?? null;
  const liveWindow = data?.liveWindowMinutes ?? 30;

  const filtered = (sessions ?? []).filter((s) => {
    if (filter === 'live') return s.live;
    if (filter === 'closed') return !s.live;
    if (filter === 'redflag') return s.redFlags > 0;
    return true;
  });

  return (
    <div>
      <header>
        <p className="eyebrow">Admin</p>
        <h1 className="text-2xl font-extrabold text-stone-900">AI Chats</h1>
        <p className="mt-1 text-sm text-stone-500">
          What parents are asking mateo.ai — live and past conversations, and the red flags it caught. Read-only.
        </p>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      {/* Overview */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
        {counts === null ? (
          Array.from({ length: 6 }).map((_, i) => <Card key={i} className="p-4"><Skeleton className="h-12 w-full" /></Card>)
        ) : (
          <>
            <Stat label="Conversations" value={counts.sessions} tone="var(--cat-assistant)" icon={MessagesSquare} />
            <Stat label="Live now" value={counts.live} tone="#10b981" icon={Radio} />
            <Stat label="Questions asked" value={counts.questions} tone="#2f7fd6" icon={MessageCircle} />
            <Stat label="Red-flag alerts" value={counts.redFlags} tone="#e11d48" icon={AlertTriangle} />
            <Stat label="Active parents" value={counts.activeParents} tone="#7c5cfc" icon={Users} />
            <Stat label="Total messages" value={counts.messages} tone="#0891b2" icon={MessagesSquare} />
          </>
        )}
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-xs text-stone-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        “Live” means a message in the last {liveWindow} minutes. These are private health conversations — visible to admins only.
      </p>

      {/* Filter */}
      <div className="mt-5 inline-flex flex-wrap gap-0.5 rounded-xl bg-stone-100 p-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', filter === f.value ? 'bg-white text-stone-900 shadow-soft' : 'text-stone-500 hover:text-stone-700')}
          >
            {f.label}
            {f.value === 'redflag' && counts && counts.redFlags > 0 && <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 text-xs font-bold text-rose-700">{counts.redFlags}</span>}
          </button>
        ))}
      </div>

      {/* Session list */}
      <Card className="mt-3 overflow-x-auto p-0">
        {sessions === null ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-stone-500">{sessions.length === 0 ? 'No chats yet. Parents’ mateo.ai conversations will show up here.' : 'No chats match this filter.'}</p>
        ) : (
          <table className="w-full min-w-[860px] text-left text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Parent</th>
                <th className="px-5 py-3 font-semibold">Baby</th>
                <th className="px-5 py-3 font-semibold">Topic</th>
                <th className="px-5 py-3 font-semibold">Msgs</th>
                <th className="px-5 py-3 font-semibold">Flags</th>
                <th className="px-5 py-3 font-semibold">Last active</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((s: AdminChatRow) => (
                <tr key={s.id} className="cursor-pointer hover:bg-stone-50" onClick={() => openTranscript(s.id)}>
                  <td className="px-5 py-3">
                    {s.live ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        <LiveDot /> Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">Closed</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium text-stone-800">{s.parentName}</td>
                  <td className="px-5 py-3 text-stone-600">{s.babyName}</td>
                  <td className="px-5 py-3 text-stone-700"><span className="block max-w-[280px] truncate" title={s.title}>{s.title}</span></td>
                  <td className="px-5 py-3 text-stone-600">{s.messages}</td>
                  <td className="px-5 py-3">
                    {s.redFlags > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                        <AlertTriangle className="h-3 w-3" /> {s.redFlags}
                      </span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-stone-500">{timeAgo(s.lastMessageAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs font-semibold text-indigo-600">View</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Transcript modal */}
      {/* Portaled to <body>: the page's animated <main> has a transform, which
          would otherwise make this fixed overlay resolve against <main> instead
          of the viewport (off-centre, header clipped). */}
      {openId && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Chat transcript">
          <div className="absolute inset-0 bg-stone-900/40" onClick={closeTranscript} />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-lift">
            <header className="flex items-start justify-between gap-3 border-b border-stone-100 p-4">
              <div className="min-w-0">
                <h2 className="truncate font-bold text-stone-900">{transcript?.session.title ?? 'Conversation'}</h2>
                {transcript && (
                  <p className="mt-0.5 text-xs text-stone-500">
                    {transcript.session.parentName} · baby {transcript.session.babyName} · started {formatDateIST(transcript.session.createdAt)}
                    {transcript.session.live && <span className="ml-1 font-semibold text-emerald-600">· live</span>}
                  </p>
                )}
              </div>
              <button onClick={closeTranscript} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {transcriptLoading || !transcript ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-3/4" />
                  <Skeleton className="ml-auto h-12 w-2/3" />
                  <Skeleton className="h-12 w-3/4" />
                </div>
              ) : transcript.messages.length === 0 ? (
                <p className="py-6 text-center text-sm text-stone-500">This conversation has no messages.</p>
              ) : (
                transcript.messages.map((m) => (
                  <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                        m.role === 'user'
                          ? 'bg-indigo-50 text-stone-800'
                          : m.redFlagTriggered
                            ? 'border border-rose-200 bg-rose-50 text-rose-900'
                            : 'border border-stone-200 bg-white text-stone-700',
                      )}
                    >
                      {m.redFlagTriggered && (
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-rose-600">
                          <AlertTriangle className="h-3 w-3" /> Red-flag escalation
                        </p>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      <p className={cn('mt-1 text-[10px]', m.role === 'user' ? 'text-indigo-400' : 'text-stone-400')}>
                        {m.role === 'user' ? transcript.session.parentName : 'mateo.ai'} · {formatDateIST(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <footer className="flex items-start gap-1.5 border-t border-stone-100 px-4 py-2.5 text-[11px] text-stone-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Private health conversation — shown to admins for support and safety oversight only.
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
