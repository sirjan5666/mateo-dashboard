import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Mic, Send, Sparkles, X } from 'lucide-react';
import { listBabies } from '../../api/babies';
import type { Baby } from '../../api/babies';
import { ASSISTANT_BY, ASSISTANT_NAME, QUICK_CHIPS, SUGGESTED_QUESTIONS, askAssistantLink } from '../../lib/assistant';
import { useTypewriter } from '../../lib/useTypewriter';
import { useVoiceInput } from '../../lib/useVoiceInput';
import { AssistantMark } from './AssistantMark';
import { cn } from '../../lib/cn';

// Dai Maa, on every page: a floating launcher (bottom-right) that opens a small ask
// panel and routes the question into a fresh chat thread for the active baby.
export function AssistantLauncher() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [babies, setBabies] = useState<Baby[] | null>(null);
  const [input, setInput] = useState('');
  const typed = useTypewriter(SUGGESTED_QUESTIONS);
  const voice = useVoiceInput((text) => setInput((p) => (p ? `${p} ${text}` : text)));
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Refetch on navigation so a newly-added baby (or going from zero→one) is picked
  // up without a full reload (AppShell — and this launcher — persist across routes).
  useEffect(() => {
    let cancelled = false;
    listBabies()
      .then((r) => !cancelled && setBabies(r.babies))
      .catch(() => !cancelled && setBabies([]));
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const activeBaby = useMemo(() => {
    if (!babies || babies.length === 0) return null;
    const saved = localStorage.getItem('mateo:activeBaby');
    return babies.find((b) => b.id === saved) ?? babies[0];
  }, [babies]);

  // While open: focus the input, close on Escape, close on outside click.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      clearTimeout(t);
    };
  }, [open]);

  // Return focus to the FAB when the panel closes (not on first mount).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) btnRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Hide on the full chat page (redundant there) and until a baby exists. Match the
  // parent chat route exactly so the admin "/chats" page isn't caught by a substring.
  const onChat = /\/babies\/[^/]+\/chat$/.test(location.pathname);
  if (onChat || !activeBaby) return null;

  function ask(question: string) {
    const q = question.trim();
    // Re-read the active baby at click time so a baby switch since mount is honoured.
    const saved = localStorage.getItem('mateo:activeBaby');
    const target = babies?.find((b) => b.id === saved) ?? activeBaby;
    if (!q || !target) return;
    navigate(askAssistantLink(target.id, q));
    setOpen(false);
    setInput('');
  }

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`Ask ${ASSISTANT_NAME}`}
          className="animate-popin fixed bottom-24 right-4 z-40 w-[330px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-stone-200/70 bg-white shadow-lift sm:right-6"
        >
          {/* Header on the brand gradient */}
          <div className="relative flex items-center gap-3 px-4 py-3.5" style={{ background: 'linear-gradient(135deg, #6d4ff0 0%, #6b48ef 55%, #8b35d8 100%)' }}>
            <AssistantMark variant="tile" size={40} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold leading-tight text-white">{ASSISTANT_NAME}</p>
              <p className="text-[0.7rem] font-medium text-white/80">{ASSISTANT_BY} · {activeBaby.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4">
            <p className="text-sm leading-relaxed text-stone-600">
              Hi! I’m {ASSISTANT_NAME} 👋 Ask me anything about {activeBaby.name}’s sleep, feeding, skin or milestones.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="mt-3"
            >
              <div className="relative flex items-center gap-1.5 rounded-2xl bg-stone-100 p-1.5 pl-3 transition-colors focus-within:bg-stone-50">
                <div className="relative min-w-0 flex-1">
                  {/* The self-typing text is decorative (aria-hidden) so its churn never
                      reaches a screen reader on the auto-focused input. */}
                  {!input && (
                    <span aria-hidden="true" className={cn('pointer-events-none absolute inset-0 flex items-center truncate text-sm', voice.listening ? 'font-medium text-rose-500' : 'text-stone-400')}>
                      {voice.listening ? 'Listening…' : `${typed}▏`}
                    </span>
                  )}
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder=""
                    aria-label={`Ask ${ASSISTANT_NAME} a question`}
                    className="w-full min-w-0 bg-transparent text-sm text-stone-900 focus:outline-none"
                  />
                </div>
                {voice.supported && (
                  <button
                    type="button"
                    onClick={voice.toggle}
                    aria-label={voice.listening ? 'Stop listening' : 'Speak your question'}
                    aria-pressed={voice.listening}
                    className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors', voice.listening ? 'animate-pulse bg-rose-100 text-rose-600' : 'text-stone-500 hover:bg-stone-200')}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Ask"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white shadow-soft transition-opacity disabled:opacity-40"
                  style={{ background: 'var(--brand-gradient)' }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => ask(c)}
                  className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  {c}
                </button>
              ))}
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-stone-400">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
              {ASSISTANT_NAME} gives general guidance, not a diagnosis — for anything worrying, see your pediatrician.
            </p>
          </div>
        </div>
      )}

      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? `Close ${ASSISTANT_NAME}` : `Ask ${ASSISTANT_NAME}`}
        className={cn(
          'pop-hover fixed bottom-5 right-4 z-40 inline-flex items-center gap-2 rounded-full p-2 shadow-lift transition-colors sm:right-6',
          open ? 'bg-stone-900/90 text-white' : 'bg-white text-stone-800',
        )}
      >
        {open ? (
          <span className="grid h-9 w-9 place-items-center">
            <X className="h-5 w-5" />
          </span>
        ) : (
          <>
            <AssistantMark variant="tile" size={38} />
            <span className="hidden pr-1.5 text-sm font-bold sm:inline">Ask {ASSISTANT_NAME}</span>
          </>
        )}
      </button>
    </>
  );
}
