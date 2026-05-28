/**
 * A tiny FLIP (First-Last-Invert-Play) helper for reorder animations
 * (P3.8). When a list's order changes, the rows would otherwise jump to
 * their new positions instantly; FLIP records where each row *was*, lets
 * React paint the new order, then transforms each row back to its old spot
 * and releases it — so the eye sees a smooth 150 ms slide.
 *
 * Shared by Today's lift list and Plan's template-exercise rows (and the
 * template manager), so the motion is identical everywhere.
 *
 * Rows opt in with a `data-flip-key="<stable-id>"` attribute. Honors
 * `prefers-reduced-motion`.
 */
import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

const FLIP_ATTR = 'data-flip-key'
const DURATION_MS = 150

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Snapshot the viewport rect of every flip-tracked child of `container`. */
function recordPositions(container: HTMLElement | null): Map<string, DOMRect> {
  const map = new Map<string, DOMRect>()
  if (!container) return map
  for (const el of container.querySelectorAll<HTMLElement>(`[${FLIP_ATTR}]`)) {
    const key = el.getAttribute(FLIP_ATTR)
    if (key) map.set(key, el.getBoundingClientRect())
  }
  return map
}

/**
 * Given the previous positions, transform each moved row from its old spot
 * to its new one and animate the transform away. Runs synchronously (in a
 * layout effect) so the inverted transform is applied before the browser
 * paints the new order — no flash.
 */
function playFlip(container: HTMLElement | null, prev: Map<string, DOMRect>): void {
  if (!container || prev.size === 0 || prefersReducedMotion()) return
  for (const el of container.querySelectorAll<HTMLElement>(`[${FLIP_ATTR}]`)) {
    const key = el.getAttribute(FLIP_ATTR)
    if (!key) continue
    const before = prev.get(key)
    if (!before) continue
    const after = el.getBoundingClientRect()
    const dx = before.left - after.left
    const dy = before.top - after.top
    if (dx === 0 && dy === 0) continue
    el.style.transition = 'none'
    el.style.transform = `translate(${dx}px, ${dy}px)`
    // Force a reflow so the browser registers the start transform before we
    // swap in the transition.
    void el.getBoundingClientRect()
    requestAnimationFrame(() => {
      el.style.transition = `transform ${DURATION_MS}ms ease-out`
      el.style.transform = ''
      const clear = (): void => {
        el.style.transition = ''
        el.removeEventListener('transitionend', clear)
      }
      el.addEventListener('transitionend', clear)
    })
  }
}

/**
 * Animate reorders within `containerRef`. Pass a `key` string that changes
 * whenever the list order changes (e.g. the joined ids) — the hook captures
 * positions after each commit and plays the FLIP when `key` next changes.
 */
export function useFlip(containerRef: RefObject<HTMLElement | null>, key: string): void {
  const prevRef = useRef<Map<string, DOMRect>>(new Map())
  const firstRef = useRef(true)

  useLayoutEffect(() => {
    // Skip the very first commit — there's no "previous" order to animate
    // from, and we don't want rows sliding in on mount.
    if (firstRef.current) {
      firstRef.current = false
      prevRef.current = recordPositions(containerRef.current)
      return
    }
    playFlip(containerRef.current, prevRef.current)
    prevRef.current = recordPositions(containerRef.current)
  }, [containerRef, key])
}
