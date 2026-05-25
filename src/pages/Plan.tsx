import { useState } from 'react'
import { CalendarDays, Check, Moon, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  ConfirmModal,
  Input,
  Modal,
  PageHeader,
  ReorderButtons,
  useToast,
} from '@/components'
import { useStore } from '@/data/store-context'
import { MUSCLE_GROUPS } from '@/data/constants'
import { seedPushPullLegs } from '@/data/storage'
import { addDays, dateKey, dayNameOf, todayKey } from '@/lib/dates'
import { uid } from '@/lib/uid'
import type {
  DayName,
  MuscleGroup,
  TemplateColor,
  TemplateExercise,
} from '@/data/types'

const TEMPLATE_COLORS: TemplateColor[] = ['red', 'blue', 'green', 'amber', 'neutral']
const COLOR_LABELS: Record<TemplateColor, string> = {
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
  amber: 'Amber',
  neutral: 'Neutral',
}

export function PlanScreen() {
  const { data, assignPlanDay, saveTemplate, viewWorkoutDate } = useStore()
  const { showToast } = useToast()
  const [templateModal, setTemplateModal] = useState<{ id: string | null } | null>(null)
  const [assigning, setAssigning] = useState<DayName | null>(null)

  const startWithPPL = (): void => {
    for (const t of seedPushPullLegs()) saveTemplate(t)
    showToast('Push, Pull, Legs added — assign them to your week.', 'success')
  }

  // P2.3 — "Next 7 days from today" rotation. Same weeklyPlan model, just
  // re-anchored: today is row 1, tomorrow row 2, … The underlying plan is
  // still keyed by weekday name, so a Mon/Wed/Fri schedule stays Mon/Wed/Fri
  // regardless of which day "row 1" lands on.
  const todayK = todayKey()
  const today = new Date()
  const next7 = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i)
    return { date: d, key: dateKey(d), day: dayNameOf(d), isToday: i === 0 }
  })

  return (
    <div className="fj-screen">
      <PageHeader title="Plan" subtitle="Your templates and the next 7 days" />

      {data.templates.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={40} />}
          title="You haven't planned a week yet."
          description="Templates are reusable workout blueprints — start from Push / Pull / Legs, or build your own."
          action={
            <div className="fj-row" style={{ gap: 'var(--space-2)', justifyContent: 'center' }}>
              <Button onClick={startWithPPL}>
                <Plus size={16} /> Start with PPL
              </Button>
              <Button variant="secondary" onClick={() => setTemplateModal({ id: null })}>
                Custom
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* P2.8 — collapsed template chip strip, one swatch per template.
              The repeat-use surface is the schedule below; templates compress
              to a header row so they don't dominate. Tap a chip to edit it
              (the modal carries delete + the colour picker); "+ new" opens
              a blank template modal. */}
          <div className="fj-template-strip" role="toolbar" aria-label="Templates">
            {data.templates.map((t) => {
              const color: TemplateColor = t.color ?? 'neutral'
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`fj-template-chip fj-template-chip--${color}`}
                  onClick={() => setTemplateModal({ id: t.id })}
                  aria-label={`Edit template ${t.name}`}
                >
                  <span className="fj-template-chip__dot" aria-hidden="true" />
                  <span>{t.name}</span>
                </button>
              )
            })}
            <button
              type="button"
              className="fj-template-chip fj-template-chip--new"
              onClick={() => setTemplateModal({ id: null })}
              aria-label="Create a new template"
            >
              <Plus size={13} /> new
            </button>
          </div>

          <section className="fj-section">
            <div className="fj-section__head">
              <h2 className="fj-section__title fj-section__title--label">
                Week from today
              </h2>
            </div>
            {next7.map(({ date, key, day, isToday }) => {
              const plan = data.weeklyPlan[day]
              const template = plan?.templateId
                ? data.templates.find((t) => t.id === plan.templateId)
                : null
              const color: TemplateColor = template?.color ?? 'neutral'
              const label = plan?.templateName ?? 'Rest day'
              const isRest = !plan
              const dow = date
                .toLocaleDateString('en-US', { weekday: 'short' })
                .toUpperCase()
              return (
                <Card
                  key={key}
                  padded={false}
                  className={`fj-plan-day${isToday ? ' fj-plan-day--today' : ''}`}
                >
                  <button
                    type="button"
                    className="fj-plan-day__head"
                    onClick={() => setAssigning(day)}
                    aria-label={`${isToday ? 'Today' : day} — currently ${label}. Tap to change.`}
                  >
                    <span className="fj-plan-day__name">
                      {isToday ? (
                        <>
                          <span className="fj-plan-day__today-tag">TODAY</span>
                          <span aria-hidden="true"> · </span>
                          {dow}
                        </>
                      ) : (
                        <>
                          {dow}
                          <span className="fj-plan-day__date">
                            {' '}
                            {date.getDate()}
                          </span>
                        </>
                      )}
                    </span>
                    <span
                      className={
                        'fj-plan-day__assign' +
                        (isRest ? ' fj-plan-day__assign--rest' : '')
                      }
                    >
                      {isRest ? (
                        <Moon size={14} aria-hidden="true" />
                      ) : (
                        <span
                          className={`fj-plan-chip-dot fj-plan-chip-dot--${color}`}
                          aria-hidden="true"
                        />
                      )}
                      <span className="fj-plan-day__assign-text">{label}</span>
                      <Pencil size={14} aria-hidden="true" className="fj-plan-day__pencil" />
                    </span>
                  </button>
                  {isToday && plan && (
                    <div className="fj-plan-day__start">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => viewWorkoutDate(todayK)}
                      >
                        <Play size={14} /> Start
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })}
          </section>
        </>
      )}

      {templateModal && (
        <TemplateModal
          key={templateModal.id ?? 'new'}
          templateId={templateModal.id}
          onClose={() => setTemplateModal(null)}
        />
      )}
      {assigning && (
        <AssignDaySheet
          day={assigning}
          currentTemplateId={data.weeklyPlan[assigning]?.templateId ?? null}
          onPick={(templateId) => {
            assignPlanDay(assigning, templateId)
            setAssigning(null)
          }}
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  )
}

