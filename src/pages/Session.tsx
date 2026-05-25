import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Dumbbell,
  Pause,
  Pencil,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
} from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  ProgressRing,
  useToast,
} from '@/components'
import { useStore } from '@/data/store-context'
import {
  REPS_MAX,
  WEIGHT_MAX,
  computeExerciseHistory,
  findLastTime,
  formatSets,
  recommendNextSession,
} from '@/data/logic'
import type { ExerciseEntry, SetEntry } from '@/data/types'
import { cn } from '@/lib/cn'
import { formatShort, todayKey } from '@/lib/dates'
import { celebrate, tap } from '@/lib/feedback'
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

type RestTimer = ReturnType<typeof useRestTimer>

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
 *
 * P2.1 — Train Mode takeover. AppShell hides the 5-tab nav when the active
 * page is `session`; this screen renders its own 2-action bottom bar
 * (Pause / Finish workout, P2.6) so the only system-level affordance during
 * a workout is the action that matters.
 *
 * P2.7 — Rest visualised in-place. The floating timer bar is gone; the
 * resting set card adopts a blue treatment with a circular ring on the
 * right side. The +15s / skip-rest controls sit alongside the ring rather
 * than at the bottom of the screen, in the context they affect.
 */
export function SessionScreen() {
  const { data, navigate } = useStore()
  const { showToast } = useToast()
  const todayK = todayKey()
  const workout = data.workouts[todayK]
  // Memoize so the empty-array fallback doesn't allocate fresh on every
  // render — keeps `restingTarget`'s memo stable under the React Compiler.
  const exercises = useMemo(() => workout?.exercises ?? [], [workout])
  const weightUnit = data.preferences.weightUnit
  const restSeconds = data.preferences.restTimerSeconds ?? DEFAULT_REST_SECONDS
  const timer = useRestTimer(restSeconds)
  const [doneSets, setDoneSets] = useState<Set<string>>(new Set())
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [addingExercise, setAddingExercise] = useState(false)
  // The just-completed set, so the next un-done set of the same exercise
  // can adopt the resting-card treatment with the countdown ring.
  const [lastCompleted, setLastCompleted] = useState<{ exId: string; setIndex: number } | null>(null)

  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0)
  const doneCount = doneSets.size

  const toggleSet = (exId: string, setIndex: number): void => {
    const key = `${exId}:${setIndex}`
    setDoneSets((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        // P1.8 — soft haptic only on the *first* check of the session.
        // Subsequent checks rely on the existing rest-timer chime/buzz at zero.
        if (next.size === 0) tap()
        next.add(key)
        timer.start()
        setLastCompleted({ exId, setIndex })
      }
      return next
    })
  }

  // The set the rest ring attaches to — first un-done set within the same
  // exercise the user just completed. Null when no rest is running, when the
  // exercise is fully done, or when no set has been checked yet. Computed
  // directly in render so the React Compiler can memoize it itself; manual
  // useMemo here can't be preserved because the compiler can't see the
  // shape of the `timer` object's stable fields.
  let restingTarget: { exId: string; setIndex: number } | null = null
  if (timer.active && !timer.isDone && lastCompleted) {
    const ex = exercises.find((e) => e.id === lastCompleted.exId)
    if (ex) {
      for (let i = 0; i < ex.sets.length; i++) {
        if (!doneSets.has(`${ex.id}:${i}`)) {
          restingTarget = { exId: ex.id, setIndex: i }
          break
        }
      }
    }
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
      {/* Train Mode header — compact ambient strip + display title. */}
      <header className="fj-session-head">
        <div className="fj-session-head__strip">
          <span>SESSION</span>
          {totalSets > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span aria-label={`${doneCount} of ${totalSets} sets done`}>
                {doneCount}/{totalSets} SETS
              </span>
            </>
          )}
        </div>
        <h1 className="fj-session-head__title">Workout in progress</h1>
      </header>

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
              restingTarget={restingTarget}
              timer={timer}
            />
          ))}
        </div>
      )}

      {exercises.length > 0 && (
        <div className="fj-row fj-session-secondary" style={{ marginTop: 'var(--space-5)' }}>
          <Button variant="ghost" onClick={() => setAddingExercise(true)}>
            <Plus size={16} /> Add exercise
          </Button>
        </div>
      )}

      {/* P2.6 — Adaptive bottom bar. Outline Pause on the left, solid-fill
          Finish on the right. The 5-tab nav is hidden by AppShell in train
          mode (P2.1), so this is the only system-level surface during a
          workout — Hick's Law minimised at the moment of physical exertion. */}
      {exercises.length > 0 && (
        <nav className="fj-session-bottom" aria-label="Session actions">
          <Button
            variant="secondary"
            className="fj-session-bottom__pause"
            onClick={() => navigate('today')}
          >
            <Pause size={16} /> Pause
          </Button>
          <Button
            className="fj-session-bottom__finish"
            onClick={() => setSummaryOpen(true)}
          >
            <Sparkles size={16} /> Finish workout
          </Button>
        </nav>
      )}

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
  restingTarget,
  timer,
}: {
  exercise: ExerciseEntry
  doneSets: Set<string>
  onToggleSet: (exId: string, setIndex: number) => void
  dateKey: string
  weightUnit: string
  restingTarget: { exId: string; setIndex: number } | null
  timer: RestTimer
}) {
  const { data, updateExercise } = useStore()
  const lastTime = useMemo(
    () => findLastTime(data.workouts, exercise.name, dateKey),
    [data.workouts, exercise.name, dateKey],
  )
  // P0.3-Session — auto-bump heuristic for the dominant subtitle's "try X"
  // segment. Same pure helper that powers ExerciseDetail's recommendation
  // card, so the suggestions stay in lockstep.
  const nextRec = useMemo(
    () => recommendNextSession(computeExerciseHistory(data.workouts, exercise.name)),
    [data.workouts, exercise.name],
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
      {/* P0.3-Session — dominant subtitle: "set X of N" tracks the first
          un-checked set so the line stays meaningful even without the P2
          single-active-card treatment. "try X" only shows when the bump
          heuristic actually fires. */}
      <p className="fj-session-ex__subtitle">
        <span>
          {(() => {
            const total = exercise.sets.length
            const doneCount = exercise.sets.reduce(
              (n, _, i) => (doneSets.has(`${exercise.id}:${i}`) ? n + 1 : n),
              0,
            )
            if (doneCount >= total) return `all ${total} sets done`
            return `set ${doneCount + 1} of ${total}`
          })()}
        </span>
        {lastTime && (
          <>
            <span aria-hidden="true"> · </span>
            <span>
              last time ({formatShort(lastTime.date)}): {formatSets(lastTime.entry.sets, weightUnit)}
            </span>
          </>
        )}
        {nextRec && nextRec.bumped && (
          <>
            <span aria-hidden="true"> · </span>
            <span className="fj-session-ex__try">
              try {nextRec.weight} {weightUnit}
            </span>
          </>
        )}
      </p>
      <div className="fj-session-sets" style={{ marginTop: 'var(--space-3)' }}>
        <div className="fj-session-set fj-session-set--head" aria-hidden="true">
          <span className="fj-session-set__num">#</span>
          <span className="fj-session-set__col">Weight × reps</span>
          <span />
          <span />
        </div>
        {exercise.sets.map((s, i) => {
          const key = `${exercise.id}:${i}`
          const done = doneSets.has(key)
          const resting =
            restingTarget !== null &&
            restingTarget.exId === exercise.id &&
            restingTarget.setIndex === i
          return (
            <SessionSetRow
              key={i}
              index={i}
              set={s}
              done={done}
              weightUnit={weightUnit}
              resting={resting}
              timer={resting ? timer : null}
              onUpdate={(patch) => updateSet(i, patch)}
              onToggle={() => onToggleSet(exercise.id, i)}
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
  resting,
  timer,
  onUpdate,
  onToggle,
}: {
  index: number
  set: SetEntry
  done: boolean
  weightUnit: string
  resting: boolean
  timer: RestTimer | null
  onUpdate: (patch: Partial<SetEntry>) => void
  onToggle: () => void
}) {
  const weightOver = set.weight > WEIGHT_MAX
  const repsOver = set.reps > REPS_MAX
  // P1.11 — single primary CTA per row: tap = complete. Editing is gated
  // behind an explicit pencil affordance so the row doesn't conflate two
  // actions during physical exertion. Defaults to read-only "weight × reps"
  // text; inputs only appear once the pencil is tapped. Marking the set
  // done suppresses inputs even if `editing` is still true under the hood,
  // so a completed set always returns to its calm display.
  const [editing, setEditing] = useState(false)
  const showInputs = editing && !done

  const stopBubble = (e: React.MouseEvent | React.FocusEvent | React.KeyboardEvent): void =>
    e.stopPropagation()

  const display =
    set.weight > 0 || set.reps > 0
      ? `${set.weight || 0} × ${set.reps || 0}`
      : '— × —'

  // P2.7 — rest ring pct, derived from the timer's remaining ms. Drains
  // 100→0 as the rest counts down; clamps to [0, 100].
  const restPct =
    timer && timer.total > 0
      ? Math.max(0, Math.min(100, (timer.remaining / (timer.total * 1000)) * 100))
      : 0

  return (
    <div
      className={cn(
        'fj-session-set',
        done && 'fj-session-set--done',
        showInputs && 'fj-session-set--editing',
        resting && 'fj-session-set--resting',
      )}
      role="button"
      tabIndex={0}
      aria-pressed={done}
      aria-label={
        done
          ? `Set ${index + 1} done — tap to undo`
          : resting
            ? `Resting before set ${index + 1}`
            : `Complete set ${index + 1}`
      }
      onClick={() => {
        if (showInputs) return
        onToggle()
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (showInputs) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      <div className="fj-session-set__row">
        <span className="fj-session-set__num" aria-hidden="true">
          {resting ? (
            <span className="fj-session-set__resting-label">RESTING</span>
          ) : (
            index + 1
          )}
        </span>
        {showInputs ? (
          <span className="fj-session-set__inputs">
            <input
              className="fj-input"
              type="number"
              min={0}
              max={WEIGHT_MAX}
              inputMode="decimal"
              aria-label={`Set ${index + 1} weight (${weightUnit})`}
              aria-invalid={weightOver || undefined}
              placeholder="0"
              autoFocus
              value={set.weight || ''}
              onClick={stopBubble}
              onFocus={stopBubble}
              onKeyDown={stopBubble}
              onChange={(e) =>
                onUpdate({ weight: Math.max(0, Number(e.target.value) || 0) })
              }
            />
            <span aria-hidden="true" className="fj-session-set__times">
              ×
            </span>
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
              onClick={stopBubble}
              onFocus={stopBubble}
              onKeyDown={stopBubble}
              onChange={(e) =>
                onUpdate({ reps: Math.max(0, Math.round(Number(e.target.value) || 0)) })
              }
            />
          </span>
        ) : (
          <span className="fj-session-set__display" aria-label={`${set.weight} ${weightUnit} × ${set.reps} reps`}>
            {display}
            <small className="fj-muted"> {weightUnit}</small>
          </span>
        )}
        {resting && timer ? (
          /* P2.7 — the ring sits where the pencil + check normally do; the
             rest controls (+15s, skip) tuck in on the line below so the
             card stays scannable. */
          <span className="fj-session-set__ring" aria-hidden="true">
            <ProgressRing
              pct={restPct}
              size={44}
              stroke={4}
              color="var(--color-accent)"
            >
              <span className="fj-session-set__ring-label">
                {formatTimer(timer.remaining)}
              </span>
            </ProgressRing>
          </span>
        ) : (
          <>
            <button
              type="button"
              className="fj-session-set__edit"
              aria-label={showInputs ? `Done editing set ${index + 1}` : `Edit set ${index + 1}`}
              aria-pressed={showInputs}
              onClick={(e) => {
                e.stopPropagation()
                setEditing((v) => !v)
              }}
            >
              {showInputs ? <Check size={16} /> : <Pencil size={14} />}
            </button>
            <span
              className={cn('fj-session-check', done && 'fj-session-check--done')}
              aria-hidden="true"
            >
              {done && <CheckCircle2 size={20} />}
            </span>
          </>
        )}
      </div>
      {resting && timer && (
        <div
          className="fj-session-set__rest-actions"
          /* These controls belong to the timer, not the row's complete
              gesture; their clicks must not double-fire row toggling. */
          onClick={stopBubble}
          onKeyDown={stopBubble}
        >
          <button
            type="button"
            className="fj-session-set__rest-btn"
            aria-label="Add 15 seconds to rest"
            onClick={(e) => {
              e.stopPropagation()
              timer.add(15)
            }}
          >
            <RotateCcw size={14} aria-hidden="true" /> +15s
          </button>
          <button
            type="button"
            className="fj-session-set__rest-btn"
            aria-label="Skip rest"
            onClick={(e) => {
              e.stopPropagation()
              timer.skip()
            }}
          >
            <SkipForward size={14} aria-hidden="true" /> skip rest
          </button>
        </div>
      )}
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
