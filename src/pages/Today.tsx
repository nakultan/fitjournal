import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Lightbulb,
  Moon,
  PlayCircle,
  Scale,
  Sparkles,
  StickyNote,
  Trash2,
  Trophy,
} from 'lucide-react'
import {
  Button,
  Card,
  Chip,
  Confetti,
  ConfirmModal,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  ProgressRing,
  useToast,
} from '@/components'
import { useStore } from '@/data/store-context'
import { CARDIO_LABELS, CARDIO_TYPES, MUSCLE_GROUPS, cardioSpeedUnit } from '@/data/constants'
import {
  WORKOUT_MILESTONES,
  computeInsights,
  computeSessionSummary,
  computeStreak,
  computeStrengthPRs,
  computeWeekProgress,
  exerciseKey,
  isLoggedWorkout,
  totalWorkoutsLogged,
} from '@/data/logic'
import type { CardioEntry, CardioType, ExerciseEntry, MuscleGroup, Workout } from '@/data/types'
import { addDays, dateKey, dayNameOf, formatLong, formatShort, parseKey, todayKey } from '@/lib/dates'
import { uid } from '@/lib/uid'
import { celebrate, tap } from '@/lib/feedback'

export function TodayScreen() {
  const { data, viewingDateKey, setViewingDateKey } = useStore()
  const [exerciseModal, setExerciseModal] = useState<ExerciseEntry | 'new' | null>(null)
  const [cardioEdit, setCardioEdit] = useState<CardioEntry | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const date = parseKey(viewingDateKey)
  const workout = data.workouts[viewingDateKey]
  const strengthPRs = useMemo(() => computeStrengthPRs(data.workouts), [data.workouts])
  const isToday = viewingDateKey === todayKey()
  const dayLogged = isLoggedWorkout(workout)
  const weightUnit = data.preferences.weightUnit

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
            >
              {formatLong(date)}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className="fj-datenav__date"
              value={viewingDateKey}
              onChange={(e) => e.target.value && setViewingDateKey(e.target.value)}
              tabIndex={-1}
              aria-hidden="true"
            />
            <button className="fj-datenav__btn" onClick={() => shiftDate(1)} aria-label="Next day">
              <ChevronRight size={18} />
            </button>
          </div>
        }
      />

      {isToday && <TodayHub />}

      <WeightBanner dateKey={viewingDateKey} />

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <Activity size={18} /> Cardio
          </h2>
        </div>
        <CardioForm dateKey={viewingDateKey} />
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
          <Button size="sm" onClick={() => setExerciseModal('new')}>
            Add exercise
          </Button>
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
          <EmptyState
            icon={<Dumbbell size={40} />}
            title="No exercises logged"
            description="Add an exercise or load one of your templates to get started."
          />
        ) : (
          <div className="fj-table">
            <div className="fj-table__row fj-table__head">
              <span>Exercise</span>
              <span>Sets</span>
              <span>Reps</span>
              <span>Weight</span>
              <span />
            </div>
            {workout.exercises.map((e, idx) => {
              const pr = strengthPRs[exerciseKey(e.name)]
              const isPR = !!pr && e.weight > 0 && pr.weight === e.weight && pr.date === viewingDateKey
              return (
                <div
                  key={e.id}
                  className="fj-table__row fj-table__row--clickable"
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
                  <span className="fj-cell-name">
                    {e.name}
                    <span className="fj-muscle-tag" data-muscle={e.muscle}>
                      {e.muscle}
                    </span>
                    {isPR && <Trophy size={13} color="var(--color-warning)" />}
                    {e.notes && <StickyNote size={13} color="var(--color-text-dim)" aria-label={e.notes} />}
                  </span>
                  <span className="fj-cell-value">{e.sets}</span>
                  <span className="fj-cell-value">{e.reps}</span>
                  <span className="fj-cell-value">
                    {e.weight} <small>{weightUnit}</small>
                  </span>
                  <DeleteButton dateKey={viewingDateKey} kind="exercise" entry={e} index={idx} />
                </div>
              )
            })}
          </div>
        )}
      </section>

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
    </div>
  )
}

