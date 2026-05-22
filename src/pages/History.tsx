import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader } from '@/components'
import { useStore } from '@/data/store-context'
import { computeHeatmap, isLoggedWorkout } from '@/data/logic'
import { CARDIO_LABELS } from '@/data/constants'
import { formatShort, parseKey } from '@/lib/dates'

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1)

const PAGE_SIZE = 30

export function HistoryScreen() {
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
    <div className="fj-screen">
      <PageHeader title="History" subtitle="Every past session in one place" />

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
                  (cell.count > 0 ? ` — ${cell.count} ${cell.count === 1 ? 'entry' : 'entries'}` : '')
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
    </div>
  )
}
