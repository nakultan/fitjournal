import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  Dumbbell,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  useToast,
} from '@/components'
import { useStore } from '@/data/store-context'
import { findLastTime, formatSets, REPS_MAX, WEIGHT_MAX } from '@/data/logic'
import type { ExerciseEntry, SetEntry } from '@/data/types'
import { cn } from '@/lib/cn'
import { formatLong, formatShort, parseKey, todayKey } from '@/lib/dates'
import { celebrate } from '@/lib/feedback'
import { ExerciseModal, WorkoutSummaryModal } from '@/pages/Today'

const DEFAULT_REST_SECONDS = 120

interface RestTimerState {
  total: number
  deadline: number
  done: boolean
}

/**
 * A one-shot rest-timer hook. `start(seconds)` schedules a chime + haptic at
 * the deadline; after firing the state lingers for three seconds so the user
 * sees the "Rest complete" line, then clears itself. `add`/`skip` adjust the
 * running timer. Transient — state is lost on navigate.
 *
 * `remaining` is held in state and only mutated by event handlers or by the
 * tick/timeout callbacks the effect schedules — never synchronously inside
 * the effect body, and never recomputed from `Date.now()` during render.
 */
function useRestTimer(defaultSeconds: number) {
  const [state, setState] = useState<RestTimerState | null>(null)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!state) return
    if (state.done) {
      const id = setTimeout(() => {
        setState(null)
        setRemaining(0)
      }, 3000)
      return () => clearTimeout(id)
    }
    const fireAt = Math.max(0, state.deadline - Date.now())
    const fireId = setTimeout(() => {
      celebrate()
      setRemaining(0)
      setState((s) => (s && !s.done ? { ...s, done: true } : s))
    }, fireAt)
    const tickId = setInterval(() => {
      setRemaining(Math.max(0, state.deadline - Date.now()))
    }, 250)
    return () => {
      clearTimeout(fireId)
      clearInterval(tickId)
    }
  }, [state])

  return {
    active: !!state,
    isDone: !!state && state.done,
    remaining,
    total: state?.total ?? 0,
    start: (seconds?: number) => {
      const secs = seconds ?? defaultSeconds
      setState({ total: secs, deadline: Date.now() + secs * 1000, done: false })
      setRemaining(secs * 1000)
    },
    add: (seconds: number) => {
      setState((s) =>
        s && !s.done
          ? { ...s, deadline: s.deadline + seconds * 1000, total: s.total + seconds }
          : s,
      )
      setRemaining((r) => r + seconds * 1000)
    },
    skip: () => {
      setState(null)
      setRemaining(0)
    },
  }
}

function formatTimer(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

/**
 * In-workout session view — the day's exercises rendered as checkable set
 * rows, with a rest timer that fires the chime + haptic at zero. Editing the
 * sets here writes through to the store; the "done" state is transient.
 */
export function SessionScreen() {
  const { data, navigate } = useStore()
  const { showToast } = useToast()
  const todayK = todayKey()
  const workout = data.workouts[todayK]
  const exercises = workout?.exercises ?? []
  const weightUnit = data.preferences.weightUnit
  const restSeconds = data.preferences.restTimerSeconds ?? DEFAULT_REST_SECONDS
  const timer = useRestTimer(restSeconds)
  const [doneSets, setDoneSets] = useState<Set<string>>(new Set())
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [addingExercise, setAddingExercise] = useState(false)

  const toggleSet = (key: string): void => {
    setDoneSets((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        timer.start()
      }
      return next
    })
  }

  const closeSummary = (): void => {
    setSummaryOpen(false)
    navigate('today')
  }

  const onAddedExercise = (): void => {
    setAddingExercise(false)
    showToast('Exercise added to session')
  }

  return (
    <div className="fj-screen fj-screen--session">
      <PageHeader
        title="Workout in progress"
        subtitle={formatLong(parseKey(todayK))}
        actions={
          <Button variant="ghost" onClick={() => navigate('today')}>
            <ChevronLeft size={16} /> Today
          </Button>
        }
      />

      {exercises.length === 0 ? (
        <EmptyState
          icon={<Dumbbell size={40} />}
          title="No exercises to do yet"
          description="Add one to get started, or head back to Today to load a template."
          action={
            <Button onClick={() => setAddingExercise(true)}>
              <Plus size={16} /> Add exercise
            </Button>
          }
        />
      ) : (
        <div className="fj-col" style={{ gap: 'var(--space-4)' }}>
          {exercises.map((e) => (
            <SessionExerciseCard
              key={e.id}
              exercise={e}
              doneSets={doneSets}
              onToggleSet={toggleSet}
              dateKey={todayK}
              weightUnit={weightUnit}
            />
          ))}
        </div>
      )}

      {exercises.length > 0 && (
        <div
          className="fj-row fj-session-actions"
          style={{ marginTop: 'var(--space-5)' }}
        >
          <Button variant="secondary" onClick={() => setAddingExercise(true)}>
            <Plus size={16} /> Add exercise
          </Button>
          <Button onClick={() => setSummaryOpen(true)}>
            <Sparkles size={16} /> Finish workout
          </Button>
        </div>
      )}

      {timer.active && <RestTimerBar timer={timer} />}
      {addingExercise && (
        <ExerciseModal
          dateKey={todayK}
          editing={null}
          onClose={onAddedExercise}
        />
      )}
      {summaryOpen && (
        <WorkoutSummaryModal dateKey={todayK} onClose={closeSummary} />
      )}
    </div>
  )
}

