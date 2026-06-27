import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, ArrowLeft, Check, History, Mic, Plus, Send, ShieldCheck, Square, Stethoscope, Trash2, Volume2, X } from 'lucide-react';
import { getBaby } from '../api/babies';
import type { Baby } from '../api/babies';
import { deleteSession, getSession, listSessions, sendChat } from '../api/chat';
import type { ChatMessage, ChatSession } from '../api/chat';
import { ApiError } from '../api/client';
import { useLang } from '../i18n/context';
import { createRecognition, speak, speechRecognitionSupported, speechSynthesisSupported, stopSpeaking } from '../lib/speech';
import type { SpeechRecognitionLike } from '../lib/speech';
import { formatAge, toDateInputValueIST, todayInputValueIST } from '../lib/age';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { AssistantMark } from '../components/assistant/AssistantMark';
import { ASSISTANT_BY, ASSISTANT_NAME } from '../lib/assistant';
import { cn } from '../lib/cn';
import { gsap, prefersReducedMotion } from '../lib/gsap';

const DISCLAIMER = `${ASSISTANT_NAME} shares general guidance, not a diagnosis. For anything that worries you, please see your pediatrician.`;

const EXAMPLES = [
  'Is my baby’s weight on track?',
  'What foods can I start at 6 months?',
  'How do I care for dry baby skin?',
];

// Bucket the chat list into recent → older sections for the side panel.
const GROUP_ORDER = ['Today', 'Previous 7 days', 'Older'] as const;
type GroupLabel = (typeof GROUP_ORDER)[number];

function groupSessions(sessions: ChatSession[]): { label: GroupLabel; items: ChatSession[] }[] {
  const today = todayInputValueIST();
  const todayMs = Date.parse(today);
  const groups: Record<GroupLabel, ChatSession[]> = { Today: [], 'Previous 7 days': [], Older: [] };
  for (const s of sessions) {
    const day = toDateInputValueIST(s.lastMessageAt);
    const diffDays = (todayMs - Date.parse(day)) / 86_400_000;
    const label: GroupLabel = day === today ? 'Today' : diffDays <= 7 ? 'Previous 7 days' : 'Older';
    groups[label].push(s);
  }
  return GROUP_ORDER.map((label) => ({ label, items: groups[label] })).filter((g) => g.items.length > 0);
}

