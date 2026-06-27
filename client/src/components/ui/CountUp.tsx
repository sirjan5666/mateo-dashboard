import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { gsap, prefersReducedMotion } from '../../lib/gsap';

/**
 * Counts a number up from zero on mount (and whenever `value` changes). The span
 * owns its own text content so React never fights GSAP over it. Under reduced
 * motion it renders the final value immediately. Numbers use the en-IN locale to
 * match the rest of the app.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 1.1,
  prefix = '',
  suffix = '',
  className,
  style,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const format = (n: number) =>
      `${prefix}${n.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;

    if (prefersReducedMotion()) {
      el.textContent = format(value);
      return;
    }
    const obj = { v: 0 };
    el.textContent = format(0);
    const tween = gsap.to(obj, {
      v: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = format(obj.v);
      },
    });
    return () => {
      tween.kill();
      // Guarantee the final value is shown even if interrupted mid-count.
      el.textContent = format(value);
    };
  }, [value, decimals, prefix, suffix, duration]);

  // Empty on first render; the layout-effect above fills it before paint.
  return <span ref={ref} className={className} style={style} />;
}
