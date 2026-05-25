/**
 * Minimal hash-based router. Hash routing needs no server rewrites, so it
 * works offline and under the GitHub Pages sub-path. The URL is the single
 * source of truth for which screen is shown and which day Today is viewing,
 * which is what makes the browser (and Android hardware) back button work.
 */
import { useSyncExternalStore } from 'react'
import type { PageId } from '@/data/types'
import { todayKey } from './dates'

const PAGES: PageId[] = [
  'today',
  'progress',
  'plan',
  'recipes',
  'settings',
  'session',
  'exercise',
]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Sub-sections of the Settings screen, addressable by hash route. */
export type SettingsSection = 'preferences' | 'data' | 'health' | 'about'
const SETTINGS_SECTIONS: SettingsSection[] = ['preferences', 'data', 'health', 'about']

/** Sub-rooms of the Progress screen, addressable by hash route.
 *  - `story`   — weekly recap, body weight, insights (was "Overview")
 *  - `records` — PRs, goals, PR timeline (was "Exercises", renamed for clarity)
 *  - `history` — past workouts + activity heatmap
 *  A bare `#/progress` redirects to `story`. */
export type ProgressSection = 'story' | 'records' | 'history'
const PROGRESS_SECTIONS: ProgressSection[] = ['story', 'records', 'history']
export const DEFAULT_PROGRESS_SECTION: ProgressSection = 'story'

export interface Route {
  page: PageId
  /** The day the Today screen is viewing — always a valid YYYY-MM-DD key. */
  date: string
  /** The exercise (lowercased name) the Exercise Detail screen is viewing. */
  exerciseKey?: string
  /** When on Settings, the active sub-section; absent on the cards index. */
  settingsSection?: SettingsSection
  /** When on Progress, the active room (defaults to `story`). */
  progressSection?: ProgressSection
}

/** Parse a route from a hash string (defaults to the live `location.hash`). */
export function parseRoute(hash: string = location.hash): Route {
  const [seg, sub] = hash.replace(/^#\/?/, '').split('/')
  let page: PageId = (PAGES as string[]).includes(seg) ? (seg as PageId) : 'today'
  // Retired screens — old links land on the merged Progress screen.
  if (seg === 'records' || seg === 'history') page = 'progress'

  let exerciseKey: string | undefined
  if (page === 'exercise') {
    if (sub) {
      try {
        exerciseKey = decodeURIComponent(sub)
      } catch {
        exerciseKey = sub
      }
    }
    // A bare `#/exercise` with no key sends the user back to Progress rather
    // than rendering an unidentified detail page.
    if (!exerciseKey) page = 'progress'
  }

  let settingsSection: SettingsSection | undefined
  if (page === 'settings' && sub && (SETTINGS_SECTIONS as string[]).includes(sub)) {
    settingsSection = sub as SettingsSection
  }

  let progressSection: ProgressSection | undefined
  if (page === 'progress') {
    progressSection =
      sub && (PROGRESS_SECTIONS as string[]).includes(sub)
        ? (sub as ProgressSection)
        : DEFAULT_PROGRESS_SECTION
  }

  const date = page === 'today' && DATE_RE.test(sub ?? '') ? sub : todayKey()
  return { page, date, exerciseKey, settingsSection, progressSection }
}

function hashFor(
  page: PageId,
  date?: string,
  exerciseKey?: string,
  settingsSection?: SettingsSection,
  progressSection?: ProgressSection,
): string {
  if (page === 'today' && date && date !== todayKey()) return `#/today/${date}`
  if (page === 'exercise' && exerciseKey) {
    return `#/exercise/${encodeURIComponent(exerciseKey)}`
  }
  if (page === 'settings' && settingsSection) return `#/settings/${settingsSection}`
  if (page === 'progress' && progressSection && progressSection !== DEFAULT_PROGRESS_SECTION) {
    return `#/progress/${progressSection}`
  }
  return `#/${page}`
}

/** Navigate by updating the URL hash (adds a browser history entry). */
export function navigateTo(
  page: PageId,
  date?: string,
  exerciseKey?: string,
  settingsSection?: SettingsSection,
  progressSection?: ProgressSection,
): void {
  const next = hashFor(page, date, exerciseKey, settingsSection, progressSection)
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