/* ---------- Today hub ---------- */
function TodayHub() {
  const { data, navigate, loadPlanIntoDay } = useStore()
  const { showToast } = useToast()
  const todayK = todayKey()

  const { streak, week, insights, dayName } = useMemo(() => {
    const now = parseKey(todayK)
    return {
      streak: computeStreak(data.workouts, data.weeklyPlan, now),
      week: computeWeekProgress(data.workouts, now, data.preferences.weeklyGoal),
      insights: computeInsights(data, now),
      dayName: dayNameOf(now),
    }
  }, [data, todayK])

  const logged = isLoggedWorkout(data.workouts[todayK])
  const plan = data.weeklyPlan[dayName]
  const isTrainingDay = !!plan && plan.exercises.length > 0
  const hasAnyPlan = Object.keys(data.weeklyPlan).length > 0
  const showReminder = data.preferences.dailyReminder && !logged && isTrainingDay

  const dayNum = Math.floor(parseKey(todayK).getTime() / 86_400_000)
  const nudge = insights.length > 0 ? insights[dayNum % insights.length] : null

  const goalReached = week.done >= week.goal
  const weekMsg = goalReached
    ? 'Weekly goal reached'
    : `${week.remaining} workout${week.remaining === 1 ? '' : 's'} to your goal`

  const startPlan = () => {
    loadPlanIntoDay(todayK, dayName)
    showToast(plan?.templateName ? `Loaded ${plan.templateName}` : "Loaded today's plan", 'success')
  }

  return (
    <Card className="fj-hub">
      {showReminder && (
        <div className="fj-hub__reminder">
          <Bell size={15} />
          Time to train — you haven&apos;t logged today&apos;s workout yet.
        </div>
      )}

      <div className="fj-hub__top">
        <div className="fj-hub__stat">
          <div className="fj-hub__flame">
            <Flame size={24} />
          </div>
          <div>
            <div className="fj-hub__big">{streak.current}</div>
            <div className="fj-hub__cap">
              day streak
              {streak.longest > streak.current
                ? ` · best ${streak.longest}`
                : streak.current > 0
                  ? ' · best yet'
                  : ''}
            </div>
          </div>
        </div>

        <div className="fj-hub__divider" />

        <div className="fj-hub__stat">
          <ProgressRing
            pct={week.pct}
            size={62}
            stroke={6}
            color={goalReached ? 'var(--color-success)' : 'var(--color-accent)'}
          >
            <span className="fj-hub__ringnum">
              {week.done}
              <small>/{week.goal}</small>
            </span>
          </ProgressRing>
          <div>
            <div className="fj-hub__cap">this week</div>
            <div className="fj-hub__sub">{weekMsg}</div>
          </div>
        </div>
      </div>

      {logged ? (
        <div className="fj-hub__plan">
          <div className="fj-hub__plan-icon">
            <CheckCircle2 size={20} />
          </div>
          <div className="fj-hub__plan-text">
            <div className="fj-hub__plan-title">Today&apos;s workout is logged</div>
            <div className="fj-hub__plan-sub">
              Nice work — review it below, or finish up when you&apos;re done.
            </div>
          </div>
        </div>
      ) : isTrainingDay ? (
        <div className="fj-hub__plan">
          <div className="fj-hub__plan-icon">
            <CalendarCheck size={20} />
          </div>
          <div className="fj-hub__plan-text">
            <div className="fj-hub__plan-title">
              Today&apos;s plan · {plan?.templateName ?? 'Custom workout'}
            </div>
            <div className="fj-hub__plan-sub">
              {plan?.exercises.length} exercise{plan?.exercises.length === 1 ? '' : 's'} ready to go
            </div>
          </div>
          <Button size="sm" onClick={startPlan}>
            <PlayCircle size={15} /> Start
          </Button>
        </div>
      ) : (
        <div className="fj-hub__plan">
          <div className="fj-hub__plan-icon fj-hub__plan-icon--rest">
            <Moon size={20} />
          </div>
          <div className="fj-hub__plan-text">
            <div className="fj-hub__plan-title">{hasAnyPlan ? 'Rest day' : 'No weekly plan yet'}</div>
            <div className="fj-hub__plan-sub">
              {hasAnyPlan
                ? streak.current > 0
                  ? 'Your streak is safe — recovery is part of the work.'
                  : 'Recover well, then come back strong.'
                : 'Set up a weekly schedule to see your plan here.'}
            </div>
          </div>
          {!hasAnyPlan && (
            <Button size="sm" variant="secondary" onClick={() => navigate('plan')}>
              Plan my week
            </Button>
          )}
        </div>
      )}

      {nudge && (
        <div className="fj-hub__nudge">
          <Lightbulb size={15} />
          <span>{nudge.text}</span>
        </div>
      )}
    </Card>
  )
}

