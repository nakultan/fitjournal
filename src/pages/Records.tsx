import { useMemo, useState } from 'react'
import { Activity, Dumbbell, History, Target, Trophy } from 'lucide-react'
import { Button, Card, EmptyState, Input, Modal, PageHeader, useToast } from '@/components'
import { useStore } from '@/data/store-context'
import { computeCardioPRs, computePRTimeline, computeStrengthPRs } from '@/data/logic'
import { CARDIO_LABELS } from '@/data/constants'
import type { CardioType } from '@/data/types'
import { formatShort } from '@/lib/dates'

const RECORD_COLS = { gridTemplateColumns: '2fr 1fr 1fr 1.4fr' }

export function RecordsScreen() {
  const { data } = useStore()
  const [goalKey, setGoalKey] = useState<string | null>(null)

  const strengthPRs = useMemo(() => computeStrengthPRs(data.workouts), [data.workouts])
  const cardioPRs = useMemo(() => computeCardioPRs(data.workouts), [data.workouts])
  const timeline = useMemo(() => computePRTimeline(data.workouts), [data.workouts])

  const strengthKeys = Object.keys(strengthPRs)
  const cardioKeys = Object.keys(cardioPRs) as CardioType[]

  return (
    <div className="fj-screen">
      <PageHeader title="Records" subtitle="Your personal bests across every exercise" />

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <Dumbbell size={18} /> Strength records
          </h2>
        </div>
        {strengthKeys.length > 0 ? (
          <div className="fj-table">
            <div className="fj-table__row fj-table__head" style={RECORD_COLS}>
              <span>Exercise</span>
              <span>Best</span>
              <span>Date</span>
              <span>Goal</span>
            </div>
            {strengthKeys.map((k) => {
              const pr = strengthPRs[k]
              const goal = data.goals[k]
              const reached = goal != null && pr.weight >= goal
              return (
                <div key={k} className="fj-table__row" style={RECORD_COLS}>
                  <span className="fj-cell-name" style={{ textTransform: 'capitalize' }}>
                    {pr.name}
                  </span>
                  <span className="fj-cell-value" style={{ color: 'var(--color-success)' }}>
                    {pr.weight} <small>lbs</small>
                  </span>
                  <span className="fj-muted">{formatShort(pr.date)}</span>
                  <button
                    className="fj-cell-value"
                    style={{
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: goal == null
                        ? 'var(--color-text-dim)'
                        : reached
                          ? 'var(--color-success)'
                          : 'var(--color-accent)',
                      font: 'var(--text-caption)',
                    }}
                    onClick={() => setGoalKey(k)}
                  >
                    {goal == null
                      ? 'Set goal'
                      : `${goal} lbs · ${Math.min(100, Math.round((pr.weight / goal) * 100))}%${reached ? ' ✓' : ''}`}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy size={40} />}
            title="No records yet"
            description="Log exercises with a weight and your bests appear here automatically."
          />
        )}
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <Activity size={18} /> Cardio records
          </h2>
        </div>
        {cardioKeys.length > 0 ? (
          <div className="fj-table">
            <div className="fj-table__row fj-table__head" style={RECORD_COLS}>
              <span>Type</span>
              <span>Most calories</span>
              <span>Date</span>
              <span />
            </div>
            {cardioKeys.map((k) => {
              const pr = cardioPRs[k]
              if (!pr) return null
              return (
                <div key={k} className="fj-table__row" style={RECORD_COLS}>
                  <span className="fj-cell-name">{CARDIO_LABELS[k]}</span>
                  <span className="fj-cell-value" style={{ color: 'var(--color-success)' }}>
                    {pr.mostCalories} <small>kcal</small>
                  </span>
                  <span className="fj-muted">{formatShort(pr.date)}</span>
                  <span />
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Activity size={40} />}
            title="No cardio records yet"
            description="Log cardio sessions to track your bests."
          />
        )}
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <History size={18} /> PR timeline
          </h2>
        </div>
        {timeline.length > 0 ? (
          <Card>
            {timeline.slice(0, 30).map((e, i) => (
              <div
                key={`${e.date}-${e.label}-${i}`}
                className="fj-row"
                style={{
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--color-border-soft)',
                }}
              >
                <span className="fj-row" style={{ gap: 'var(--space-3)' }}>
                  <Trophy size={16} color="var(--color-warning)" />
                  <span className="fj-muted" style={{ minWidth: 64 }}>
                    {formatShort(e.date)}
                  </span>
                  <span style={{ fontSize: 13 }}>
                    <strong>{e.label}</strong> — new {e.kind} record
                  </span>
                </span>
                <span className="fj-cell-value" style={{ color: 'var(--color-success)' }}>
                  {e.value}
                </span>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState
            icon={<History size={40} />}
            title="No PR history yet"
            description="Records you set will be listed here as you train."
          />
        )}
      </section>

      {goalKey && (
        <GoalModal
          key={goalKey}
          exerciseKey={goalKey}
          exerciseName={strengthPRs[goalKey]?.name ?? goalKey}
          currentBest={strengthPRs[goalKey]?.weight ?? 0}
          onClose={() => setGoalKey(null)}
        />
      )}
    </div>
  )
}

function GoalModal({
  exerciseKey,
  exerciseName,
  currentBest,
  onClose,
}: {
  exerciseKey: string
  exerciseName: string
  currentBest: number
  onClose: () => void
}) {
  const { data, setGoal, removeGoal } = useStore()
  const { showToast } = useToast()
  const [target, setTarget] = useState(() => {
    const existing = data.goals[exerciseKey]
    return existing != null ? String(existing) : ''
  })

  const save = () => {
    const value = Number(target)
    if (!value || value <= 0) {
      showToast('Enter a weight above zero', 'warning')
      return
    }
    setGoal(exerciseKey, value)
    showToast(`Goal set — ${exerciseName} ${value} lbs`, 'success')
    onClose()
  }
  const clear = () => {
    removeGoal(exerciseKey)
    showToast('Goal removed')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Goal — ${exerciseName}`}
      footer={
        <>
          {data.goals[exerciseKey] != null && (
            <Button variant="danger" onClick={clear}>
              Remove
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save goal</Button>
        </>
      }
    >
      <div className="fj-row" style={{ marginBottom: 'var(--space-3)' }}>
        <Target size={18} color="var(--color-accent)" />
        <span className="fj-muted">Current best: {currentBest} lbs</span>
      </div>
      <Input
        label="Target weight (lbs)"
        type="number"
        inputMode="decimal"
        placeholder="0"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        autoFocus
      />
    </Modal>
  )
}
