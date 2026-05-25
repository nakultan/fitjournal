import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  HeartPulse,
  Moon,
  Play,
  Plus,
  Scale,
  Sparkles,
  StickyNote,
  Sun,
  Trash2,
  Trophy,
} from 'lucide-react'
import {
  Button,
  Card,
  Chip,
  Confetti,
  ConfirmModal,
  CountUp,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  ReorderButtons,
  useToast,
} from '@/components'
import { buildLogWorkoutURL } from '@/lib/healthBridge'
import { useStore } from '@/data/store-context'
import { CARDIO_LABELS, CARDIO_TYPES, MUSCLE_GROUPS, cardioSpeedUnit } from '@/data/constants'
import {
  REPS_MAX,
  WEIGHT_MAX,
  WORKOUT_MILESTONES,
  computeSessionSummary,
  computeStreak,
  computeStrengthPRs,
  computeWeekProgress,
  exerciseKey,
  findLastTime,
  formatSets,
  isLoggedWorkout,
  topSetWeight,
  totalWorkoutsLogged,
} from '@/data/logic'
import type { StrengthPR } from '@/data/logic'
import type {
  CardioEntry,
  CardioType,
  ExerciseEntry,
  MuscleGroup,
  SetEntry,
  Workout,
} from '@/data/types'
import { addDays, dateKey, dayNameOf, formatLong, formatShort, parseKey, todayKey } from '@/lib/dates'
import { uid } from '@/lib/uid'
import { celebrate, tap } from '@/lib/feedback'

