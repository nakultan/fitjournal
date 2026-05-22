import { useState } from 'react'
import { CalendarRange, LayoutGrid, Plus, Trash2 } from 'lucide-react'
import { Button, Card, ConfirmModal, Input, Modal, PageHeader, useToast } from '@/components'
import { useStore } from '@/data/store-context'
import { MUSCLE_GROUPS } from '@/data/constants'
import { DAY_NAMES } from '@/lib/dates'
import { uid } from '@/lib/uid'
import type { MuscleGroup, TemplateExercise } from '@/data/types'

export function PlanScreen() {
  const { data, assignPlanDay, removePlanExercise } = useStore()
  const [templateModal, setTemplateModal] = useState<{ id: string | null } | null>(null)

  const dayOptions = [
    { value: '', label: 'Rest day' },
    ...data.templates.map((t) => ({ value: t.id, label: t.name })),
  ]

  return (
    <div className="fj-screen">
      <PageHeader title="Plan" subtitle="Your workout templates and weekly schedule" />

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <LayoutGrid size={18} /> Templates
          </h2>
        </div>
        <div className="fj-card-grid">
          {data.templates.map((t) => (
            <Card
              key={t.id}
              className="fj-template-card"
              onClick={() => setTemplateModal({ id: t.id })}
            >
              <div className="fj-template-card__title">{t.name}</div>
              <div className="fj-template-card__sub">{t.subtitle || '—'}</div>
              <div className="fj-template-card__ex">
                {t.exercises.slice(0, 6).map((e, i) => (
                  <div key={i}>
                    {e.name} — {e.sets}×{e.reps}
                  </div>
                ))}
              </div>
            </Card>
          ))}
          <button className="fj-add-card" onClick={() => setTemplateModal({ id: null })}>
            <Plus size={28} />
            Create template
          </button>
        </div>
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <CalendarRange size={18} /> Weekly schedule
          </h2>
        </div>
        {DAY_NAMES.map((day) => {
          const plan = data.weeklyPlan[day]
          return (
            <div key={day} className="fj-plan-day">
              <div className="fj-plan-day__head">
                <span className="fj-plan-day__name">{day}</span>
                <select
                  className="fj-select"
                  style={{ width: 184 }}
                  value={plan?.templateId ?? ''}
                  onChange={(e) => assignPlanDay(day, e.target.value || null)}
                >
                  {dayOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {plan && plan.exercises.length > 0 ? (
                <div className="fj-plan-day__body">
                  {plan.exercises.map((e, i) => (
                    <div key={i} className="fj-plan-ex">
                      <span className="fj-plan-ex__name">{e.name}</span>
                      <span className="fj-muted">
                        {e.sets}×{e.reps} · {e.muscle}
                      </span>
                      <button
                        className="fj-icon-btn fj-icon-btn--danger"
                        aria-label="Remove exercise"
                        onClick={() => removePlanExercise(day, i)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="fj-plan-rest">Rest day</div>
              )}
            </div>
          )
        })}
      </section>

      {templateModal && (
        <TemplateModal
          key={templateModal.id ?? 'new'}
          templateId={templateModal.id}
          onClose={() => setTemplateModal(null)}
        />
      )}
    </div>
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
  const { data, saveTemplate, deleteTemplate } = useStore()
  const { showToast } = useToast()
  const existing = templateId ? (data.templates.find((t) => t.id === templateId) ?? null) : null

  const [name, setName] = useState(existing?.name ?? '')
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? '')
  const [rows, setRows] = useState<TemplateExercise[]>(
    existing ? existing.exercises.map((e) => ({ ...e })) : [emptyRow()],
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const updateRow = (i: number, patch: Partial<TemplateExercise>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

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
      exercises: rows
        .filter((r) => r.name.trim())
        .map((r) => ({ name: r.name.trim(), muscle: r.muscle, sets: r.sets, reps: r.reps })),
    })
    showToast(existing ? 'Template updated' : 'Template created', 'success')
    onClose()
  }

  const remove = () => {
    if (existing) {
      deleteTemplate(existing.id)
      showToast('Template deleted')
    }
    onClose()
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
        <div className="fj-field">
          <label className="fj-field__label">Exercises</label>
          <div className="fj-col" style={{ gap: 'var(--space-2)' }}>
            {rows.map((r, i) => (
              <div key={i} className="fj-row" style={{ gap: 'var(--space-2)', flexWrap: 'nowrap' }}>
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
