/**
 * Theme helper. The colour theme is chosen by CSS (see tokens.css): with no
 * `data-theme` attribute the OS preference wins; `data-theme="light|dark"`
 * forces one. This applies the user's choice to the document, and mirrors it
 * to a small localStorage hint that index.html reads before first paint to
 * avoid a flash of the wrong theme.
 */
import type { ThemePreference } from '@/data/types'

/** localStorage key for the pre-paint theme hint — read by index.html. */
const THEME_HINT_KEY = 'fj-theme'

/** Apply a theme preference: set (or clear) `data-theme` and the paint hint. */
export function applyTheme(pref: ThemePreference): void {
  const root = document.documentElement
  if (pref === 'light' || pref === 'dark') {
    root.dataset.theme = pref
    try {
      localStorage.setItem(THEME_HINT_KEY, pref)
    } catch {
      /* the hint is only an optimisation — losing it risks a brief flash */
    }
  } else {
    delete root.dataset.theme
    try {
      localStorage.removeItem(THEME_HINT_KEY)
    } catch {
      /* ignore — see above */
    }
  }
}
