import { useEffect, useRef, useState } from 'react'

/**
 * Animate a number from its previously displayed value up (or down) to a new
 * target — used for the celebration moments in the post-workout summary. The
 * very first mount counts up from zero. Honours `prefers-reduced-motion` by
 * snapping to the target instead of animating.
 *
 * Render stays pure: the displayed value is held in state and only mutated by
 * the `requestAnimationFrame` tick the effect schedules, never synchronously
 * inside the effect body.
 */
export function CountUp({
  value,
  duration = 700,
}: {
  value: number
  duration?: number
}) {
  const [displayed, setDisplayed] = useState(0)
  // The most-recently rendered `displayed`, used to start the next animation
  // from where it left off rather than jumping back to zero on every update.
  const displayedRef = useRef(0)

  useEffect(() => {
    displayedRef.current = displayed
  })

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || duration <= 0) {
      // Skip the animation — schedule via rAF so the setState happens off
      // the effect body, satisfying the no-sync-setState-in-effect rule.
      const snap = requestAnimationFrame(() => setDisplayed(value))
      return () => cancelAnimationFrame(snap)
    }
    let frame = 0
    const from = displayedRef.current
    const startTime = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(from + (value - from) * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <>{Math.round(displayed).toLocaleString()}</>
}
