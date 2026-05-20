import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  /** Optional call-to-action, usually a Button. */
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="fj-empty">
      {icon && <div className="fj-empty__icon">{icon}</div>}
      <div className="fj-empty__title">{title}</div>
      {description && <p className="fj-empty__desc">{description}</p>}
      {action && <div className="fj-empty__action">{action}</div>}
    </div>
  )
}
