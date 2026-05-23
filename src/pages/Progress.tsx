import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  HeartPulse,
  History,
  Lightbulb,
  LineChart,
  MapPin,
  Moon,
  Scale,
  Target,
  Timer,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  ProgressRing,
  Sparkline,
  StatTile,
  useToast,
} from '@/components'
import { useStore } from '@/data/store-context'
import {
  computeCardioPRs,
  computeHeatmap,
  computeInsights,
  computeMuscleBalance,
  computePRTimeline,
  computeStreak,
  computeStrengthPRs,
  computeTotalStats,
  computeWeekProgress,
  computeWeeklyStats,
  computeWeightSeries,
  formatCardioMetric,
  isLoggedWorkout,
} from '@/data/logic'
import { CARDIO_LABELS } from '@/data/constants'
import type { CardioType, HealthData, WeightUnit } from '@/data/types'
import { cn } from '@/lib/cn'
import { formatShort, parseKey } from '@/lib/dates'

const TONE_ICON = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Lightbulb,
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'exercises', label: 'Exercises' },
  { id: 'history', label: 'History' },
] as const
type TabId = (typeof TABS)[number]['id']

const RECORD_COLS = { gridTemplateColumns: '2fr 1fr 1fr 1.4fr' }
const PAGE_SIZE = 30
const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1)

/**
 * The eight numeric metrics the Apple Health bridge can carry. A formatter
 * that does not need the weight unit just declares one parameter — JS allows
 * a function with fewer params to satisfy a signature with more.
 */
const HEALTH_FIELDS: {
  key:
    | 'steps'
    | 'activeEnergy'
    | 'exerciseMinutes'
    | 'distanceMi'
    | 'flightsClimbed'
    | 'restingHeartRate'
    | 'sleepHours'
    | 'bodyMass'
  label: string
  Icon: LucideIcon
  color?: string
  format: (n: number, weightUnit: WeightUnit) => string
}[] = [
  {
    key: 'steps',
    label: 'Steps',
    Icon: Footprints,
    color: 'var(--color-accent)',
    format: (n) => Math.round(n).toLocaleString(),
  },
  {
    key: 'activeEnergy',
    label: 'Active energy',
    Icon: Flame,
    color: 'var(--color-warning)',
    format: (n) => `${Math.round(n).toLocaleString()} cal`,
  },
  {
    key: 'exerciseMinutes',
    label: 'Exercise',
    Icon: Timer,
    color: 'var(--color-success)',
    format: (n) => `${Math.round(n)} min`,
  },
  {
    key: 'distanceMi',
    label: 'Distance',
    Icon: MapPin,
    format: (n) => `${n} mi`,
  },
  {
    key: 'flightsClimbed',
    label: 'Flights',
    Icon: TrendingUp,
    format: (n) => String(Math.round(n)),
  },
  {
    key: 'restingHeartRate',
    label: 'Resting HR',
    Icon: Heart,
    color: 'var(--color-danger)',
    format: (n) => `${Math.round(n)} bpm`,
  },
  {
    key: 'sleepHours',
    label: 'Sleep',
    Icon: Moon,
    format: (n) => `${n} h`,
  },
  {
    key: 'bodyMass',
    label: 'Body weight',
    Icon: Scale,
    format: (n, weightUnit) => `${n} ${weightUnit}`,
  },
]

function pickHealthTiles(health: HealthData, weightUnit: WeightUnit) {
  return HEALTH_FIELDS.flatMap((f) => {
    const v = health[f.key]
    if (typeof v !== 'number') return []
    return [{ key: f.key, label: f.label, Icon: f.Icon, color: f.color, value: f.format(v, weightUnit) }]
  })
}

/**
 * One retrospective screen — Overview, Exercises and History — replacing the
 * three separate tabs the audit found fragmented "how am I doing?" into.
 */
export function ProgressScreen() {
  const [tab, setTab] = useState<TabId>('overview')

  return (
    <div className="fj-screen">
      <PageHeader title="Progress" subtitle="Trends, records and history" />

      <div className="fj-segmented">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            className={cn('fj-segmented__btn', tab === t.id && 'fj-segmented__btn--active')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewSection />}
      {tab === 'exercises' && <ExercisesSection />}
      {tab === 'history' && <HistorySection />}
    </div>
  )
}

