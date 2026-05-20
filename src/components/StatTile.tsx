import type { ReactNode } from 'react'

interface StatTileProps {
  icon?: ReactNode
  value: ReactNode
  label: string
}

export function StatTile({ icon, value, label }: StatTileProps) {
  return (
    <div className="fj-stat">
      {icon && <div className="fj-stat__icon">{icon}</div>}
      <div className="fj-stat__value">{value}</div>
      <div className="fj-stat__label">{label}</div>
    </div>
  )
}
