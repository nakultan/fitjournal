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
import { TodayScreen } from '@/pages/Today'
import { ProgressScreen } from '@/pages/Progress'
import { PlanScreen } from '@/pages/Plan'
import { RecipesScreen } from '@/pages/Recipes'
import { SettingsScreen } from '@/pages/Settings'

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
}

export function AppShell() {
  const { page, navigate } = useStore()
  const Screen = SCREENS[page]

  return (
    <div className="fj-app">
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
      <main className="fj-main">
        <Screen />
      </main>
    </div>
  )
}
