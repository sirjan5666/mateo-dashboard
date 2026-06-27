import type { CSSProperties } from 'react';

// Tara's mark — a four-point "guiding star" sparkle with a small twinkle, in the
// Mateo brand purple. `variant="tile"` sits it on a rounded gradient chip (for
// the floating launcher / avatars); `variant="plain"` draws the sparkle itself
// in the brand gradient (for inline use on light surfaces).
const SPARKLE = 'M16 2.6Q18.2 13.8 29.4 16Q18.2 18.2 16 29.4Q13.8 18.2 2.6 16Q13.8 13.8 16 2.6Z';
const TWINKLE = 'M25.2 3.4Q25.9 6.7 29.2 7.4Q25.9 8.1 25.2 11.4Q24.5 8.1 21.2 7.4Q24.5 6.7 25.2 3.4Z';

export function AssistantMark({
  size = 28,
  variant = 'plain',
  className,
  style,
}: {
  size?: number;
  variant?: 'plain' | 'tile';
  className?: string;
  style?: CSSProperties;
}) {
  if (variant === 'tile') {
    return (
      <span
        aria-hidden="true"
        className={className}
        style={{
          display: 'inline-grid',
          placeItems: 'center',
          width: size,
          height: size,
          borderRadius: size * 0.32,
          background: 'var(--brand-gradient)',
          boxShadow: '0 6px 16px -5px rgba(124,92,252,0.55), inset 0 1px 0 rgba(255,255,255,0.45)',
          flexShrink: 0,
          ...style,
        }}
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 32 32" aria-hidden="true">
          <path d={SPARKLE} fill="#ffffff" />
          <path d={TWINKLE} fill="#ffffff" opacity="0.9" />
        </svg>
      </span>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} style={style} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="taraMark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b6bff" />
          <stop offset="55%" stopColor="#7c5cfc" />
          <stop offset="100%" stopColor="#b06bff" />
        </linearGradient>
      </defs>
      <path d={SPARKLE} fill="url(#taraMark)" />
      <path d={TWINKLE} fill="url(#taraMark)" opacity="0.85" />
    </svg>
  );
}