export function TodayScreen() {
  const { data, viewingDateKey, setViewingDateKey, reorderExercise } = useStore()
  const [exerciseModal, setExerciseModal] = useState<ExerciseEntry | 'new' | null>(null)
  const [cardioEdit, setCardioEdit] = useState<CardioEntry | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [cardioExpanded, setCardioExpanded] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const date = parseKey(viewingDateKey)
  const workout = data.workouts[viewingDateKey]
  const strengthPRs = useMemo(() => computeStrengthPRs(data.workouts), [data.workouts])
  const isToday = viewingDateKey === todayKey()
  const dayLogged = isLoggedWorkout(workout)
  const weightUnit = data.preferences.weightUnit
  const isFocused = data.preferences.todayLayout === 'focused'
  // In focused mode the cardio form stays hidden even when entries already exist —
  // tapping "+ Add cardio" reveals it. In classic mode it auto-expands once cardio
  // is logged, matching the original Phase-1 behavior.
  const cardioFormVisible =
    cardioExpanded || (!isFocused && !!workout && workout.cardio.length > 0)

  const shiftDate = (days: number) => setViewingDateKey(dateKey(addDays(date, days)))

  return (
    <div className="fj-screen">
      <PageHeader
        title="Today's Log"
        subtitle={isToday ? 'Log your workout, one day at a time' : 'Viewing a past day'}
        actions={
          <div className="fj-datenav">
            <button className="fj-datenav__btn" onClick={() => shiftDate(-1)} aria-label="Previous day">
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="fj-datenav__label"
              onClick={() => dateInputRef.current?.showPicker?.()}
              aria-label="Pick a date"
              aria-haspopup="dialog"
            >
              {formatLong(date)}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className="fj-datenav__date"
              value={viewingDateKey}
              max={todayKey()}
              onChange={(e) => {
                // Silent guard: never let the picker land on a future day.
                if (e.target.value && e.target.value <= todayKey()) {
                  setViewingDateKey(e.target.value)
                }
              }}
              tabIndex={-1}
              aria-hidden="true"
            />
            <button
              className="fj-datenav__btn"
              onClick={() => shiftDate(1)}
              aria-label="Next day"
              disabled={isToday}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        }
      />

      {isToday && <TodayAmbientHeader workout={workout} />}

      <WeightBanner dateKey={viewingDateKey} focused={isFocused} />

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <Activity size={18} /> Cardio
          </h2>
          {!cardioFormVisible && (
            <Button size="sm" variant="secondary" onClick={() => setCardioExpanded(true)}>
              <Plus size={14} /> Add cardio
            </Button>
          )}
        </div>
        {cardioFormVisible && <CardioForm dateKey={viewingDateKey} />}
        {workout && workout.cardio.length > 0 && (
          <div className="fj-col" style={{ marginTop: 'var(--space-3)' }}>
            {workout.cardio.map((c, idx) => (
              <CardioRow
                key={c.id}
                dateKey={viewingDateKey}
                entryId={c.id}
                index={idx}
                onEdit={setCardioEdit}
              />
            ))}
          </div>
        )}
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <Dumbbell size={18} /> Weight Lifting
          </h2>
          <div className="fj-row" style={{ gap: 'var(--space-2)' }}>
            <Button size="sm" onClick={() => setExerciseModal('new')}>
              Add exercise
            </Button>
          </div>
        </div>

        {data.templates.length > 0 && (
          <div className="fj-row" style={{ marginBottom: 'var(--space-3)' }}>
            <span className="fj-muted">Start from a template:</span>
            {data.templates.map((t) => (
              <TemplateChip key={t.id} templateId={t.id} dateKey={viewingDateKey} />
            ))}
          </div>
        )}

        {!workout || workout.exercises.length === 0 ? (
          isToday && !workout?.note && workout?.bodyWeight == null && !workout?.cardio.length ? (
            <div className="fj-today-hero">
              <BookOpen size={48} color="var(--color-text-dim)" />
              <p className="fj-today-hero__title">Today&apos;s a fresh page.</p>
              <p className="fj-today-hero__sub">Pick a template or add an exercise — the page fills in as you log.</p>
              <div className="fj-row" style={{ gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button onClick={() => setExerciseModal('new')}>
                  <Plus size={16} /> Add exercise
                </Button>
                {data.templates.length === 0 && (
                  <Button variant="secondary" onClick={() => setCardioExpanded(true)}>
                    <Activity size={16} /> Log cardio
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Dumbbell size={40} />}
              title="No exercises logged"
              description="Add an exercise or load one of your templates to get started."
            />
          )
        ) : (
          <div className="fj-table">
            {workout.exercises.map((e, idx) => {
              const top = topSetWeight(e)
              const pr = strengthPRs[exerciseKey(e.name)]
              const isPR = !!pr && top > 0 && pr.weight === top && pr.date === viewingDateKey
              const delta = computeRowDelta(e, data.workouts, viewingDateKey, weightUnit, pr)
              return (
                <div
                  key={e.id}
                  className="fj-ex-row fj-ex-row--clickable"
                  role="button"
                  tabIndex={0}
                  aria-label={`Edit ${e.name}`}
                  onClick={() => setExerciseModal(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      setExerciseModal(e)
                    }
                  }}
                >
                  <div className="fj-ex-row__main">
                    <span className="fj-cell-name">
                      {e.name}
                      <span className="fj-muscle-tag" data-muscle={e.muscle}>
                        {e.muscle}
                      </span>
                      {isPR && <Trophy size={13} color="var(--color-warning)" />}
                      {e.notes && (
                        <StickyNote size={13} color="var(--color-text-dim)" aria-label={e.notes} />
                      )}
                    </span>
                    <div className="fj-ex-row__sets">{formatSets(e.sets, weightUnit)}</div>
                  </div>
                  {delta && (
                    <span
                      className={`fj-ex-delta fj-ex-delta--${delta.tone}`}
                      aria-label={delta.aria}
                    >
                      {delta.label}
                    </span>
                  )}
                  <ReorderButtons
                    canUp={idx > 0}
                    canDown={idx < workout.exercises.length - 1}
                    onUp={() => reorderExercise(viewingDateKey, idx, idx - 1)}
                    onDown={() => reorderExercise(viewingDateKey, idx, idx + 1)}
                  />
                  <DeleteButton dateKey={viewingDateKey} kind="exercise" entry={e} index={idx} />
                </div>
              )
            })}
          </div>
        )}
      </section>

      <DayNoteSection key={viewingDateKey} dateKey={viewingDateKey} focused={isFocused} />

      {isToday && dayLogged && (
        <div className="fj-finish">
          <p className="fj-finish__hint">Done training for today?</p>
          <Button onClick={() => setSummaryOpen(true)}>
            <Sparkles size={16} /> Finish &amp; review workout
          </Button>
        </div>
      )}

      {exerciseModal && (
        <ExerciseModal
          key={exerciseModal === 'new' ? 'new' : exerciseModal.id}
          dateKey={viewingDateKey}
          editing={exerciseModal === 'new' ? null : exerciseModal}
          onClose={() => setExerciseModal(null)}
        />
      )}
      {cardioEdit && (
        <CardioModal
          key={cardioEdit.id}
          dateKey={viewingDateKey}
          entry={cardioEdit}
          onClose={() => setCardioEdit(null)}
        />
      )}
      {summaryOpen && (
        <WorkoutSummaryModal dateKey={viewingDateKey} onClose={() => setSummaryOpen(false)} />
      )}
      {isToday && workout && workout.exercises.length > 0 && (
        <TodayStartFab exercises={workout.exercises} weightUnit={weightUnit} />
      )}
    </div>
  )
}

/* ---------- Ambient header (P0.1) ----------
 * A calm, two-line replacement for the old hub dashboard. The strip carries
 * date · streak · weekly progress in monospace; the heavier title underneath
 * says what today *is* — the template name, "Rest day", or "No plan". Numbers
 * still live in full on Progress; the hub card was demoted so the lift list
 * becomes the screen.
 *
 * P1.8 — the streak number animates via CountUp on change, and a soft haptic
 * fires the first time the value increases in a session (the ratchet) so
 * earning the next day feels like something. Refs gate it so a fresh mount
 * with an already-high streak stays quiet.
 */
function TodayAmbientHeader({ workout }: { workout: Workout | undefined }) {
  const { data, savePreferences } = useStore()
  const todayK = todayKey()
  const now = useMemo(() => parseKey(todayK), [todayK])
  const dayName = dayNameOf(now)
  const plan = data.weeklyPlan[dayName]
  const hasAnyPlan = Object.keys(data.weeklyPlan).length > 0
  const hasLoggedToday = isLoggedWorkout(workout)

  const streak = useMemo(
    () => computeStreak(data.workouts, data.weeklyPlan, now),
    [data.workouts, data.weeklyPlan, now],
  )
  const week = useMemo(
    () => computeWeekProgress(data.workouts, now, data.preferences.weeklyGoal),
    [data.workouts, now, data.preferences.weeklyGoal],
  )

  // Soft haptic the first time the streak *increases* in this session —
  // the "ratchet" reward. Refs prevent firing on initial mount.
  const prevStreakRef = useRef<number | null>(null)
  const streakValue = streak.current
  useEffect(() => {
    if (prevStreakRef.current !== null && streakValue > prevStreakRef.current) {
      tap()
    }
    prevStreakRef.current = streakValue
  }, [streakValue])

  const dow = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const md = now
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase()

  const title = plan?.templateName
    ? plan.templateName
    : hasLoggedToday
      ? "Today's workout"
      : hasAnyPlan
        ? 'Rest day'
        : 'No plan'

  const isCalm = data.preferences.todayLayout === 'focused'
  const toggleCalm = (): void => {
    tap()
    savePreferences({
      ...data.preferences,
      todayLayout: isCalm ? 'classic' : 'focused',
    })
  }

  return (
    <section className="fj-today-ambient" aria-label="Today at a glance">
      <div className="fj-today-ambient__row">
        <div className="fj-today-ambient__strip">
          <span>{dow}</span>
          <span aria-hidden="true">·</span>
          <span>{md}</span>
          <span aria-hidden="true">·</span>
          <span className="fj-today-ambient__streak" aria-label={`${streak.current}-day streak`}>
            <CountUp value={streak.current} />
            <Flame size={12} aria-hidden="true" />
          </span>
          <span aria-hidden="true">·</span>
          <span aria-label={`${week.done} of ${week.goal} workouts this week`}>
            {week.done}/{week.goal} wk
          </span>
        </div>
        <button
          type="button"
          className={`fj-calm-chip${isCalm ? ' fj-calm-chip--on' : ''}`}
          onClick={toggleCalm}
          aria-pressed={isCalm}
          aria-label={isCalm ? 'Switch to classic layout' : 'Switch to calm layout'}
        >
          {isCalm ? <Moon size={13} aria-hidden="true" /> : <Sun size={13} aria-hidden="true" />}
          <span>{isCalm ? 'Calm' : 'Classic'}</span>
        </button>
      </div>
      <h2 className="fj-today-ambient__title">{title}</h2>
    </section>
  )
}

/* ---------- Sticky Start FAB (P0.2) ----------
 * Thumb-zone shortcut into the in-workout session. Sub-label trades the dense
 * "what's queued" rundown of the old hub for a single number — count + the
 * heaviest top-set you're aiming for (sourced from each exercise's last time
 * if today's weight isn't entered yet).
 */
function TodayStartFab({
  exercises,
  weightUnit,
}: {
  exercises: ExerciseEntry[]
  weightUnit: string
}) {
  const { data, startSession } = useStore()
  const todayK = todayKey()

  const count = exercises.length
  const liftWord = count === 1 ? 'LIFT' : 'LIFTS'
  const suggestedTop = useMemo(() => {
    let best = 0
    for (const e of exercises) {
      const planned = topSetWeight(e)
      if (planned > 0) {
        best = Math.max(best, planned)
        continue
      }
      const last = findLastTime(data.workouts, e.name, todayK)
      if (last) best = Math.max(best, topSetWeight(last.entry))
    }
    return best
  }, [exercises, data.workouts, todayK])
  const sub =
    suggestedTop > 0
      ? `${count} ${liftWord} · TRY ${Math.round(suggestedTop)}`
      : `${count} ${liftWord}`

  return (
    <button
      type="button"
      className="fj-start-fab"
      onClick={() => startSession()}
      aria-label={`Start session — ${count} exercise${count === 1 ? '' : 's'}${
        suggestedTop > 0 ? `, try ${Math.round(suggestedTop)} ${weightUnit}` : ''
      }`}
    >
      <span className="fj-start-fab__row">
        <Play size={18} fill="currentColor" aria-hidden="true" />
        <span className="fj-start-fab__label">Start session</span>
      </span>
      <span className="fj-start-fab__sub">{sub}</span>
    </button>
  )
}

/* ---------- Lift-row delta pill (P0.3) ----------
 * A "where am I vs last time" pill at the trailing edge of each row. PR shot
 * takes precedence (planning to exceed the standing PR), then weight gain,
 * then rep gain, then same-as-last. Returns null when there's no last time
 * to compare against, or when this entry hasn't been entered yet (top == 0).
 */
function computeRowDelta(
  entry: ExerciseEntry,
  workouts: Record<string, Workout>,
  todayK: string,
  weightUnit: string,
  pr: StrengthPR | undefined,
): { label: string; tone: 'success' | 'neutral' | 'pr'; aria: string } | null {
  const top = topSetWeight(entry)
  if (top <= 0) return null
  if (pr && pr.date !== todayK && top > pr.weight) {
    return {
      label: 'PR shot ★',
      tone: 'pr',
      aria: `Planned top set ${top} ${weightUnit} — would beat your ${pr.weight} ${weightUnit} record`,
    }
  }
  const last = findLastTime(workouts, entry.name, todayK)
  if (!last) return null
  const lastTop = topSetWeight(last.entry)
  if (lastTop <= 0) return null
  const topReps = entry.sets.reduce(
    (max, s) => (s.weight === top ? Math.max(max, s.reps) : max),
    0,
  )
  const lastTopReps = last.entry.sets.reduce(
    (max, s) => (s.weight === lastTop ? Math.max(max, s.reps) : max),
    0,
  )
  if (top > lastTop) {
    const diff = Math.round(top - lastTop)
    return {
      label: `+${diff} ${weightUnit}`,
      tone: 'success',
      aria: `Up ${diff} ${weightUnit} from last time`,
    }
  }
  if (top === lastTop && topReps > lastTopReps) {
    const diff = topReps - lastTopReps
    return {
      label: `+${diff} rep${diff === 1 ? '' : 's'}`,
      tone: 'success',
      aria: `Up ${diff} rep${diff === 1 ? '' : 's'} from last time`,
    }
  }
  if (top === lastTop && topReps === lastTopReps) {
    return { label: 'same as last', tone: 'neutral', aria: 'Same as last time' }
  }
  return null
}

/* ---------- Workout summary ---------- */
export function WorkoutSummaryModal({ dateKey: dk, onClose }: { dateKey: string; onClose: () => void }) {
  const { data } = useStore()
  const weightUnit = data.preferences.weightUnit
  const summary = useMemo(
    () =>
      computeSessionSummary(
        data.workouts,
        dk,
        weightUnit,
        data.preferences.distanceUnit,
      ),
    [data.workouts, dk, weightUnit, data.preferences.distanceUnit],
  )
  const streak = useMemo(
    () => computeStreak(data.workouts, data.weeklyPlan, parseKey(dk)),
    [data.workouts, data.weeklyPlan, dk],
  )
  const total = useMemo(() => totalWorkoutsLogged(data.workouts), [data.workouts])
  const dayWorkout = data.workouts[dk]
  const note = dayWorkout?.note
  const hasPR = summary.prs.length > 0
  const milestone = WORKOUT_MILESTONES.includes(total)
  const bigMoment = hasPR || milestone

  // A PR or milestone earns the full celebration; an everyday finish gets
  // just a quiet haptic tap, so the big moments stay meaningful.
  useEffect(() => {
    if (bigMoment) celebrate()
    else tap()
  }, [bigMoment])

  const logToHealth = (): void => {
    const url = buildLogWorkoutURL({
      date: dk,
      exerciseCount: summary.exerciseCount,
      totalSets: summary.totalSets,
      totalVolume: Math.round(summary.totalVolume),
      weightUnit,
      cardioMinutes: summary.cardioMinutes,
      ...(dayWorkout?.bodyWeight != null ? { bodyWeight: dayWorkout.bodyWeight } : {}),
    })
    location.href = url
  }

  return (
    <>
      {bigMoment && <Confetti count={72} />}
      <Modal
        open
        onClose={onClose}
        footer={
          <>
            {data.health && (
              <Button variant="secondary" onClick={logToHealth}>
                <HeartPulse size={15} /> Log to Health
              </Button>
            )}
            <Button onClick={onClose}>Done</Button>
          </>
        }
      >
        <div className="fj-summary">
          <div className="fj-summary__check">
            <CheckCircle2 size={44} />
          </div>
          <h2 className="fj-summary__title">
            {hasPR ? 'Record-breaking session!' : 'Workout complete'}
          </h2>
          <div className="fj-summary__streak">
            <Flame size={15} color="var(--color-warning)" />
            {streak.current}-day streak
          </div>

          <div className="fj-summary__stats">
            <div>
              <span className="fj-summary__num">
                <CountUp value={summary.exerciseCount} />
              </span>
              <span className="fj-summary__unit">exercises</span>
            </div>
            <div>
              <span className="fj-summary__num">
                <CountUp value={summary.totalSets} />
              </span>
              <span className="fj-summary__unit">sets</span>
            </div>
            {summary.totalVolume > 0 && (
              <div>
                <span className="fj-summary__num">
                  <CountUp value={Math.round(summary.totalVolume)} />
                </span>
                <span className="fj-summary__unit">{weightUnit} volume</span>
              </div>
            )}
            {summary.cardioCount > 0 && (
              <div>
                <span className="fj-summary__num">
                  <CountUp value={summary.cardioMinutes} />
                </span>
                <span className="fj-summary__unit">min cardio</span>
              </div>
            )}
          </div>

          {hasPR && (
            <div className="fj-summary__prs">
              <div className="fj-summary__prs-head">
                <Trophy size={15} color="var(--color-warning)" />
                {summary.prs.length === 1
                  ? 'New personal record'
                  : `${summary.prs.length} new personal records`}
              </div>
              {summary.prs.map((p, i) => (
                <div key={i} className="fj-summary__pr">
                  <span>{p.label}</span>
                  <span className="fj-summary__pr-val">{p.value}</span>
                </div>
              ))}
            </div>
          )}

          {note && (
            <blockquote className="fj-summary__note">
              <StickyNote size={15} />
              <span>{note}</span>
            </blockquote>
          )}

          {milestone && (
            <div className="fj-summary__milestone">
              🎉 That&apos;s your {total}th logged workout — a real milestone.
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

/* ---------- Body weight ---------- */
function WeightBanner({ dateKey: dk, focused }: { dateKey: string; focused: boolean }) {
  const { data, setBodyWeight } = useStore()
  const [expanded, setExpanded] = useState(false)
  const workout = data.workouts[dk]
  const bw = workout?.bodyWeight ?? null
  const date = parseKey(dk)
  const weightUnit = data.preferences.weightUnit
  // Offer to prefill from the last Apple Health sync — only when the day has
  // no logged weight and a synced body-mass value exists.
  const healthWeight = data.health?.bodyMass
  const showPrefill = bw == null && typeof healthWeight === 'number' && healthWeight > 0

  // Focused mode collapses the banner to a tappable affordance when the day
  // has nothing to show — no logged weight, no Health prefill on offer.
  const isCollapsed = focused && !expanded && bw == null && !showPrefill
  if (isCollapsed) {
    return (
      <button
        type="button"
        className="fj-add-row"
        onClick={() => setExpanded(true)}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <Scale size={16} />
        <span>+ Body weight</span>
      </button>
    )
  }

  const diff = (daysAgo: number): number | null => {
    const other = data.workouts[dateKey(addDays(date, -daysAgo))]?.bodyWeight
    if (bw == null || other == null) return null
    return Number((bw - other).toFixed(1))
  }
  const compares: { label: string; value: number | null }[] = [
    { label: 'vs Yesterday', value: diff(1) },
    { label: 'vs Last week', value: diff(7) },
  ]

  return (
    <Card className="fj-weight-banner" style={{ marginBottom: 'var(--space-6)' }}>
      <div className="fj-weight-banner__main">
        <div className="fj-weight-icon">
          <Scale size={22} />
        </div>
        <div>
          <div className="fj-muted">Body weight</div>
          <div className="fj-row" style={{ gap: 'var(--space-2)' }}>
            <input
              className="fj-weight-input"
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="—"
              value={bw ?? ''}
              onChange={(e) =>
                setBodyWeight(
                  dk,
                  e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0),
                )
              }
            />
            <span className="fj-muted">{weightUnit}</span>
          </div>
          {showPrefill && (
            <button
              type="button"
              className="fj-prefill"
              onClick={() => setBodyWeight(dk, healthWeight)}
            >
              <HeartPulse size={13} /> Apple Health · {healthWeight} {weightUnit} · use
            </button>
          )}
        </div>
      </div>
      <div className="fj-weight-compare">
        {compares.map((c) => (
          <div key={c.label} className="fj-weight-compare__item">
            <div className="fj-weight-compare__label">{c.label}</div>
            <div
              className={
                'fj-weight-compare__value ' +
                (c.value == null ? '' : c.value < 0 ? 'fj-down' : c.value > 0 ? 'fj-up' : '')
              }
            >
              {c.value == null
                ? '—'
                : `${c.value > 0 ? '+' : ''}${c.value} ${weightUnit}`}
            </div>
          </div>
        ))}
        <div className="fj-weight-compare__item">
          <div className="fj-weight-compare__label">Goal</div>
          <div className="fj-weight-compare__value">
            {data.preferences.goalWeight} {weightUnit}
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ---------- Cardio ---------- */
function CardioForm({ dateKey: dk }: { dateKey: string }) {
  const { data, addCardio } = useStore()
  const { showToast } = useToast()
  const [type, setType] = useState<CardioType>('treadmill')
  const [time, setTime] = useState('')
  const [speed, setSpeed] = useState('')
  const [calories, setCalories] = useState('')

  const submit = () => {
    if (!time && !speed && !calories) return
    const isPR = addCardio(dk, {
      id: uid(),
      type,
      time: Math.max(0, Number(time) || 0),
      speed: Math.max(0, Number(speed) || 0),
      calories: Math.max(0, Number(calories) || 0),
    })
    showToast(isPR ? `New cardio PR — ${CARDIO_LABELS[type]}` : 'Cardio added', isPR ? 'success' : 'default')
    setTime('')
    setSpeed('')
    setCalories('')
  }

  return (
    <Card>
      <CardioTypeTabs type={type} onChange={setType} />
      <div className="fj-row" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Input label="Time (min)" type="number" min={0} inputMode="decimal" placeholder="0" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Input
            label={`Speed (${cardioSpeedUnit(type, data.preferences.distanceUnit)})`}
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="0"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Input label="Calories" type="number" min={0} inputMode="decimal" placeholder="0" value={calories} onChange={(e) => setCalories(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={!time && !speed && !calories}>
          Add
        </Button>
      </div>
    </Card>
  )
}

/* ---------- Cardio type tabs (P1.10 a11y) ----------
 * Tablist semantics on a single-select toolbar so screen readers announce
 * the row as a tab group and the active tab. Arrow keys move focus AND
 * selection, matching the WAI-ARIA tablist pattern.
 */
function CardioTypeTabs({
  type,
  onChange,
}: {
  type: CardioType
  onChange: (t: CardioType) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (idx: number) => (ev: React.KeyboardEvent<HTMLButtonElement>) => {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return
    ev.preventDefault()
    const next =
      ev.key === 'ArrowRight'
        ? (idx + 1) % CARDIO_TYPES.length
        : (idx - 1 + CARDIO_TYPES.length) % CARDIO_TYPES.length
    refs.current[next]?.focus()
    onChange(CARDIO_TYPES[next])
  }
  return (
    <div className="fj-cardio-tabs" role="tablist" aria-label="Cardio type">
      {CARDIO_TYPES.map((t, i) => {
        const isActive = type === t
        return (
          <button
            key={t}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={'fj-cardio-tab' + (isActive ? ' fj-cardio-tab--active' : '')}
            onClick={() => onChange(t)}
            onKeyDown={onKey(i)}
          >
            {CARDIO_LABELS[t]}
          </button>
        )
      })}
    </div>
  )
}

function CardioRow({
  dateKey: dk,
  entryId,
  index,
  onEdit,
}: {
  dateKey: string
  entryId: string
  index: number
  onEdit: (entry: CardioEntry) => void
}) {
  const { data } = useStore()
  const entry = data.workouts[dk]?.cardio.find((c) => c.id === entryId)
  if (!entry) return null
  return (
    <Card
      className="fj-cardio-entry fj-cardio-entry--clickable"
      padded={false}
      style={{ padding: '12px 16px' }}
      role="button"
      tabIndex={0}
      aria-label={`Edit ${CARDIO_LABELS[entry.type]} cardio`}
      onClick={() => onEdit(entry)}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          onEdit(entry)
        }
      }}
    >
      <span className="fj-cardio-entry__name">{CARDIO_LABELS[entry.type]}</span>
      <div className="fj-cardio-entry__stats">
        <span className="fj-cell-value">
          {entry.time} <small>min</small>
        </span>
        <span className="fj-cell-value">
          {entry.speed} <small>{cardioSpeedUnit(entry.type, data.preferences.distanceUnit)}</small>
        </span>
        <span className="fj-cell-value">
          {entry.calories} <small>kcal</small>
        </span>
      </div>
      <DeleteButton dateKey={dk} kind="cardio" entry={entry} index={index} />
    </Card>
  )
}

/* ---------- Day note ---------- */
/**
 * Keyed by `dateKey` at the call site so the textarea remounts (with fresh
 * state) when the user navigates between days. That way each keystroke can
 * stay local — the store only sees the final value on blur — without
 * leaking one day's draft into another.
 */
function DayNoteSection({ dateKey: dk, focused }: { dateKey: string; focused: boolean }) {
  const { data, setDayNote } = useStore()
  const stored = data.workouts[dk]?.note ?? ''
  const [draft, setDraft] = useState(stored)
  const [expanded, setExpanded] = useState(false)

  // Focused mode hides the textarea until the user opts in (or a note exists).
  const isCollapsed = focused && !expanded && stored === ''
  if (isCollapsed) {
    return (
      <section className="fj-section">
        <button
          type="button"
          className="fj-add-row"
          onClick={() => setExpanded(true)}
        >
          <StickyNote size={16} />
          <span>+ Day note</span>
        </button>
      </section>
    )
  }

  return (
    <section className="fj-section">
      <div className="fj-section__head">
        <h2 className="fj-section__title">
          <StickyNote size={18} /> Day note
          <span className="fj-muted" style={{ fontWeight: 400 }}>
            · optional
          </span>
        </h2>
      </div>
      <textarea
        className="fj-input"
        rows={2}
        style={{ resize: 'vertical', width: '100%' }}
        placeholder="How did today feel? Energy, sleep, soreness…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() !== stored) setDayNote(dk, draft)
        }}
      />
    </section>
  )
}

/* ---------- Shared bits ---------- */
/** A row delete that's reversible — it fires an "Undo" toast. */
type DeleteButtonProps =
  | { dateKey: string; kind: 'exercise'; entry: ExerciseEntry; index: number }
  | { dateKey: string; kind: 'cardio'; entry: CardioEntry; index: number }

function DeleteButton(props: DeleteButtonProps) {
  const { deleteExercise, deleteCardio, restoreExercise, restoreCardio } = useStore()
  const { showToast } = useToast()

  const remove = () => {
    if (props.kind === 'exercise') {
      const { dateKey: dk, entry, index } = props
      deleteExercise(dk, entry.id)
      showToast('Exercise deleted', 'default', {
        label: 'Undo',
        onAction: () => restoreExercise(dk, entry, index),
      })
    } else {
      const { dateKey: dk, entry, index } = props
      deleteCardio(dk, entry.id)
      showToast('Cardio entry deleted', 'default', {
        label: 'Undo',
        onAction: () => restoreCardio(dk, entry, index),
      })
    }
  }

  return (
    <button
      className="fj-icon-btn fj-icon-btn--danger"
      aria-label="Delete"
      onClick={(ev) => {
        ev.stopPropagation()
        remove()
      }}
    >
      <Trash2 size={15} />
    </button>
  )
}

function TemplateChip({ templateId, dateKey: dk }: { templateId: string; dateKey: string }) {
  const { data, loadTemplateIntoDay } = useStore()
  const { showToast } = useToast()
  const template = data.templates.find((t) => t.id === templateId)
  if (!template) return null
  return (
    <Chip
      onClick={() => {
        loadTemplateIntoDay(dk, template)
        showToast(`Loaded "${template.name}"`)
      }}
    >
      {template.name}
    </Chip>
  )
}

type SetDraft = { reps: string; weight: string }

/** Stored sets → editable string rows; always yields at least one row. */
function setsToDraft(sets: SetEntry[]): SetDraft[] {
  if (sets.length === 0) return [{ reps: '', weight: '' }]
  return sets.map((s) => ({
    reps: s.reps > 0 ? String(s.reps) : '',
    weight: s.weight > 0 ? String(s.weight) : '',
  }))
}

/* ---------- Add / edit exercise modal ---------- */
export function ExerciseModal({
  dateKey: dk,
  editing,
  onClose,
}: {
  dateKey: string
  /** The entry being edited, or null to add a new one. */
  editing: ExerciseEntry | null
  onClose: () => void
}) {
  const { data, addExercise, updateExercise } = useStore()
  const { showToast } = useToast()
  const weightUnit = data.preferences.weightUnit

  const initialRows = useMemo(() => setsToDraft(editing?.sets ?? []), [editing])
  const [name, setName] = useState(editing?.name ?? '')
  const [muscle, setMuscle] = useState<MuscleGroup>(editing?.muscle ?? 'chest')
  const [rows, setRows] = useState<SetDraft[]>(initialRows)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const updateRow = (i: number, patch: Partial<SetDraft>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, { reps: '', weight: '' }])
  const removeRow = (i: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))

  const pastNames = useMemo(() => {
    const names = new Set<string>()
    for (const w of Object.values(data.workouts)) {
      for (const e of w.exercises) names.add(e.name)
    }
    return [...names].sort()
  }, [data.workouts])

  // The most recent time this exercise was logged on an earlier day.
  const lastTime = findLastTime(data.workouts, name, dk)

  const dirty =
    name !== (editing?.name ?? '') ||
    muscle !== (editing?.muscle ?? 'chest') ||
    notes !== (editing?.notes ?? '') ||
    JSON.stringify(rows) !== JSON.stringify(initialRows)

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const sets: SetEntry[] = rows.map((r) => ({
      reps: Math.max(0, Math.round(Number(r.reps) || 0)),
      weight: Math.max(0, Number(r.weight) || 0),
    }))
    const entry: ExerciseEntry = {
      id: editing?.id ?? uid(),
      name: trimmed,
      muscle,
      sets,
      notes: notes.trim() || undefined,
    }
    if (editing) {
      updateExercise(dk, entry)
      showToast('Exercise updated')
    } else {
      const isPR = addExercise(dk, entry)
      showToast(
        isPR ? `New PR — ${trimmed} ${topSetWeight(entry)} ${weightUnit}` : 'Exercise added',
        isPR ? 'success' : 'default',
      )
    }
    onClose()
  }

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        title={editing ? 'Edit exercise' : 'Add exercise'}
        footer={
          <>
            <Button variant="ghost" onClick={requestClose}>
              Cancel
            </Button>
            <Button onClick={submit}>{editing ? 'Save changes' : 'Add exercise'}</Button>
          </>
        }
      >
        <div className="fj-col" style={{ gap: 'var(--space-4)' }}>
          <div>
            <Input
              label="Exercise name"
              placeholder="e.g. Bench Press"
              list="fj-exercise-names"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <datalist id="fj-exercise-names">
              {pastNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {lastTime && (
              <p className="fj-muted" style={{ marginTop: 'var(--space-2)' }}>
                Last time ({formatShort(lastTime.date)}): {formatSets(lastTime.entry.sets, weightUnit)}
                {lastTime.entry.notes ? ` — ${lastTime.entry.notes}` : ''}
              </p>
            )}
          </div>
          <div className="fj-field">
            <label className="fj-field__label" htmlFor="fj-ex-muscle">
              Muscle group
            </label>
            <select
              id="fj-ex-muscle"
              className="fj-select"
              value={muscle}
              onChange={(e) => setMuscle(e.target.value as MuscleGroup)}
            >
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="fj-field">
            <label className="fj-field__label">Sets</label>
            <div className="fj-col" style={{ gap: 'var(--space-2)' }}>
              {rows.map((r, i) => {
                const weightNum = Number(r.weight)
                const repsNum = Number(r.reps)
                const weightOver = Number.isFinite(weightNum) && weightNum > WEIGHT_MAX
                const repsOver = Number.isFinite(repsNum) && repsNum > REPS_MAX
                return (
                  <div key={i} className="fj-col" style={{ gap: 'var(--space-1)' }}>
                    <div
                      className="fj-row"
                      style={{ gap: 'var(--space-2)', flexWrap: 'nowrap' }}
                    >
                      <span
                        className="fj-muted"
                        style={{ width: 18, textAlign: 'center', flexShrink: 0 }}
                      >
                        {i + 1}
                      </span>
                      <input
                        className="fj-input"
                        style={{ flex: 1, minWidth: 0 }}
                        type="number"
                        min={0}
                        max={WEIGHT_MAX}
                        inputMode="decimal"
                        placeholder={`Weight (${weightUnit})`}
                        aria-label={`Set ${i + 1} weight`}
                        aria-invalid={weightOver || undefined}
                        value={r.weight}
                        onChange={(e) => updateRow(i, { weight: e.target.value })}
                      />
                      <input
                        className="fj-input"
                        style={{ flex: 1, minWidth: 0 }}
                        type="number"
                        min={0}
                        max={REPS_MAX}
                        inputMode="numeric"
                        placeholder="Reps"
                        aria-label={`Set ${i + 1} reps`}
                        aria-invalid={repsOver || undefined}
                        value={r.reps}
                        onChange={(e) => updateRow(i, { reps: e.target.value })}
                      />
                      <button
                        type="button"
                        className="fj-icon-btn fj-icon-btn--danger"
                        aria-label={`Remove set ${i + 1}`}
                        disabled={rows.length === 1}
                        style={rows.length === 1 ? { opacity: 0.3 } : undefined}
                        onClick={() => removeRow(i)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {(weightOver || repsOver) && (
                      <div className="fj-input-warn" role="note" style={{ paddingLeft: 28 }}>
                        {weightOver && repsOver
                          ? `That's a lot — double-check the weight and reps.`
                          : weightOver
                            ? `That's a lot of weight — double-check.`
                            : `That's a lot of reps — double-check.`}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={addRow}
              style={{ marginTop: 'var(--space-2)' }}
            >
              <Plus size={14} /> Add set
            </Button>
          </div>
          <div className="fj-field">
            <label className="fj-field__label" htmlFor="fj-ex-notes">
              Notes (optional — shown next time you log this)
            </label>
            <textarea
              id="fj-ex-notes"
              className="fj-input"
              rows={2}
              style={{ resize: 'vertical' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmDiscard}
        title="Discard changes?"
        message="Your unsaved changes to this exercise will be lost."
        confirmLabel="Discard"
        onConfirm={() => {
          setConfirmDiscard(false)
          onClose()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  )
}

/* ---------- Edit cardio modal ---------- */
function CardioModal({
  dateKey: dk,
  entry,
  onClose,
}: {
  dateKey: string
  entry: CardioEntry
  onClose: () => void
}) {
  const { data, updateCardio } = useStore()
  const { showToast } = useToast()
  const [type, setType] = useState<CardioType>(entry.type)
  const [time, setTime] = useState(entry.time ? String(entry.time) : '')
  const [speed, setSpeed] = useState(entry.speed ? String(entry.speed) : '')
  const [calories, setCalories] = useState(entry.calories ? String(entry.calories) : '')

  const submit = () => {
    updateCardio(dk, {
      id: entry.id,
      type,
      time: Math.max(0, Number(time) || 0),
      speed: Math.max(0, Number(speed) || 0),
      calories: Math.max(0, Number(calories) || 0),
    })
    showToast('Cardio updated')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit cardio"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Save changes</Button>
        </>
      }
    >
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <CardioTypeTabs type={type} onChange={setType} />
      </div>
      <div className="fj-row" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Input label="Time (min)" type="number" min={0} inputMode="decimal" placeholder="0" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Input
            label={`Speed (${cardioSpeedUnit(type, data.preferences.distanceUnit)})`}
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="0"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Input label="Calories" type="number" min={0} inputMode="decimal" placeholder="0" value={calories} onChange={(e) => setCalories(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
