import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './gsap';

/**
 * Cycles a list of phrases with a typewriter effect — types a phrase out, holds,
 * deletes it, then moves to the next. Returns the current visible substring (use
 * it as an input placeholder). Under prefers-reduced-motion it skips the per-
 * character animation and simply rotates the full phrases on a calm interval.
 */
export function useTypewriter(
  phrases: string[],
  opts: { typeMs?: number; deleteMs?: number; holdMs?: number; startMs?: number } = {},
): string {
  const { typeMs = 48, deleteMs = 26, holdMs = 1500, startMs = 500 } = opts;
  // Non-motion: start empty so the type-on reads cleanly. Reduced-motion: show
  // the first phrase right away (no per-char animation), then rotate on a timer.
  const [text, setText] = useState(() => (prefersReducedMotion() ? phrases[0] ?? '' : ''));

  useEffect(() => {
    if (phrases.length === 0) return;

    if (prefersReducedMotion()) {
      let i = 0;
      const id = setInterval(() => {
        i = (i + 1) % phrases.length;
        setText(phrases[i]);
      }, 3200);
      return () => clearInterval(id);
    }

    let timer: ReturnType<typeof setTimeout>;
    let phase: 'typing' | 'holding' | 'deleting' = 'typing';
    let phraseI = 0;
    let charI = 0;

    const tick = () => {
      const phrase = phrases[phraseI] ?? '';
      if (phase === 'typing') {
        charI += 1;
        setText(phrase.slice(0, charI));
        if (charI >= phrase.length) {
          phase = 'holding';
          timer = setTimeout(tick, holdMs);
        } else {
          timer = setTimeout(tick, typeMs);
        }
      } else if (phase === 'holding') {
        phase = 'deleting';
        timer = setTimeout(tick, deleteMs);
      } else {
        charI -= 1;
        setText(phrase.slice(0, Math.max(0, charI)));
        if (charI <= 0) {
          phraseI = (phraseI + 1) % phrases.length;
          phase = 'typing';
          timer = setTimeout(tick, typeMs);
        } else {
          timer = setTimeout(tick, deleteMs);
        }
      }
    };

    timer = setTimeout(tick, startMs);
    return () => clearTimeout(timer);
  }, [phrases, typeMs, deleteMs, holdMs, startMs]);

  return text;
}