function SessionExerciseCard({
  exercise,
  doneSets,
  onToggleSet,
  dateKey,
  weightUnit,
}: {
  exercise: ExerciseEntry
  doneSets: Set<string>
  onToggleSet: (key: string) => void
  dateKey: string
  weightUnit: string
}) {
  const { data, updateExercise } = useStore()
  const lastTime = useMemo(
    () => findLastTime(data.workouts, exercise.name, dateKey),
    [data.workouts, exercise.name, dateKey],
  )

  const updateSet = (i: number, patch: Partial<SetEntry>): void => {
    const sets = exercise.sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    updateExercise(dateKey, { ...exercise, sets })
  }

  const addSet = (): void => {
    const last = exercise.sets[exercise.sets.length - 1] ?? { reps: 0, weight: 0 }
    updateExercise(dateKey, { ...exercise, sets: [...exercise.sets, { ...last }] })
  }

  return (
    <Card className="fj-session-ex">
      <div className="fj-session-ex__head">
        <span className="fj-cell-name">
          {exercise.name}
          <span className="fj-muscle-tag" data-muscle={exercise.muscle}>
            {exercise.muscle}
          </span>
        </span>
      </div>
      {lastTime && (
        <p className="fj-muted" style={{ marginTop: 'var(--space-1)' }}>
          Last time ({formatShort(lastTime.date)}): {formatSets(lastTime.entry.sets, weightUnit)}
        </p>
      )}
      <div className="fj-session-sets" style={{ marginTop: 'var(--space-3)' }}>
        <div className="fj-session-set fj-session-set--head" aria-hidden="true">
          <span className="fj-session-set__num">#</span>
          <span className="fj-session-set__col">Weight</span>
          <span className="fj-session-set__col">Reps</span>
          <span />
        </div>
        {exercise.sets.map((s, i) => {
          const key = `${exercise.id}:${i}`
          const done = doneSets.has(key)
          return (
            <SessionSetRow
              key={i}
              index={i}
              set={s}
              done={done}
              weightUnit={weightUnit}
              onUpdate={(patch) => updateSet(i, patch)}
              onToggle={() => onToggleSet(key)}
            />
          )
        })}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={addSet}
        style={{ marginTop: 'var(--space-2)' }}
      >
        <Plus size={14} /> Add set
      </Button>
    </Card>
  )
}

function SessionSetRow({
  index,
  set,
  done,
  weightUnit,
  onUpdate,
  onToggle,
}: {
  index: number
  set: SetEntry
  done: boolean
  weightUnit: string
  onUpdate: (patch: Partial<SetEntry>) => void
  onToggle: () => void
}) {
  const weightOver = set.weight > WEIGHT_MAX
  const repsOver = set.reps > REPS_MAX
  return (
    <div className={cn('fj-session-set', done && 'fj-session-set--done')}>
      <div className="fj-session-set__row">
        <span className="fj-session-set__num">{index + 1}</span>
        <input
          className="fj-input"
          type="number"
          min={0}
          max={WEIGHT_MAX}
          inputMode="decimal"
          aria-label={`Set ${index + 1} weight (${weightUnit})`}
          aria-invalid={weightOver || undefined}
          placeholder="0"
          value={set.weight || ''}
          onChange={(e) =>
            onUpdate({ weight: Math.max(0, Number(e.target.value) || 0) })
          }
        />
        <input
          className="fj-input"
          type="number"
          min={0}
          max={REPS_MAX}
          inputMode="numeric"
          aria-label={`Set ${index + 1} reps`}
          aria-invalid={repsOver || undefined}
          placeholder="0"
          value={set.reps || ''}
          onChange={(e) =>
            onUpdate({ reps: Math.max(0, Math.round(Number(e.target.value) || 0)) })
          }
        />
        <button
          type="button"
          className={cn('fj-session-check', done && 'fj-session-check--done')}
          aria-label={
            done ? `Set ${index + 1} done — tap to undo` : `Mark set ${index + 1} done`
          }
          aria-pressed={done}
          onClick={onToggle}
        >
          {done && <CheckCircle2 size={20} />}
        </button>
      </div>
      {(weightOver || repsOver) && (
        <div className="fj-input-warn" role="note">
          {weightOver && repsOver
            ? `That's a lot — double-check the weight and reps.`
            : weightOver
              ? `That's a lot of weight — double-check.`
              : `That's a lot of reps — double-check.`}
        </div>
      )}
    </div>
  )
}

function RestTimerBar({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  return (
    <div
      className={cn('fj-rest-timer', timer.isDone && 'fj-rest-timer--done')}
      role="status"
      aria-live="polite"
    >
      <Clock size={18} />
      <div className="fj-rest-timer__main">
        <div className="fj-rest-timer__label">
          {timer.isDone ? 'Rest complete' : 'Rest'}
        </div>
        <div className="fj-rest-timer__time">{formatTimer(timer.remaining)}</div>
      </div>
      {!timer.isDone && (
        <button
          type="button"
          className="fj-rest-timer__btn"
          aria-label="Add 15 seconds"
          onClick={() => timer.add(15)}
        >
          <RotateCcw size={14} />
          +15s
        </button>
      )}
      <button
        type="button"
        className="fj-rest-timer__btn fj-rest-timer__btn--close"
        aria-label="Dismiss timer"
        onClick={timer.skip}
      >
        <X size={16} />
      </button>
    </div>
  )
}