export default function Chat() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  // A question handed off from the dashboard ask-bar / floating Tara launcher.
  // Read once on mount; the initial-load effect opens it as a fresh thread.
  const initialQ = useRef<string | null>(searchParams.get('q'));
  const [baby, setBaby] = useState<Baby | null>(null);
  const [sessions, setSessions] = useState<ChatSession[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [assistantEnabled, setAssistantEnabled] = useState(true);
  const { lang } = useLang();
  const [listening, setListening] = useState(false);
  // Which assistant message is being read aloud right now (per-message Listen).
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = createRecognition(lang);
    if (!rec) return;
    recognitionRef.current = rec;
    stopSpeaking();
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? '';
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  // Read one assistant message aloud on demand (Tara only speaks when asked).
  function toggleSpeak(m: ChatMessage) {
    if (speakingId === m.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(m.id);
    speak(m.content, lang, { onend: () => setSpeakingId((cur) => (cur === m.id ? null : cur)) });
  }
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tempId = useRef(0);

  // Initial load: baby + chat list, then open the most recent thread.
  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const [b, list] = await Promise.all([getBaby(id), listSessions(id)]);
        if (cancelled) return;
        setBaby(b.baby);
        setSessions(list.sessions);
        setAssistantEnabled(list.assistantEnabled);
        // Handed-off question → open a brand-new thread and send it immediately.
        if (initialQ.current) {
          const q = initialQ.current;
          initialQ.current = null;
          setSearchParams({}, { replace: true }); // strip ?q so a refresh won't resend
          setActiveId(null);
          setMessages([]);
          void send(q, { newThread: true });
          return;
        }
        const first = list.sessions[0];
        if (first) {
          setActiveId(first.id);
          const thread = await getSession(id, first.id);
          if (cancelled) return;
          setMessages(thread.messages);
          setAssistantEnabled(thread.assistantEnabled);
        } else {
          setMessages([]);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-time load + one-shot ?q hand-off; send/setSearchParams intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Open an existing thread from the side list.
  async function openSession(sid: string) {
    if (id === undefined || sid === activeId) {
      setPanelOpen(false);
      return;
    }
    setActiveId(sid);
    setMessages(null);
    setError(null);
    setConfirmDeleteId(null);
    setPanelOpen(false);
    try {
      const thread = await getSession(id, sid);
      setMessages(thread.messages);
      setAssistantEnabled(thread.assistantEnabled);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      setMessages([]);
    }
  }

  // Start a fresh conversation — the first message will create the thread.
  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setInput('');
    setError(null);
    setConfirmDeleteId(null);
    setPanelOpen(false);
    inputRef.current?.focus();
  }

  async function handleDelete(sid: string) {
    if (id === undefined) return;
    setDeletingId(sid);
    setConfirmDeleteId(null);
    try {
      await deleteSession(id, sid);
      const remaining = (sessions ?? []).filter((s) => s.id !== sid);
      setSessions(remaining);
      if (sid === activeId) {
        if (remaining[0]) await openSession(remaining[0].id);
        else startNewChat();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setDeletingId(null);
    }
  }

  async function send(text: string, opts?: { newThread?: boolean }) {
    if (id === undefined || !text.trim() || sending) return;
    const content = text.trim();
    setInput('');
    setError(null);
    setSending(true);
    const optimistic: ChatMessage = {
      id: `temp-${(tempId.current += 1)}`,
      role: 'user',
      content,
      redFlagTriggered: false,
      createdAt: '',
    };
    setMessages((prev) => [...(opts?.newThread ? [] : prev ?? []), optimistic]);
    try {
      const resp = await sendChat(id, content, opts?.newThread ? undefined : activeId ?? undefined, lang);
      setActiveId(resp.sessionId);
      setMessages((prev) => [...(prev ?? []).filter((m) => m.id !== optimistic.id), ...resp.messages]);
      if (resp.assistantEnabled === false) setAssistantEnabled(false);
      // Move/insert this thread to the top of the list with its (possibly new) title.
      setSessions((prev) => [resp.session, ...(prev ?? []).filter((s) => s.id !== resp.session.id)]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      // The server may have saved the message in a new thread — refresh the list
      // so it’s reachable (the optimistic bubble stays visible meanwhile).
      try {
        const list = await listSessions(id);
        setSessions(list.sessions);
      } catch {
        // keep the current view
      }
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const groups = sessions ? groupSessions(sessions) : [];

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <AssistantMark variant="tile" size={48} className="shrink-0" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold text-stone-900">{ASSISTANT_NAME}</h1>
          {baby ? (
            <p className="truncate text-sm text-stone-500">
              {baby.name} · {formatAge(baby.dob)}
            </p>
          ) : (
            <p className="text-sm text-stone-500">{ASSISTANT_BY}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/find-doctor"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 shadow-soft hover:bg-stone-50"
          >
            <Stethoscope className="h-4 w-4" />
            <span className="hidden sm:inline">Talk to a doctor</span>
            <span className="sm:hidden">Doctor</span>
          </Link>
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 shadow-soft hover:bg-stone-50 lg:hidden"
          >
            <History className="h-4 w-4" />
            Chats{sessions ? ` (${sessions.length})` : ''}
          </button>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Side panel — chat sessions */}
        <aside className={cn('lg:block', panelOpen ? 'block' : 'hidden')}>
          <div className="space-y-3 lg:sticky lg:top-6">
            <button
              type="button"
              onClick={startNewChat}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-emerald-800"
            >
              <Plus className="h-4 w-4" />
              New chat
            </button>

            <div className="rounded-2xl border border-stone-200 bg-white p-2 shadow-soft">
              <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
                {sessions === null ? (
                  <div className="space-y-2 p-1">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-5/6" />
                    <Skeleton className="h-8 w-2/3" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="px-2 py-8 text-center text-xs text-stone-400">
                    Your conversations will show up here.
                  </p>
                ) : (
                  groups.map((group) => (
                    <div key={group.label}>
                      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                        {group.label}
                      </p>
                      <ul className="space-y-0.5">
                        {group.items.map((s) => {
                          const active = s.id === activeId;
                          return (
                            <li
                              key={s.id}
                              className={cn(
                                'flex items-center gap-1 rounded-xl pr-1 transition-colors',
                                active ? 'bg-emerald-50' : 'hover:bg-stone-100',
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => void openSession(s.id)}
                                className={cn(
                                  'min-w-0 flex-1 truncate px-3 py-2 text-left text-sm',
                                  active ? 'font-semibold text-emerald-800' : 'text-stone-600',
                                )}
                                title={s.title}
                              >
                                {s.title}
                              </button>
                              {confirmDeleteId === s.id ? (
                                <span className="flex shrink-0 items-center">
                                  <button
                                    type="button"
                                    onClick={() => void handleDelete(s.id)}
                                    disabled={deletingId === s.id}
                                    aria-label="Confirm delete chat"
                                    className="grid h-7 w-7 place-items-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    aria-label="Cancel delete"
                                    className="grid h-7 w-7 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(s.id)}
                                  disabled={deletingId === s.id}
                                  aria-label={`Delete chat: ${s.title}`}
                                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-300 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Conversation */}
        <section className="flex min-h-[calc(100vh-12rem)] flex-col">
          <div className="flex-1 space-y-4">
            {messages === null ? (
              <>
                <Skeleton className="h-16 w-2/3" />
                <Skeleton className="ml-auto h-12 w-1/2" />
              </>
            ) : messages.length === 0 ? (
              <Card className="p-6 text-center">
                <img src="/owl-assistant.png" alt={`${ASSISTANT_NAME} the owl`} className="animate-float mx-auto h-36 w-auto" />
                <h2 className="mt-2 font-display text-xl font-semibold text-stone-800">Ask anything about {baby?.name ?? 'your baby'}’s care</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
                  I use your baby’s age and tracker data to answer. I’m not a doctor — I’ll always point you to one
                  when it matters.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => void send(ex)}
                      className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </Card>
            ) : (
              messages.map((m) => <Bubble key={m.id} message={m} speaking={speakingId === m.id} onListen={() => toggleSpeak(m)} />)
            )}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-stone-400">
                <span className="h-2 w-2 animate-bounce rounded-full bg-stone-300" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-stone-300 [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-stone-300 [animation-delay:240ms]" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

          {!assistantEnabled && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              The AI assistant isn’t switched on yet (no API key configured). Your messages are saved, and the
              urgent safety checks still run on everything you send.
            </p>
          )}

          <form onSubmit={handleSubmit} className="sticky bottom-0 mt-4 bg-stone-50 pb-2 pt-2">
            <div className="flex items-end gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-soft focus-within:border-emerald-400">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={listening ? 'Listening…' : 'Ask about feeding, sleep, skin, milestones…'}
                className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-stone-900 placeholder:text-stone-400 focus:outline-none"
              />
              {speechRecognitionSupported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={listening ? 'Stop voice input' : 'Speak your question'}
                  title={listening ? 'Stop' : 'Speak your question'}
                  className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors', listening ? 'animate-pulse bg-rose-100 text-rose-600' : 'text-stone-500 hover:bg-stone-100')}
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Send"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white transition-colors hover:bg-emerald-800 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

// A small "Listen" toggle under each assistant reply — Tara reads it aloud only
// when asked (no auto-speak), and shows "Stop" while speaking.
function ListenButton({ speaking, onClick }: { speaking: boolean; onClick: () => void }) {
  if (!speechSynthesisSupported) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={speaking}
      aria-label={speaking ? 'Stop reading aloud' : 'Listen to this reply'}
      className={cn('mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors', speaking ? 'bg-emerald-50 text-emerald-700' : 'text-stone-500 hover:bg-stone-100')}
    >
      {speaking ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
      {speaking ? 'Stop' : 'Listen'}
    </button>
  );
}

function Bubble({ message, speaking, onListen }: { message: ChatMessage; speaking: boolean; onListen: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Slide new bubbles in (user from the right, assistant from the left). The
  // red-flag escalation is deliberately NOT animated — urgent-care guidance must
  // appear instantly, never gated behind motion.
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || message.redFlagTriggered) return;
    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: 12, x: message.role === 'user' ? 16 : -10 },
      { opacity: 1, y: 0, x: 0, duration: 0.4, ease: 'power2.out', overwrite: 'auto', immediateRender: false },
    );
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: 'opacity,transform' });
    };
  }, [message.redFlagTriggered, message.role]);

  if (message.role === 'user') {
    return (
      <div ref={ref} className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-2.5 text-white">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.redFlagTriggered) {
    return (
      <div ref={ref} className="max-w-[92%]">
        <div className="rounded-2xl rounded-bl-sm border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            Please seek medical care
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-rose-900">{message.content}</p>
        </div>
        <ListenButton speaking={speaking} onClick={onListen} />
        <Disclaimer />
      </div>
    );
  }

  return (
    <div ref={ref} className="max-w-[85%]">
      <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-stone-200 bg-white px-4 py-2.5 text-stone-700">
        {message.content}
      </div>
      <ListenButton speaking={speaking} onClick={onListen} />
      <Disclaimer />
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 px-1 text-[11px] text-stone-500">
      <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
      {DISCLAIMER}
    </p>
  );
}
