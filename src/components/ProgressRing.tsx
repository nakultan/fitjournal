import type { ReactNode } from 'react'

interface ProgressRingProps {
  /** Completion percentage, 0–100. */
  pct: number
  /** Outer diameter in pixels. */
  size?: number
  /** Ring thickness in pixels. */
  stroke?: number
  /** Colour of the filled arc. */
  color?: string
  /** Centre content (e.g. a number). */
  children?: ReactNode
}

/** A circular progress indicator with optional centred content. */
export function ProgressRing({
  pct,
  size = 72,
  stroke = 7,
  color = 'var(--color-accent)',
  children,
}: ProgressRingProps) {
  const c = size / 2
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <div className="fj-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="fj-ring__svg" aria-hidden="true">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--color-surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${c} ${c})`}
          className="fj-ring__bar"
        />
      </svg>
      {children != null && <div className="fj-ring__label">{children}</div>}
    </div>
  )
}
