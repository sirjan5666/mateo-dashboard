import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { ImagePlus, Send, X } from 'lucide-react';
import { listConsultationMessages, sendConsultationMessage } from '../api/consultationChat';
import type { ChatMessage } from '../api/consultationChat';
import { ApiError } from '../api/client';
import { formatDateTimeIST } from '../lib/age';
import { Skeleton } from './ui/Skeleton';
import { cn } from '../lib/cn';

export function ConsultationChat({ consultationId }: { consultationId: string }) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [myRole, setMyRole] = useState<'parent' | 'doctor' | null>(null);
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listConsultationMessages(consultationId)
      .then((d) => {
        if (!cancelled) {
          setMessages(d.messages);
          setMyRole(d.role);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
      });
    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function submit() {
    if ((!text.trim() && !image) || sending) return;
    setSending(true);
    setError(null);
    try {
      const resp = await sendConsultationMessage(consultationId, { text: text.trim() || undefined, image: image ?? undefined });
      setMessages((prev) => [...(prev ?? []), resp.message]);
      setText('');
      setImage(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong, please try again');
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-stone-200 bg-white">
      <div data-lenis-prevent className="max-h-[55vh] min-h-[220px] flex-1 space-y-3 overflow-y-auto p-4">
        {messages === null ? (
          <>
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
          </>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-400">No messages yet. Start the conversation.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderRole === myRole;
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm', mine ? 'rounded-br-sm bg-emerald-600 text-white' : 'rounded-bl-sm border border-stone-200 bg-stone-50 text-stone-800')}>
                  {!mine && <p className="mb-0.5 text-xs font-semibold opacity-70">{m.senderRole === 'doctor' ? 'Doctor' : 'Parent'}</p>}
                  {m.imageUrl && (
                    <a href={m.imageUrl} target="_blank" rel="noreferrer">
                      <img src={m.imageUrl} alt="attachment" className="mb-1 max-h-48 rounded-lg" />
                    </a>
                  )}
                  {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                  <p className={cn('mt-1 text-[10px]', mine ? 'text-emerald-100' : 'text-stone-400')}>{formatDateTimeIST(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-sm text-rose-600">{error}</p>}

      <form onSubmit={handleSubmit} className="border-t border-stone-100 p-3">
        {image && (
          <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
            <span className="truncate">📎 {image.name}</span>
            <button
              type="button"
              onClick={() => {
                setImage(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              aria-label="Remove image"
              className="text-rose-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach image" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-50">
            <ImagePlus className="h-4 w-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="hidden" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type a message…"
            className="max-h-28 flex-1 resize-none rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-400 focus:outline-none"
          />
          <button type="submit" disabled={sending || (!text.trim() && !image)} aria-label="Send" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white transition-colors hover:bg-emerald-800 disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
