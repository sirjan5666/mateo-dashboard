// Browser-native voice helpers (Web Speech API) — no server, no keys. Everything
// degrades gracefully when the browser doesn't support it (Chrome is best).

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechRecognitionSupported = recognitionCtor() !== null;
export const speechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Map the app language to a BCP-47 voice locale.
export function voiceLocale(lang: string): string {
  return lang === 'hi' ? 'hi-IN' : 'en-IN';
}

export function createRecognition(lang: string): SpeechRecognitionLike | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = voiceLocale(lang);
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  return rec;
}

// The browser loads voices asynchronously, so cache them and refresh on the
// 'voiceschanged' event (fires once the list is ready, esp. in Chrome).
let voicesCache: SpeechSynthesisVoice[] = [];
function loadVoices() {
  if (speechSynthesisSupported) voicesCache = window.speechSynthesis.getVoices();
}
if (speechSynthesisSupported) {
  loadVoices();
  try {
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  } catch {
    /* ignore */
  }
}

// Dai Maa has an attractive female voice. Prefer (in order) a natural/neural voice,
// then a known-pleasant named female voice, then Google, then any female — and
// only fall back to a non-female voice if the language has none.
const PREMIUM_FEMALE = /\b(aria|jenny|emma|ava|libby|sonia|michelle|samantha|karen|victoria|tessa|serena|moira|fiona|swara)\b/i;
const FEMALE_HINT = /(female|woman|girl|\bheera\b|\bkalpana\b|\bzira\b|\bneerja\b|\bananya\b|\bpriya\b|\bveena\b|\braveena\b)/i;
function isFemaleVoice(v: SpeechSynthesisVoice): boolean {
  return PREMIUM_FEMALE.test(v.name) || FEMALE_HINT.test(v.name);
}
function voiceScore(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  let s = 0;
  if (/natural|neural|online/.test(n)) s += 50; // Edge/cloud natural voices sound best
  if (PREMIUM_FEMALE.test(v.name)) s += 25; // Aria, Jenny, Samantha, Swara
  if (/google/.test(n)) s += 15; // Google voices are natural too
  if (/\bzira\b/.test(n)) s += 8; // common Windows en-US female (nicer than Heera)
  return s;
}
function pickVoice(locale: string): SpeechSynthesisVoice | null {
  if (!voicesCache.length) loadVoices();
  const voices = voicesCache;
  if (!voices.length) return null;
  const base = locale.toLowerCase().split('-')[0];
  const pool = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const candidates = pool.length ? pool : voices;
  const female = candidates.filter(isFemaleVoice);
  // Among female voices (or all, if none are clearly female), the nicest wins.
  return (female.length ? female : candidates).slice().sort((a, b) => voiceScore(b) - voiceScore(a))[0] ?? null;
}

// Sanitise text for TEXT-TO-SPEECH ONLY — the on-screen message is never changed.
// Removes emoji/pictographs/flags/skin-tones/ZWJ/variation-selectors and markdown
// noise, unwraps [label](url) -> label, turns em/en dashes into a natural comma
// pause (never the word "dash"), and KEEPS normal sentence punctuation for
// intonation. Devanagari/Hindi text is left untouched (only emoji + markdown go).
export function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [label](url) -> label
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // # headings
    .replace(/^[ \t]*[-\u{2022}*]\s+/gmu, '') // leading bullet markers (-, bullet, *)
    .replace(/\*\*|__|[*_`~]/g, '') // **bold** _italic_ `code` ~strike~ markers
    // emoji, pictographs, flags, skin-tone modifiers + TM/info glyphs (property escapes)
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}]/gu, '')
    // ZWJ, keycap combiner, bullet and variation selectors — alternation (NOT a
    // character class) so the no-misleading-character-class lint rule stays happy.
    .replace(/\u{200D}|\u{20E3}|\u{2022}|\u{FE0E}|\u{FE0F}/gu, '')
    .replace(/\s*[\u{2014}\u{2013}]\s*/gu, ', ') // em/en dash -> comma pause
    .replace(/\s+-\s+/g, ', ') // spaced hyphen -> comma pause
    .replace(/[ \t]{2,}/g, ' ') // collapse runs of spaces (e.g. where an emoji was)
    .replace(/[ \t]+\n/g, '\n') // drop trailing spaces left at line ends
    .replace(/\s+([,.;:!?])/g, '$1') // no space before punctuation
    .replace(/,(\s*,)+/g, ',') // dedupe commas
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// Speak `text` aloud in an attractive female voice. The text is first run through
// cleanTextForSpeech (strips emoji + markdown) — only the SPOKEN copy is cleaned,
// never the on-screen message. Voice is chosen by SCRIPT (Devanagari -> a Hindi
// voice) so it reads fluently whatever language Dai Maa replied in. `onend` fires
// when it stops.
export function speak(text: string, lang: string, opts?: { onend?: () => void }): void {
  if (!speechSynthesisSupported) {
    opts?.onend?.();
    return;
  }
  const spoken = cleanTextForSpeech(text);
  if (!spoken) {
    opts?.onend?.(); // e.g. an emoji-only message -> nothing to read
    return;
  }
  try {
    window.speechSynthesis.cancel(); // stop any in-flight speech so clicks don't stack
    const locale = /\p{Script=Devanagari}/u.test(spoken) ? 'hi-IN' : voiceLocale(lang);
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = locale;
    const v = pickVoice(locale);
    if (v) u.voice = v;
    u.rate = 1.0;
    u.pitch = 1.05; // gently warmer, natural female tone
    u.onend = () => opts?.onend?.();
    u.onerror = () => opts?.onend?.();
    window.speechSynthesis.speak(u);
  } catch {
    opts?.onend?.();
  }
}

export function stopSpeaking(): void {
  if (!speechSynthesisSupported) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
