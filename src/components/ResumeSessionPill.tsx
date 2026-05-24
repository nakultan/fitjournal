import { PlayCircle } from 'lucide-react'
import { useStore } from '@/data/store-context'
import { todayKey } from '@/lib/dates'

/**
 * A small floating pill that resumes the in-workout session from any screen
 * when today already has exercises queued. Hidden on the session screen
 * itself (you can't resume what you're already in) and on Today (the Start /
 * Session button there already serves the purpose).
 */
export function ResumeSessionPill() {
  const { data, page, startSession } = useStore()
  const todayK = todayKey()
  const exercises = data.workouts[todayK]?.exercises ?? []
  if (exercises.length === 0) return null
  if (page === 'session' || page === 'today') return null

  const count = exercises.length
  return (
    <button
      type="button"
      className="fj-resume-pill"
      onClick={() => startSession()}
      aria-label={`Resume session — ${count} exercise${count === 1 ? '' : 's'} ready`}
    >
      <PlayCircle size={18} />
      <span className="fj-resume-pill__label">Resume session</span>
      <span className="fj-resume-pill__count">
        {count} <span className="fj-muted">ex.</span>
      </span>
    </button>
  )
}
