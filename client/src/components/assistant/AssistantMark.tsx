import type { CSSProperties } from 'react';

// Dai Maa's mark — her portrait avatar (a warm, waving grandmother). Served from
// /public. `variant="tile"` sits her on a rounded-square chip with a soft brand
// shadow (floating launcher / chat header); `variant="plain"` is a simple round
// avatar for inline use. The image is framed to her face via object-position so
// she still reads well at small sizes.
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
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        overflow: 'hidden',
        width: size,
        height: size,
        borderRadius: variant === 'tile' ? size * 0.32 : '50%',
        background: 'var(--brand-gradient)',
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
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 8%' }}
      />
    </span>
  );
}
