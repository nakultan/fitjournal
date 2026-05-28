import type { ReactNode } from 'react'
import { useStore } from '@/data/store-context'
import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Optional actions shown on the right, usually Buttons. */
  actions?: ReactNode
  /**
   * P3.7 — page-header rhythm. `hub` screens (Today, Progress) carry the
   * heavier display title; `tool` screens (Plan, Recipes, Settings) get a
   * lighter sub-display so the header signals the *kind* of screen, not just
   * its name. Defaults to `hub` to preserve the existing weight.
   */
  kind?: 'hub' | 'tool'
}

export function PageHeader({ title, subtitle, actions, kind = 'hub' }: PageHeaderProps) {
  const { lastSavedAt } = useStore()
  return (
    <header className={cn('fj-page-header', kind === 'tool' && 'fj-page-header--tool')}>
      <div>
        <h1 className="fj-page-header__title">{title}</h1>
        {subtitle && <p className="fj-page-header__subtitle">{subtitle}</p>}
      </div>
      <div className="fj-page-header__actions">
        <span className="fj-save-dot" aria-hidden="true">
          {lastSavedAt > 0 && <span key={lastSavedAt} className="fj-save-dot__ring" />}
        </span>
        {actions}
      </div>
    </header>
  )
}
