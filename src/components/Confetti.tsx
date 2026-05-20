import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

const COLORS = ['#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#ffd60a']

interface Piece {
  id: number
  style: CSSProperties
}

/**
 * A short, tasteful confetti burst that falls down the screen and fades out.
 * Pieces are randomised once in an effect (keeping render pure), and nothing
 * shows when the user prefers reduced motion (also enforced in CSS).
 */
export function Confetti({ count = 46 }: { count?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const raf = requestAnimationFrame(() => {
      setPieces(
        Array.from({ length: count }, (_, i) => {
          const size = 6 + Math.random() * 6
          return {
            id: i,
            style: {
              left: `${Math.random() * 100}%`,
              width: size,
              height: size * 0.42,
              background: COLORS[i % COLORS.length],
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${2 + Math.random() * 1.6}s`,
              '--fj-drift': `${(Math.random() - 0.5) * 140}px`,
              '--fj-rot': `${Math.round(Math.random() * 720 - 360)}deg`,
            } as CSSProperties,
          }
        }),
      )
    })
    return () => cancelAnimationFrame(raf)
  }, [count])

  if (pieces.length === 0) return null

  return (
    <div className="fj-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span key={p.id} className="fj-confetti__piece" style={p.style} />
      ))}
    </div>
  )
}
