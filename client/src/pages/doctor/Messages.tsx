import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ExternalLink, MessageSquare } from 'lucide-react';
import { ApiError } from '../../api/client';
import { listMessages, listThreads, sendMessage } from '../../api/doctorMessages';
import type { ThreadSummary } from '../../api/doctorMessages';
import { MessageThread } from '../../components/MessageThread';
import type { ThreadMessage } from '../../components/MessageThread';
import { useT } from '../../i18n/context';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { BrandTile } from '../../components/ui/BrandTile';
import { cn } from '../../lib/cn';

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date().toLocaleDateString('en-CA');
  return d.toLocaleDateString('en-CA') === today
    ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function Messages() {
  const t = useT();
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [selected, setSelected] = useState<ThreadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listThreads()
      .then((d) => {
        if (cancelled) return;
        // Auto-open the first thread; opening it marks it read, so clear its chip too.
        const first = d.threads[0] ?? null;
        setThreads(first ? d.threads.map((t) => (t.patientId === first.patientId ? { ...t, unread: 0 } : t)) : d.threads);
        setSelected(first);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load messages');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function open(t: ThreadSummary) {
    setSelected(t);
    // Optimistically clear this thread's unread (opening it marks it read server-side).
    setThreads((prev) => prev?.map((x) => (x.patientId === t.patientId ? { ...x, unread: 0 } : x)) ?? prev);
  }

  return (
    <div>
      <header className="flex items-center gap-3">
        <BrandTile icon={MessageSquare} iconClassName="h-6 w-6" className="h-12 w-12 rounded-2xl shadow-soft" />
        <div>
          <p className="eyebrow">Doctor</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight text-stone-900">{t('doctor.messages.title')}</h1>
          <p className="text-sm text-stone-500">{t('doctor.messages.subtitle')}</p>
        </div>
      </header>

      {error && <Card className="mt-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

      <div className="mt-5 grid gap-4 lg:grid-cols-[330px_1fr]">
        {/* Thread list */}
        <Card className={cn('overflow-hidden p-2', selected && 'hidden lg:block')}>
          {threads === null ? (
            <p className="p-4 text-sm text-stone-500">{t('doctor.messages.loading')}</p>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
              <MessageSquare className="h-6 w-6 text-stone-300" />
              <p className="text-sm text-stone-500">{t('doctor.messages.noConvos')}</p>
              <p className="text-xs text-stone-400">{t('doctor.messages.noConvosHint')}</p>
            </div>
          ) : (
            <div data-lenis-prevent className="max-h-[70vh] space-y-0.5 overflow-y-auto">
              {threads.map((th) => (
                <button
                  key={th.patientId}
                  onClick={() => open(th)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors',
                    selected?.patientId === th.patientId ? 'bg-emerald-50' : 'hover:bg-stone-50',
                  )}
                >
                  <Avatar name={th.patientName} size="sm" hashColor />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-stone-800">{th.patientName}</p>
                      <span className="ml-auto shrink-0 text-[10px] tabular-nums text-stone-400">{fmtWhen(th.lastAt)}</span>
                    </div>
                    <p className={cn('truncate text-xs', th.unread > 0 ? 'font-semibold text-stone-700' : 'text-stone-500')}>
                      {th.lastSender === 'doctor' ? t('doctor.messages.you') : ''}
                      {th.lastBody}
                    </p>
                  </div>
                  {th.unread > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-rose-500 px-1.5 text-[0.7rem] font-bold tabular-nums text-white">{th.unread}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Conversation */}
        <Card className={cn('flex flex-col p-5', !selected && 'hidden lg:flex')}>
          {selected ? (
            <>
              <div className="mb-3 flex items-center gap-3 border-b border-stone-100 pb-3">
                <button onClick={() => setSelected(null)} className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 lg:hidden">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Avatar name={selected.patientName} size="sm" hashColor />
                <p className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-stone-900">{selected.patientName}</p>
                <Link to={`/doctor/patients/${selected.patientId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('doctor.messages.openChart')}
                </Link>
              </div>
              <Conversation key={selected.patientId} patientId={selected.patientId} />
            </>
          ) : (
            <div className="grid flex-1 place-items-center py-16 text-center text-sm text-stone-400">{t('doctor.messages.selectConvo')}</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Conversation({ patientId }: { patientId: string }) {
  const t = useT();
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMessages(patientId)
      .then((d) => !cancelled && setMessages(d.messages))
      .catch(() => !cancelled && setMessages([]));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  async function onSend(body: string) {
    const { message } = await sendMessage(patientId, body);
    setMessages((prev) => [...(prev ?? []), message]);
  }

  return <MessageThread messages={messages} onSend={onSend} emptyHint={t('doctor.messages.emptyThread')} />;
}