/**
 * Bottom-sheet picker for assigning a template (or rest) to a weekday. On
 * mobile this avoids the iOS native select picker — the heaviest
 * interaction in the old design — in favor of a quick tappable list.
 */
function AssignDaySheet({
  day,
  currentTemplateId,
  onPick,
  onClose,
}: {
  day: DayName
  currentTemplateId: string | null
  onPick: (templateId: string | null) => void
  onClose: () => void
}) {
  const { data } = useStore()
  // Render the day's label as "Today" when this assign sheet belongs to the
  // current calendar day, so the rotation framing is consistent.
  const today = new Date()
  const isToday = dayNameOf(today) === day
  const heading = isToday ? `Assign Today (${day})` : `Assign ${day}`
  const choices: { id: string | null; label: string; sub: string; color?: TemplateColor }[] = [
    { id: null, label: 'Rest day', sub: 'No workout planned' },
    ...data.templates.map((t) => ({
      id: t.id,
      label: t.name,
      sub: t.subtitle || `${t.exercises.length} exercise${t.exercises.length === 1 ? '' : 's'}`,
      color: t.color ?? 'neutral',
    })),
  ]
  return (
    <Modal open onClose={onClose} title={heading}>
      <div className="fj-col" style={{ gap: 'var(--space-2)' }}>
        {choices.map((c) => {
          const selected = c.id === currentTemplateId
          return (
            <button
              key={c.id ?? '__rest'}
              type="button"
              className={'fj-assign-choice' + (selected ? ' fj-assign-choice--on' : '')}
              onClick={() => onPick(c.id)}
            >
              <span className="fj-assign-choice__main">
                <span className="fj-assign-choice__label">
                  {c.color && (
                    <span
                      className={`fj-plan-chip-dot fj-plan-chip-dot--${c.color}`}
                      aria-hidden="true"
                      style={{ marginRight: 6 }}
                    />
                  )}
                  {c.label}
                </span>
                <span className="fj-assign-choice__sub">{c.sub}</span>
              </span>
              {selected && <Check size={18} color="var(--color-accent)" />}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

function emptyRow(): TemplateExercise {
  return { name: '', muscle: 'chest', sets: 3, reps: 10 }
}

function TemplateModal({
  templateId,
  onClose,
}: {
  templateId: string | null
  onClose: () => void
}) {
  const { data, saveTemplate, deleteTemplate, restoreTemplate } = useStore()
  const { showToast } = useToast()
  const existing = templateId ? (data.templates.find((t) => t.id === templateId) ?? null) : null

  const [name, setName] = useState(existing?.name ?? '')
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? '')
  const [color, setColor] = useState<TemplateColor>(existing?.color ?? 'neutral')
  const [rows, setRows] = useState<TemplateExercise[]>(
    existing ? existing.exercises.map((e) => ({ ...e })) : [emptyRow()],
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const updateRow = (i: number, patch: Partial<TemplateExercise>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const moveRow = (from: number, to: number) =>
    setRows((rs) => {
      if (to < 0 || to >= rs.length) return rs
      const next = [...rs]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      showToast('Give the template a name', 'warning')
      return
    }
    saveTemplate({
      id: existing?.id ?? uid(),
      name: trimmed,
      subtitle: subtitle.trim(),
      color,
      exercises: rows
        .filter((r) => r.name.trim())
        .map((r) => ({ name: r.name.trim(), muscle: r.muscle, sets: r.sets, reps: r.reps })),
    })
    showToast(existing ? 'Template updated' : 'Template created', 'success')
    onClose()
  }

  const remove = () => {
    if (existing) {
      const index = data.templates.findIndex((t) => t.id === existing.id)
      deleteTemplate(existing.id)
      onClose()
      showToast('Template deleted', 'default', {
        label: 'Undo',
        onAction: () => restoreTemplate(existing, index),
      })
    } else {
      onClose()
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? 'Edit template' : 'Create template'}
      footer={
        <>
          {existing && (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save template</Button>
        </>
      }
    >
      <div className="fj-col" style={{ gap: 'var(--space-4)' }}>
        <Input
          label="Template name"
          placeholder="e.g. Push Day"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Input
          label="Subtitle"
          placeholder="e.g. Chest, Shoulders, Triceps"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
        />
        {/* P2.8 — colour swatch picker. Same five-colour palette the chip
            strip and Plan day-row dots render from. */}
        <div className="fj-field">
          <label className="fj-field__label">Colour</label>
          <div className="fj-row" role="radiogroup" aria-label="Template colour">
            {TEMPLATE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={COLOR_LABELS[c]}
                className={
                  `fj-color-swatch fj-color-swatch--${c}` +
                  (color === c ? ' fj-color-swatch--on' : '')
                }
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div className="fj-field">
          <label className="fj-field__label">Exercises</label>
          <div className="fj-col" style={{ gap: 'var(--space-2)' }}>
            {rows.map((r, i) => (
              <div key={i} className="fj-row" style={{ gap: 'var(--space-2)', flexWrap: 'nowrap' }}>
                <ReorderButtons
                  canUp={i > 0}
                  canDown={i < rows.length - 1}
                  onUp={() => moveRow(i, i - 1)}
                  onDown={() => moveRow(i, i + 1)}
                />
                <input
                  className="fj-input"
                  style={{ flex: 2 }}
                  placeholder="Exercise"
                  value={r.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                />
                <select
                  className="fj-select"
                  style={{ flex: 1 }}
                  value={r.muscle}
                  onChange={(e) => updateRow(i, { muscle: e.target.value as MuscleGroup })}
                >
                  {MUSCLE_GROUPS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  className="fj-input"
                  style={{ width: 58 }}
                  type="number"
                  min={0}
                  aria-label="Sets"
                  value={r.sets}
                  onChange={(e) => updateRow(i, { sets: Math.max(0, Number(e.target.value) || 0) })}
                />
                <input
                  className="fj-input"
                  style={{ width: 58 }}
                  type="number"
                  min={0}
                  aria-label="Reps"
                  value={r.reps}
                  onChange={(e) => updateRow(i, { reps: Math.max(0, Number(e.target.value) || 0) })}
                />
                <button
                  className="fj-icon-btn fj-icon-btn--danger"
                  aria-label="Remove row"
                  onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRows((rs) => [...rs, emptyRow()])}
            style={{ marginTop: 'var(--space-2)' }}
          >
            <Plus size={14} /> Add exercise
          </Button>
        </div>
      </div>
      {existing && (
        <ConfirmModal
          open={confirmingDelete}
          title="Delete this template?"
          message={`"${existing.name}" will be removed. Workouts you've already logged from it stay in your history.`}
          onConfirm={remove}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </Modal>
  )
}
