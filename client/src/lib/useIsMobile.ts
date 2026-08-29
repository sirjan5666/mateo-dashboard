import { useEffect, useState } from 'react';

/**
 * True below the `lg` breakpoint (the parent mobile app width). Drives the
 * mobile-vs-desktop Home split without rendering both. setState happens only in
 * the matchMedia change callback (never synchronously in the effect body).
 */
export function useIsMobile(query = '(max-width: 1023px)'): boolean {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return isMobile;
}
