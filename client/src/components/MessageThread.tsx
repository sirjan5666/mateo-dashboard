import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { ApiError } from '../api/client';
import { buttonClass } from './ui/buttonStyles';
import { cn } from '../lib/cn';

export interface ThreadMessage {
  id: string;
  senderRole: 'doctor' | 'patient';
  body: string;
  mine: boolean;
  createdAt: string;
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Presentational chat thread + composer. Parent owns the message list and onSend. */
export function MessageThread({
  messages,
  onSend,
  emptyHint = 'No messages yet.',
}: {
  messages: ThreadMessage[] | null;
  onSend: (body: string) => Promise<void>;
  emptyHint?: string;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function submit() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(body);
      setText('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send your message');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div data-lenis-prevent className="max-h-[26rem] space-y-2.5 overflow-y-auto rounded-2xl bg-stone-50/60 p-3">
        {messages === null ? (
          <p className="py-6 text-center text-sm text-stone-400">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-400">{emptyHint}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm',
                  m.mine ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md bg-white text-stone-800 shadow-soft',
                )}
              >
                {m.body}
              </div>
              <span className="mt-0.5 px-1 text-[10px] text-stone-400">{fmtWhen(m.createdAt)}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Write a message…"
          className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-stone-300 px-3 py-2.5 text-stone-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <button onClick={() => void submit()} disabled={sending || !text.trim()} className={buttonClass('primary', 'md')}>
          <Send className="h-4 w-4" />
          Send
        </button>
      </div>
    </div>
  );
}
