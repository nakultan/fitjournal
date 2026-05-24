import { useState } from 'react'
import { Lock, Minus, Plus } from 'lucide-react'
import { Button } from './Button'
import { Chip } from './Chip'
import { Modal } from './Modal'
import { useStore } from '@/data/store-context'
import type { WeightUnit } from '@/data/types'

/**
 * The two-question welcome card shown on a fresh install — weight unit and
 * weekly workout goal. Everything has sensible defaults, so the user can
 * dismiss with one tap and change either later in Settings. The "dismissed"
 * flag is set whether the user confirms, closes, or skips, so this only ever
 * runs once.
 */
export function FirstRun() {
  const { data, savePreferences } = useStore()
  const prefs = data.preferences
  const [unit, setUnit] = useState<WeightUnit>(prefs.weightUnit)
  const [goal, setGoal] = useState(prefs.weeklyGoal)

  const journalEmpty = Object.keys(data.workouts).length === 0
  const shouldShow = !prefs.firstRunDismissed && journalEmpty
  if (!shouldShow) return null

  const dismiss = (apply: boolean) => {
    savePreferences({
      ...prefs,
      ...(apply ? { weightUnit: unit, weeklyGoal: goal } : {}),
      firstRunDismissed: true,
    })
  }

  return (
    <Modal
      open
      onClose={() => dismiss(true)}
      title="Welcome to FitJournal"
      footer={
        <>
          <Button variant="ghost" onClick={() => dismiss(false)}>
            Skip
          </Button>
          <Button onClick={() => dismiss(true)}>Get started</Button>
        </>
      }
    >
      <p style={{ marginBottom: 'var(--space-3)' }}>
        Two quick choices, then you&apos;re in. Both are changeable later in
        Settings.
      </p>
      <div className="fj-settings-trust" role="note" style={{ marginBottom: 'var(--space-4)' }}>
        <Lock size={14} aria-hidden="true" />
        <span>Everything stays on this device — no account, no servers.</span>
      </div>
      <div className="fj-field" style={{ marginBottom: 'var(--space-4)' }}>
        <label className="fj-field__label">Weights in</label>
        <div className="fj-row">
          <Chip active={unit === 'lbs'} onClick={() => setUnit('lbs')}>
            lbs
          </Chip>
          <Chip active={unit === 'kg'} onClick={() => setUnit('kg')}>
            kg
          </Chip>
        </div>
      </div>
      <div className="fj-field">
        <label className="fj-field__label">Workouts per week</label>
        <div className="fj-row" style={{ gap: 'var(--space-3)' }}>
          <button
            type="button"
            className="fj-scaler__btn"
            aria-label="Fewer per week"
            onClick={() => setGoal((g) => Math.max(1, g - 1))}
            disabled={goal <= 1}
          >
            <Minus size={16} />
          </button>
          <span
            className="fj-scaler__value"
            style={{ minWidth: 32, fontSize: '1.25rem' }}
          >
            {goal}
          </span>
          <button
            type="button"
            className="fj-scaler__btn"
            aria-label="More per week"
            onClick={() => setGoal((g) => Math.min(7, g + 1))}
            disabled={goal >= 7}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </Modal>
  )
}
