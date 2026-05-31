import { useState } from 'react'
import { GitMerge } from 'lucide-react'
import { useStore } from '@/data/store-context'
import { Button } from './Button'
import { Modal } from './Modal'
import { formatShort } from '@/lib/dates'
import type { ConflictInfo } from '@/data/sync'
import type { AppData } from '@/data/types'

/** Human-readable singleton labels. The keys mirror sync.ts's singleton ids. */
const SINGLETON_LABELS: Record<string, string> = {
  preferences: 'Preferences',
  goals: 'Goals',
  weeklyPlan: 'Weekly plan',
  health: 'Apple Health data',
  lastBackupAt: 'Backup record',
  templates: 'Workout templates',
}

/** Render one conflict as a short, recognisable string. The label may rely on
 *  post-merge data (e.g. a recipe's current name) — the lost local edit isn't
 *  preserved, so this is the best we can do. */
function labelConflict(c: ConflictInfo, data: AppData): string {
  if (c.kind === 'workout') return `Workout on ${formatShort(c.id)}`
  if (c.kind === 'recipe') {
    const r = data.recipes.find((x) => x.id === c.id)
    return r ? `Recipe "${r.name}"` : 'Recipe'
  }
  if (c.kind === 'loggedMeal') {
    const meal = (data.loggedMeals ?? []).find((m) => m.id === c.id)
    if (meal) {
      const recipe = data.recipes.find((r) => r.id === meal.recipeId)
      return recipe
        ? `Logged meal: ${recipe.name}`
        : `Logged meal on ${formatShort(meal.date)}`
    }
    return 'Logged meal'
  }
  if (c.kind === 'singleton') return SINGLETON_LABELS[c.id] ?? c.id
  return c.id
}

/**
 * Amber banner shown when the last sync surfaced LWW conflicts — records you
 * edited on this device that were overwritten by a newer edit from another
 * device. The lost local edits are NOT recoverable (LWW discards them); the
 * banner exists so you know to re-make the change instead of being surprised
 * by your edit vanishing. Persists until *Got it* is tapped.
 */
export function SyncConflictBanner() {
  const { data, sync, dismissSyncConflicts } = useStore()
  const [open, setOpen] = useState(false)
  if (sync.conflicts.length === 0) return null

  // Latest-first; one row per (kind, id) — multiple conflicts for the same
  // record collapse to the most recent one.
  const recent = new Map<string, ConflictInfo>()
  for (let i = sync.conflicts.length - 1; i >= 0; i--) {
    const c = sync.conflicts[i]
    const key = `${c.kind}:${c.id}`
    if (!recent.has(key)) recent.set(key, c)
  }
  const list = [...recent.values()]
  const n = list.length

  const dismiss = (): void => {
    setOpen(false)
    dismissSyncConflicts()
  }

  return (
    <>
      <button
        type="button"
        className="fj-sync-conflict"
        onClick={() => setOpen(true)}
        aria-label={`${n} sync conflict${n === 1 ? '' : 's'} — tap to review`}
      >
        <GitMerge size={18} className="fj-sync-conflict__icon" aria-hidden="true" />
        <span className="fj-sync-conflict__msg">
          <strong>
            {n === 1 ? 'An edit from another device' : `${n} edits from another device`}
          </strong>{' '}
          replaced what you had on this one. Tap to review.
        </span>
      </button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={n === 1 ? 'Sync conflict' : 'Sync conflicts'}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button onClick={dismiss}>Got it</Button>
            </>
          }
        >
          <p style={{ marginBottom: 'var(--space-3)' }}>
            {n === 1 ? 'This record was' : 'These records were'} edited on another
            device after you edited{' '}
            {n === 1 ? 'it' : 'them'} here. The other device's version won
            (newer timestamp), and your local edit{n === 1 ? '' : 's'} couldn't
            be recovered. Re-make the change if you still want it.
          </p>
          <ul className="fj-sync-conflict__list">
            {list.map((c) => (
              <li key={`${c.kind}:${c.id}`} className="fj-sync-conflict__item">
                <span className="fj-sync-conflict__label">{labelConflict(c, data)}</span>
                <span className="fj-sync-conflict__when">
                  remote {new Date(c.remoteUpdatedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  )
}
