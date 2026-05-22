/**
 * Minimal hash-based router. Hash routing needs no server rewrites, so it
 * works offline and under the GitHub Pages sub-path. The URL is the single
 * source of truth for which screen is shown and which day Today is viewing,
 * which is what makes the browser (and Android hardware) back button work.
 */
import { useSyncExternalStore } from 'react'
import type { PageId } from '@/data/types'
import { todayKey } from './dates'

const PAGES: PageId[] = ['today', 'progress', 'plan', 'recipes', 'settings']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface Route {
  page: PageId
  /** The day the Today screen is viewing — always a valid YYYY-MM-DD key. */
  date: string
}

/** Parse a route from a hash string (defaults to the live `location.hash`). */
export function parseRoute(hash: string = location.hash): Route {
  const [seg, sub] = hash.replace(/^#\/?/, '').split('/')
  let page: PageId = (PAGES as string[]).includes(seg) ? (seg as PageId) : 'today'
  // Retired screens — old links land on the merged Progress screen.
  if (seg === 'records' || seg === 'history') page = 'progress'
  const date = page === 'today' && DATE_RE.test(sub ?? '') ? sub : todayKey()
  return { page, date }
}

function hashFor(page: PageId, date?: string): string {
  if (page === 'today' && date && date !== todayKey()) return `#/today/${date}`
  return `#/${page}`
}

/** Navigate by updating the URL hash (adds a browser history entry). */
export function navigateTo(page: PageId, date?: string): void {
  const next = hashFor(page, date)
  if (location.hash !== next) location.hash = next
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** Subscribe a component to the current route; re-renders on every hash change. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  return parseRoute(hash)
}
