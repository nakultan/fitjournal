import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  Dumbbell,
  History as HistoryIcon,
  LineChart,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react'
import { Button, Card, EmptyState, PageHeader, Sparkline } from '@/components'
import { useStore } from '@/data/store-context'
import {
  computeExerciseHistory,
  computeGoalTrajectory,
  computeStrengthPRs,
  recommendNextSession,
} from '@/data/logic'
import { formatShort } from '@/lib/dates'
import { GoalModal } from '@/pages/Progress'

/**
 * Per-exercise progression — top-set weight and an Epley 1RM estimate over
 * time, plus the full session history. Reachable from a Progress strength
 * row, or by deep-linking to `#/exercise/<lowercased-name>`.
 */
export function ExerciseDetailScreen() {
  const { data, viewingExerciseKey, navigate, viewWorkoutDate } = useStore()
  const [goalOpen, setGoalOpen] = useState(false)
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
          title="Log it three times — we'll start projecting."
          description={
            key
              ? `Once ${key} shows up in a few sessions, the trend lines and the next-session recommendation switch on.`
              : 'Open an exercise from Progress → Records to see its progression.'
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
  const nextRec = recommendNextSession(history)
  const trajectory = goal != null ? computeGoalTrajectory(history, goal) : null

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

      {/* P1.7 — Three pills, three categories, three palettes. PR is past
          achievement (green); e1RM is a projection (blue); Goal is a future
          commitment (amber). Each pill is tappable when relevant. */}
      <div className="fj-detail-pills" aria-label="Records, projection and goal">
        <span className="fj-detail-pill fj-detail-pill--pr">
          <Trophy size={13} aria-hidden="true" />
          <span className="fj-detail-pill__cap">PR</span>
          <span className="fj-detail-pill__val">
            {pr ? `${pr.weight} ${weightUnit}` : '—'}
          </span>
        </span>
        <span className="fj-detail-pill fj-detail-pill--e1rm">
          <LineChart size={13} aria-hidden="true" />
          <span className="fj-detail-pill__cap">e1RM</span>
          <span className="fj-detail-pill__val">
            {latestOneRm > 0 ? `${latestOneRm} ${weightUnit}` : '—'}
          </span>
        </span>
        <button
          type="button"
          className="fj-detail-pill fj-detail-pill--goal fj-detail-pill--btn"
          onClick={() => setGoalOpen(true)}
          aria-label={goal != null ? `Edit goal: ${goal} ${weightUnit}` : 'Set a goal'}
        >
          <Target size={13} aria-hidden="true" />
          <span className="fj-detail-pill__cap">Goal</span>
          <span className="fj-detail-pill__val">
            {goal != null ? `${goal} ${weightUnit}` : 'Set'}
          </span>
        </button>
        <span className="fj-detail-pill fj-detail-pill--sessions">
          <HistoryIcon size={13} aria-hidden="true" />
          <span className="fj-detail-pill__cap">Sessions</span>
          <span className="fj-detail-pill__val">{history.length}</span>
        </span>
      </div>

      {/* P1.3 — Auto-bump suggestion. Quiet blue card, opt-in. */}
      {nextRec && (
        <Card className="fj-detail-rec" aria-label="Next session recommendation">
          <Sparkles size={18} color="var(--color-accent)" aria-hidden="true" />
          <div>
            <div className="fj-detail-rec__head">
              Next session — try {nextRec.sets}×{nextRec.reps} @ {nextRec.weight} {weightUnit}
            </div>
            <div className="fj-detail-rec__sub">
              {nextRec.bumped
                ? `Up 5 ${weightUnit} on your last top set — you're in rhythm.`
                : 'Repeats your last top set — bank the reps before pushing weight.'}
            </div>
          </div>
        </Card>
      )}

      {/* P1.6 — Distance-to-goal as a trajectory, not a static gap. */}
      {trajectory && (
        <Card className="fj-detail-trajectory" aria-label="Goal trajectory">
          <Target size={18} color="var(--color-warning)" aria-hidden="true" />
          <div>
            <div className="fj-detail-trajectory__head">
              {trajectory.remaining} {weightUnit} to go
              {trajectory.weeks != null && (
                <>
                  {' · '}
                  <span className="fj-detail-trajectory__weeks">
                    ~{trajectory.weeks} week{trajectory.weeks === 1 ? '' : 's'} at this pace
                  </span>
                </>
              )}
            </div>
            <div className="fj-detail-trajectory__sub">
              {trajectory.weeks != null
                ? 'Linear fit from the last eight sessions.'
                : 'Trend is flat — the next bump unlocks the projection.'}
            </div>
          </div>
        </Card>
      )}

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <LineChart size={18} /> Top-set weight
          </h2>
        </div>
        <Card>
          {topSeries.length >= 2 ? (
            <Sparkline
              values={topSeries}
              label={`Top-set weight over ${topSeries.length} sessions — ${topSeries[0]} to ${topSeries[topSeries.length - 1]} ${weightUnit}`}
            />
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
              <Sparkline
                values={oneRmSeries}
                stroke="var(--color-success)"
                label={`Estimated 1RM over ${oneRmSeries.length} sessions — ${oneRmSeries[0]} to ${oneRmSeries[oneRmSeries.length - 1]} ${weightUnit}`}
              />
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

      {goalOpen && key && (
        <GoalModal
          exerciseKey={key}
          exerciseName={displayName}
          currentBest={pr?.weight ?? 0}
          onClose={() => setGoalOpen(false)}
        />
      )}
    </div>
  )
}
