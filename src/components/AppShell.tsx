import {
  CalendarRange,
  Dumbbell,
  NotebookPen,
  Settings,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import type { PageId } from '@/data/types'
import { useStore } from '@/data/store-context'
import { cn } from '@/lib/cn'
import { useStreakReminder } from '@/lib/useStreakReminder'
import { TodayScreen } from '@/pages/Today'
import { ProgressScreen } from '@/pages/Progress'
import { PlanScreen } from '@/pages/Plan'
import { RecipesScreen } from '@/pages/Recipes'
import { SettingsScreen } from '@/pages/Settings'
import { SessionScreen } from '@/pages/Session'
import { ExerciseDetailScreen } from '@/pages/ExerciseDetail'

const NAV: { id: PageId; label: string; Icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', Icon: NotebookPen },
  { id: 'progress', label: 'Progress', Icon: TrendingUp },
  { id: 'plan', label: 'Plan', Icon: CalendarRange },
  { id: 'recipes', label: 'Recipes', Icon: UtensilsCrossed },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

const SCREENS: Record<PageId, ComponentType> = {
  today: TodayScreen,
  progress: ProgressScreen,
  plan: PlanScreen,
  recipes: RecipesScreen,
  settings: SettingsScreen,
  session: SessionScreen,
  exercise: ExerciseDetailScreen,
}

export function AppShell() {
  const { page, navigate } = useStore()
  const Screen = SCREENS[page]
  // P2.5 — fire the opt-in streak-save reminder at the chosen time while the
  // app is open (a PWA can't notify while fully closed without a server).
  useStreakReminder()
  // P2.1 — Train Mode takeover. The 5-tab sidebar/bottom nav steps aside
  // mid-workout so the lift list, rest ring and 2-action Pause/Finish bar
  // own the entire screen. Session renders its own bottom bar via
  // `fj-session-bottom` (see Session.tsx); the resume pill is already
  // suppressed there. The skip link still works — it focuses the main
  // landmark — so a keyboard user can still leave.
  const trainMode = page === 'session'

  return (
    <div className={cn('fj-app', trainMode && 'fj-app--trainmode')}>
      <button
        type="button"
        className="fj-skip-link"
        onClick={() => document.getElementById('fj-main')?.focus()}
      >
        Skip to content
      </button>
      {!trainMode && (
        <aside className="fj-sidebar">
          <div className="fj-sidebar__logo">
            <div className="fj-logo-mark">
              <Dumbbell size={20} />
            </div>
            <span className="fj-logo-text">FitJournal</span>
          </div>
          <nav>
            {NAV.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={cn('fj-nav__item', page === id && 'fj-nav__item--active')}
                onClick={() => navigate(id)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
        </aside>
      )}
      <main className="fj-main" id="fj-main" tabIndex={-1}>
        <Screen />
      </main>
    </div>
  )
}
