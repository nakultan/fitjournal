/**
 * A compact SVG line chart for trends — the body-weight trend on Progress, and
 * (later) per-exercise progression. Renders nothing for fewer than two points.
 */
export function Sparkline({
  values,
  height = 64,
  stroke = 'var(--color-accent)',
}: {
  values: number[]
  height?: number
  stroke?: string
}) {
  if (values.length < 2) return null

  const width = 300
  const pad = 4
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = (width - pad * 2) / (values.length - 1)

  const points = values
    .map((v, i) => {
      const x = pad + i * stepX
      const y = pad + (height - pad * 2) * (1 - (v - min) / range)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      className="fj-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
