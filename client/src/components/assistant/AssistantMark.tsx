import type { CSSProperties } from 'react';

// Dai Maa's mark — her portrait avatar (a warm, waving grandmother), served from
// /public. Shown as a square with a gently rounded corner (never a circle), the
// full illustration, no crop/zoom. `variant="tile"` adds a soft brand shadow (for
// the floating launcher / chat header); `variant="plain"` is the bare square.
const SRC = '/dai-maa.png';

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
  return (
    <span
      role="img"
      aria-label="Dai Maa"
      className={className}
      style={{
        display: 'inline-block',
        overflow: 'hidden',
        width: size,
        height: size,
        borderRadius: Math.max(3, size * 0.18), // minor corner radius — square, not a circle
        backgroundColor: '#ece3fb',
        boxShadow: variant === 'tile' ? '0 6px 16px -5px rgba(124,92,252,0.55), inset 0 1px 0 rgba(255,255,255,0.45)' : undefined,
        flexShrink: 0,
        ...style,
      }}
    >
      <img
        src={SRC}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </span>
  );
}
