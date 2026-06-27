import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ReactLenis } from 'lenis/react';

// App-wide Lenis smooth scroll (root/window). DISABLED under
// `prefers-reduced-motion: reduce` — the app respects reduced motion everywhere
// (same rule as lib/gsap.ts). Inner scroll areas (sidebars, chat threads, the
// modal, the cart drawer) opt out via `data-lenis-prevent` so they keep native
// scroll instead of being captured by the page-level smooth scroll.
function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(reducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (reduced) return <>{children}</>;

  // root → binds to window (no wrapping div); autoRaf drives the animation loop.
  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}