/* ---------- Workout summary ---------- */
function WorkoutSummaryModal({ dateKey: dk, onClose }: { dateKey: string; onClose: () => void }) {
  const { data } = useStore()
  const summary = useMemo(
    () => computeSessionSummary(data.workouts, dk, data.preferences.weightUnit),
    [data.workouts, dk, data.preferences.weightUnit],
  )
  const streak = useMemo(
    () => computeStreak(data.workouts, data.weeklyPlan, parseKey(dk)),
    [data.workouts, data.weeklyPlan, dk],
  )
  const total = useMemo(() => totalWorkoutsLogged(data.workouts), [data.workouts])
  const hasPR = summary.prs.length > 0
  const milestone = WORKOUT_MILESTONES.includes(total)
  const bigMoment = hasPR || milestone

  // A PR or milestone earns the full celebration; an everyday finish gets
  // just a quiet haptic tap, so the big moments stay meaningful.
  useEffect(() => {
    if (bigMoment) celebrate()
    else tap()
  }, [bigMoment])

  return (
    <>
      {bigMoment && <Confetti count={72} />}
      <Modal open onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
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
              <span className="fj-summary__num">{summary.exerciseCount}</span>
              <span className="fj-summary__unit">exercises</span>
            </div>
            <div>
              <span className="fj-summary__num">{summary.totalSets}</span>
              <span className="fj-summary__unit">sets</span>
            </div>
            {summary.totalVolume > 0 && (
              <div>
                <span className="fj-summary__num">
                  {Math.round(summary.totalVolume).toLocaleString()}
                </span>
                <span className="fj-summary__unit">{data.preferences.weightUnit} volume</span>
              </div>
            )}
            {summary.cardioCount > 0 && (
              <div>
                <span className="fj-summary__num">{summary.cardioMinutes}</span>
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
function WeightBanner({ dateKey: dk }: { dateKey: string }) {
  const { data, setBodyWeight } = useStore()
  const workout = data.workouts[dk]
  const bw = workout?.bodyWeight ?? null
  const date = parseKey(dk)

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
            <span className="fj-muted">{data.preferences.weightUnit}</span>
          </div>
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
                : `${c.value > 0 ? '+' : ''}${c.value} ${data.preferences.weightUnit}`}
            </div>
          </div>
        ))}
        <div className="fj-weight-compare__item">
          <div className="fj-weight-compare__label">Goal</div>
          <div className="fj-weight-compare__value">
            {data.preferences.goalWeight} {data.preferences.weightUnit}
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
      <div className="fj-cardio-tabs">
        {CARDIO_TYPES.map((t) => (
          <button
            key={t}
            className={'fj-cardio-tab' + (type === t ? ' fj-cardio-tab--active' : '')}
            onClick={() => setType(t)}
          >
            {CARDIO_LABELS[t]}
          </button>
        ))}
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
        <Button onClick={submit} disabled={!time && !speed && !calories}>
          Add
        </Button>
      </div>
    </Card>
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

/** The most recent logged instance of `name`, on a day before `dk`. */
function findLastTime(
  workouts: Record<string, Workout>,
  name: string,
  dk: string,
): { entry: ExerciseEntry; date: string } | null {
  const key = name.trim().toLowerCase()
  if (key.length < 2) return null
  for (const dk2 of Object.keys(workouts).sort().reverse()) {
    if (dk2 >= dk) continue
    for (const e of workouts[dk2].exercises) {
      if (e.name.toLowerCase() === key) return { entry: e, date: dk2 }
    }
  }
  return null
}

/* ---------- Add / edit exercise modal ---------- */
function ExerciseModal({
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

  const initialWeight = editing && editing.weight > 0 ? String(editing.weight) : ''
  const [name, setName] = useState(editing?.name ?? '')
  const [muscle, setMuscle] = useState<MuscleGroup>(editing?.muscle ?? 'chest')
  const [sets, setSets] = useState(editing ? String(editing.sets) : '')
  const [reps, setReps] = useState(editing ? String(editing.reps) : '')
  const [weight, setWeight] = useState(initialWeight)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [confirmDiscard, setConfirmDiscard] = useState(false)

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
    sets !== (editing ? String(editing.sets) : '') ||
    reps !== (editing ? String(editing.reps) : '') ||
    weight !== initialWeight ||
    notes !== (editing?.notes ?? '')

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const w = Math.max(0, Number(weight) || 0)
    const entry: ExerciseEntry = {
      id: editing?.id ?? uid(),
      name: trimmed,
      muscle,
      sets: Math.max(0, Number(sets) || 0),
      reps: Math.max(0, Number(reps) || 0),
      weight: w,
      notes: notes.trim() || undefined,
    }
    if (editing) {
      updateExercise(dk, entry)
      showToast('Exercise updated')
    } else {
      const isPR = addExercise(dk, entry)
      showToast(
        isPR ? `New PR — ${trimmed} ${w} ${weightUnit}` : 'Exercise added',
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
                Last time ({formatShort(lastTime.date)}): {lastTime.entry.weight} {weightUnit} ·{' '}
                {lastTime.entry.sets} × {lastTime.entry.reps}
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
          <div className="fj-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Input label="Sets" type="number" min={0} inputMode="numeric" placeholder="0" value={sets} onChange={(e) => setSets(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Reps" type="number" min={0} inputMode="numeric" placeholder="0" value={reps} onChange={(e) => setReps(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label={`Weight (${weightUnit})`} type="number" min={0} inputMode="decimal" placeholder="0" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
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
      <div className="fj-cardio-tabs" style={{ marginBottom: 'var(--space-4)' }}>
        {CARDIO_TYPES.map((t) => (
          <button
            key={t}
            className={'fj-cardio-tab' + (type === t ? ' fj-cardio-tab--active' : '')}
            onClick={() => setType(t)}
          >
            {CARDIO_LABELS[t]}
          </button>
        ))}
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
