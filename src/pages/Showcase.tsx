import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  CalendarDays,
  Dumbbell,
  Flame,
  Plus,
  Scale,
  Settings,
  TrendingUp,
  Trophy,
  UtensilsCrossed,
} from 'lucide-react'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatTile,
  Toggle,
  useToast,
} from '@/components'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'cardio', label: 'Cardio' },
]

// The Lucide icons FitJournal's features will use in Phase 2.
const ICONS = [
  { Icon: Dumbbell, name: 'Workouts' },
  { Icon: Activity, name: 'Cardio' },
  { Icon: TrendingUp, name: 'Progress' },
  { Icon: Trophy, name: 'Records' },
  { Icon: CalendarDays, name: 'History' },
  { Icon: Scale, name: 'Weight' },
  { Icon: UtensilsCrossed, name: 'Recipes' },
  { Icon: Settings, name: 'Settings' },
]

const COLUMN = { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' } as const

/**
 * Phase 1 deliverable — a living catalogue of every core component and token.
 * It exists so we can see the design system in one place; Phase 2 replaces it
 * with the real FitJournal screens.
 */
export function Showcase() {
  const { showToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [reminders, setReminders] = useState(true)
  const [weeklySummary, setWeeklySummary] = useState(false)
  const [filter, setFilter] = useState('all')

  return (
    <div className="fj-showcase">
      <PageHeader
        title="FitJournal"
        subtitle="Phase 1 — design system & app foundations. Real screens arrive in Phase 2."
        actions={<Button onClick={() => showToast('Saved successfully', 'success')}>Save</Button>}
      />

      <Section label="Buttons">
        <div className="fj-showcase__row">
          <Button>
            <Plus size={16} /> Add exercise
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section label="Icons (Lucide)">
        <Card>
          <div className="fj-showcase__row" style={{ gap: 'var(--space-5)' }}>
            {ICONS.map(({ Icon, name }) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                }}
              >
                <Icon />
                <span style={{ font: 'var(--text-micro)', color: 'var(--color-text-dim)' }}>
                  {name}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section label="Stat tiles">
        <div className="fj-showcase__grid">
          <StatTile icon={<Flame color="var(--color-warning)" />} value="12" label="Day streak" />
          <StatTile
            icon={<Dumbbell color="var(--color-accent)" />}
            value="48"
            label="Workouts"
          />
          <StatTile
            icon={<TrendingUp color="var(--color-success)" />}
            value="1,240"
            label="Total sets"
          />
          <StatTile icon={<Scale />} value="178.4" label="Weight (lbs)" />
        </div>
      </Section>

      <Section label="Form fields">
        <Card>
          <div style={{ ...COLUMN, gap: 'var(--space-4)' }}>
            <Input label="Exercise name" placeholder="e.g. Bench Press" />
            <Input label="Weight" placeholder="0" hint="Pounds" />
            <Input label="Reps" placeholder="0" error="Enter a number greater than zero" />
            <Select
              label="Muscle group"
              options={[
                { value: 'chest', label: 'Chest' },
                { value: 'back', label: 'Back' },
                { value: 'legs', label: 'Legs' },
              ]}
            />
          </div>
        </Card>
      </Section>

      <Section label="Toggles">
        <Card>
          <div style={COLUMN}>
            <Toggle label="Daily reminder" checked={reminders} onChange={setReminders} />
            <Toggle label="Weekly summary" checked={weeklySummary} onChange={setWeeklySummary} />
          </div>
        </Card>
      </Section>

      <Section label="Chips">
        <div className="fj-showcase__row">
          {FILTERS.map((f) => (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Empty state">
        <EmptyState
          icon={<Trophy size={40} />}
          title="No records yet"
          description="Log a few workouts and your personal bests show up here automatically."
          action={<Button size="sm">Log a workout</Button>}
        />
      </Section>

      <Section label="Modal & toasts">
        <div className="fj-showcase__row">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
          <Button variant="secondary" onClick={() => showToast('Exercise added')}>
            Show toast
          </Button>
          <Button
            variant="secondary"
            onClick={() => showToast('Heads up — leg day skipped', 'warning')}
          >
            Warning toast
          </Button>
        </div>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Exercise"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false)
                showToast('Exercise added', 'success')
              }}
            >
              Add
            </Button>
          </>
        }
      >
        This is the Modal component. Press Escape or click outside to close it.
      </Modal>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="fj-showcase__section">
      <div className="fj-showcase__section-label">{label}</div>
      {children}
    </section>
  )
}
