import { useMemo } from 'react'
import {
  ChevronLeft,
  Dumbbell,
  History as HistoryIcon,
  LineChart,
  Target,
  Trophy,
} from 'lucide-react'
import { Button, Card, EmptyState, PageHeader, Sparkline, StatTile } from '@/components'
import { useStore } from '@/data/store-context'
import { computeExerciseHistory, computeStrengthPRs } from '@/data/logic'
import { formatShort } from '@/lib/dates'

/**
 * Per-exercise progression — top-set weight and an Epley 1RM estimate over
 * time, plus the full session history. Reachable from a Progress strength
 * row, or by deep-linking to `#/exercise/<lowercased-name>`.
 */
export function ExerciseDetailScreen() {
  const { data, viewingExerciseKey, navigate, viewWorkoutDate } = useStore()
  const key = viewingExerciseKey
  const weightUnit = data.preferences.weightUnit

  const history = useMemo(
    () => (key ? computeExerciseHistory(data.workouts, key) : []),
    [data.workouts, key],
  )
  const strengthPRs = useMemo(() => computeStrengthPRs(data.workouts), [data.workouts])

  if (!key || history.length === 0) {
    return (
      <div className="fj-screen">
        <PageHeader
          title="Exercise"
          actions={
            <Button variant="ghost" onClick={() => navigate('progress')}>
              <ChevronLeft size={16} /> Progress
            </Button>
          }
        />
        <EmptyState
          icon={<Dumbbell size={40} />}
          title="No history yet"
          description={
            key
              ? 'No logged sessions for this exercise yet — log one and it shows up here.'
              : 'Open an exercise from Progress → Exercises to see its progression.'
          }
        />
      </div>
    )
  }

  const pr = strengthPRs[key]
  const goal = data.goals[key]
  const displayName = pr?.name ?? history[history.length - 1].name
  const topSeries = history.map((h) => h.topSet)
  const oneRmSeries = history.map((h) => Math.round(h.oneRm))
  const latestOneRm = oneRmSeries[oneRmSeries.length - 1] ?? 0

  return (
    <div className="fj-screen">
      <PageHeader
        title={displayName}
        subtitle={`${history.length} session${history.length === 1 ? '' : 's'} logged`}
        actions={
          <Button variant="ghost" onClick={() => navigate('progress')}>
            <ChevronLeft size={16} /> Progress
          </Button>
        }
      />

      <div className="fj-stat-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <StatTile
          icon={<Trophy size={22} color="var(--color-warning)" />}
          value={pr ? pr.weight : '—'}
          label={`Best weight (${weightUnit})`}
        />
        <StatTile
          icon={<LineChart size={22} color="var(--color-accent)" />}
          value={latestOneRm > 0 ? latestOneRm : '—'}
          label={`Est. 1RM (${weightUnit})`}
        />
        <StatTile
          icon={<HistoryIcon size={22} color="var(--color-success)" />}
          value={history.length}
          label="Sessions"
        />
        {goal != null && (
          <StatTile
            icon={<Target size={22} color="var(--color-accent)" />}
            value={goal}
            label={`Goal (${weightUnit})`}
          />
        )}
      </div>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <LineChart size={18} /> Top-set weight
          </h2>
        </div>
        <Card>
          {topSeries.length >= 2 ? (
            <Sparkline values={topSeries} />
          ) : (
            <p className="fj-muted">Log a second session to see the trend.</p>
          )}
        </Card>
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <LineChart size={18} /> Estimated 1RM
          </h2>
        </div>
        <Card>
          {oneRmSeries.length >= 2 ? (
            <>
              <Sparkline values={oneRmSeries} stroke="var(--color-success)" />
              <p className="fj-muted" style={{ marginTop: 'var(--space-2)' }}>
                Epley estimate from the top set of each session.
              </p>
            </>
          ) : (
            <p className="fj-muted">Log a second session to see the trend.</p>
          )}
        </Card>
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <HistoryIcon size={18} /> Session history
          </h2>
        </div>
        <div className="fj-table">
          <div className="fj-table__row fj-table__head fj-ex-history__row">
            <span>Date</span>
            <span>Top set</span>
            <span>Est. 1RM</span>
            <span>Volume</span>
          </div>
          {history
            .slice()
            .reverse()
            .map((h) => (
              <div
                key={h.date}
                className="fj-table__row fj-table__row--clickable fj-ex-history__row"
                role="button"
                tabIndex={0}
                aria-label={`Open the ${formatShort(h.date)} workout`}
                onClick={() => viewWorkoutDate(h.date)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    viewWorkoutDate(h.date)
                  }
                }}
              >
                <span className="fj-muted">{formatShort(h.date)}</span>
                <span className="fj-cell-value">
                  {h.topSet} <small>×{h.topSetReps}</small>
                </span>
                <span className="fj-cell-value">{Math.round(h.oneRm)}</span>
                <span className="fj-muted">{Math.round(h.volume).toLocaleString()}</span>
              </div>
            ))}
        </div>
      </section>
    </div>
  )
}
