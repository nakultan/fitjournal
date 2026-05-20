import { useMemo } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Dumbbell,
  Flame,
  Lightbulb,
  Scale,
  TrendingUp,
} from 'lucide-react'
import { Card, EmptyState, PageHeader, StatTile } from '@/components'
import { useStore } from '@/data/store-context'
import {
  computeInsights,
  computeMuscleBalance,
  computeStreak,
  computeTotalStats,
  computeWeeklyStats,
} from '@/data/logic'

const TONE_ICON = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Lightbulb,
}

export function ProgressScreen() {
  const { data } = useStore()

  const { streak, stats, weekly, insights, balance } = useMemo(() => {
    const now = new Date()
    return {
      streak: computeStreak(data.workouts, now),
      stats: computeTotalStats(data.workouts, now),
      weekly: computeWeeklyStats(data.workouts, now, 8),
      insights: computeInsights(data, now),
      balance: computeMuscleBalance(data.workouts, now),
    }
  }, [data])

  const maxSets = Math.max(...weekly.map((w) => w.totalSets), 1)
  const hasWeekly = weekly.some((w) => w.workoutCount > 0)

  const muscles = Object.keys(balance).sort((a, b) => balance[b] - balance[a])
  const maxMuscle = Math.max(...Object.values(balance), 1)
  const avgMuscle = muscles.length
    ? Object.values(balance).reduce((a, b) => a + b, 0) / muscles.length
    : 0

  return (
    <div className="fj-screen">
      <PageHeader title="Progress" subtitle="Your trends over time" />

      {streak.current > 0 && (
        <Card className="fj-streak" style={{ marginBottom: 'var(--space-5)' }}>
          <Flame size={34} color="var(--color-warning)" />
          <div>
            <div className="fj-streak__count">
              {streak.current} <span>day streak</span>
            </div>
            <div className="fj-muted">Longest: {streak.longest} days</div>
          </div>
        </Card>
      )}

      <div className="fj-stat-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <StatTile
          icon={<Dumbbell size={22} color="var(--color-accent)" />}
          value={stats.totalWorkouts}
          label="Workouts (30d)"
        />
        <StatTile
          icon={<Flame size={22} color="var(--color-warning)" />}
          value={(stats.totalWorkouts / 4.3).toFixed(1)}
          label="Avg / week"
        />
        <StatTile
          icon={<TrendingUp size={22} color="var(--color-success)" />}
          value={stats.totalSets}
          label="Sets (30d)"
        />
        <StatTile
          icon={<Activity size={22} />}
          value={stats.totalCardioDistance.toFixed(1)}
          label="Distance (30d mi)"
        />
      </div>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <BarChart3 size={18} /> Weekly sets — last 8 weeks
          </h2>
        </div>
        {hasWeekly ? (
          <Card>
            <div className="fj-chart">
              {weekly.map((w) => (
                <div key={w.label} className="fj-chart__col">
                  <div
                    className="fj-chart__bar"
                    style={{ height: Math.max(6, (w.totalSets / maxSets) * 150) }}
                  />
                  <span className="fj-chart__label">{w.label}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <EmptyState
            icon={<BarChart3 size={40} />}
            title="No data yet"
            description="Log workouts to see weekly trends."
          />
        )}
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <Lightbulb size={18} /> Insights
          </h2>
        </div>
        {insights.length > 0 ? (
          insights.map((i) => {
            const Icon = TONE_ICON[i.tone]
            return (
              <div key={i.id} className={`fj-insight fj-insight--${i.tone}`}>
                <Icon size={18} />
                <span className="fj-insight__text">{i.text}</span>
              </div>
            )
          })
        ) : (
          <EmptyState
            icon={<Lightbulb size={40} />}
            title="No insights yet"
            description="Train for a few sessions and insights appear here automatically."
          />
        )}
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <Scale size={18} /> Muscle balance — last 4 weeks
          </h2>
        </div>
        {muscles.length > 0 ? (
          <Card>
            {muscles.map((m) => {
              const low = balance[m] < avgMuscle * 0.5 && muscles.length > 2
              return (
                <div key={m} className="fj-mbar">
                  <span className="fj-mbar__label">{m}</span>
                  <div className="fj-mbar__track">
                    <div
                      className={`fj-mbar__fill${low ? ' fj-mbar__fill--low' : ''}`}
                      style={{ width: `${(balance[m] / maxMuscle) * 100}%` }}
                    />
                  </div>
                  <span className="fj-mbar__value">{balance[m]} sets</span>
                </div>
              )
            })}
          </Card>
        ) : (
          <EmptyState
            icon={<Scale size={40} />}
            title="No muscle data yet"
            description="Log exercises with muscle groups to see balance."
          />
        )}
      </section>
    </div>
  )
}
