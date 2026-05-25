import { useRef, useState } from 'react'

/**
 * A compact SVG line chart for trends — the body-weight trend on Progress, and
 * per-exercise progression. Renders nothing for fewer than two points.
 * Pass `label` to give screen readers a text summary; omit to hide from AT.
 *
 * P2.4 — `tooltip` enables hover (desktop) / tap (mobile) tooltips on each
 * datapoint, surfacing the exact value. `pointLabels` (one per value) feeds
 * the tooltip text and a screen-reader readout, so a chart that was "a vibe"
 * becomes inspectable data.
 */
export function Sparkline({
  values,
  height = 64,
  stroke = 'var(--color-accent)',
  label,
  tooltip = false,
  pointLabels,
  valueFormat,
}: {
  values: number[]
  height?: number
  stroke?: string
  label?: string
  /** Enable per-point tooltips on hover / focus / tap. */
  tooltip?: boolean
  /** Labels aligned with `values`, e.g. dates or weekday names. */
  pointLabels?: string[]
  /** Format a value for the tooltip; defaults to `String(v)`. */
  valueFormat?: (v: number) => string
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  if (values.length < 2) return null

  const width = 300
  const pad = 4
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = (width - pad * 2) / (values.length - 1)

  const pt = (i: number, v: number): { x: number; y: number } => ({
    x: pad + i * stepX,
    y: pad + (height - pad * 2) * (1 - (v - min) / range),
  })
  const points = values.map((v, i) => pt(i, v))
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const fmt = valueFormat ?? ((v: number): string => String(v))

  // Map a pointer x (in SVG userspace) to the nearest point index.
  const nearestIndex = (clientX: number): number | null => {
    const el = svgRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return null
    const svgX = ((clientX - rect.left) / rect.width) * width
    const idx = Math.round((svgX - pad) / stepX)
    return Math.max(0, Math.min(values.length - 1, idx))
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (!tooltip) return
    const idx = nearestIndex(e.clientX)
    if (idx !== null) setHoverIdx(idx)
  }
  const onLeave = (): void => {
    if (!tooltip) return
    setHoverIdx(null)
  }

  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null
  const hoverLabel = hoverIdx !== null ? pointLabels?.[hoverIdx] : undefined
  const hoverValue = hoverIdx !== null ? fmt(values[hoverIdx]) : ''
  const tooltipText =
    hoverPoint && (hoverLabel ? `${hoverLabel}: ${hoverValue}` : hoverValue)

  return (
    <div className="fj-sparkline-wrap">
      <svg
        ref={svgRef}
        className="fj-sparkline"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : 'true'}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={onLeave}
      >
        <polyline
          points={polyline}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {tooltip &&
          points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoverIdx === i ? 3.5 : 1.5}
              fill={stroke}
              opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.55}
            />
          ))}
        {hoverPoint && (
          <line
            x1={hoverPoint.x}
            x2={hoverPoint.x}
            y1={pad}
            y2={height - pad}
            stroke={stroke}
            strokeWidth={1}
            strokeDasharray="2 2"
            opacity={0.5}
          />
        )}
      </svg>
      {tooltipText && (
        <div
          className="fj-sparkline-tip"
          role="status"
          aria-live="polite"
          style={
            hoverPoint
              ? {
                  /* Anchor the tip horizontally to the hovered point as a
                     percent of width — works under preserveAspectRatio="none". */
                  left: `${(hoverPoint.x / width) * 100}%`,
                }
              : undefined
          }
        >
          {tooltipText}
        </div>
      )}
    </div>
  )
}