/* ---------- Overview ---------- */
function OverviewSection() {
  const { data } = useStore()

  const { streak, week, stats, weekly, insights, balance } = useMemo(() => {
    const now = new Date()
    return {
      streak: computeStreak(data.workouts, data.weeklyPlan, now),
      week: computeWeekProgress(data.workouts, now, data.preferences.weeklyGoal),
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

  const lastWeekSets = weekly[weekly.length - 2]?.totalSets ?? 0
  const trendPct =
    lastWeekSets > 0 ? Math.round(((week.totalSets - lastWeekSets) / lastWeekSets) * 100) : null

  // Keep Overview calm: at most 3 insights, no more than 2 warnings.
  const warningInsights = insights.filter((i) => i.tone === 'warning').slice(0, 2)
  const positiveInsights = insights.filter((i) => i.tone !== 'warning')
  const shownInsights = [
    ...positiveInsights.slice(0, 3 - warningInsights.length),
    ...warningInsights,
  ]

  return (
    <>
      {data.preferences.weeklySummary && (
        <Card className="fj-recap" style={{ marginBottom: 'var(--space-5)' }}>
          <ProgressRing
            pct={week.pct}
            size={88}
            stroke={9}
            color={week.done >= week.goal ? 'var(--color-success)' : 'var(--color-accent)'}
          >
            <span className="fj-hub__ringnum" style={{ fontSize: '1.1875rem' }}>
              {week.done}
              <small>/{week.goal}</small>
            </span>
          </ProgressRing>
          <div className="fj-recap__body">
            <div className="fj-recap__head">Your week so far</div>
            <div className="fj-recap__line">
              <strong>{week.done}</strong> of <strong>{week.goal}</strong> workouts logged
              {week.done >= week.goal
                ? ' — goal reached. '
                : week.remaining === 1
                  ? ' — 1 to go. '
                  : ` — ${week.remaining} to go. `}
              <strong>{week.totalSets}</strong> sets this week
              {trendPct != null && trendPct !== 0
                ? ` (${trendPct > 0 ? '+' : ''}${trendPct}% vs last week).`
                : '.'}
            </div>
          </div>
        </Card>
      )}

      {streak.current > 0 && (
        <Card className="fj-streak" style={{ marginBottom: 'var(--space-5)' }}>
          <Flame size={34} color="var(--color-warning)" />
          <div>
            <div className="fj-streak__count">
              {streak.current} <span>day streak</span>
            </div>
            <div className="fj-muted">Longest: {streak.longest} days</div>
            <div className="fj-muted" style={{ marginTop: 2 }}>
              Planned rest days, and one missed day, keep it alive.
            </div>
          </div>
        </Card>
      )}

      <WeightTrendSection />

      <HealthSection />

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
          label={`Distance (30d ${data.preferences.distanceUnit === 'km' ? 'km' : 'mi'})`}
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
        {shownInsights.length > 0 ? (
          <div role="list">
            {shownInsights.map((i) => {
              const Icon = TONE_ICON[i.tone]
              return (
                <div key={i.id} role="listitem" className={`fj-insight fj-insight--${i.tone}`}>
                  <Icon size={18} />
                  <span className="fj-insight__text">{i.text}</span>
                </div>
              )
            })}
          </div>
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
    </>
  )
}

/* ---------- Body-weight trend ---------- */
function WeightTrendSection() {
  const { data } = useStore()
  const series = useMemo(
    () => computeWeightSeries(data.workouts, new Date(), 90),
    [data.workouts],
  )
  const unit = data.preferences.weightUnit

  const head = (
    <div className="fj-section__head">
      <h2 className="fj-section__title">
        <LineChart size={18} /> Body-weight trend
      </h2>
    </div>
  )

  if (series.length < 2) {
    return (
      <section className="fj-section">
        {head}
        <EmptyState
          icon={<LineChart size={40} />}
          title="Not enough weigh-ins yet"
          description="Log your body weight on a few days and the trend appears here."
        />
      </section>
    )
  }

  const latest = series[series.length - 1]
  const first = series[0]
  const change = Number((latest.weight - first.weight).toFixed(1))

  return (
    <section className="fj-section">
      {head}
      <Card>
        <div
          className="fj-row"
          style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}
        >
          <div>
            <div
              style={{
                font: 'var(--text-title)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {latest.weight}
              <small className="fj-muted" style={{ fontSize: '0.9375rem', fontWeight: 400 }}>
                {' '}
                {unit}
              </small>
            </div>
            <div className="fj-muted" style={{ marginTop: 4 }}>
              {change > 0 ? '+' : ''}
              {change} {unit} since {formatShort(first.date)} · goal{' '}
              {data.preferences.goalWeight} {unit}
            </div>
          </div>
        </div>
        <Sparkline values={series.map((p) => p.avg)} />
      </Card>
    </section>
  )
}

/* ---------- Apple Health card ---------- */
/**
 * Render whatever Apple Health metrics are present, in a single calm card.
 * Renders nothing when no Health data has been synced.
 */
function HealthSection() {
  const { data } = useStore()
  const health = data.health
  if (!health) return null
  const tiles = pickHealthTiles(health, data.preferences.weightUnit)
  if (tiles.length === 0) return null
  return (
    <section className="fj-section">
      <div className="fj-section__head">
        <h2 className="fj-section__title">
          <HeartPulse size={18} /> Apple Health
        </h2>
      </div>
      <Card>
        <div className="fj-stat-grid">
          {tiles.map((t) => (
            <StatTile
              key={t.key}
              icon={<t.Icon size={22} color={t.color} />}
              value={t.value}
              label={t.label}
            />
          ))}
        </div>
        {health.importedAt && (
          <p className="fj-muted" style={{ marginTop: 'var(--space-3)' }}>
            Last synced {new Date(health.importedAt).toLocaleString()}
          </p>
        )}
      </Card>
    </section>
  )
}

/* ---------- Exercises (records) ---------- */
function ExercisesSection() {
  const { data, viewExercise } = useStore()
  const [goalKey, setGoalKey] = useState<string | null>(null)
  const weightUnit = data.preferences.weightUnit

  const strengthPRs = useMemo(() => computeStrengthPRs(data.workouts), [data.workouts])
  const cardioPRs = useMemo(() => computeCardioPRs(data.workouts), [data.workouts])
  const timeline = useMemo(
    () => computePRTimeline(data.workouts, weightUnit, data.preferences.distanceUnit),
    [data.workouts, weightUnit, data.preferences.distanceUnit],
  )

  const strengthKeys = Object.keys(strengthPRs)
  const cardioKeys = Object.keys(cardioPRs) as CardioType[]

  return (
    <>
      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <Dumbbell size={18} /> Strength records
          </h2>
        </div>
        {strengthKeys.length > 0 ? (
          <div className="fj-table">
            <div className="fj-table__row fj-table__head" style={RECORD_COLS}>
              <span>Exercise</span>
              <span>Best</span>
              <span>Date</span>
              <span>Goal</span>
            </div>
            {strengthKeys.map((k) => {
              const pr = strengthPRs[k]
              const goal = data.goals[k]
              const reached = goal != null && pr.weight >= goal
              return (
                <div
                  key={k}
                  className="fj-table__row fj-table__row--clickable"
                  style={RECORD_COLS}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${pr.name} progression`}
                  onClick={() => viewExercise(k)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      viewExercise(k)
                    }
                  }}
                >
                  <span className="fj-cell-name" style={{ textTransform: 'capitalize' }}>
                    {pr.name}
                  </span>
                  <span className="fj-cell-value" style={{ color: 'var(--color-success)' }}>
                    {pr.weight} <small>{weightUnit}</small>
                  </span>
                  <span className="fj-muted">{formatShort(pr.date)}</span>
                  <button
                    className="fj-cell-value"
                    style={{
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color:
                        goal == null
                          ? 'var(--color-text-dim)'
                          : reached
                            ? 'var(--color-success)'
                            : 'var(--color-accent)',
                      font: 'var(--text-caption)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setGoalKey(k)
                    }}
                  >
                    {goal == null
                      ? 'Set goal'
                      : `${goal} ${weightUnit} · ${Math.min(100, Math.round((pr.weight / goal) * 100))}%${reached ? ' ✓' : ''}`}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy size={40} />}
            title="No records yet"
            description="Log exercises with a weight and your bests appear here automatically."
          />
        )}
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <Activity size={18} /> Cardio records
          </h2>
        </div>
        {cardioKeys.length > 0 ? (
          <div className="fj-table">
            <div className="fj-table__row fj-table__head" style={RECORD_COLS}>
              <span>Type</span>
              <span>Best distance</span>
              <span>Date</span>
              <span />
            </div>
            {cardioKeys.map((k) => {
              const pr = cardioPRs[k]
              if (!pr) return null
              return (
                <div key={k} className="fj-table__row" style={RECORD_COLS}>
                  <span className="fj-cell-name">{CARDIO_LABELS[k]}</span>
                  <span className="fj-cell-value" style={{ color: 'var(--color-success)' }}>
                    {formatCardioMetric(k, pr.bestDistance, data.preferences.distanceUnit)}
                  </span>
                  <span className="fj-muted">{formatShort(pr.date)}</span>
                  <span />
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Activity size={40} />}
            title="No cardio records yet"
            description="Log cardio sessions to track your bests."
          />
        )}
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">
            <History size={18} /> PR timeline
          </h2>
        </div>
        {timeline.length > 0 ? (
          <Card>
            {timeline.slice(0, 30).map((e, i) => (
              <div
                key={`${e.date}-${e.label}-${i}`}
                className="fj-row"
                style={{
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--color-border-soft)',
                }}
              >
                <span className="fj-row" style={{ gap: 'var(--space-3)' }}>
                  <Trophy size={16} color="var(--color-warning)" />
                  <span className="fj-muted" style={{ minWidth: 64 }}>
                    {formatShort(e.date)}
                  </span>
                  <span style={{ fontSize: '0.8125rem' }}>
                    <strong>{e.label}</strong> — new {e.kind} record
                  </span>
                </span>
                <span className="fj-cell-value" style={{ color: 'var(--color-success)' }}>
                  {e.value}
                </span>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState
            icon={<History size={40} />}
            title="No PR history yet"
            description="Records you set will be listed here as you train."
          />
        )}
      </section>

      {goalKey && (
        <GoalModal
          key={goalKey}
          exerciseKey={goalKey}
          exerciseName={strengthPRs[goalKey]?.name ?? goalKey}
          currentBest={strengthPRs[goalKey]?.weight ?? 0}
          onClose={() => setGoalKey(null)}
        />
      )}
    </>
  )
}

function GoalModal({
  exerciseKey,
  exerciseName,
  currentBest,
  onClose,
}: {
  exerciseKey: string
  exerciseName: string
  currentBest: number
  onClose: () => void
}) {
  const { data, setGoal, removeGoal } = useStore()
  const { showToast } = useToast()
  const [target, setTarget] = useState(() => {
    const existing = data.goals[exerciseKey]
    return existing != null ? String(existing) : ''
  })

  const save = () => {
    const value = Number(target)
    if (!value || value <= 0) {
      showToast('Enter a weight above zero', 'warning')
      return
    }
    setGoal(exerciseKey, value)
    showToast(`Goal set — ${exerciseName} ${value} ${data.preferences.weightUnit}`, 'success')
    onClose()
  }
  const clear = () => {
    removeGoal(exerciseKey)
    showToast('Goal removed')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Goal — ${exerciseName}`}
      footer={
        <>
          {data.goals[exerciseKey] != null && (
            <Button variant="danger" onClick={clear}>
              Remove
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save goal</Button>
        </>
      }
    >
      <div className="fj-row" style={{ marginBottom: 'var(--space-3)' }}>
        <Target size={18} color="var(--color-accent)" />
        <span className="fj-muted">
          Current best: {currentBest} {data.preferences.weightUnit}
        </span>
      </div>
      <Input
        label={`Target weight (${data.preferences.weightUnit})`}
        type="number"
        inputMode="decimal"
        placeholder="0"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        autoFocus
      />
    </Modal>
  )
}

/* ---------- History ---------- */
function HistorySection() {
  const { data, viewWorkoutDate } = useStore()
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const heatmap = useMemo(() => computeHeatmap(data.workouts, new Date()), [data.workouts])

  const loggedDates = useMemo(
    () =>
      Object.keys(data.workouts)
        .filter((k) => isLoggedWorkout(data.workouts[k]))
        .sort()
        .reverse(),
    [data.workouts],
  )

  return (
    <>
      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">Activity — last 13 weeks</h2>
        </div>
        <Card>
          <div className="fj-heatmap__grid">
            {heatmap.map((cell) => (
              <div
                key={cell.dateKey}
                className="fj-heatmap__cell"
                data-level={cell.future ? 0 : cell.level}
                title={
                  formatShort(cell.dateKey) +
                  (cell.count > 0
                    ? ` — ${cell.count} ${cell.count === 1 ? 'entry' : 'entries'}`
                    : '')
                }
              />
            ))}
          </div>
          <div className="fj-heatmap__legend">
            <span>Less</span>
            <div className="fj-heatmap__cell" data-level="0" style={{ width: 12 }} />
            <div className="fj-heatmap__cell" data-level="1" style={{ width: 12 }} />
            <div className="fj-heatmap__cell" data-level="2" style={{ width: 12 }} />
            <div className="fj-heatmap__cell" data-level="3" style={{ width: 12 }} />
            <div className="fj-heatmap__cell" data-level="4" style={{ width: 12 }} />
            <span>More</span>
          </div>
        </Card>
      </section>

      <section className="fj-section">
        <div className="fj-section__head">
          <h2 className="fj-section__title">Past workouts</h2>
        </div>
        {loggedDates.length > 0 ? (
          loggedDates.slice(0, visibleCount).map((dk) => {
            const w = data.workouts[dk]
            const d = parseKey(dk)
            const muscles = [...new Set(w.exercises.map((e) => e.muscle))]
            const cardio = [...new Set(w.cardio.map((c) => CARDIO_LABELS[c.type]))]
            const cardioMin = w.cardio.reduce((s, c) => s + c.time, 0)
            const title = [...cardio, ...muscles.map(capitalize)].join(', ') || 'Workout'
            const sub = [
              w.exercises.length > 0 ? `${w.exercises.length} exercises` : '',
              cardioMin > 0 ? `${cardioMin} min cardio` : '',
              w.bodyWeight != null ? `${w.bodyWeight} ${data.preferences.weightUnit}` : '',
            ]
              .filter(Boolean)
              .join('  ·  ')
            return (
              <div
                key={dk}
                className="fj-history-item"
                role="button"
                tabIndex={0}
                aria-label={`Open workout from ${formatShort(dk)} — ${[title, sub].filter(Boolean).join(', ')}`}
                onClick={() => viewWorkoutDate(dk)}
                onKeyDown={(e) => e.key === 'Enter' && viewWorkoutDate(dk)}
              >
                <div className="fj-history-item__left">
                  <div className="fj-date-box">
                    <span className="fj-date-box__day">{d.getDate()}</span>
                    <span className="fj-date-box__month">
                      {d.toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                  <div>
                    <div className="fj-history-item__title">{title}</div>
                    <div className="fj-history-item__sub">{sub}</div>
                  </div>
                </div>
                <div className="fj-tag-row">
                  {muscles.map((m) => (
                    <span key={m} className="fj-muscle-tag" data-muscle={m}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          <EmptyState
            icon={<CalendarDays size={40} />}
            title="No workout history"
            description="Your logged workouts will appear here."
          />
        )}
        {loggedDates.length > visibleCount && (
          <div className="fj-history-more">
            <Button variant="secondary" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, loggedDates.length - visibleCount)} older
            </Button>
          </div>
        )}
      </section>
    </>
  )
}
