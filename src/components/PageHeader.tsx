import type { ReactNode } from 'react'
import { useStore } from '@/data/store-context'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Optional actions shown on the right, usually Buttons. */
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const { lastSavedAt } = useStore()
  return (
    <header className="fj-page-header">
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
