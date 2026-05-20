import { useMemo, useState } from 'react'
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Scale,
  StickyNote,
  Trash2,
  Trophy,
} from 'lucide-react'
import { Button, Card, Chip, EmptyState, Input, Modal, PageHeader, useToast } from '@/components'
import { useStore } from '@/data/store-context'
import { CARDIO_LABELS, CARDIO_SPEED_UNIT, CARDIO_TYPES, MUSCLE_GROUPS } from '@/data/constants'
import { computeStrengthPRs, exerciseKey } from '@/data/logic'
import type { CardioType, MuscleGroup } from '@/data/types'
import { addDays, dateKey, formatLong, parseKey, todayKey } from '@/lib/dates'
import { uid } from '@/lib/uid'

export function TodayScreen() {
  const { data, viewingDateKey, setViewingDateKey } = useStore()
  const [modalOpen, setModalOpen] = useState(false)

  const date = parseKey(viewingDateKey)
  const workout = data.workouts[viewingDateKey]
  const strengthPRs = useMemo(() => computeStrengthPRs(data.workouts), [data.workouts])
  const isToday = viewingDateKey === todayKey()

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
            <span className="fj-datenav__label">{formatLong(date)}</span>
            <button className="fj-datenav__btn" onClick={() => shiftDate(1)} aria-label="Next day">
              <ChevronRight size={18} />
            </button>
          </div>
        }
      />

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
            {workout.cardio.map((c) => (
              <CardioRow key={c.id} dateKey={viewingDateKey} entryId={c.id} />
            ))}
          </div>
        )}
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <Dumbbell size={18} /> Weight Lifting
          </h2>
          <Button size="sm" onClick={() => setModalOpen(true)}>
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
            {workout.exercises.map((e) => {
              const pr = strengthPRs[exerciseKey(e.name)]
              const isPR = !!pr && e.weight > 0 && pr.weight === e.weight && pr.date === viewingDateKey
              return (
                <div key={e.id} className="fj-table__row">
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
                    {e.weight} <small>lbs</small>
                  </span>
                  <DeleteButton dateKey={viewingDateKey} kind="exercise" entryId={e.id} />
                </div>
              )
            })}
          </div>
        )}
      </section>

      <ExerciseModal open={modalOpen} dateKey={viewingDateKey} onClose={() => setModalOpen(false)} />
    </div>
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
              inputMode="decimal"
              placeholder="—"
              value={bw ?? ''}
              onChange={(e) =>
                setBodyWeight(dk, e.target.value === '' ? null : Number(e.target.value))
              }
            />
            <span className="fj-muted">lbs</span>
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
              {c.value == null ? '—' : `${c.value > 0 ? '+' : ''}${c.value} lbs`}
            </div>
          </div>
        ))}
        <div className="fj-weight-compare__item">
          <div className="fj-weight-compare__label">Goal</div>
          <div className="fj-weight-compare__value">{data.preferences.goalWeight} lbs</div>
        </div>
      </div>
    </Card>
  )
}

/* ---------- Cardio ---------- */
function CardioForm({ dateKey: dk }: { dateKey: string }) {
  const { addCardio } = useStore()
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
      time: Number(time) || 0,
      speed: Number(speed) || 0,
      calories: Number(calories) || 0,
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
          <Input label="Time (min)" type="number" inputMode="decimal" placeholder="0" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Input
            label={`Speed (${CARDIO_SPEED_UNIT[type]})`}
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Input label="Calories" type="number" inputMode="decimal" placeholder="0" value={calories} onChange={(e) => setCalories(e.target.value)} />
        </div>
        <Button onClick={submit}>Add</Button>
      </div>
    </Card>
  )
}

function CardioRow({ dateKey: dk, entryId }: { dateKey: string; entryId: string }) {
  const { data } = useStore()
  const entry = data.workouts[dk]?.cardio.find((c) => c.id === entryId)
  if (!entry) return null
  return (
    <Card className="fj-cardio-entry" padded={false} style={{ padding: '12px 16px' }}>
      <span className="fj-cardio-entry__name">{CARDIO_LABELS[entry.type]}</span>
      <div className="fj-cardio-entry__stats">
        <span className="fj-cell-value">
          {entry.time} <small>min</small>
        </span>
        <span className="fj-cell-value">
          {entry.speed} <small>{CARDIO_SPEED_UNIT[entry.type]}</small>
        </span>
        <span className="fj-cell-value">
          {entry.calories} <small>kcal</small>
        </span>
      </div>
      <DeleteButton dateKey={dk} kind="cardio" entryId={entryId} />
    </Card>
  )
}

/* ---------- Shared bits ---------- */
function DeleteButton({
  dateKey: dk,
  kind,
  entryId,
}: {
  dateKey: string
  kind: 'exercise' | 'cardio'
  entryId: string
}) {
  const { deleteExercise, deleteCardio } = useStore()
  return (
    <button
      className="fj-icon-btn fj-icon-btn--danger"
      aria-label="Delete"
      onClick={() => (kind === 'exercise' ? deleteExercise(dk, entryId) : deleteCardio(dk, entryId))}
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

/* ---------- Add-exercise modal ---------- */
function ExerciseModal({
  open,
  dateKey: dk,
  onClose,
}: {
  open: boolean
  dateKey: string
  onClose: () => void
}) {
  const { data, addExercise } = useStore()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup>('chest')
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')

  const pastNames = useMemo(() => {
    const names = new Set<string>()
    for (const w of Object.values(data.workouts)) {
      for (const e of w.exercises) names.add(e.name)
    }
    return [...names].sort()
  }, [data.workouts])

  const lastNote = useMemo(() => {
    const key = name.trim().toLowerCase()
    if (key.length < 2) return null
    for (const dk2 of Object.keys(data.workouts).sort().reverse()) {
      for (const e of data.workouts[dk2].exercises) {
        if (e.name.toLowerCase() === key && e.notes) return e.notes
      }
    }
    return null
  }, [name, data.workouts])

  const reset = () => {
    setName('')
    setMuscle('chest')
    setSets('')
    setReps('')
    setWeight('')
    setNotes('')
  }
  const close = () => {
    reset()
    onClose()
  }
  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const w = Number(weight) || 0
    const isPR = addExercise(dk, {
      id: uid(),
      name: trimmed,
      muscle,
      sets: Number(sets) || 0,
      reps: Number(reps) || 0,
      weight: w,
      notes: notes.trim() || undefined,
    })
    showToast(
      isPR ? `New PR — ${trimmed} ${w} lbs` : 'Exercise added',
      isPR ? 'success' : 'default',
    )
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add Exercise"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit}>Add Exercise</Button>
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
          {lastNote && (
            <p className="fj-muted" style={{ marginTop: 'var(--space-2)' }}>
              Last note: {lastNote}
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
            <Input label="Sets" type="number" inputMode="numeric" placeholder="0" value={sets} onChange={(e) => setSets(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <Input label="Reps" type="number" inputMode="numeric" placeholder="0" value={reps} onChange={(e) => setReps(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <Input label="Weight (lbs)" type="number" inputMode="decimal" placeholder="0" value={weight} onChange={(e) => setWeight(e.target.value)} />
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
  )
}
