import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

export { gsap };

/**
 * Honour the OS "reduce motion" setting. Every animation in the app checks this
 * first and bails out — matching the same rule already enforced in index.css.
 * This is a gentle health app for tired parents; motion must always be optional.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface RevealOptions {
  /** Which elements to reveal. Defaults to the scope's direct children. */
  selector?: string;
  y?: number;
  stagger?: number;
  duration?: number;
  delay?: number;
}

/**
 * Stagger the scope's children in (fade + gentle rise) once they mount.
 * Re-runs whenever `dependencies` change — pass the "data loaded" flag so the
 * reveal plays over the real content rather than the skeleton.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  dependencies: unknown[] = [],
  options: RevealOptions = {},
) {
  const scope = useRef<T>(null);
  const { selector = ':scope > *', y = 16, stagger = 0.07, duration = 0.5, delay = 0 } = options;
  // Plain useEffect with an explicit kill + clearProps cleanup. This is more
  // robust than useGSAP's auto-revert, which under StrictMode's double-mount can
  // record a half-applied (opacity:0) state and strand elements hidden. The
  // cleanup always returns targets to their natural state before any re-run.
  useEffect(
    () => {
      const root = scope.current;
      if (!root || prefersReducedMotion()) return;
      const targets = Array.from(root.querySelectorAll(selector));
      if (!targets.length) return;
      // fromTo with an explicit end (not `.from`, whose end is read from the live
      // DOM) so a clean opacity:1 / y:0 is always the destination.
      const tween = gsap.fromTo(
        targets,
        { opacity: 0, y },
        { opacity: 1, y: 0, duration, stagger, delay, ease: 'power2.out', overwrite: 'auto' },
      );
      return () => {
        tween.kill();
        gsap.set(targets, { clearProps: 'opacity,transform' });
      };
    },
    // Re-run only when the caller's dependencies change (e.g. data loaded).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    dependencies,
  );
  return scope;
}

/**
 * Reveal a list of items (fade + rise) in a soft cascade once they render. Tag
 * the items with the selector (default `[data-reveal]`) and pass the data in
 * `dependencies` so the reveal plays over the real content. The total stagger is
 * time-capped, so even long lists finish quickly. Mount-driven (not scroll-
 * driven) on purpose — reliable in an SPA where async content and route changes
 * make scroll-position math fragile.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  dependencies: unknown[] = [],
  options: { selector?: string; y?: number } = {},
) {
  const scope = useRef<T>(null);
  const { selector = '[data-reveal]', y = 18 } = options;
  useEffect(
    () => {
      const root = scope.current;
      if (!root || prefersReducedMotion()) return;
      const items = Array.from(root.querySelectorAll(selector));
      if (!items.length) return;
      // Explicit fromTo + clearProps cleanup (see useReveal) so re-runs on add /
      // delete never strand items hidden.
      const tween = gsap.fromTo(
        items,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
          overwrite: 'auto',
          stagger: { each: 0.05, amount: Math.min(0.7, items.length * 0.05) },
        },
      );
      return () => {
        tween.kill();
        gsap.set(items, { clearProps: 'opacity,transform' });
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    dependencies,
  );
  return scope;
}

/**
 * Orchestrated entrance for a page. Reveals a hero ([data-entrance="hero"]) and
 * its inner blocks ([data-entrance-child]) first, then cascades the cards
 * ([data-entrance="card"]) in with a gentle spring. Runs in useLayoutEffect (set
 * before paint, so nothing flashes) and cleans up via gsap.context().revert(),
 * which restores the natural state — so a StrictMode double-mount or a dependency
 * change never strands anything hidden. No-op under reduced motion.
 */
export function useEntrance<T extends HTMLElement = HTMLDivElement>(dependencies: unknown[] = []) {
  const scope = useRef<T>(null);
  useLayoutEffect(
    () => {
      const root = scope.current;
      if (!root || prefersReducedMotion()) return;
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        const hero = root.querySelector('[data-entrance="hero"]');
        const heroKids = root.querySelectorAll('[data-entrance-child]');
        const cards = root.querySelectorAll('[data-entrance="card"]');
        if (hero) tl.from(hero, { opacity: 0, y: 20, duration: 0.55 }, 0);
        if (heroKids.length) tl.from(heroKids, { opacity: 0, y: 12, duration: 0.5, stagger: 0.06 }, 0.12);
        if (cards.length) tl.from(cards, { opacity: 0, y: 26, scale: 0.985, duration: 0.55, stagger: 0.07, ease: 'back.out(1.4)' }, 0.16);
      }, root);
      return () => ctx.revert();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    dependencies,
  );
  return scope;
}

/**
 * Subtle pointer parallax for a hero: elements tagged [data-parallax] drift a few
 * px toward the pointer (strength via [data-depth]). Fine-pointer + motion-enabled
 * only; uses gsap.quickTo for smooth, throttled updates, and clears what it set.
 */
export function useHeroParallax<T extends HTMLElement = HTMLDivElement>() {
  const scope = useRef<T>(null);
  useEffect(() => {
    const root = scope.current;
    if (!root || prefersReducedMotion()) return;
    if (typeof window.matchMedia === 'function' && !window.matchMedia('(pointer: fine)').matches) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-parallax]'));
    if (!targets.length) return;
    const movers = targets.map((el) => ({
      depth: parseFloat(el.dataset.depth ?? '1') || 1,
      x: gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' }),
    }));
    const onMove = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      for (const m of movers) {
        m.x(nx * 26 * m.depth);
        m.y(ny * 18 * m.depth);
      }
    };
    const reset = () => movers.forEach((m) => { m.x(0); m.y(0); });
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', reset);
    return () => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', reset);
      gsap.set(targets, { clearProps: 'x,y' });
    };
  }, []);
  return scope;
}

const CONFETTI_COLORS = ['#7c5cfc', '#25c281', '#ff9f40', '#ff7ac0', '#ffc93c', '#6c8bff'];

/**
 * A small, self-cleaning confetti burst centred on `target`. Used for genuine
 * little wins — finishing a vaccine dose, reaching a milestone. No-op under
 * reduced motion.
 */
export function celebrate(
  target: HTMLElement | null,
  options: { count?: number; colors?: string[] } = {},
) {
  if (!target || prefersReducedMotion()) return;
  const { count = 16, colors = CONFETTI_COLORS } = options;
  const rect = target.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden;';
  document.body.appendChild(layer);

  const dots: HTMLElement[] = [];
  for (let i = 0; i < count; i += 1) {
    const size = gsap.utils.random(6, 11, 1);
    const dot = document.createElement('span');
    dot.style.cssText =
      `position:absolute;left:${originX}px;top:${originY}px;width:${size}px;height:${size}px;` +
      `border-radius:${gsap.utils.random(0, 1) > 0.5 ? '50%' : '2px'};` +
      `background:${colors[i % colors.length]};will-change:transform,opacity;`;
    layer.appendChild(dot);
    dots.push(dot);
  }

  gsap
    .timeline({ onComplete: () => layer.remove() })
    .to(dots, {
      x: () => gsap.utils.random(-110, 110),
      y: () => gsap.utils.random(-130, -40),
      rotation: () => gsap.utils.random(-200, 200),
      scale: () => gsap.utils.random(0.7, 1.3),
      duration: 0.55,
      ease: 'power2.out',
      stagger: 0.008,
    })
    .to(
      dots,
      {
        y: '+=160',
        opacity: 0,
        duration: 0.7,
        ease: 'power1.in',
        stagger: 0.008,
      },
      '>-0.15',
    );
}
